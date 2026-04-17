import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

import { createEmailTemplate } from "@/lib/emailTemplate";

// Get email configuration from environment variables (read at runtime for Vercel compatibility)
function getEmailConfig() {
  const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
  const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
  const SMTP_SECURE = process.env.SMTP_SECURE === "true";
  const SMTP_USER = process.env.SMTP_USER || process.env.SMTP_EMAIL;
  const SMTP_PASS = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;
  const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER || "noreply@uol.edu.pk";
  const FROM_NAME = process.env.FROM_NAME || "UOL Alumni Portal";

  return {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
    FROM_EMAIL,
    FROM_NAME,
  };
}

// Create transporter dynamically (for Vercel compatibility)
let transporterCache: Transporter | null = null;

function getTransporter(): Transporter | null {
  const config = getEmailConfig();
  
  // Log configuration status (without sensitive data)
  if (!config.SMTP_USER || !config.SMTP_PASS) {
    console.warn("[Email] SMTP not configured. Missing SMTP_USER or SMTP_PASS");
    console.warn("[Email] SMTP_USER:", config.SMTP_USER ? "SET" : "NOT SET");
    console.warn("[Email] SMTP_PASS:", config.SMTP_PASS ? "SET" : "NOT SET");
    return null;
  }

  // Create new transporter if not cached or if config changed
  if (!transporterCache) {
    console.log("[Email] Creating SMTP transporter...");
    console.log("[Email] SMTP Host:", config.SMTP_HOST);
    console.log("[Email] SMTP Port:", config.SMTP_PORT);
    console.log("[Email] SMTP Secure:", config.SMTP_SECURE);
    console.log("[Email] SMTP User:", config.SMTP_USER);
    
    transporterCache = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE, // true for 465, false for other ports
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
    });
  }

  return transporterCache;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export type SendEmailResult = {
  ok: boolean;
  errorMessage?: string;
};

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const config = getEmailConfig();
    const transporter = getTransporter();

    // If SMTP is not configured, log the email instead of failing
    if (!transporter) {
      console.warn("[Email] SMTP not configured. Email would be sent:", {
        to: options.to,
        subject: options.subject,
      });
      console.warn("[Email] HTML content:", options.html.substring(0, 200) + "...");
      return false; // Return false but don't throw error
    }

    const mailOptions = {
      from: `"${config.FROM_NAME}" <${config.FROM_EMAIL}>`,
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      subject: options.subject,
      text: options.text || options.html.replace(/<[^>]*>/g, ""), // Plain text version
      html: options.html,
    };

    console.log("[Email] Attempting to send email to:", options.to);
    const info = await transporter.sendMail(mailOptions);
    console.log("[Email] Email sent successfully!");
    console.log("[Email] Message ID:", info.messageId);
    console.log("[Email] Response:", info.response);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("[Email] Failed to send email:");
    console.error("[Email] Error:", errorMessage);
    if (errorStack) {
      console.error("[Email] Stack:", errorStack);
    }
    // Don't throw error - just log it so the application continues
    return false;
  }
}

