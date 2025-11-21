import nodemailer from "nodemailer";

// Email configuration from environment variables
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_SECURE = process.env.SMTP_SECURE === "true";
const SMTP_USER = process.env.SMTP_USER || process.env.SMTP_EMAIL;
const SMTP_PASS = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER || "noreply@uol.edu.pk";
const FROM_NAME = process.env.FROM_NAME || "UOL Alumni Portal";

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE, // true for 465, false for other ports
  auth: SMTP_USER && SMTP_PASS ? {
    user: SMTP_USER,
    pass: SMTP_PASS,
  } : undefined,
  // For Gmail, you might need to enable "Less secure app access" or use OAuth2
  // For development, you can use services like Mailtrap or Ethereal Email
});

// Verify connection on first use (optional)
if (SMTP_USER && SMTP_PASS) {
  transporter.verify().then(() => {
    console.log("[Email] SMTP server is ready to send emails");
  }).catch((err) => {
    console.warn("[Email] SMTP server connection failed:", err.message);
    console.warn("[Email] Email functionality may not work. Check SMTP configuration.");
  });
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    // If SMTP is not configured, log the email instead of failing
    if (!SMTP_USER || !SMTP_PASS) {
      console.warn("[Email] SMTP not configured. Email would be sent:", {
        to: options.to,
        subject: options.subject,
      });
      console.warn("[Email] HTML content:", options.html.substring(0, 200) + "...");
      return false; // Return false but don't throw error
    }

    const mailOptions = {
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      subject: options.subject,
      text: options.text || options.html.replace(/<[^>]*>/g, ""), // Plain text version
      html: options.html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("[Email] Email sent successfully:", info.messageId);
    return true;
  } catch (error) {
    console.error("[Email] Failed to send email:", error);
    // Don't throw error - just log it so the application continues
    return false;
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
      You can access the portal at: <a href="${process.env.NEXT_PUBLIC_BASE_URL || "https://alumni.uol.edu.pk"}/signin" style="color: #007bff; text-decoration: underline;">Sign In</a>
    </p>
  `;
  const footer = "We look forward to your active participation in the alumni community. If you have any questions, please don't hesitate to contact us.";

  const html = createEmailTemplate(subject, greeting, body, footer);
  return await sendEmail({ to: alumniEmail, subject, html });
}

