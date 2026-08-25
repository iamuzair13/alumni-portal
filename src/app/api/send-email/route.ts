import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { sql } from "@/lib/dbconnect";
import { sendEmailDetailed } from "@/lib/email";
import {
  EMAIL_LOG_STATUS,
  EMAIL_TRIGGERED_BY,
  insertEmailLog,
} from "@/lib/emailLogs";
import { EMAIL_ACTION_TYPE, generateAdminActionEmail } from "@/lib/emailTemplates";
import { logAdminAction } from "@/lib/adminActivityLog";

type SendEmailBody = {
  recipientEmail: string;
  alumniId?: number | null;
  subject: string;
  body: string;
  actionType: string;
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

    const payload = (await req.json()) as Partial<SendEmailBody>;

    const recipientEmail = String(payload.recipientEmail ?? "").trim();
    const actionType = String(payload.actionType ?? "").trim();

    let subject = String(payload.subject ?? "").trim();
    let htmlBody = String(payload.body ?? "").trim();

    const alumniId = payload.alumniId === undefined || payload.alumniId === null ? null : Number(payload.alumniId);

    if (!recipientEmail || !recipientEmail.includes("@")) {
      return NextResponse.json({ error: "Invalid recipientEmail" }, { status: 400 });
    }
    if (!actionType) {
      return NextResponse.json({ error: "actionType is required" }, { status: 400 });
    }
    if (alumniId !== null && (!Number.isFinite(alumniId) || alumniId <= 0)) {
      return NextResponse.json({ error: "Invalid alumniId" }, { status: 400 });
    }

    // SECURITY/CONSISTENCY: For verification emails, generate credentials server-side.
    // The client-provided HTML may not include sapid/registration/password.
    if (actionType === EMAIL_ACTION_TYPE.ALUMNI_VERIFY) {
      if (alumniId === null) {
        return NextResponse.json({ error: "alumniId is required for verification email" }, { status: 400 });
      }

      const rows = await sql/* sql */`
        SELECT alumniid, alumniname, sapid, registrationno, password
        FROM public.tbl_alumni
        WHERE alumniid = ${alumniId}
        LIMIT 1
      `;

      const alumni = rows[0] as
        | {
            alumniid: number;
            alumniname: string | null;
            sapid: string | null;
            registrationno: string | null;
            password: string | null;
          }
        | undefined;

      if (!alumni) {
        return NextResponse.json({ error: "Alumni not found" }, { status: 404 });
      }

      const storedPassword = String(alumni.password || "").trim();
      // Business rule: this endpoint must not generate/rotate passwords.
      if (!storedPassword) {
        return NextResponse.json({ error: "PASSWORD_NOT_SET" }, { status: 400 });
      }
      const passwordToSend = storedPassword;

      const alumniName = String(alumni.alumniname || "Alumni").trim() || "Alumni";
      const tpl = generateAdminActionEmail({
        actionType: EMAIL_ACTION_TYPE.ALUMNI_VERIFY,
        alumniName,
        sapId: alumni.sapid,
        regNo: alumni.registrationno,
        generatedPassword: passwordToSend,
      });

      subject = tpl.subject;
      htmlBody = tpl.html;
    }

    if (!subject) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    }
    if (!htmlBody) {
      return NextResponse.json({ error: "Body is required" }, { status: 400 });
    }

    const res = await sendEmailDetailed({
      to: recipientEmail,
      subject,
      html: htmlBody,
    });

    await insertEmailLog({
      recipientEmail,
      alumniId,
      subject,
      body: htmlBody,
      status: res.ok ? EMAIL_LOG_STATUS.SENT : EMAIL_LOG_STATUS.FAILED,
      errorMessage: res.ok ? null : res.errorMessage ?? "Unknown error",
      triggeredBy: EMAIL_TRIGGERED_BY.ADMIN_ACTION,
      actionType,
    });

    await logAdminAction({
      session,
      req,
      input: {
        action: "email.send",
        entityType: "email",
        success: res.ok,
        entityId: alumniId,
        metadata: { recipientEmail, actionType, subject },
        errorMessage: res.ok ? null : res.errorMessage ?? "Unknown error",
      },
    });

    return NextResponse.json(
      {
        ok: res.ok,
        errorMessage: res.ok ? undefined : res.errorMessage,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send email";
    await logAdminAction({
      session: null,
      req,
      input: {
        action: "email.send",
        entityType: "email",
        success: false,
        errorMessage: message,
      },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
