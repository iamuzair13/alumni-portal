import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { createEmailTemplate } from "@/lib/email";
import { generateMembershipPDF } from "@/lib/pdfGenerator";
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

export async function GET(request: NextRequest, ctx: { params: Promise<{ alumniId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { alumniId } = await ctx.params;
    const membershipIdNum = parseInt(String(alumniId), 10);
    if (isNaN(membershipIdNum) || membershipIdNum <= 0) {
      return NextResponse.json({ error: "Invalid membership ID" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const mode = (searchParams.get("mode") || "").toLowerCase();

    const membershipRows = await sql/* sql */`
      SELECT
        am.id,
        am.alumniid,
        am.gym_membership_month,
        am.swimmingpool_membership_month,
        a.alumniname,
        a.personalemail,
        a.universityemail,
        a.officialemail
      FROM public.alumni_memberships am
      JOIN public.tbl_alumni a ON a.alumniid = am.alumniid
      WHERE am.id = ${membershipIdNum}
      LIMIT 1
    `;

    if (!membershipRows[0]) {
      return NextResponse.json({ error: "Membership application not found" }, { status: 404 });
    }

    const membership = membershipRows[0] as {
      gym_membership_month: string | null;
      swimmingpool_membership_month: string | null;
      alumniname: string | null;
      personalemail: string | null;
      universityemail: string | null;
      officialemail: string | null;
    };

    const alumniName = String(membership.alumniname || "");
    const alumniEmail = String(membership.personalemail || membership.universityemail || membership.officialemail || "");
    const gymMonth = membership.gym_membership_month;
    const swimmingPoolMonth = membership.swimmingpool_membership_month;
    const membershipType = gymMonth ? "Gym" : swimmingPoolMonth ? "Swimming Pool" : "Membership";

    if (mode === "pdf") {
      const pdfBuffer = await generateMembershipPDF({
        alumniName,
        membershipType,
        gymMembershipMonth: gymMonth,
        swimmingPoolMembershipMonth: swimmingPoolMonth,
      });

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename=Membership_Application_${membershipIdNum}.pdf`,
          "Cache-Control": "no-store",
        },
      });
    }

    const pdfUrl = `/api/alumni/memberships/${membershipIdNum}?mode=pdf`;
    return NextResponse.json({ email: alumniEmail, pdfUrl }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch application preview";
    return NextResponse.json({ error: msg }, { status: 500 });
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

    // Only admins can update membership status
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

    // Fetch membership and alumni details before updating
    const membershipRows = await sql/* sql */`
      SELECT
        am.id,
        am.alumniid,
        am.gym_membership_month,
        am.swimmingpool_membership_month,
        a.alumniname,
        a.personalemail,
        a.universityemail,
        a.officialemail
      FROM public.alumni_memberships am
      JOIN public.tbl_alumni a ON a.alumniid = am.alumniid
      WHERE am.id = ${alumniIdNum}
      LIMIT 1
    `;

    if (!membershipRows[0]) {
      return NextResponse.json({ error: "Membership application not found" }, { status: 404 });
    }

    const membership = membershipRows[0] as {
      gym_membership_month: string | null;
      swimmingpool_membership_month: string | null;
      alumniname: string | null;
      personalemail: string | null;
      universityemail: string | null;
      officialemail: string | null;
    };

    const alumniName = String(membership.alumniname || "");
    const alumniEmail = String(membership.personalemail || membership.universityemail || membership.officialemail || "");
    const gymMonth = membership.gym_membership_month;
    const swimmingPoolMonth = membership.swimmingpool_membership_month;
    const membershipType = gymMonth ? "Gym" : swimmingPoolMonth ? "Swimming Pool" : "Membership";

    // Update membership status and rejection reason
    if (status === "not-approved") {
      await sql/* sql */`
        UPDATE public.alumni_memberships
        SET status = ${status}, reason = ${rejectionReason.trim()}
        WHERE id = ${alumniIdNum}
      `;
    } else {
      // Clear rejection reason when approving or setting to pending
      await sql/* sql */`
        UPDATE public.alumni_memberships
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
            let subject = "";
            const greeting = "Dear Applicant,";
            let emailBody = "";

            if (status === "approved") {
              // Determine membership type and set appropriate subject and content
              if (gymMonth) {
                // Gym membership approval
                subject = "Gym Membership Approved";
                emailBody = `
                  <p style="margin: 0 0 10px 0; color: #333333; font-size: 16px;">
                    We are pleased to inform you that your request for membership of the Gym Services has been <strong>approved</strong>.
                  </p>
                  <p style="margin: 10px 0; color: #333333; font-size: 16px;">
                    You may now proceed with the next steps required for activation of your membership. Please visit the <strong>Alumni Office</strong> with a printed copy of your application and any required documents for verification and further processing.
                  </p>
                  <p style="margin: 10px 0; color: #333333; font-size: 16px;">
                    Our team will guide you regarding membership activation, timings, and usage guidelines during your visit.
                  </p>
                  <p style="margin: 10px 0; color: #333333; font-size: 16px;">
                    If you have any questions, please feel free to contact us.
                  </p>
                  <p style="margin: 10px 0; color: #333333; font-size: 16px;">
                    We look forward to welcoming you and wish you a healthy and active experience.
                  </p>
                `;
              } else if (swimmingPoolMonth) {
                // Pool membership approval
                subject = "Pool Membership Approved";
                emailBody = `
                  <p style="margin: 0 0 10px 0; color: #333333; font-size: 16px;">
                    We are pleased to inform you that your request for membership of the Pool Services has been <strong>approved</strong>.
                  </p>
                  <p style="margin: 10px 0; color: #333333; font-size: 16px;">
                    You may now proceed with the next steps required for activation of your membership. Please visit the <strong>Alumni Office</strong> with a printed copy of your application and any required documents for verification and further processing.
                  </p>
                  <p style="margin: 10px 0; color: #333333; font-size: 16px;">
                    Our team will guide you regarding membership activation, timings, and usage guidelines during your visit.
                  </p>
                  <p style="margin: 10px 0; color: #333333; font-size: 16px;">
                    If you have any questions, please feel free to contact us.
                  </p>
                  <p style="margin: 10px 0; color: #333333; font-size: 16px;">
                    We look forward to welcoming you and wish you a healthy and active experience.
                  </p>
                `;
              } else {
                // Fallback for unknown membership type
                subject = "Membership Application Approved";
                emailBody = `
                  <p style="margin: 0 0 10px 0; color: #333333; font-size: 16px;">
                    We are pleased to inform you that your membership request has been <strong>approved</strong>.
                  </p>
                  <p style="margin: 10px 0; color: #333333; font-size: 16px;">
                    You may now proceed with the next steps required for activation of your membership. Please visit the <strong>Alumni Office</strong> with a printed copy of your application and any required documents for verification and further processing.
                  </p>
                  <p style="margin: 10px 0; color: #333333; font-size: 16px;">
                    Our team will guide you regarding membership activation, timings, and usage guidelines during your visit.
                  </p>
                  <p style="margin: 10px 0; color: #333333; font-size: 16px;">
                    If you have any questions, please feel free to contact us.
                  </p>
                `;
              }
            } else {
              // Not approved email - different content for gym vs pool
              if (gymMonth) {
                // Gym membership rejection
                subject = "Gym Membership Request Status";
                emailBody = `
                  <p style="margin: 0 0 10px 0; color: #333333; font-size: 16px;">
                    Thank you for your interest in availing the Gym Services.
                  </p>
                  <p style="margin: 10px 0; color: #333333; font-size: 16px;">
                    After careful review, we regret to inform you that your membership request <strong>cannot be approved at this time</strong>. This decision may be due to eligibility criteria, capacity limitations, or incomplete information provided in the application.
                  </p>
                  <p style="margin: 10px 0; color: #333333; font-size: 16px;">
                    You are welcome to reapply in the future once the requirements are fulfilled or when membership slots become available.
                  </p>
                  <p style="margin: 10px 0; color: #333333; font-size: 16px;">
                    For further clarification, you may contact the <strong>Alumni Office</strong> during working hours.
                  </p>
                  <p style="margin: 10px 0; color: #333333; font-size: 16px;">
                    Thank you for your understanding.
                  </p>
                `;
              } else if (swimmingPoolMonth) {
                // Pool membership rejection
                subject = "Pool Membership Request Status";
                emailBody = `
                  <p style="margin: 0 0 10px 0; color: #333333; font-size: 16px;">
                    Thank you for your interest in availing the Pool Services.
                  </p>
                  <p style="margin: 10px 0; color: #333333; font-size: 16px;">
                    After careful review, we regret to inform you that your membership request <strong>cannot be approved at this time</strong>. This decision may be due to eligibility criteria, capacity limitations, or incomplete information provided in the application.
                  </p>
                  <p style="margin: 10px 0; color: #333333; font-size: 16px;">
                    You are welcome to reapply in the future once the requirements are fulfilled or when membership slots become available.
                  </p>
                  <p style="margin: 10px 0; color: #333333; font-size: 16px;">
                    For further clarification, you may contact the <strong>Alumni Office</strong> during working hours.
                  </p>
                  <p style="margin: 10px 0; color: #333333; font-size: 16px;">
                    Thank you for your understanding.
                  </p>
                `;
              } else {
                // Fallback for unknown membership type
                subject = "Membership Application Status Update";
                emailBody = `
                  <p style="margin: 0 0 10px 0; color: #333333; font-size: 16px;">
                    Thank you for submitting your membership request.
                  </p>
                  <p style="margin: 10px 0; color: #333333; font-size: 16px;">
                    After careful review, we regret to inform you that your request <strong>cannot be approved at this time</strong>. This decision may be due to eligibility criteria, capacity limitations, or incomplete information provided in the application.
                  </p>
                  <p style="margin: 10px 0; color: #333333; font-size: 16px;">
                    You are welcome to reapply in the future once the requirements are fulfilled or when membership slots become available.
                  </p>
                  <p style="margin: 10px 0; color: #333333; font-size: 16px;">
                    For further clarification, you may contact the <strong>Alumni Office</strong> during working hours.
                  </p>
                  <p style="margin: 10px 0; color: #333333; font-size: 16px;">
                    Thank you for your understanding.
                  </p>
                `;
              }
            }

            const footer = status === "approved" 
              ? "Kind regards,<br/>Office of Alumni Relations"
              : "Sincerely,<br/>Office of Alumni Relations";
            const html = createEmailTemplate(subject, greeting, emailBody, footer);

            const mailOptions: nodemailer.SendMailOptions = {
              from: `"${config.FROM_NAME}" <${config.FROM_EMAIL}>`,
              to: alumniEmail,
              subject,
              html,
            };

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
    const msg = err instanceof Error ? err.message : "Failed to update membership status";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ alumniId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can delete membership applications
    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { alumniId } = await ctx.params;
    const membershipId = parseInt(String(alumniId), 10);
    
    if (isNaN(membershipId) || membershipId <= 0) {
      return NextResponse.json({ error: "Invalid membership ID" }, { status: 400 });
    }

    // Check if membership exists
    const membershipRows = await sql/* sql */`
      SELECT id
      FROM public.alumni_memberships
      WHERE id = ${membershipId}
      LIMIT 1
    `;

    if (!membershipRows[0]) {
      return NextResponse.json({ error: "Membership application not found" }, { status: 404 });
    }

    // Delete the membership application
    await sql/* sql */`
      DELETE FROM public.alumni_memberships
      WHERE id = ${membershipId}
    `;

    return NextResponse.json({ success: true, message: "Membership application deleted successfully" }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete membership application";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
