import { NextRequest, NextResponse } from "next/server";
 
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { sql } from "@/lib/dbconnect";
import { sendEmailDetailed } from "@/lib/email";
import {
  EMAIL_ACTION_TYPE,
  generateAdminActionEmail,
} from "@/lib/emailTemplates";
import {
  EMAIL_LOG_STATUS,
  EMAIL_TRIGGERED_BY,
  insertEmailLog,
} from "@/lib/emailLogs";

type SendCredentialsBody = {
  alumniId: number;
};

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload = (await req.json().catch(() => null)) as Partial<SendCredentialsBody> | null;
    const alumniId = Number(payload?.alumniId);
    if (!Number.isFinite(alumniId) || alumniId <= 0) {
      return NextResponse.json({ error: "Invalid alumniId" }, { status: 400 });
    }

    const rows = await sql/* sql */`
      SELECT alumniid, alumniname, personalemail, officialemail, sapid, registrationno, password
      FROM public.tbl_alumni
      WHERE alumniid = ${alumniId}
      LIMIT 1
    `;

    const alumni = rows[0] as
      | {
          alumniid: number;
          alumniname: string | null;
          personalemail: string | null;
          officialemail: string | null;
          sapid: string | null;
          registrationno: string | null;
          password: string | null;
        }
      | undefined;

    if (!alumni) {
      return NextResponse.json({ error: "Alumni not found" }, { status: 404 });
    }

    const recipientEmail = String(alumni.personalemail || alumni.officialemail || "").trim();
    if (!recipientEmail || !recipientEmail.includes("@")) {
      return NextResponse.json({ error: "Alumni email not found" }, { status: 400 });
    }

    const passwordToSend = String(alumni.password || "").trim();
    // Business rule: Send Credentials must never generate/rotate passwords.
    if (!passwordToSend) {
      return NextResponse.json({ error: "PASSWORD_NOT_SET" }, { status: 400 });
    }

    const alumniName = String(alumni.alumniname || "Alumni").trim() || "Alumni";
    const didUpdatePassword = false;

    const extraBodyHtml = `
      <div style="margin: 16px 0; padding: 14px; border: 1px solid #e5e7eb; border-radius: 10px; background: #f9fafb;">
        <p style="margin: 0; font-size: 14px;"><strong>SAP ID:</strong> ${String(alumni.sapid || "-")}</p>
        <p style="margin: 6px 0 0 0; font-size: 14px;"><strong>Registration No:</strong> ${String(alumni.registrationno || "-")}</p>
        <p style="margin: 6px 0 0 0; font-size: 14px;"><strong>Password:</strong> ${passwordToSend}</p>
      </div>
    `;

    const emailTpl = generateAdminActionEmail({
      actionType: EMAIL_ACTION_TYPE.ALUMNI_SEND_CREDENTIALS,
      alumniName,
      extraBodyHtml,
      sapId: alumni.sapid,
      regNo: alumni.registrationno,
      generatedPassword: passwordToSend,
    });

    const emailRes = await sendEmailDetailed({
      to: recipientEmail,
      subject: emailTpl.subject,
      html: emailTpl.html,
    });

    await insertEmailLog({
      recipientEmail,
      alumniId,
      subject: emailTpl.subject,
      body: emailTpl.html,
      status: emailRes.ok ? EMAIL_LOG_STATUS.SENT : EMAIL_LOG_STATUS.FAILED,
      errorMessage: emailRes.ok ? null : emailRes.errorMessage ?? "Unknown error",
      triggeredBy: EMAIL_TRIGGERED_BY.ADMIN_ACTION,
      actionType: EMAIL_ACTION_TYPE.ALUMNI_SEND_CREDENTIALS,
    });

    if (!emailRes.ok) {
      return NextResponse.json(
        { ok: false, error: emailRes.errorMessage ?? "Failed to send email" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        updatedPassword: didUpdatePassword,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send credentials";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
