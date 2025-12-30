import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { sendPasswordResetEmail } from "@/lib/email";

// Generate a random password
function generatePassword(): string {
  const length = 12;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  
  // Ensure at least one of each type
  password += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)]; // uppercase
  password += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]; // lowercase
  password += "0123456789"[Math.floor(Math.random() * 10)]; // number
  password += "!@#$%^&*"[Math.floor(Math.random() * 8)]; // special char
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    // Validate email
    if (!email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if email exists in personalemail column
    const rows = await sql/* sql */`
      SELECT alumniid, alumniname, personalemail
      FROM public.tbl_alumni
      WHERE LOWER(TRIM(COALESCE(personalemail, ''))) = ${normalizedEmail}
      LIMIT 1
    `;

    if (rows.length === 0) {
      // Don't reveal whether email exists or not (security best practice)
      return NextResponse.json(
        {
          success: true,
          message: "If the email exists in our system, a password reset link has been sent."
        },
        { status: 200 }
      );
    }

    const alumni = rows[0];
    const alumniId = Number(alumni.alumniid);
    const alumniName = String(alumni.alumniname || "");
    const alumniEmail = String(alumni.personalemail || "");

    // Generate new password
    const newPassword = generatePassword();

    // Update password in database (saved as plain text)
    await sql/* sql */`
      UPDATE public.tbl_alumni
      SET password = ${newPassword}
      WHERE alumniid = ${alumniId}
    `;

    // Send email with new password
    const emailSent = await sendPasswordResetEmail(
      alumniEmail,
      alumniName,
      newPassword
    );

    if (!emailSent) {
      console.warn("[Forgot Password] Email sending failed for:", alumniEmail);
      return NextResponse.json(
        {
          success: false,
          error: "Password was reset but email could not be sent. Please contact support."
        },
        { status: 500 }
      );
    }

    console.log("[Forgot Password] Password reset successful for alumni ID:", alumniId);

    return NextResponse.json(
      {
        success: true,
        message: "A new password has been sent to your email address."
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reset password";
    console.error("[Forgot Password] Error:", message, err);
    return NextResponse.json(
      { success: false, error: "An error occurred. Please try again later." },
      { status: 500 }
    );
  }
}