export async function sendEmailDetailed(options: EmailOptions): Promise<SendEmailResult> {
  try {
    const config = getEmailConfig();
    const transporter = getTransporter();

    if (!transporter) {
      return { ok: false, errorMessage: "SMTP not configured" };
    }

    const mailOptions = {
      from: `"${config.FROM_NAME}" <${config.FROM_EMAIL}>`,
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      subject: options.subject,
      text: options.text || options.html.replace(/<[^>]*>/g, ""),
      html: options.html,
    };

    await transporter.sendMail(mailOptions);
    return { ok: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { ok: false, errorMessage };
  }
}

// Export function to verify SMTP configuration
export async function verifySMTPConfig(): Promise<{ ok: boolean; message: string; details?: Record<string, unknown> }> {
  try {
    const config = getEmailConfig();
    
    if (!config.SMTP_USER || !config.SMTP_PASS) {
      return {
        ok: false,
        message: "SMTP not configured",
        details: {
          SMTP_USER: config.SMTP_USER ? "SET" : "NOT SET",
          SMTP_PASS: config.SMTP_PASS ? "SET" : "NOT SET",
          SMTP_HOST: config.SMTP_HOST,
          SMTP_PORT: config.SMTP_PORT,
        },
      };
    }

    const transporter = getTransporter();
    if (!transporter) {
      return {
        ok: false,
        message: "Failed to create transporter",
      };
    }

    await transporter.verify();
    return {
      ok: true,
      message: "SMTP configuration is valid and connection successful",
      details: {
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_SECURE,
        from: config.FROM_EMAIL,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      message: `SMTP verification failed: ${errorMessage}`,
    };
  }
}

// Specific email templates for different application types
export async function sendChaptersApplicationEmail(
  alumniEmail: string,
  alumniName: string,
  chapters: string[]
): Promise<boolean> {
  const subject = "Your Request for Joining / Changing UOL Alumni Chapter";
  const greeting = `Dear ${alumniName},`;
  const body = `
    <p style="margin: 0 0 10px 0; color: #333333; font-size: 16px;">
      Thank you for joining the  Alumni Chapters:
    </p>
    <ul style="margin: 10px 0; padding-left: 20px; color: #333333;">
      ${chapters.map(chapter => `<li style="margin: 5px 0;">${chapter}</li>`).join("")}
    </ul>
    <p style="margin: 15px 0 0 0; color: #333333; font-size: 16px;">
      You have successfully joined the Alumni Chapters.
    </p>
  `;
  const footer = "We appreciate your interest in staying connected with the UOL community.<br><br>Regards,<br>Office of Alumni Relations, EE2 Building 4th Floor<br>University of Lahore<br>alumni@uol.edu.pk";

  const html = createEmailTemplate(subject, greeting, body, footer);
  return await sendEmail({ to: alumniEmail, subject, html });
}

export async function sendAlumniCardApplicationReceivedEmail(
  alumniEmail: string,
  alumniName: string
): Promise<boolean> {
  const subject = "Your Application for UOL Alumni Honor Card";
  const greeting = `Dear ${alumniName},`;
  const body = `
    <p style="margin: 0; color: #333333; font-size: 16px;">
      This is an auto-generated email to confirm that we have successfully received your application for the UOL Alumni Card.
    </p>
    <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">
      Our team has begun processing your request. You will be notified via email or SMS once your alumni card is ready for collection or dispatch.
    </p>
  `;
  const footer = "Warm regards,<br>Office of Alumni Relations, EE2 Building 4th Floor<br>University of Lahore<br>alumni@uol.edu.pk";

  const html = createEmailTemplate(subject, greeting, body, footer);
  return await sendEmail({ to: alumniEmail, subject, html });
}

export async function sendAlumniCardOnHoldEmail(
  alumniEmail: string,
  alumniName: string,
  onHoldReasons: string
): Promise<boolean> {
  const subject = "Your UOL Alumni Card is On-Hold";
  const greeting = `Dear ${alumniName},`;
  const safeReasons = String(onHoldReasons || "").trim();
  const body = `
    <p style="margin: 0; color: #333333; font-size: 16px;">
      Thank you for applying for the UOL Alumni Card. After reviewing your application, we found that following required information or documents are missing or do not meet the criteria.
    </p>
    ${safeReasons ? `
    <div style="margin: 14px 0; padding: 12px 14px; border: 1px solid #fde68a; border-radius: 10px; background: #fffbeb; color: #92400e; white-space: pre-line;">
      ${safeReasons}
    </div>
    ` : ""}
    <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Your application is currently on hold.</p>
    <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Kindly arrange to provide the required information so your application can be processed.</p>
  `;
  const footer = "Warm regards,<br>Office of Alumni Relations, EE2 Building 4th Floor<br>University of Lahore<br>alumni@uol.edu.pk";

  const html = createEmailTemplate(subject, greeting, body, footer);
  return await sendEmail({ to: alumniEmail, subject, html });
}

export async function sendSwimmingPoolMembershipEmail(
  alumniEmail: string,
  alumniName: string,
  month: string
): Promise<boolean> {
  const subject = "UOL Swimming Pool Membership Application – Update on Your Application";
  const greeting = `Dear ${alumniName},`;
  const body = `
    <p style="margin: 0 0 10px 0; color: #333333; font-size: 16px;">Thank you for applying for the UOL Swimming Pool Facility.</p>
    <p style="margin: 10px 0; color: #333333; font-size: 16px;">Being an alumnus of UOL, you are availing a special discount on your swimming pool fee for ${month}. Your application has been received and is currently being processed.</p>
    <p style="margin: 15px 0 0 0; color: #333333; font-size: 16px;">You will be notified once your access is activated.</p>
  `;
  const footer = "Warm regards,<br>Office of Alumni Relations, EE2 Building 4th Floor<br>University of Lahore";

  const html = createEmailTemplate(subject, greeting, body, footer);
  return await sendEmail({ to: alumniEmail, subject, html });
}

export async function sendMentorshipApplicationEmail(
  alumniEmail: string,
  alumniName: string,
  major: string,
  area: string,
  topic: string,
  mode: string,
  availability: string
): Promise<boolean> {
  const subject = "Alumni Talk";
  const greeting = `Dear ${alumniName},`;
  const body = `
    <p style="margin: 0 0 10px 0; color: #333333; font-size: 16px;">Thank you for your application to lead an Alumni Talk. Below are the details you submitted:</p>
    <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
      <tr>
        <td style="padding: 8px 0; font-weight: bold; color: #333333; width: 40%;">Major / Specialization:</td>
        <td style="padding: 8px 0; color: #555555;">${major}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold; color: #333333;">Area of Experience:</td>
        <td style="padding: 8px 0; color: #555555;">${area} years</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold; color: #333333;">Topic:</td>
        <td style="padding: 8px 0; color: #555555;">${topic}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold; color: #333333;">Mode:</td>
        <td style="padding: 8px 0; color: #555555;">${mode}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold; color: #333333; vertical-align: top;">Availability:</td>
        <td style="padding: 8px 0; color: #555555; white-space: pre-line;">${availability}</td>
      </tr>
    </table>
    <p style="margin: 15px 0 0 0; color: #333333; font-size: 16px;">Your application has been received and is currently under review. We will contact you soon with updates.</p>
    <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Thank you for your commitment to inspiring and guiding the next generation of UOL students.</p>
  `;
  const footer = "Regards,<br>Office of Alumni Relations, EE2 Building 4th Floor<br>University of Lahore";

  const html = createEmailTemplate(subject, greeting, body, footer);
  return await sendEmail({ to: alumniEmail, subject, html });
}

export async function sendAssociationApplicationEmail(
  alumniEmail: string,
  alumniName: string,
  role: string
): Promise<boolean> {
  const subject = "Your Application for Association Leadership Role";
  const greeting = `Dear ${alumniName},`;
  const body = `
    <p style="margin: 0 0 10px 0; color: #333333; font-size: 16px;">
      Thank you for your application to join the Alumni Association as <strong>${role}</strong>.
    </p>
    <p style="margin: 10px 0; color: #333333; font-size: 16px;">
      Your application has been received and is under review by the Alumni Office. We will contact you soon with updates regarding your application.
    </p>
    <p style="margin: 15px 0 0 0; color: #333333; font-size: 16px;">
      We appreciate your interest in contributing to the UOL Alumni Association and helping to strengthen our alumni network.
    </p>
  `;
  const footer = "Regards,<br>Office of Alumni Relations, EE2 Building 4th Floor<br>University of Lahore";

  const html = createEmailTemplate(subject, greeting, body, footer);
  return await sendEmail({ to: alumniEmail, subject, html });
}

export async function sendSuccessStoryEmail(
  alumniEmail: string,
  alumniName: string
): Promise<boolean> {
  const subject = "Success Story";
  const greeting = `Dear ${alumniName},`;
  const body = `
    <p style="margin: 0 0 10px 0; color: #333333; font-size: 16px;">
      Thank you for sharing your success story with the UOL Alumni community!
    </p>
    <p style="margin: 10px 0; color: #333333; font-size: 16px;">
      Your story has been received and will be reviewed by our team. Once approved, it will be published on the Alumni Portal to inspire other graduates.
    </p>
    <p style="margin: 15px 0 0 0; color: #333333; font-size: 16px;">
      We appreciate you taking the time to share your journey and contribute to the alumni network.
    </p>
  `;
  const footer = "Regards,<br>Office of Alumni Relations, EE2 Building 4th Floor<br>University of Lahore";

  const html = createEmailTemplate(subject, greeting, body, footer);
  return await sendEmail({ to: alumniEmail, subject, html });
}

export async function sendWelcomeEmail(
  alumniEmail: string,
  alumniName: string,
  generatedPassword: string,
  sapIdOrRegNo: string
): Promise<boolean> {
  const subject = "Your Alumni Registration is Approved!";
  const greeting = `Dear ${alumniName},`;
  const body = `
    <p style="margin: 0; color: #333333; font-size: 16px;">
      Welcome to the UOL vibrant alumni community. Your account has been successfully created and below are your Login Credentials:
    </p>
    <div style="margin: 16px 0; padding: 14px; border: 1px solid #e5e7eb; border-radius: 10px; background: #f9fafb;">
      <p style="margin: 0; font-size: 14px;"><strong>SAP ID / Registration No:</strong> ${sapIdOrRegNo || "-"}</p>
      <p style="margin: 6px 0 0 0; font-size: 14px;"><strong>Temporary Password:</strong> ${generatedPassword}</p>
    </div>
    <p style="margin: 0; color: #333333; font-size: 14px;">
      Please log in UOL Alumni portal using above credentials and change your password from your profile settings for security reasons.
    </p>
    <p style="margin: 10px 0 0 0; color: #333333; font-size: 14px;">
      Portal Login: <a href="${process.env.NEXT_PUBLIC_BASE_URL || "https://portal-alumni.uol.edu.pk"}/signin" style="color: #007bff; text-decoration: underline;">${process.env.NEXT_PUBLIC_BASE_URL || "https://portal-alumni.uol.edu.pk"}/signin</a>
    </p>
    <p style="margin: 12px 0 0 0; color: #333333; font-size: 14px;">We look forward to your active participation in the alumni community.</p>
  `;
  const footer = "Regards,<br>Office of Alumni Relations, EE2 Building 4th Floor<br>University of Lahore<br>alumni@uol.edu.pk";

  const html = createEmailTemplate(subject, greeting, body, footer);
  return await sendEmail({ to: alumniEmail, subject, html });
}

export async function sendGymMembershipEmail(
  alumniEmail: string,
  alumniName: string,
  month: string
): Promise<boolean> {
  const subject = "UOL Gym Membership Application";
  const greeting = `Dear ${alumniName},`;
  const body = `
    <p style="margin: 0 0 10px 0; color: #333333; font-size: 16px;">
      Thank you for applying for the UOL Gym Facility.
    </p>
    <p style="margin: 10px 0; color: #333333; font-size: 16px;">
      Being an alumnus of UOL, you are availing a special discount on your gym fee for ${month}. Your application has been received and is currently being processed.
    </p>
    <p style="margin: 15px 0 0 0; color: #333333; font-size: 16px;">
      You will be notified once your access is activated.
    </p>
    <p style="margin: 10px 0 0 0; color: #333333; font-size: 16px;">
      If you have any questions, feel free to contact us.
    </p>
  `;
  const footer = "Warm regards,<br>Office of Alumni Relations, EE2 Building 4th Floor<br>University of Lahore";

  const html = createEmailTemplate(subject, greeting, body, footer);
  return await sendEmail({ to: alumniEmail, subject, html });
}


export async function sendAlumniCardActivatedEmail(
  alumniEmail: string,
  alumniName: string
): Promise<boolean> {
  const subject = "Your UOL Alumni Card Has Been Activated";
  const greeting = `Dear ${alumniName},`;
  const body = `
    <p style="margin: 0; color: #333333; font-size: 16px;">Great news!</p>
    <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Your UOL Alumni Card has been activated, and you can access its e-version through your alumni portal.</p>
    <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">For physical card collection, you may visit the UOL Alumni Relations Office on campus. Alternatively, if you would like us to dispatch the card to your address (within Pakistan only), please share your complete postal address and contact number. Once dispatched, a confirmation will be sent to you via email or SMS.</p>
  `;
  const footer = "Warm regards,<br>Office of Alumni Relations, EE2 Building 4th Floor<br>University of Lahore";

  const html = createEmailTemplate(subject, greeting, body, footer);
  return await sendEmail({ to: alumniEmail, subject, html });
}

export async function sendPasswordResetEmail(
  alumniEmail: string,
  alumniName: string,
  newPassword: string
): Promise<boolean> {
  const subject = "Password Reset Request";
  const greeting = `Dear ${alumniName},`;
  const body = `
    <p style="margin: 0; color: #333333; font-size: 16px;">You have requested to reset your password for the UOL Alumni Portal.</p>
    <div style="margin: 16px 0; padding: 14px; border: 1px solid #e5e7eb; border-radius: 10px; background: #f9fafb;">
      <p style="margin: 0; color: #333333; font-size: 14px;"><strong>Your New Password:</strong> <span style="font-family: monospace;">${newPassword}</span></p>
    </div>
    <p style="margin: 0; color: #333333; font-size: 14px;"><strong>Important Security Notice:</strong></p>
    <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #333333;">
      <li style="margin: 5px 0;">Please log in immediately and change this password from your profile settings.</li>
      <li style="margin: 5px 0;">Never share your password with anyone.</li>
      <li style="margin: 5px 0;">If you did not request this password reset, please contact us immediately.</li>
    </ul>
    <p style="margin: 12px 0 0 0; color: #333333; font-size: 14px;">Portal Login: <a href="${process.env.NEXT_PUBLIC_BASE_URL || "https://portal-alumni.uol.edu.pk"}/signin" style="color: #007bff; text-decoration: underline;">${process.env.NEXT_PUBLIC_BASE_URL || "https://portal-alumni.uol.edu.pk"}/signin</a></p>
  `;
  const footer = "Regards,<br>Office of Alumni Relations, EE2 Building 4th Floor<br>University of Lahore<br>alumni@uol.edu.pk";

  const html = createEmailTemplate(subject, greeting, body, footer);
  return await sendEmail({ to: alumniEmail, subject, html });
}

