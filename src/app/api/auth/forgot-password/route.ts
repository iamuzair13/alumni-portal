import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { sendPasswordResetEmail, sendAdminPasswordResetEmail } from "@/lib/email";
import { hashAdminPassword } from "@/lib/adminPassword";
import { generatePassword } from "@/lib/passwordUtils";
import { logAdminAction } from "@/lib/adminActivityLog";

const RATE_LIMIT = new Map<string, { count: number; last: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_WINDOW_MS = 5 * 60 * 1000;

const GENERIC_SUCCESS_MESSAGE =
  "If the email exists in our system, a password reset email has been sent.";

function rateLimitPrune() {
  const now = Date.now();
  for (const [k, v] of RATE_LIMIT.entries()) {
    if (now - v.last > RATE_WINDOW_MS) RATE_LIMIT.delete(k);
  }
}

function checkRateLimit(ip: string): boolean {
  rateLimitPrune();
  const key = `forgot-password|${ip}`;
  const rl = RATE_LIMIT.get(key) || { count: 0, last: Date.now() };
  const now = Date.now();
  if (now - rl.last > RATE_WINDOW_MS) rl.count = 0;
  rl.last = now;
  rl.count += 1;
  RATE_LIMIT.set(key, rl);
  return rl.count <= RATE_LIMIT_MAX;
}

const STAFF_TYPES = ["admin", "superadmin", "viewer", "user"] as const;

async function tryStaffPasswordReset(normalizedEmail: string): Promise<boolean> {
  const staffRows = await sql/* sql */`
    SELECT
      id,
      email,
      firstname,
      lastname,
      LOWER(TRIM(COALESCE(type, legacy_type, ''))) AS type_normalized,
      COALESCE(blocked, NOT is_active) AS blocked
    FROM public.users
    WHERE LOWER(TRIM(email)) = ${normalizedEmail}
    LIMIT 1
  `;

  if (staffRows.length === 0) return false;

  const staff = staffRows[0];
  const typeNormalized = String(staff.type_normalized || "").replace(/\s+/g, "");
  if (!STAFF_TYPES.includes(typeNormalized as (typeof STAFF_TYPES)[number])) {
    return false;
  }
  if (Boolean(staff.blocked)) {
    return false;
  }

  const userId = Number(staff.id);
  const staffEmail = String(staff.email || "");
  const firstName = String(staff.firstname || "").trim();
  const lastName = String(staff.lastname || "").trim();
  const staffName = [firstName, lastName].filter(Boolean).join(" ") || "Staff Member";

  const newPassword = generatePassword();
  const passwordHash = await hashAdminPassword(newPassword);

  await sql/* sql */`
    UPDATE public.users
    SET password = ${newPassword}, password_hash = ${passwordHash}, updated_at = now()
    WHERE id = ${userId}
  `;

  const emailSent = await sendAdminPasswordResetEmail(staffEmail, staffName, newPassword);
  if (!emailSent) {
    throw new Error("STAFF_EMAIL_FAILED");
  }

  await logAdminAction({
    session: null,
    input: {
      action: "auth.password_reset_request",
      entityType: "users",
      entityId: userId,
      metadata: { email: staffEmail, accountType: "staff" },
    },
  });

  return true;
}

async function tryAlumniPasswordReset(normalizedEmail: string): Promise<boolean> {
  const rows = await sql/* sql */`
    SELECT alumniid, alumniname, personalemail
    FROM public.tbl_alumni
    WHERE LOWER(TRIM(COALESCE(personalemail, ''))) = ${normalizedEmail}
    LIMIT 1
  `;

  if (rows.length === 0) return false;

  const alumni = rows[0];
  const alumniId = Number(alumni.alumniid);
  const alumniName = String(alumni.alumniname || "");
  const alumniEmail = String(alumni.personalemail || "");

  const newPassword = generatePassword();

  await sql/* sql */`
    UPDATE public.tbl_alumni
    SET password = ${newPassword}
    WHERE alumniid = ${alumniId}
  `;

  const emailSent = await sendPasswordResetEmail(alumniEmail, alumniName, newPassword);
  if (!emailSent) {
    throw new Error("ALUMNI_EMAIL_FAILED");
  }

  return true;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const staffReset = await tryStaffPasswordReset(normalizedEmail);
    if (staffReset) {
      return NextResponse.json(
        {
          success: true,
          message: "A new password has been sent to your email address.",
        },
        { status: 200 }
      );
    }

    const alumniReset = await tryAlumniPasswordReset(normalizedEmail);
    if (alumniReset) {
      return NextResponse.json(
        {
          success: true,
          message: "A new password has been sent to your email address.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: GENERIC_SUCCESS_MESSAGE,
      },
      { status: 200 }
    );
  } catch (err) {
    const code = err instanceof Error ? err.message : "";
    if (code === "STAFF_EMAIL_FAILED" || code === "ALUMNI_EMAIL_FAILED") {
      return NextResponse.json(
        {
          success: false,
          error: "Password was reset but email could not be sent. Please contact support.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { success: false, error: "An error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
