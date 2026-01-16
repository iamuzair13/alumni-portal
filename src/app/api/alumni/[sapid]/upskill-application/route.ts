import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isAdminUser } from "@/lib/alumniProfile";
import { generateUpskillPDF } from "@/lib/pdfGenerator";
import { createEmailTemplate } from "@/lib/email";
import nodemailer from "nodemailer";

// Get email configuration dynamically
function getEmailConfig() {
  const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
  const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
  const SMTP_SECURE = process.env.SMTP_SECURE === "true";
  const SMTP_USER = process.env.SMTP_USER || process.env.SMTP_EMAIL;
  const SMTP_PASS = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;
  const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER || "noreply@uol.edu.pk";
  const FROM_NAME = process.env.FROM_NAME || "UOL Alumni Portal";
  return { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, FROM_EMAIL, FROM_NAME };
}

// Create transporter dynamically
function getTransporter() {
  const config = getEmailConfig();
  if (!config.SMTP_USER || !config.SMTP_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
    },
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ sapid: string }> }) {
  try {
    const { sapid } = await ctx.params;
    const session = await auth();

    // Verify the user is authenticated
    const userEmail = session?.user?.email ? String(session.user.email) : null;
    const userSapid = session?.user ? ((session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid) : null) : null;

    if (!userEmail && !userSapid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify alumni exists and user has access
    const rows = await sql/* sql */`
      SELECT alumniid, sapid, alumniname, personalemail, universityemail, officialemail FROM public.tbl_alumni WHERE sapid = ${sapid} LIMIT 1`;

    if (!rows[0]) {
      return NextResponse.json({ error: "Alumni not found" }, { status: 404 });
    }

    const row = rows[0] as Record<string, unknown>;
    const alumniName = String(row.alumniname || "");
    const alumniEmail = String(row.personalemail || row.universityemail || row.officialemail || userEmail || "");

    // Check ownership
    const isOwnerBySapid = userSapid && String(row.sapid ?? "").toLowerCase().trim() === userSapid.toLowerCase().trim();
    const isOwnerByEmail = userEmail && (
      String(row.personalemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim() ||
      String(row.universityemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim() ||
      String(row.officialemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim()
    );
    const isOwner = isOwnerBySapid || isOwnerByEmail;

    if (!isOwner && !isAdminUser(session?.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { courseName, departmentName } = body;

    // Validate required fields
    if (!courseName || !departmentName) {
      return NextResponse.json({ error: "Missing required fields: courseName and departmentName are required" }, { status: 400 });
    }

    // Generate PDF
    const pdfBuffer = await generateUpskillPDF({
      alumniName,
      courseName: String(courseName).trim(),
      departmentName: String(departmentName).trim(),
    });

    // Prepare email content
    const subject = "UOL Alumni Upskill & Reskill Course Application";
    const greeting = `Dear ${alumniName},`;
    const emailBody = `
      <p style="margin: 0 0 10px 0; color: #333333; font-size: 16px;">
        Thank you for applying for the <strong>${String(courseName).trim()}</strong> offered by the <strong>${String(departmentName).trim()}</strong> at UOL.
      </p>
      <p style="margin: 10px 0; color: #333333; font-size: 16px;">
        Attached is your  application document, which has been sent to the Alumni Office for approval. Please keep this document for your records. Once your application is approved, you will be notified and can proceed with enrollment in the selected program.
      </p>
      <p style="margin: 15px 0 0 0; color: #333333; font-size: 16px;">
        We appreciate your continued engagement with UOL and your commitment to lifelong learning.
      </p>
    `;
    const footer = "Regards,<br>Office of Alumni Relations, UOL";

    const html = createEmailTemplate(subject, greeting, emailBody, footer);

    // Send email with PDF attachment
    try {
      const config = getEmailConfig();
      const transporter = getTransporter();
      
      // Check SMTP configuration
      if (!transporter) {
        return NextResponse.json({ 
          ok: true, 
          message: "Application received. Email service not configured. Please contact the Alumni Office.",
          pdfGenerated: true,
          emailSent: false,
          emailError: "SMTP not configured"
        }, { status: 200 });
      }

      // Verify transporter connection
      try {
        await transporter.verify();
      } catch (verifyError) {
        const errorMessage = verifyError instanceof Error ? verifyError.message : String(verifyError);
        return NextResponse.json({
          ok: true,
          message: "Application received. However, email service is not available. Please contact the Alumni Office.",
          pdfGenerated: true,
          emailSent: false,
          emailError: `SMTP verification failed: ${errorMessage}`
        }, { status: 200 });
      }

      const mailOptions = {
        from: `"${config.FROM_NAME}" <${config.FROM_EMAIL}>`,
        to: alumniEmail,
        subject: subject,
        html: html,
        attachments: [
          {
            filename: `Upskill_Application_${alumniName.replace(/\s+/g, "_")}_${Date.now()}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      };
      const emailInfo = await transporter.sendMail(mailOptions);
      return NextResponse.json({
        ok: true,
        message: "Application submitted successfully. Please check your email for the confirmation document.",
        emailSent: true,
        messageId: emailInfo.messageId,
      }, { status: 200 });
    } catch (emailError) {
      const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
      const errorStack = emailError instanceof Error ? emailError.stack : undefined;
      if (errorStack) {
      }
      
      // Check for specific error types
      if (errorMessage.includes("Invalid login")) {
      } else if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("ETIMEDOUT")) {
      } else if (errorMessage.includes("ENOTFOUND")) {
      }

      // Return error details to help with debugging
      return NextResponse.json({
        ok: true,
        message: "Application received. However, email delivery failed. Please contact the Alumni Office.",
        pdfGenerated: true,
        emailSent: false,
        emailError: errorMessage,
      }, { status: 200 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process upskill application";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

