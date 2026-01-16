import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
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

// Helper function to get discount label
function getDiscountLabel(discountType: string): string {
  switch (discountType) {
    case "kinship":
      return "Kinship Discount";
    case "alumni":
      return "Alumni Discount";
    default:
      return discountType;
  }
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ alumniId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can update scholarship status
    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { alumniId } = await ctx.params;
    const alumniIdNum = parseInt(String(alumniId), 10);
    
    if (isNaN(alumniIdNum) || alumniIdNum <= 0) {
      return NextResponse.json({ error: "Invalid alumni ID" }, { status: 400 });
    }

    const body = await request.json();
    const { status, rejectionReason } = body;

    // Validate status
    const validStatuses = ["pending", "approved", "not-approved"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Status must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // If status is "not-approved", rejectionReason is required
    if (status === "not-approved" && (!rejectionReason || rejectionReason.trim() === "")) {
      return NextResponse.json(
        { error: "Rejection reason is required when marking application as not approved" },
        { status: 400 }
      );
    }

    // Fetch application and alumni details before updating
    const applicationRows = await sql/* sql */`
      SELECT
        asch.kinship_firstname,
        asch.kinship_lastname,
        asch.kinship_cnic,
        asch.apply_for,
        asch.degree_title,
        a.alumniname,
        a.personalemail,
        a.universityemail,
        a.officialemail,
        a.cnicpassport,
        a.father_cnic
      FROM public.alumni_scholarships asch
      JOIN public.tbl_alumni a ON a.alumniid = asch.id
      WHERE asch.id = ${alumniIdNum}
      LIMIT 1
    `;

    if (!applicationRows[0]) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const app = applicationRows[0] as {
      kinship_firstname: string | null;
      kinship_lastname: string | null;
      kinship_cnic: string | null;
      apply_for: string | null;
      degree_title: string | null;
      alumniname: string | null;
      personalemail: string | null;
      universityemail: string | null;
      officialemail: string | null;
      cnicpassport: string | null;
      father_cnic: string | null;
    };

    const alumniName = String(app.alumniname || "");
    const alumniEmail = String(app.personalemail || app.universityemail || app.officialemail || "");
    const applyFor = String(app.apply_for || "");
    const degreeTitle = String(app.degree_title || "");
    const kinshipFirstName = app.kinship_firstname;
    const kinshipLastName = app.kinship_lastname;
    const kinshipCnic = app.kinship_cnic;
    const hasKinship = !!(kinshipFirstName && kinshipLastName);

    // Determine discount type based on kinship data
    const discountType = hasKinship ? "kinship" : "alumni";

    // Update scholarship status and rejection reason
    if (status === "not-approved") {
      await sql/* sql */`
        UPDATE public.alumni_scholarships
        SET status = ${status}, reason = ${rejectionReason.trim()}
        WHERE id = ${alumniIdNum}
      `;
    } else {
      // Clear rejection reason when approving or setting to pending
      await sql/* sql */`
        UPDATE public.alumni_scholarships
        SET status = ${status}, reason = NULL
        WHERE id = ${alumniIdNum}
      `;
    }

    // Send email based on status
    let emailSent = false;
    let emailError: string | null = null;

    if (status === "approved" || status === "not-approved") {
      try {
        const config = getEmailConfig();
        const transporter = getTransporter();

        if (!transporter) {

          emailError = "SMTP not configured";
        } else {
          // Verify transporter connection
          try {
            await transporter.verify();
          } catch (verifyError) {

            emailError = `SMTP verification failed: ${verifyError instanceof Error ? verifyError.message : String(verifyError)}`;
          }

          if (!emailError) {
            const subject = status === "approved" 
              ? "Scholarship Application Approved"
              : "Scholarship Application Status Update";

            const greeting = "Dear Applicant,";

            let emailBody = "";
            let pdfBuffer: Buffer | null = null;

            if (status === "approved") {
              // Approved email with PDF
              emailBody = `
                <p style="margin: 0 0 10px 0; color: #333333; font-size: 16px;">
                  We are pleased to inform you that your scholarship request has been approved.
                </p>
                <p style="margin: 10px 0; color: #333333; font-size: 16px;">
                  For further approval and processing, you are requested to <strong>visit the Alumni Office</strong> along with a <strong>printed copy of your submitted application</strong> at your earliest convenience.
                </p>
                <p style="margin: 10px 0; color: #333333; font-size: 16px;">
                  Please note that completion of this step is mandatory to proceed with the scholarship processing.
                </p>
                <p style="margin: 10px 0; color: #333333; font-size: 16px;">
                  If you have any questions, feel free to contact the Alumni Office during official working hours.
                </p>
              `;

              // Generate PDF for approved applications
              try {
                pdfBuffer = await generateScholarshipPDF({
                  alumniName,
                  discountType,
                  applyingFor: applyFor,
                  degreeTitle: degreeTitle,
                  kinshipRelation: null,
                  kinshipFirstName: kinshipFirstName || null,
                  kinshipLastName: kinshipLastName || null,
                  kinshipName: hasKinship ? `${kinshipFirstName} ${kinshipLastName}` : null,
                });
              } catch (pdfError) {

                emailError = `PDF generation failed: ${pdfError instanceof Error ? pdfError.message : String(pdfError)}`;
              }
            } else {
              // Not approved email without PDF
              emailBody = `
                <p style="margin: 0 0 10px 0; color: #333333; font-size: 16px;">
                  Thank you for submitting your scholarship request.
                </p>
                <p style="margin: 10px 0; color: #333333; font-size: 16px;">
                  After careful review, we regret to inform you that your request <strong>could not be approved at this time</strong> as it does not meet the required criteria.
                </p>
                <p style="margin: 10px 0; color: #333333; font-size: 16px;">
                  You may contact the Alumni Office during official working hours if you require further clarification or wish to inquire about future opportunities.
                </p>
                <p style="margin: 10px 0; color: #333333; font-size: 16px;">
                  We appreciate your interest and encourage you to apply again should you become eligible.
                </p>
              `;
            }

            const footer = "Best regards,<br/>Office of Alumni Relations";
            const html = createEmailTemplate(subject, greeting, emailBody, footer);

            const mailOptions: nodemailer.SendMailOptions = {
              from: `"${config.FROM_NAME}" <${config.FROM_EMAIL}>`,
              to: alumniEmail,
              subject,
              html,
            };

            // Add PDF attachment for approved applications
            if (status === "approved" && pdfBuffer) {
              mailOptions.attachments = [
                {
                  filename: `Scholarship_Application_${alumniIdNum}.pdf`,
                  content: pdfBuffer,
                  contentType: "application/pdf",
                },
              ];
            }

            await transporter.sendMail(mailOptions);
            emailSent = true;

          }
        }
      } catch (emailErr) {

        emailError = emailErr instanceof Error ? emailErr.message : String(emailErr);
      }
    }

    return NextResponse.json(
      { 
        success: true, 
        status,
        emailSent,
        emailError: emailError || undefined,
      },
      { status: 200 }
    );
  } catch (err) {

    const msg = err instanceof Error ? err.message : "Failed to update scholarship status";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

