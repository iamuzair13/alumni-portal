import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isAdminUser } from "@/lib/alumniProfile";
import { generateScholarshipPDF } from "@/lib/pdfGenerator";
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
    const userRegNo = session?.user ? ((session.user as { registrationno?: string | null })?.registrationno ? String((session.user as { registrationno?: string | null }).registrationno) : null) : null;

    if (!userEmail && !userSapid && !userRegNo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify alumni exists and user has access - try by sapid first, then by registrationno
    let rows: Array<Record<string, unknown>> = [];
    
    // Try to find by SAP ID first
    rows = await sql/* sql */`
      SELECT alumniid, sapid, registrationno, alumniname, personalemail, universityemail, officialemail, cnicpassport, father_cnic 
      FROM public.tbl_alumni 
      WHERE sapid = ${sapid} 
      LIMIT 1`;

    // If not found by SAP ID, try by registration number
    if (!rows[0]) {
      rows = await sql/* sql */`
        SELECT alumniid, sapid, registrationno, alumniname, personalemail, universityemail, officialemail, cnicpassport, father_cnic 
        FROM public.tbl_alumni 
        WHERE registrationno = ${sapid} 
        LIMIT 1`;
    }

    if (!rows[0]) {
      return NextResponse.json({ error: "Alumni not found" }, { status: 404 });
    }

    const row = rows[0] as Record<string, unknown>;
    const alumniId = Number(row.alumniid);
    const alumniName = String(row.alumniname || "");
    const alumniEmail = String(row.personalemail || row.universityemail || row.officialemail || userEmail || "");
    const alumniCnic = String(row.cnicpassport || "");

    // Check ownership - by SAP ID, registration number, or email
    const isOwnerBySapid = userSapid && String(row.sapid ?? "").toLowerCase().trim() === userSapid.toLowerCase().trim();
    const isOwnerByRegNo = userRegNo && String(row.registrationno ?? "").toLowerCase().trim() === userRegNo.toLowerCase().trim();
    const isOwnerByEmail = userEmail && (
      String(row.personalemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim() ||
      String(row.universityemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim() ||
      String(row.officialemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim()
    );
    const isOwner = isOwnerBySapid || isOwnerByRegNo || isOwnerByEmail;

    if (!isOwner && !isAdminUser(session?.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { discountType, applyingFor, degreeTitle, kinshipRelation, kinshipFirstName, kinshipLastName, kinshipCnic, fatherCnic } = body;

    // Validate required fields
    if (!discountType || !applyingFor || !degreeTitle) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (discountType === "kinship" && (!kinshipRelation || !kinshipFirstName || !kinshipLastName || !kinshipCnic)) {
      return NextResponse.json({ error: "Kinship relation, first name, last name, and CNIC are required for kinship discount" }, { status: 400 });
    }

    // Update father_cnic in tbl_alumni if provided
    if (fatherCnic && fatherCnic.trim() !== "") {
      try {
        await sql/* sql */`
          UPDATE public.tbl_alumni 
          SET father_cnic = ${fatherCnic.trim()}
          WHERE alumniid = ${alumniId}
        `;
      } catch (updateError) {
        console.error("[API] Failed to update father_cnic:", updateError);
        // Continue with application even if father_cnic update fails
      }
    }

    // Save to alumni_scholarships table
    // Note: The schema has a foreign key constraint where id references tbl_alumni(alumniid)
    // We'll use the alumniid as the id to satisfy the constraint
    try {
      await sql/* sql */`
        INSERT INTO public.alumni_scholarships (
          id,
          kinship_firstname,
          kinship_lastname,
          kinship_cnic,
          apply_for,
          degree_title,
          status,
          created_at
        )
        VALUES (
          ${alumniId},
          ${discountType === "kinship" ? (kinshipFirstName || null) : null},
          ${discountType === "kinship" ? (kinshipLastName || null) : null},
          ${discountType === "kinship" ? (kinshipCnic || null) : null},
          ${applyingFor || null},
          ${degreeTitle || null},
          'pending',
          NOW()
        )
        ON CONFLICT (id) DO UPDATE
        SET 
          kinship_firstname = EXCLUDED.kinship_firstname,
          kinship_lastname = EXCLUDED.kinship_lastname,
          kinship_cnic = EXCLUDED.kinship_cnic,
          apply_for = EXCLUDED.apply_for,
          degree_title = EXCLUDED.degree_title,
          status = 'pending',
          created_at = NOW()
      `;
    } catch (insertError) {
      console.error("[API] Failed to save to alumni_scholarships:", insertError);
      // Continue with email sending even if database save fails
    }

    // Generate PDF
    const pdfBuffer = await generateScholarshipPDF({
      alumniName,
      discountType,
      applyingFor,
      degreeTitle,
      kinshipRelation: kinshipRelation || null,
      kinshipFirstName: discountType === "kinship" ? (kinshipFirstName || null) : null,
      kinshipLastName: discountType === "kinship" ? (kinshipLastName || null) : null,
      kinshipName: discountType === "kinship" && kinshipFirstName && kinshipLastName 
        ? `${kinshipFirstName} ${kinshipLastName}` 
        : null,
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
          ${discountType === "kinship" && kinshipFirstName && kinshipLastName ? `<li><strong>Beneficiary:</strong> ${kinshipFirstName} ${kinshipLastName} (${kinshipRelation})</li>` : ""}
          ${discountType === "kinship" && alumniCnic ? `<li><strong>Alumni CNIC:</strong> ${alumniCnic}</li>` : ""}
          ${discountType === "kinship" && kinshipCnic ? `<li><strong>Kinship CNIC:</strong> ${kinshipCnic}</li>` : ""}
          ${fatherCnic ? `<li><strong>Father CNIC:</strong> ${fatherCnic}</li>` : ""}
        </ul>
      </div>
    `;
    const footer = "If you have any questions, please contact the Alumni Office.";

    const html = createEmailTemplate(subject, greeting, emailBody, footer);

    // Send email with PDF attachment
    try {
      const config = getEmailConfig();
      const transporter = getTransporter();
      
      // Check SMTP configuration
      if (!transporter) {
        console.warn("[Scholarship API] SMTP not configured. Missing SMTP_USER or SMTP_PASS");
        console.warn("[Scholarship API] SMTP_USER:", config.SMTP_USER ? "SET" : "NOT SET");
        console.warn("[Scholarship API] SMTP_PASS:", config.SMTP_PASS ? "SET" : "NOT SET");
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
        from: `"${config.FROM_NAME}" <${config.FROM_EMAIL}>`,
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
      console.log("[Scholarship API] From:", config.FROM_EMAIL);
      console.log("[Scholarship API] SMTP Host:", config.SMTP_HOST);
      console.log("[Scholarship API] SMTP Port:", config.SMTP_PORT);

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

