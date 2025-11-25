import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

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

// Email template helpers
export function createEmailTemplate(
  title: string,
  greeting: string,
  body: string,
  footer?: string
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px;">University of Lahore</h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 16px;">Alumni Portal</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 20px;">${title}</h2>
              
              <p style="margin: 0 0 15px 0; color: #555555; font-size: 16px; line-height: 1.6;">
                ${greeting}
              </p>
              
              <div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #667eea; border-radius: 4px;">
                ${body}
              </div>
              
              ${footer ? `
              <p style="margin: 20px 0 0 0; color: #777777; font-size: 14px; line-height: 1.6;">
                ${footer}
              </p>
              ` : ''}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="margin: 0; color: #777777; font-size: 12px;">
                This is an automated email from the UOL Alumni Portal.<br>
                Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// Specific email templates for different application types
export async function sendChaptersApplicationEmail(
  alumniEmail: string,
  alumniName: string,
  chapters: string[]
): Promise<boolean> {
  const subject = "Alumni Chapters Application Received";
  const greeting = `Dear ${alumniName},`;
  const body = `
    <p style="margin: 0 0 10px 0; color: #333333; font-size: 16px;">
      Thank you for your application to join the following Alumni Chapters:
    </p>
    <ul style="margin: 10px 0; padding-left: 20px; color: #333333;">
      ${chapters.map(chapter => `<li style="margin: 5px 0;">${chapter}</li>`).join("")}
    </ul>
    <p style="margin: 15px 0 0 0; color: #333333; font-size: 16px;">
      Your application has been received and is under review. We will contact you soon with updates.
    </p>
  `;
  const footer = "We appreciate your interest in staying connected with the UOL community.";

  const html = createEmailTemplate(subject, greeting, body, footer);
  return await sendEmail({ to: alumniEmail, subject, html });
}

export async function sendMentorshipApplicationEmail(
  alumniEmail: string,
  alumniName: string,
  major: string,
  area: string,
  topic: string,
  day: string,
  time: string
): Promise<boolean> {
  const subject = "Alumni Talk Application Received";
  const greeting = `Dear ${alumniName},`;
  const body = `
    <p style="margin: 0 0 10px 0; color: #333333; font-size: 16px;">
      Thank you for your application to lead an Alumni Talk. Here are your application details:
    </p>
    <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
      <tr>
        <td style="padding: 8px 0; font-weight: bold; color: #333333;">Major/Specialization:</td>
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
        <td style="padding: 8px 0; font-weight: bold; color: #333333;">Availability:</td>
        <td style="padding: 8px 0; color: #555555;">${day} at ${time}</td>
      </tr>
    </table>
    <p style="margin: 15px 0 0 0; color: #333333; font-size: 16px;">
      Your application has been received and is under review. We will contact you soon with updates.
    </p>
  `;
  const footer = "Thank you for your commitment to inspiring and guiding the next generation of UOL students.";

  const html = createEmailTemplate(subject, greeting, body, footer);
  return await sendEmail({ to: alumniEmail, subject, html });
}

export async function sendAssociationApplicationEmail(
  alumniEmail: string,
  alumniName: string,
  role: string
): Promise<boolean> {
  const subject = "Alumni Association Application Received";
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
  const footer = "Your leadership and involvement are invaluable to our community.";

  const html = createEmailTemplate(subject, greeting, body, footer);
  return await sendEmail({ to: alumniEmail, subject, html });
}

export async function sendSuccessStoryEmail(
  alumniEmail: string,
  alumniName: string
): Promise<boolean> {
  const subject = "Success Story Submitted Successfully";
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
  const footer = "Your story can inspire the next generation of UOL students and alumni.";

  const html = createEmailTemplate(subject, greeting, body, footer);
  return await sendEmail({ to: alumniEmail, subject, html });
}

export async function sendWelcomeEmail(
  alumniEmail: string,
  alumniName: string,
  generatedPassword: string,
  sapIdOrRegNo: string
): Promise<boolean> {
  const subject = "Welcome to UOL Alumni Portal - Your Account Details";
  const greeting = `Dear ${alumniName},`;
  const body = `
    <p style="margin: 0 0 10px 0; color: #333333; font-size: 16px;">
      Welcome to the University of Lahore Alumni Portal! Your account has been successfully created.
    </p>
    <div style="margin: 20px 0; padding: 20px; background-color: #f0f7ff; border: 2px solid #007bff; border-radius: 8px;">
      <p style="margin: 0 0 10px 0; color: #333333; font-size: 16px; font-weight: bold;">
        Your Login Credentials:
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #333333; width: 40%;">SAP ID / Registration No:</td>
          <td style="padding: 8px 0; color: #555555;">${sapIdOrRegNo || "N/A"}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #333333;">Temporary Password:</td>
          <td style="padding: 8px 0; color: #007bff; font-size: 18px; font-weight: bold; font-family: monospace;">${generatedPassword}</td>
        </tr>
      </table>
    </div>
    <p style="margin: 15px 0 10px 0; color: #333333; font-size: 16px;">
      <strong>Important:</strong> Please log in using your SAP ID or email and the password above, then change your password from your profile settings for security.
    </p>
    <p style="margin: 10px 0; color: #333333; font-size: 16px;">
      You can access the portal at: <a href="${process.env.NEXT_PUBLIC_BASE_URL || "https://alumni-portal-uol.vercel.app"}/signin" style="color: #007bff; text-decoration: underline;">Sign In</a>
    </p>
  `;
  const footer = "We look forward to your active participation in the alumni community. If you have any questions, please don't hesitate to contact us.";

  const html = createEmailTemplate(subject, greeting, body, footer);
  return await sendEmail({ to: alumniEmail, subject, html });
}

export async function sendGymMembershipEmail(
  alumniEmail: string,
  alumniName: string,
  month: string
): Promise<boolean> {
  const subject = "Gym Facility Discount Confirmation";
  const greeting = `Dear ${alumniName},`;
  const body = `
    <p style="margin: 0 0 10px 0; color: #333333; font-size: 16px;">
      Thank you for applying for the UOL Gym Facility.
    </p>
    <p style="margin: 10px 0; color: #333333; font-size: 16px;">
      Being an alumni of UOL, you are availing a special discount on your gym fee for ${month}. Your application has been received and is currently being processed. You will be notified once your access is activated.
    </p>
    <p style="margin: 15px 0 0 0; color: #333333; font-size: 16px;">
      If you have any questions, feel free to contact us.
    </p>
  `;
  const footer = "Warm regards,<br>Office of Alumni Relations<br>University of Lahore";

  const html = createEmailTemplate(subject, greeting, body, footer);
  return await sendEmail({ to: alumniEmail, subject, html });
}

