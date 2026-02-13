import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { sql } from "@/lib/dbconnect";
import { sendEmailDetailed, createEmailTemplate } from "@/lib/email";
import {
  EMAIL_LOG_STATUS,
  EMAIL_TRIGGERED_BY,
  insertEmailLog,
} from "@/lib/emailLogs";
import { EMAIL_ACTION_TYPE } from "@/lib/emailTemplates";
import { generateEasyPassword } from "@/lib/passwordUtils";
import { hashPassword } from "@/auth/credentials";

type Body = {
  alumniId: number;
};

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!canModify(session.user)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const alumniId = Number(body.alumniId);
    if (!Number.isFinite(alumniId) || alumniId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid alumniId" }, { status: 400 });
    }

    const rows = await sql/* sql */`
      SELECT alumniid, sapid, registrationno, alumniname,
             personalemail, officialemail, universityemail, alumniemail
      FROM public.tbl_alumni
      WHERE alumniid = ${alumniId}
      LIMIT 1
    `;

    const row = rows?.[0] as
      | {
          alumniid: number;
          sapid: string | null;
          registrationno: string | null;
          alumniname: string | null;
          personalemail: string | null;
          officialemail: string | null;
          universityemail: string | null;
          alumniemail: string | null;
        }
      | undefined;

    if (!row) {
      return NextResponse.json({ ok: false, error: "Alumni not found" }, { status: 404 });
    }

    const recipientEmail = String(row.personalemail || row.officialemail || row.universityemail || row.alumniemail || "").trim();
    if (!recipientEmail || !recipientEmail.includes("@")) {
      return NextResponse.json({ ok: false, error: "No recipient email found" }, { status: 400 });
    }

    const tempPassword = generateEasyPassword();
    const hashed = await hashPassword(tempPassword);

    await sql/* sql */`
      UPDATE public.tbl_alumni
      SET password = ${hashed}
      WHERE alumniid = ${alumniId}
    `;

    const alumniName = String(row.alumniname || "Alumni");
    const subject = "Your Alumni Portal Credentials";

    const bodyHtml = `
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Your Alumni Portal credentials have been generated. Please use the details below to log in.</p>
      <div style="margin: 16px 0; padding: 14px; border: 1px solid #e5e7eb; border-radius: 10px; background: #f9fafb;">
        <p style="margin: 0; font-size: 14px;"><strong>SAPID:</strong> ${row.sapid ?? "-"}</p>
        <p style="margin: 6px 0 0 0; font-size: 14px;"><strong>Registration No:</strong> ${row.registrationno ?? "-"}</p>
        <p style="margin: 6px 0 0 0; font-size: 14px;"><strong>Temporary Password:</strong> ${tempPassword}</p>
      </div>
      <p style="margin: 0; color: #333333; font-size: 14px;">For security, please change your password after logging in.</p>
    `;

    const html = createEmailTemplate(subject, `Dear ${alumniName},`, bodyHtml, "Regards,<br>Office of Alumni Relations");

    const sendRes = await sendEmailDetailed({
      to: recipientEmail,
      subject,
      html,
    });

    await insertEmailLog({
      recipientEmail,
      alumniId,
      subject,
      body: html,
      status: sendRes.ok ? EMAIL_LOG_STATUS.SENT : EMAIL_LOG_STATUS.FAILED,
      errorMessage: sendRes.ok ? null : sendRes.errorMessage ?? "Unknown error",
      triggeredBy: EMAIL_TRIGGERED_BY.ADMIN_ACTION,
      actionType: EMAIL_ACTION_TYPE.ALUMNI_SEND_CREDENTIALS,
    });

    return NextResponse.json({ ok: sendRes.ok, error: sendRes.ok ? undefined : sendRes.errorMessage }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send credentials";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
