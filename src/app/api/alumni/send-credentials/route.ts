import { NextRequest, NextResponse } from "next/server";

import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { logAdminAction } from "@/lib/adminActivityLog";
import { sendEmailDetailed } from "@/lib/email";
import { EMAIL_ACTION_TYPE, generateAdminActionEmail } from "@/lib/emailTemplates";
import { EMAIL_LOG_STATUS, EMAIL_TRIGGERED_BY, insertEmailLog } from "@/lib/emailLogs";

const RATE_LIMIT = new Map<string, { count: number; last: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_WINDOW_MS = 10 * 60 * 1000;

function rateLimitPrune() {
  const now = Date.now();
  for (const [k, v] of RATE_LIMIT.entries()) {
    if (now - v.last > RATE_WINDOW_MS) RATE_LIMIT.delete(k);
  }
}

function normalizeIdentifier(input: unknown): string {
  const raw = typeof input === "string" ? input : "";
  const v = raw.trim();
  if (!v) return "";
  if (v.length > 50) return "";
  if (!/^[a-zA-Z0-9\-_/]+$/.test(v)) return "";
  return v;
}

function normalizeEmail(input: unknown): string {
  const raw = typeof input === "string" ? input : "";
  const v = raw.trim();
  if (!v) return "";
  if (v.length > 254) return "";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(v)) return "";
  return v;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const ip = req.headers.get("x-forwarded-for") || "unknown";

    rateLimitPrune();
    const rlKey = `alumni-send-credentials|${String(ip)}`;
    const now = Date.now();
    const rl = RATE_LIMIT.get(rlKey) || { count: 0, last: now };
    if (now - rl.last > RATE_WINDOW_MS) rl.count = 0;
    rl.last = now;
    rl.count += 1;
    RATE_LIMIT.set(rlKey, rl);
    if (rl.count > RATE_LIMIT_MAX) {
      return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
    }

    if (process.env.NODE_ENV === "production") {
      const proto = req.headers.get("x-forwarded-proto") || "";
      if (proto.toLowerCase() !== "https") {
        return NextResponse.json({ error: "HTTPS_REQUIRED" }, { status: 400 });
      }
    }

    const body = (await req.json().catch(() => null)) as { identifier?: unknown; email?: unknown } | null;
    const identifier = normalizeIdentifier(body?.identifier);
    const recipientEmail = normalizeEmail(body?.email);

    if (!identifier) {
      return NextResponse.json({ error: "INVALID_IDENTIFIER" }, { status: 400 });
    }
    if (!recipientEmail) {
      return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
    }

    const rows = await sql/* sql */`
      SELECT alumniid, alumniname, sapid, registrationno, password
      FROM public.tbl_alumni
      WHERE sapid = ${identifier}
         OR registrationno = ${identifier}
      LIMIT 1
    `;

    const alumni = rows?.[0] as
      | {
          alumniid: number;
          alumniname: string | null;
          sapid: string | null;
          registrationno: string | null;
          password: string | null;
        }
      | undefined;

    if (!alumni) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const passwordToSend = String(alumni.password || "").trim();
    if (!passwordToSend) {
      return NextResponse.json({ error: "PASSWORD_NOT_SET" }, { status: 400 });
    }

    const alumniName = String(alumni.alumniname || "Alumni").trim() || "Alumni";

    const extraBodyHtml = `
      <div style="margin: 16px 0;">
        <p>Greetings from UOL Alumni Office!</p>
        <p>
          Here are your log-in credentials against your registered data in our database. Kindly log-in and update your profile
          (all essential fields * must be entered) to ensure you become part of our active alumni database and stay connected with us.
        </p>
        <div style="margin: 16px 0; padding: 14px; border: 1px solid #e5e7eb; border-radius: 10px; background: #f9fafb;">
          <p style="margin: 0; font-size: 14px;"><strong>SAP ID :</strong> ${String(alumni.sapid || "-")}</p>
          <p style="margin: 6px 0 0 0; font-size: 14px;"><strong>Registration No :</strong> ${String(alumni.registrationno || "-")}</p>
          <p style="margin: 6px 0 0 0; font-size: 14px;"><strong>Password :</strong> ${passwordToSend}</p>
        </div>
        <p>
          If you intend to change your personal email, or rectify any existing data, you can do it as part of profile update.
        </p>
        <p>Thank you &amp; looking forward to welcoming you aboard as part of UOL vibrant alumni community.</p>
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

    const subject = "UOL Alumni Portal Login Credentials";

    const emailRes = await sendEmailDetailed({
      to: recipientEmail,
      subject,
      html: emailTpl.html,
    });

    await insertEmailLog({
      recipientEmail,
      alumniId: Number(alumni.alumniid),
      subject,
      body: emailTpl.html,
      status: emailRes.ok ? EMAIL_LOG_STATUS.SENT : EMAIL_LOG_STATUS.FAILED,
      errorMessage: emailRes.ok ? null : emailRes.errorMessage ?? "Unknown error",
      triggeredBy: EMAIL_TRIGGERED_BY.AUTO,
      actionType: EMAIL_ACTION_TYPE.ALUMNI_SEND_CREDENTIALS,
    });

    if (!emailRes.ok) {
      return NextResponse.json({ ok: false, error: emailRes.errorMessage ?? "Failed to send email" }, { status: 500 });
    }

    await logAdminAction({
      session,
      req,
      input: {
        action: "alumni.send_credentials",
        entityType: "tbl_alumni",
        entityId: String(alumni.alumniid),
        success: true,
        metadata: {
          sapid: alumni.sapid,
          email: recipientEmail,
        },
      },
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send credentials";
    await logAdminAction({
      session: await auth(),
      req,
      input: {
        action: "alumni.send_credentials",
        entityType: "tbl_alumni",
        success: false,
        errorMessage: message,
      },
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
