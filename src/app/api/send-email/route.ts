import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { sendEmailDetailed } from "@/lib/email";
import {
  EMAIL_LOG_STATUS,
  EMAIL_TRIGGERED_BY,
  insertEmailLog,
} from "@/lib/emailLogs";

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
    const subject = String(payload.subject ?? "").trim();
    const htmlBody = String(payload.body ?? "").trim();
    const actionType = String(payload.actionType ?? "").trim();

    const alumniId = payload.alumniId === undefined || payload.alumniId === null ? null : Number(payload.alumniId);

    if (!recipientEmail || !recipientEmail.includes("@")) {
      return NextResponse.json({ error: "Invalid recipientEmail" }, { status: 400 });
    }
    if (!subject) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    }
    if (!htmlBody) {
      return NextResponse.json({ error: "Body is required" }, { status: 400 });
    }
    if (!actionType) {
      return NextResponse.json({ error: "actionType is required" }, { status: 400 });
    }
    if (alumniId !== null && (!Number.isFinite(alumniId) || alumniId <= 0)) {
      return NextResponse.json({ error: "Invalid alumniId" }, { status: 400 });
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

    return NextResponse.json(
      {
        ok: res.ok,
        errorMessage: res.ok ? undefined : res.errorMessage,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
