import { createEmailTemplate } from "@/lib/emailTemplate";

export type EmailTemplateResult = {
  subject: string;
  html: string;
};

export const EMAIL_ACTION_TYPE = {
  ALUMNI_REGISTRATION_ACKNOWLEDGEMENT: "alumni.registration.acknowledgement",
  ALUMNI_VERIFY: "alumni.verify",
  ALUMNI_UNVERIFY: "alumni.unverify",
  ALUMNI_DELETE: "alumni.delete",
  ALUMNI_SEND_CREDENTIALS: "alumni.credentials.send",

  PASSWORD_RESET_REQUEST: "alumni.password.reset",

  ALUMNI_CARD_APPLICATION_ACK: "alumni.card.application.ack",
  ALUMNI_CARD_ONHOLD: "alumni.card.onhold",
  ALUMNI_CARD_READY_FOR_DELIVERY: "alumni.card.ready_for_delivery",
  ALUMNI_CARD_DELIVERED: "alumni.card.delivered",

  CHAPTER_MEMBERSHIP_ACK: "alumni.chapter.membership.ack",
  ASSOCIATION_MEMBERSHIP_ACK: "alumni.association.membership.ack",

  ASSOCIATION_LEADERSHIP_ACK: "leadership.association.received",
  CHAPTER_LEADERSHIP_ACK: "leadership.chapter.received",
  ASSOCIATION_LEADERSHIP_APPROVED: "leadership.association.approved",
  ASSOCIATION_LEADERSHIP_NOT_APPROVED: "leadership.association.not_approved",
  CHAPTER_LEADERSHIP_APPROVED: "leadership.chapter.approved",
  CHAPTER_LEADERSHIP_NOT_APPROVED: "leadership.chapter.not_approved",

  ALUMNI_SCHOLARSHIP_RECEIVED: "alumni.scholarship.received",
  ALUMNI_SCHOLARSHIP_APPROVED: "alumni.scholarship.approved",
  ALUMNI_SCHOLARSHIP_NOT_APPROVED: "alumni.scholarship.not_approved",

  ALUMNI_MEMBERSHIP_RECEIVED: "alumni.membership.received",
  ALUMNI_MEMBERSHIP_APPROVED: "alumni.membership.approved",
  ALUMNI_MEMBERSHIP_NOT_APPROVED: "alumni.membership.not_approved",

  UOL_GYM_MEMBERSHIP_RECEIVED: "membership.gym.received",
  UOL_GYM_MEMBERSHIP_APPROVED: "membership.gym.approved",
  UOL_GYM_MEMBERSHIP_NOT_APPROVED: "membership.gym.not_approved",

  SWIMMING_POOL_MEMBERSHIP_RECEIVED: "membership.swimming.received",
  SWIMMING_POOL_MEMBERSHIP_APPROVED: "membership.swimming.approved",
  SWIMMING_POOL_MEMBERSHIP_NOT_APPROVED: "membership.swimming.not_approved",

  LQCC_MEMBERSHIP_RECEIVED: "membership.lqcc.received",
  LQCC_MEMBERSHIP_APPROVED: "membership.lqcc.approved",
  LQCC_MEMBERSHIP_NOT_APPROVED: "membership.lqcc.not_approved",

  SUCCESS_STORY_RECEIVED: "alumni.success_story.received",
  SUCCESS_STORY_APPROVED: "alumni.success_story.approved",
  SUCCESS_STORY_NOT_APPROVED: "alumni.success_story.not_approved",

  ALUMNI_TALK_APPLICATION_ACK: "alumni.talk.application.ack",
  ALUMNI_TALK_CONFIRM: "alumni.talk.confirm",
  ALUMNI_TALK_MARK_CONDUCTED: "alumni.talk.mark_conducted",
  ALUMNI_TALK_CANCEL: "alumni.talk.cancel",
  ALUMNI_TALK_PROPOSE_SLOT: "alumni.talk.propose_slot",

  LEADERSHIP_RECOMMENDATION: "leadership.recommendation",
} as const;

