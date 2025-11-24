import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isAdminUser } from "@/lib/alumniProfile";
import { generateScholarshipPDF } from "@/lib/pdfGenerator";
import { createEmailTemplate } from "@/lib/email";
import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_SECURE = process.env.SMTP_SECURE === "true";
const SMTP_USER = process.env.SMTP_USER || process.env.SMTP_EMAIL;
const SMTP_PASS = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER || "noreply@uol.edu.pk";
const FROM_NAME = process.env.FROM_NAME || "UOL Alumni Portal";

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: SMTP_USER && SMTP_PASS ? {
    user: SMTP_USER,
    pass: SMTP_PASS,
  } : undefined,
});

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
    const { discountType, applyingFor, degreeTitle, kinshipRelation, kinshipName } = body;

    // Validate required fields
    if (!discountType || !applyingFor || !degreeTitle) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (discountType === "kinship" && (!kinshipRelation || !kinshipName)) {
      return NextResponse.json({ error: "Kinship relation and name are required for kinship discount" }, { status: 400 });
    }

    // Generate PDF
    const pdfBuffer = await generateScholarshipPDF({
      alumniName,
      discountType,
      applyingFor,
      degreeTitle,
      kinshipRelation: kinshipRelation || null,
      kinshipName: kinshipName || null,
    });

    // Prepare email content
    const subject = "UOL Alumni Scholarship / Fee Discount Application";
    const greeting = `Dear ${alumniName},`;
    const emailBody = `
      <p style="margin: 0 0 10px 0; color: #333333; font-size: 16px;">
        Thank you for submitting your application for the UOL Alumni Scholarship / Fee Discount. Please bring the attached document to the Alumni Office for processing.
      </p>
      <p style="margin: 10px 0; color: #333333; font-size: 16px;">
        The document will need to be approved by the Chairman and the Alumni Office to confirm your eligibility and allow you or your beneficiary to proceed with the admission process.
      </p>
      <div style="margin: 20px 0; padding: 15px; background-color: #f0f7ff; border-left: 4px solid #007bff; border-radius: 4px;">
        <p style="margin: 0 0 5px 0; font-weight: bold; color: #333333;">Application Details:</p>
        <ul style="margin: 5px 0; padding-left: 20px; color: #333333;">
          <li><strong>Discount Type:</strong> ${getDiscountLabel(discountType)}</li>
          <li><strong>Applying For:</strong> ${applyingFor}</li>
          <li><strong>Degree Title:</strong> ${degreeTitle}</li>
          ${kinshipRelation && kinshipName ? `<li><strong>Beneficiary:</strong> ${kinshipName} (${kinshipRelation})</li>` : ""}
        </ul>
      </div>
    `;
    const footer = "If you have any questions, please contact the Alumni Office.";

    const html = createEmailTemplate(subject, greeting, emailBody, footer);

    // Send email with PDF attachment
    try {
      // Check SMTP configuration
      if (!SMTP_USER || !SMTP_PASS) {
        console.warn("[Scholarship API] SMTP not configured. Missing SMTP_USER or SMTP_PASS");
        console.warn("[Scholarship API] Email would be sent to:", alumniEmail);
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
        console.log("[Scholarship API] SMTP connection verified successfully");
      } catch (verifyError) {
        console.error("[Scholarship API] SMTP connection verification failed:", verifyError);
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
        from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
        to: alumniEmail,
        subject: subject,
        html: html,
        attachments: [
          {
            filename: `Scholarship_Application_${alumniName.replace(/\s+/g, "_")}_${Date.now()}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      };

      console.log("[Scholarship API] Attempting to send email to:", alumniEmail);
      console.log("[Scholarship API] From:", FROM_EMAIL);
      console.log("[Scholarship API] SMTP Host:", SMTP_HOST);
      console.log("[Scholarship API] SMTP Port:", SMTP_PORT);

      const emailInfo = await transporter.sendMail(mailOptions);
      console.log("[Scholarship API] Email sent successfully!");
      console.log("[Scholarship API] Message ID:", emailInfo.messageId);
      console.log("[Scholarship API] Response:", emailInfo.response);

      return NextResponse.json({
        ok: true,
        message: "Application submitted successfully. Please check your email for the confirmation document.",
        emailSent: true,
        messageId: emailInfo.messageId,
      }, { status: 200 });
    } catch (emailError) {
      const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
      const errorStack = emailError instanceof Error ? emailError.stack : undefined;
      
      console.error("[Scholarship API] Failed to send email:");
      console.error("[Scholarship API] Error message:", errorMessage);
      if (errorStack) {
        console.error("[Scholarship API] Error stack:", errorStack);
      }
      
      // Check for specific error types
      if (errorMessage.includes("Invalid login")) {
        console.error("[Scholarship API] SMTP authentication failed. Check SMTP_USER and SMTP_PASS.");
      } else if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("ETIMEDOUT")) {
        console.error("[Scholarship API] SMTP connection failed. Check SMTP_HOST and SMTP_PORT.");
      } else if (errorMessage.includes("ENOTFOUND")) {
        console.error("[Scholarship API] SMTP host not found. Check SMTP_HOST configuration.");
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
    const message = err instanceof Error ? err.message : "Failed to process scholarship application";
    console.error("[API] Scholarship application error:", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function getDiscountLabel(discountType: string): string {
  switch (discountType) {
    case "kinship":
      return "Kinship Discount";
    case "masters-phd":
      return "Masters/PhD Discount";
    case "masters-collaboration":
      return "Masters Scholarships via UOL International Collaborations";
    default:
      return "Scholarship/Discount";
  }
}