export type EmailActionType = (typeof EMAIL_ACTION_TYPE)[keyof typeof EMAIL_ACTION_TYPE];

function getPortalBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL || "https://portal-alumni.uol.edu.pk";
}

function footerRegards() {
  return "Regards,<br>Office of Alumni Relations, EE2 Building 4th Floor<br>University of Lahore<br>alumni@uol.edu.pk";
}

function footerWarmRegards() {
  return "Warm regards,<br>Office of Alumni Relations, EE2 Building 4th Floor<br>University of Lahore<br>alumni@uol.edu.pk";
}

export function generateAdminActionEmail(input: {
  actionType: EmailActionType;
  alumniName: string;
  extraBodyHtml?: string;
  sapId?: string | number | null;
  regNo?: string | number | null;
  generatedPassword?: string | number | null;
}): EmailTemplateResult {
  const alumniName = input.alumniName || "Alumni";
  const greeting = `Dear ${alumniName},`;
  const extraBodyHtml = input.extraBodyHtml ? String(input.extraBodyHtml) : "";
  const portalUrl = getPortalBaseUrl();

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_REGISTRATION_ACKNOWLEDGEMENT) {
    const subject = "Welcome to the UOL Alumni Network!";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">We are delighted to welcome you to your alma mater and to the University of Lahore Alumni Network. By becoming part of this vibrant community, you will have the opportunity to reconnect with fellow graduates while enjoying a range of exclusive privileges designed especially for our alumni, including:</p>
      <ul style="margin: 12px 0 0 18px; color: #333333; font-size: 16px; line-height: 1.6;">
        <li>Discounted access to the university gym and other campus facilities</li>
        <li>Special discounts at the University of Lahore Hospital</li>
        <li>Eligibility for alumni scholarships and kinship tution discounts for your family members</li>
        <li>Exclusive invitations to job fairs, networking sessions, and professional events</li>
      </ul>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Your application will be reviewed by the Office of Alumni Relations, EE2 Building 4th Floor. Once approved, you will receive a confirmation email along with your login credentials.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">We look forward to welcoming you back and strengthening our lifelong connection with you.</p>
      ${extraBodyHtml}
    `;
    return { subject, html: createEmailTemplate(subject, "Dear Alumnus/Alumna,", body, footerWarmRegards()) };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_SEND_CREDENTIALS) {
    const subject = "Your Alumni Registration is Approved!";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">Welcome to the UOL vibrant alumni community. Your account has been successfully created and below are your Login Credentials:</p>
      ${extraBodyHtml}
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 14px;">Please log in UOL Alumni portal using above credentials and change your password from your profile settings for security reasons.</p>
      <p style="margin: 10px 0 0 0; color: #333333; font-size: 14px;">Portal Login: <a href="${portalUrl}/signin" style="color: #007bff; text-decoration: underline;">${portalUrl}/signin</a></p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 14px;">We look forward to your active participation in the alumni community.</p>
    `;
    return { subject, html: createEmailTemplate(subject, greeting, body, footerRegards()) };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_VERIFY) {
    const subject = "Your Alumni Registration is Approved!";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">Welcome to the UOL vibrant alumni community. Your account has been successfully created and below are your Login Credentials:</p>
      <div style="margin: 16px 0; padding: 14px; border: 1px solid #e5e7eb; border-radius: 10px; background: #f9fafb;">
        <p style="margin: 0; font-size: 14px;"><strong>SAP ID / Registration No:</strong> ${String(input.sapId ?? input.regNo ?? "-")}</p>
        <p style="margin: 6px 0 0 0; font-size: 14px;"><strong>Temporary Password:</strong> ${String(input.generatedPassword ?? "-")}</p>
      </div>
      <p style="margin: 0; color: #333333; font-size: 14px;">Please log in UOL Alumni portal using above credentials and change your password from your profile settings for security reasons.</p>
      <p style="margin: 10px 0 0 0; color: #333333; font-size: 14px;">Portal Login: <a href="${portalUrl}/signin" style="color: #007bff; text-decoration: underline;">${portalUrl}/signin</a></p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 14px;">We look forward to your active participation in the alumni community.</p>
      ${extraBodyHtml}
    `;
    return { subject, html: createEmailTemplate(subject, greeting, body, footerRegards()) };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_UNVERIFY) {
    const subject = "Alumni Registration Status Update";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">After reviewing your application, we regret to inform you that it has not been approved at this time.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 14px;">For further clarification regarding the status of your application, please feel free to contact the Office of Alumni Relations</p>
      ${extraBodyHtml}
    `;
    return { subject, html: createEmailTemplate(subject, greeting, body, footerWarmRegards()) };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.PASSWORD_RESET_REQUEST) {
    const subject = "Password Reset Request";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">You have requested to reset your password for the UOL Alumni Portal.</p>
      ${extraBodyHtml}
      <div style="margin: 16px 0; padding: 14px; border: 1px solid #e5e7eb; border-radius: 10px; background: #f9fafb;">
        <p style="margin: 0; font-size: 14px;"><strong>Your New Password:</strong> {NEW_PASSWORD}</p>
      </div>
      <p style="margin: 0; color: #333333; font-size: 14px;"><strong>Important Security Notice:</strong></p>
      <ul style="margin: 8px 0 0 18px; color: #333333; font-size: 14px; line-height: 1.6;">
        <li>Please log in immediately and change this password from your profile settings.</li>
        <li>Never share your password with anyone.</li>
        <li>If you did not request this password reset, please contact us immediately.</li>
      </ul>
      <p style="margin: 10px 0 0 0; color: #333333; font-size: 14px;">Portal Login: <a href="${portalUrl}/signin" style="color: #007bff; text-decoration: underline;">${portalUrl}/signin</a></p>
    `;
    return { subject, html: createEmailTemplate(subject, greeting, body, footerRegards()) };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_CARD_APPLICATION_ACK) {
    const subject = "Your Application for UOL Alumni Honor Card";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">This is an auto-generated email to confirm that we have successfully received your application for the UOL Alumni Card.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Our team has begun processing your request. You will be notified via email or SMS once your alumni card is ready for collection or dispatch.</p>
      ${extraBodyHtml}
    `;
    return { subject, html: createEmailTemplate(subject, greeting, body, footerWarmRegards()) };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_CARD_ONHOLD) {
    const subject = "Your UOL Alumni Card is On-Hold";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">Thank you for applying for the UOL Alumni Card. After reviewing your application, we found that following required information or documents are missing or do not meet the criteria.</p>
      ${extraBodyHtml}
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Your application is currently on hold.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Kindly arrange to provide the required information so your application can be processed.</p>
    `;
    return { subject, html: createEmailTemplate(subject, greeting, body, footerWarmRegards()) };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_CARD_READY_FOR_DELIVERY) {
    const subject = "Your UOL Alumni Card Has Been Activated";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">Great news!</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Your UOL Alumni Card has been activated, and you can access its e-version through your alumni portal.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">For physical card collection, you may visit the UOL Alumni Relations Office on campus. Alternatively, if you would like us to dispatch the card to your address (within Pakistan only), please share your complete postal address and contact number. Once dispatched, a confirmation will be sent to you via email or SMS.</p>
      ${extraBodyHtml}
    `;
    return { subject, html: createEmailTemplate(subject, greeting, body, footerWarmRegards()) };
  }



  if (input.actionType === EMAIL_ACTION_TYPE.CHAPTER_MEMBERSHIP_ACK) {
    const subject = "Your Request for Joining / Changing UOL Alumni Chapter";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">Thank you for  joining the following Alumni Chapters:</p>
      ${extraBodyHtml}
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">You have success fully joined the Alumni Chapter.</p>
    `;
    return { subject, html: createEmailTemplate(subject, greeting, body, footerRegards()) };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ASSOCIATION_MEMBERSHIP_ACK) {
    const subject = "Your Request for Joining / Changing UOL Alumni Association";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">Thank you for joining the Alumni Association:</p>
      ${extraBodyHtml}
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">You have successfully joined the Alumni Association</p>
    `;
    return { subject, html: createEmailTemplate(subject, greeting, body, footerRegards()) };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.CHAPTER_LEADERSHIP_ACK) {
    const subject = "Your Application for Chapter Leadership Role";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">Thank you for your application for the role of <strong>{ROLE}</strong> with the UOL Alumni Chapter.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Your application has been received and is currently under review by the Office of Alumni Relations, EE2 Building 4th Floor. We will contact you soon with updates regarding your application.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">We appreciate your interest in serving your chapter and helping to strengthen the UOL alumni network.</p>
      ${extraBodyHtml}
    `;
    return { subject, html: createEmailTemplate(subject, greeting, body, footerRegards()) };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ASSOCIATION_LEADERSHIP_ACK) {
    const subject = "Your Application for Association Leadership Role";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">Thank you for your application to join the Alumni Association as {ROLE}.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Your application has been received and is currently under review by the Alumni Office. We will contact you soon with updates regarding your application.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">We appreciate your interest in contributing to the UOL Alumni Association and helping to strengthen our alumni network.</p>
      ${extraBodyHtml}
    `;
    return { subject, html: createEmailTemplate(subject, greeting, body, "Regards,<br>Office of Alumni Relations, EE2 Building 4th Floor") };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.CHAPTER_LEADERSHIP_APPROVED) {
    const subject = "Your Chapter Leadership Application Has Been Approved";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">
        Congratulations! Your application for the role of <strong>{ROLE}</strong> in <strong>{ORG}</strong> has been approved.
      </p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">
        We’re excited to have you move forward in the process. Our team will be in touch with you soon to provide detailed information on the next steps and explain how everything will work.
      </p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">
        Please keep an eye out for further updates.
      </p>
      ${extraBodyHtml}
    `;
    return { subject, html: createEmailTemplate(subject, greeting, body, footerWarmRegards()) };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ASSOCIATION_LEADERSHIP_APPROVED) {
    const subject = "Your Association Leadership Application Has Been Approved";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">
        Congratulations! Your application for the role of <strong>{ROLE}</strong> in <strong>{ORG}</strong> has been approved.
      </p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">
        We’re excited to have you move forward in the process. Our team will be in touch with you soon to provide detailed information on the next steps and explain how everything will work.
      </p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">
        Please keep an eye out for further updates.
      </p>
      ${extraBodyHtml}
    `;
    return { subject, html: createEmailTemplate(subject, greeting, body, footerWarmRegards()) };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.CHAPTER_LEADERSHIP_NOT_APPROVED) {
    const subject = "Chapter Leadership Application — Not Approved";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">
        We regret to inform you that your application for <strong>{ROLE}</strong> of <strong>{ORG}</strong> has not been approved at this time. After careful review, we found that it does not fully meet the required criteria.
      </p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">
        Please don't be discouraged! We welcome you to submit a revised application in the future once you feel it better represents your skills and potential when the position will be vacant.
      </p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">
        Thank you for your interest, and we wish you the very best of luck in your future endeavours.
      </p>
      ${extraBodyHtml}
    `;
    return { subject, html: createEmailTemplate(subject, greeting, body, footerWarmRegards()) };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ASSOCIATION_LEADERSHIP_NOT_APPROVED) {
    const subject = "Association Leadership Application — Not Approved";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">
        We regret to inform you that your application for <strong>{ROLE}</strong> of <strong>{ORG}</strong> has not been approved at this time. After careful review, we found that it does not fully meet the required criteria.
      </p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">
        Please don't be discouraged! We welcome you to submit a revised application in the future once you feel it better represents your skills and potential when the position will be vacant.
      </p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">
        Thank you for your interest, and we wish you the very best of luck in your future endeavours.
      </p>
      ${extraBodyHtml}
    `;
    return { subject, html: createEmailTemplate(subject, greeting, body, footerWarmRegards()) };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_SCHOLARSHIP_RECEIVED) {
    const subject = "Scholarship Application (Self / Kinship) – Received";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">Thank you for submitting your Scholarship Application (Self / Kinship).</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">We are pleased to inform you that your application has been successfully received and is currently under review by the concerned department. You will be notified once the evaluation process is completed.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">If any additional documents or information are required, our team will contact you accordingly.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">For further queries, please feel free to reach out to us.</p>
      ${extraBodyHtml}
    `;
    return { subject, html: createEmailTemplate(subject, `Dear ${alumniName},`, body, footerWarmRegards()) };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_SCHOLARSHIP_APPROVED) {
    const subject = "Approval Status";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">We are pleased to inform you that your Scholarship Application (Self / Kinship) has been approved.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Congratulations! The relevant department will proceed with the necessary formalities and adjustments as per university policy. If any further documentation or action is required from your side, you will be informed accordingly.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Should you have any questions, please feel free to contact us.</p>
      ${extraBodyHtml}
    `;
    return { subject, html: createEmailTemplate(subject, `Dear ${alumniName},`, body, footerWarmRegards()) };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.UOL_GYM_MEMBERSHIP_RECEIVED) {
    const subject = "UOL Gym Membership Application";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">Thank you for applying for the UOL Gym Facility.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Being an alumnus of UOL, you are availing a special discount on your gym fee for {MONTH}. Your application has been received and is currently being processed.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">You will be notified once your access is activated.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">If you have any questions, feel free to contact us.</p>
      ${extraBodyHtml}
    `;
    return { subject, html: createEmailTemplate(subject, greeting, body, footerWarmRegards()) };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.UOL_GYM_MEMBERSHIP_APPROVED) {
    const subject = "UOL Gym Membership Application – Update on Your Application";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">We are pleased to inform you that your application for the UOL Gym Facility has been approved.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">As a valued alumnus of UOL, you are entitled to a special discounted gym fee for {MONTH}. Your access has now been activated, and you may proceed with the necessary formalities at the Sports Complex.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Should you require any further assistance, please feel free to contact us.</p>
      ${extraBodyHtml}
    `;
    return { subject, html: createEmailTemplate(subject, greeting, body, footerWarmRegards()) };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.UOL_GYM_MEMBERSHIP_NOT_APPROVED) {
    const subject = "UOL Gym Membership Application – Update on Your Application";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">Thank you for applying for the UOL Gym Facility.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">After reviewing your application, we regret to inform you that it has not been approved at this time. For further clarification regarding the status of your application, please feel free to contact the Office of Alumni Relations</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">We appreciate your interest and look forward to assisting you in the future.</p>
      ${extraBodyHtml}
    `;
    return { subject, html: createEmailTemplate(subject, greeting, body, footerWarmRegards()) };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.SWIMMING_POOL_MEMBERSHIP_RECEIVED) {
    const subject = "UOL Swimming Pool Membership Application – Update on Your Application";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">Thank you for applying for the UOL Swimming Pool Facility.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Being an alumnus of UOL, you are availing a special discount on your swimming pool fee for {MONTH}. Your application has been received and is currently being processed.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">You will be notified once your access is activated.</p>
      ${extraBodyHtml}
    `;
    return { subject, html: createEmailTemplate(subject, greeting, body, footerWarmRegards()) };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.SWIMMING_POOL_MEMBERSHIP_APPROVED) {
    const subject = "UOL Swimming Pool Membership Application – Update on Your Application";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">We are pleased to inform you that your application for the UOL pool Facility has been approved.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">As a valued alumnus of UOL, you are entitled to a special discounted pool fee for {MONTH}. Your access has now been activated, and you may proceed with the necessary formalities at the Sports Complex.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Should you require any further assistance, please feel free to contact us.</p>
      ${extraBodyHtml}
    `;
    return { subject, html: createEmailTemplate(subject, greeting, body, footerWarmRegards()) };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.SWIMMING_POOL_MEMBERSHIP_NOT_APPROVED) {
    const subject = "UOL Swimming Pool Membership Application – Update on Your Application";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">Thank you for applying for the UOL Swimming Pool Facility.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">After reviewing your application, we regret to inform you that it has not been approved at this time. For further clarification regarding the status of your application, please feel free to contact the Office of Alumni Relations</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">We appreciate your interest and look forward to assisting you in the future.</p>
      ${extraBodyHtml}
    `;
    return { subject, html: createEmailTemplate(subject, greeting, body, footerWarmRegards()) };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.LQCC_MEMBERSHIP_RECEIVED) {
    const subject = "Lahore Qalander Cricket Club Membership Application – Update on Your Application";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">Thank you for submitting your membership application for the Lahore Qalandars Cricket Club.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">We are pleased to inform you that your application has been successfully received and is currently under review. Our team will evaluate the submitted details and notify you once a decision has been made regarding your membership status.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">If any additional information is required, we will contact you accordingly.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Thank you for your interest in being a part of the Lahore Qalandars community.</p>
      ${extraBodyHtml}
    `;
    return { subject, html: createEmailTemplate(subject, `Dear ${alumniName},`, body, footerWarmRegards()) };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.LQCC_MEMBERSHIP_APPROVED) {
    const subject = "Lahore Qalander Cricket Club Membership Application – Update on Your Application";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">We are pleased to inform you that your application for the Lahore Qalandars Cricket Club Membership has been approved.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Congratulations and welcome to the club! Further details regarding membership benefits, access, and next steps will be shared with you shortly.</p>
      ${extraBodyHtml}
    `;
    return { subject, html: createEmailTemplate(subject, `Dear ${alumniName},`, body, footerWarmRegards()) };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.LQCC_MEMBERSHIP_NOT_APPROVED) {
    const subject = "Lahore Qalander Cricket Club Membership Application – Update on Your Application";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">Thank you for your interest in becoming a member of the Lahore Qalandars Cricket Club.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">After careful review, we regret to inform you that your application has not been approved at this time.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">We appreciate your interest in the club and encourage you to apply again in the future.</p>
      ${extraBodyHtml}
    `;
    return { subject, html: createEmailTemplate(subject, `Dear ${alumniName},`, body, footerWarmRegards()) };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.SUCCESS_STORY_RECEIVED) {
    const subject = "Success Story - Received";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">Thank you for sharing your success story with the UOL Alumni community.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Your story has been received and will be reviewed by our team. Once approved, it will be published on the Alumni Portal to inspire other graduates.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">We appreciate you taking the time to share your journey and contribute to the alumni network.</p>
      ${extraBodyHtml}
    `;
    return { subject, html: createEmailTemplate(subject, greeting, body, footerRegards()) };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.SUCCESS_STORY_APPROVED) {
    const subject = "Success Story - Approved";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">We are pleased to inform you that your success story has been approved and is now published on the Alumni Portal.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Thank you for sharing your journey and inspiring fellow UOL graduates.</p>
      ${extraBodyHtml}
    `;
    return { subject, html: createEmailTemplate(subject, greeting, body, footerWarmRegards()) };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.SUCCESS_STORY_NOT_APPROVED) {
    const subject = "Success Story - Not Approved";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">Thank you for sharing your success story with the UOL Alumni community.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">After reviewing your submission, we regret to inform you that it has not been approved at this time.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">You are welcome to revise your story and submit it again for review.</p>
      ${extraBodyHtml}
    `;
    return { subject, html: createEmailTemplate(subject, greeting, body, footerWarmRegards()) };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_TALK_APPLICATION_ACK) {
    const subject = "Alumni Talk - Application Acknowledgement";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">Thank you for your application to lead an Alumni Talk. Below are the details you submitted:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #333333; width: 40%;">Major / Specialization:</td>
          <td style="padding: 8px 0; color: #555555;">{Major}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #333333;">Area of Experience:</td>
          <td style="padding: 8px 0; color: #555555;">{Area} years</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #333333;">Topic:</td>
          <td style="padding: 8px 0; color: #555555;">{Topic}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #333333;">Mode:</td>
          <td style="padding: 8px 0; color: #555555;">{Mode}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #333333; vertical-align: top;">Availability:</td>
          <td style="padding: 8px 0; color: #555555; white-space: pre-line;">{Availability}</td>
        </tr>
      </table>
      ${extraBodyHtml}
      <p style="margin: 15px 0 0 0; color: #333333; font-size: 16px;">Your application has been received and is currently under review. We will contact you soon with updates.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Thank you for your commitment to inspiring and guiding the next generation of UOL students.</p>
    `;
    return { subject, html: createEmailTemplate(subject, greeting, body, footerRegards()) };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_TALK_CONFIRM) {
    const subject = "Alumni Talk Session - Confirmed";
    const body = `<p style="margin: 0; color: #333333; font-size: 16px;">Your alumni talk session has been <strong>confirmed</strong>. Please check the portal for the confirmed date and timings.</p>${extraBodyHtml}`;
    return { subject, html: createEmailTemplate(subject, greeting, body, "Regards,<br>Office of Alumni Relations, EE2 Building 4th Floor") };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_TALK_MARK_CONDUCTED) {
    const subject = "Alumni Talk Session - Marked as Conducted";
    const body = `<p style="margin: 0; color: #333333; font-size: 16px;">Your alumni talk session has been marked as <strong>Conducted</strong>. Thank you for your participation.</p>${extraBodyHtml}`;
    return { subject, html: createEmailTemplate(subject, greeting, body, "Regards,<br>Office of Alumni Relations, EE2 Building 4th Floor") };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_TALK_CANCEL) {
    const subject = "Alumni Talk Session - Cancelled";
    const body = `<p style="margin: 0; color: #333333; font-size: 16px;">Your alumni talk session has been <strong>cancelled</strong>. Please check the portal for details.</p>${extraBodyHtml}`;
    return { subject, html: createEmailTemplate(subject, greeting, body, "Regards,<br>Office of Alumni Relations, EE2 Building 4th Floor") };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_TALK_PROPOSE_SLOT) {
    const subject = "Alumni Talk Session - Proposed Slot";
    const body = `<p style="margin: 0; color: #333333; font-size: 16px;">A new slot has been proposed for your alumni talk session. Please check the details below and confirm.</p>${extraBodyHtml}`;
    return { subject, html: createEmailTemplate(subject, greeting, body, "Regards,<br>Office of Alumni Relations, EE2 Building 4th Floor") };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.LEADERSHIP_RECOMMENDATION) {
    const subject = "Recommendation for an Alternative Alumni Leadership Position";
    const body = `
      <p style="margin: 0; color: #333333; font-size: 16px;">Thank you for your interest in serving in a leadership role within the UOL Alumni Network and for taking the time to submit your application.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">After carefully reviewing your application, we have determined that you do not currently meet the eligibility criteria for the leadership position you initially applied for. However, we were impressed by your profile and would like to recommend you for the position of <strong>{RECOMMENDED_ROLE}</strong> for the <strong>{ORG}</strong>.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">If you are interested in being considered for this role, please indicate your response by selecting one of the following options:</p>
      <ul style="margin: 12px 0 0 18px; color: #333333; font-size: 16px; line-height: 1.8;">
        <li><strong>Yes</strong> \u2013 I accept the recommendation for the proposed position.</li>
        <li><strong>No</strong> \u2013 I do not wish to be considered for the proposed position.</li>
      </ul>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">We appreciate your willingness to contribute to the UOL Alumni community and look forward to your response.</p>
      ${extraBodyHtml}
    `;
    return { subject, html: createEmailTemplate(subject, greeting, body, "Warm regards,<br>UOL Alumni Relations Team") };
  }

  const subject = "Alumni Account Update";
  const body = `<p style="margin: 0; color: #333333; font-size: 16px;">Your alumni record status has been updated by the Alumni Office.</p>${extraBodyHtml}`;
  return {
    subject,
    html: createEmailTemplate(subject, greeting, body, "Regards,<br>Office of Alumni Relations, EE2 Building 4th Floor"),
  };
}
