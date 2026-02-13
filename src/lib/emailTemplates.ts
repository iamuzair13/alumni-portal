export const EMAIL_ACTION_TYPE = {
  ALUMNI_VERIFY: "alumni.verify",
  ALUMNI_UNVERIFY: "alumni.unverify",
  ALUMNI_DELETE: "alumni.delete",

  ALUMNI_CARD_ONHOLD: "alumni.card.onhold",
  ALUMNI_CARD_READY_FOR_DELIVERY: "alumni.card.ready_for_delivery",
  ALUMNI_CARD_DELIVERED: "alumni.card.delivered",

  ALUMNI_TALK_CONFIRM: "alumni.talk.confirm",
  ALUMNI_TALK_MARK_CONDUCTED: "alumni.talk.mark_conducted",
  ALUMNI_TALK_CANCEL: "alumni.talk.cancel",
  ALUMNI_TALK_PROPOSE_SLOT: "alumni.talk.propose_slot",

  ALUMNI_SCHOLARSHIP_APPROVED: "alumni.scholarship.approved",
  ALUMNI_SCHOLARSHIP_NOT_APPROVED: "alumni.scholarship.not_approved",

  ALUMNI_SCHOLARSHIP_RECEIVED: "alumni.scholarship.received",

  ALUMNI_MEMBERSHIP_APPROVED: "alumni.membership.approved",
  ALUMNI_MEMBERSHIP_NOT_APPROVED: "alumni.membership.not_approved",

  ALUMNI_GYM_MEMBERSHIP_RECEIVED: "alumni.gym_membership.received",

  ALUMNI_SWIMMING_MEMBERSHIP_RECEIVED: "alumni.swimming_membership.received",
  ALUMNI_SWIMMING_MEMBERSHIP_APPROVED: "alumni.swimming_membership.approved",
  ALUMNI_SWIMMING_MEMBERSHIP_NOT_APPROVED: "alumni.swimming_membership.not_approved",

  ALUMNI_CRICKET_MEMBERSHIP_RECEIVED: "alumni.cricket_membership.received",
  ALUMNI_CRICKET_MEMBERSHIP_APPROVED: "alumni.cricket_membership.approved",
  ALUMNI_CRICKET_MEMBERSHIP_NOT_APPROVED: "alumni.cricket_membership.not_approved",

  CHAPTER_LEADERSHIP_APPROVED: "leadership.chapter.approved",
  CHAPTER_LEADERSHIP_NOT_APPROVED: "leadership.chapter.not_approved",

  ASSOCIATION_LEADERSHIP_APPROVED: "leadership.association.approved",
  ASSOCIATION_LEADERSHIP_NOT_APPROVED: "leadership.association.not_approved",

  ALUMNI_SEND_CREDENTIALS: "alumni.credentials.send",
} as const;

export type EmailActionType = (typeof EMAIL_ACTION_TYPE)[keyof typeof EMAIL_ACTION_TYPE];

export type EmailTemplateResult = {
  subject: string;
  html: string;
};

function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function createEmailTemplate(title: string, greeting: string, bodyHtml: string, footerHtml?: string): string {
  const footer = footerHtml
    ? `<p style="margin: 20px 0 0 0; color: #777777; font-size: 14px; line-height: 1.6;">${footerHtml}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px;">University of Lahore</h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 16px;">Alumni Portal</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;">
              <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 20px;">${escapeHtml(title)}</h2>
              <p style="margin: 0 0 15px 0; color: #555555; font-size: 16px; line-height: 1.6;">${escapeHtml(greeting)}</p>
              <div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #667eea; border-radius: 4px;">${bodyHtml}</div>
              ${footer}
            </td>
          </tr>
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
</html>`;
}

export function generateAdminActionEmail(input: {
  actionType: EmailActionType;
  alumniName: string;
  extraBodyHtml?: string;
}): EmailTemplateResult {
  const alumniName = input.alumniName || "Alumni";
  const greeting = `Dear ${alumniName},`;
  const extraBodyHtml = input.extraBodyHtml ? String(input.extraBodyHtml) : "";

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_VERIFY) {
    const subject = "Your Alumni Registration is Approved!";
    const body = `<p style="margin: 0; color: #333333; font-size: 16px;">Welcome to the UOL vibrant alumni community. Your account has been successfully created.</p>${extraBodyHtml}`;
    return {
      subject,
      html: createEmailTemplate(subject, greeting, body, "Regards,<br>Office of Alumni Relations<br>University of Lahore<br>alumni@uol.edu.pk"),
    };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_SEND_CREDENTIALS) {
    const subject = "Your Alumni Registration is Approved!";
    const body = `<p style="margin: 0; color: #333333; font-size: 16px;">Welcome to the UOL vibrant alumni community. Your account has been successfully created and below are your Login Credentials:</p>${extraBodyHtml}`;
    return {
      subject,
      html: createEmailTemplate(subject, greeting, body, "Regards,<br>Office of Alumni Relations<br>University of Lahore<br>alumni@uol.edu.pk"),
    };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_UNVERIFY) {
    const subject = "Alumni Account Update";
    const body = `<p style="margin: 0; color: #333333; font-size: 16px;">Your alumni registration status has been updated. Please contact the Office of Alumni Relations for any questions.</p>${extraBodyHtml}`;
    return {
      subject,
      html: createEmailTemplate(subject, greeting, body, "Regards,<br>Office of Alumni Relations<br>University of Lahore<br>alumni@uol.edu.pk"),
    };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_CARD_ONHOLD) {
    const subject = "Your UOL Alumni Card is On-Hold";
    const body = `<p style="margin: 0; color: #333333; font-size: 16px;">Thank you for applying for the UOL Alumni Card. After reviewing your application, we found that certain required information or documents are missing or do not meet the criteria.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Your application is currently on hold.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Kindly arrange to provide the required information so your application can be processed.</p>${extraBodyHtml}`;
    return {
      subject,
      html: createEmailTemplate(subject, greeting, body, "Warm regards,<br>Office of Alumni Relations<br>University of Lahore<br>alumni@uol.edu.pk"),
    };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_CARD_READY_FOR_DELIVERY) {
    const subject = "Your UOL Alumni Card Has Been Activated";
    const body = `<p style="margin: 0; color: #333333; font-size: 16px;">Great news!</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Your UOL Alumni Card has been activated, and you can access its e-version through your alumni portal.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">For physical card collection, you may visit the UOL Alumni Relations Office on campus. Alternatively, if you would like us to dispatch the card to your address (within Pakistan only), please share your complete postal address and contact number. Once dispatched, a confirmation will be sent to you via email or SMS.</p>${extraBodyHtml}`;
    return {
      subject,
      html: createEmailTemplate(subject, greeting, body, "Warm regards,<br>Office of Alumni Relations<br>University of Lahore<br>alumni@uol.edu.pk"),
    };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_CARD_DELIVERED) {
    const subject = "UOL Alumni Card - Update";
    const body = `<p style="margin: 0; color: #333333; font-size: 16px;">Your alumni card status has been updated. If you have any questions, please contact the Office of Alumni Relations.</p>${extraBodyHtml}`;
    return {
      subject,
      html: createEmailTemplate(subject, greeting, body, "Warm regards,<br>Office of Alumni Relations<br>University of Lahore<br>alumni@uol.edu.pk"),
    };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_TALK_CONFIRM) {
    const subject = "Alumni Talk Session - Confirmed";
    const body = `<p style="margin: 0; color: #333333; font-size: 16px;">Your alumni talk session has been <strong>confirmed</strong>. Please check the portal for the confirmed date and timings.</p>${extraBodyHtml}`;
    return {
      subject,
      html: createEmailTemplate(subject, greeting, body, "Regards,<br>Office of Alumni Relations"),
    };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_TALK_MARK_CONDUCTED) {
    const subject = "Alumni Talk Session - Marked as Conducted";
    const body = `<p style="margin: 0; color: #333333; font-size: 16px;">Your alumni talk session has been marked as <strong>Conducted</strong>. Thank you for your participation.</p>${extraBodyHtml}`;
    return {
      subject,
      html: createEmailTemplate(subject, greeting, body, "Regards,<br>Office of Alumni Relations"),
    };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_TALK_CANCEL) {
    const subject = "Alumni Talk Session - Cancelled";
    const body = `<p style="margin: 0; color: #333333; font-size: 16px;">Your alumni talk session has been <strong>cancelled</strong>. Please check the portal for details or contact the Alumni Office if needed.</p>${extraBodyHtml}`;
    return {
      subject,
      html: createEmailTemplate(subject, greeting, body, "Regards,<br>Office of Alumni Relations"),
    };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_TALK_PROPOSE_SLOT) {
    const subject = "Alumni Talk Session - New Slot Proposed";
    const body = `<p style="margin: 0; color: #333333; font-size: 16px;">A new slot has been proposed for your alumni talk session. Please review and confirm the proposed slot in the portal.</p>${extraBodyHtml}`;
    return {
      subject,
      html: createEmailTemplate(subject, greeting, body, "Regards,<br>Office of Alumni Relations"),
    };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_SCHOLARSHIP_APPROVED) {
    const subject = "Approval Status";
    const body = `<p style="margin: 0; color: #333333; font-size: 16px;">We are pleased to inform you that your Scholarship Application (Self / Kinship) has been approved.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Congratulations! The relevant department will proceed with the necessary formalities and adjustments as per university policy. If any further documentation or action is required from your side, you will be informed accordingly.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Should you have any questions, please feel free to contact us.</p>${extraBodyHtml}`;
    return {
      subject,
      html: createEmailTemplate(subject, greeting, body, "Warm regards,<br>Office of Alumni Relations<br>University of Lahore"),
    };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_SCHOLARSHIP_NOT_APPROVED) {
    const subject = "Approval Status";
    const body = `<p style="margin: 0; color: #333333; font-size: 16px;">Your Scholarship Application (Self / Kinship) status has been updated. Please check the portal for details or contact the Office of Alumni Relations.</p>${extraBodyHtml}`;
    return {
      subject,
      html: createEmailTemplate(subject, greeting, body, "Warm regards,<br>Office of Alumni Relations<br>University of Lahore"),
    };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_SCHOLARSHIP_RECEIVED) {
    const subject = "Scholarship Application (Self / Kinship) – Received";
    const body = `<p style="margin: 0; color: #333333; font-size: 16px;">Thank you for submitting your Scholarship Application (Self / Kinship).</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">We are pleased to inform you that your application has been successfully received and is currently under review by the concerned department. You will be notified once the evaluation process is completed.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">If any additional documents or information are required, our team will contact you accordingly.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">For further queries, please feel free to reach out to us.</p>${extraBodyHtml}`;
    return {
      subject,
      html: createEmailTemplate(subject, greeting, body, "Warm regards,<br>Office of Alumni Relations<br>University of Lahore"),
    };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_MEMBERSHIP_APPROVED) {
    const subject = "UOL Membership Application – Update on Your Application";
    const body = `<p style="margin: 0; color: #333333; font-size: 16px;">We are pleased to inform you that your application for the UOL Gym Facility has been approved.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">As a valued alumnus of UOL, you are entitled to a special discounted gym fee. Your access has now been activated, and you may proceed with the necessary formalities at the Sports Complex.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Should you require any further assistance, please feel free to contact us.</p>${extraBodyHtml}`;
    return {
      subject,
      html: createEmailTemplate(subject, greeting, body, "Warm regards,<br>Office of Alumni Relations<br>University of Lahore"),
    };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_MEMBERSHIP_NOT_APPROVED) {
    const subject = "UOL Membership Application – Update on Your Application";
    const body = `<p style="margin: 0; color: #333333; font-size: 16px;">Thank you for applying for the UOL Gym Facility.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">After reviewing your application, we regret to inform you that it has not been approved at this time. For further clarification regarding the status of your application, please feel free to contact the Office of Alumni Relations.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">We appreciate your interest and look forward to assisting you in the future.</p>${extraBodyHtml}`;
    return {
      subject,
      html: createEmailTemplate(subject, greeting, body, "Warm regards,<br>Office of Alumni Relations<br>University of Lahore"),
    };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_GYM_MEMBERSHIP_RECEIVED) {
    const subject = "UOL Gym Membership Application";
    const body = `<p style="margin: 0; color: #333333; font-size: 16px;">Thank you for applying for the UOL Gym Facility.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Being an alumnus of UOL, you are availing a special discount on your gym fee. Your application has been received and is currently being processed.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">You will be notified once your access is activated.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">If you have any questions, feel free to contact us.</p>${extraBodyHtml}`;
    return {
      subject,
      html: createEmailTemplate(subject, greeting, body, "Warm regards,<br>Office of Alumni Relations<br>University of Lahore"),
    };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_SWIMMING_MEMBERSHIP_RECEIVED) {
    const subject = "UOL Swimming Pool Membership Application – Update on Your Application";
    const body = `<p style="margin: 0; color: #333333; font-size: 16px;">Thank you for applying for the UOL Swimming Pool Facility.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Being an alumnus of UOL, you are availing a special discount on your swimming pool fee. Your application has been received and is currently being processed.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">You will be notified once your access is activated.</p>${extraBodyHtml}`;
    return {
      subject,
      html: createEmailTemplate(subject, greeting, body, "Warm regards,<br>Office of Alumni Relations<br>University of Lahore"),
    };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_SWIMMING_MEMBERSHIP_APPROVED) {
    const subject = "UOL Swimming Pool Membership Application – Update on Your Application";
    const body = `<p style="margin: 0; color: #333333; font-size: 16px;">We are pleased to inform you that your application for the UOL Gym Facility has been approved.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">As a valued alumnus of UOL, you are entitled to a special discounted gym fee. Your access has now been activated, and you may proceed with the necessary formalities at the Sports Complex.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Should you require any further assistance, please feel free to contact us.</p>${extraBodyHtml}`;
    return {
      subject,
      html: createEmailTemplate(subject, greeting, body, "Warm regards,<br>Office of Alumni Relations<br>University of Lahore"),
    };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_SWIMMING_MEMBERSHIP_NOT_APPROVED) {
    const subject = "UOL Swimming Pool Membership Application – Update on Your Application";
    const body = `<p style="margin: 0; color: #333333; font-size: 16px;">Thank you for applying for the UOL Swimming Pool Facility.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">After reviewing your application, we regret to inform you that it has not been approved at this time. For further clarification regarding the status of your application, please feel free to contact the Office of Alumni Relations.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">We appreciate your interest and look forward to assisting you in the future.</p>${extraBodyHtml}`;
    return {
      subject,
      html: createEmailTemplate(subject, greeting, body, "Warm regards,<br>Office of Alumni Relations<br>University of Lahore"),
    };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_CRICKET_MEMBERSHIP_RECEIVED) {
    const subject = "Lahore Qalander Cricket Club Membership Application – Update on Your Application";
    const body = `<p style="margin: 0; color: #333333; font-size: 16px;">Thank you for submitting your membership application for the Lahore Qalandars Cricket Club.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">We are pleased to inform you that your application has been successfully received and is currently under review. Our team will evaluate the submitted details and notify you once a decision has been made regarding your membership status.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">If any additional information is required, we will contact you accordingly.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Thank you for your interest in being a part of the Lahore Qalandars community.</p>${extraBodyHtml}`;
    return {
      subject,
      html: createEmailTemplate(subject, greeting, body, "Warm regards,<br>Office of Alumni Relations<br>University of Lahore"),
    };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_CRICKET_MEMBERSHIP_APPROVED) {
    const subject = "Lahore Qalander Cricket Club Membership Application – Update on Your Application";
    const body = `<p style="margin: 0; color: #333333; font-size: 16px;">We are pleased to inform you that your application for the Lahore Qalandars Cricket Club Membership has been approved.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Congratulations and welcome to the club! Further details regarding membership benefits, access, and next steps will be shared with you shortly.</p>${extraBodyHtml}`;
    return {
      subject,
      html: createEmailTemplate(subject, greeting, body, "Warm regards,<br>Office of Alumni Relations<br>University of Lahore"),
    };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ALUMNI_CRICKET_MEMBERSHIP_NOT_APPROVED) {
    const subject = "Lahore Qalander Cricket Club Membership Application – Update on Your Application";
    const body = `<p style="margin: 0; color: #333333; font-size: 16px;">Thank you for your interest in becoming a member of the Lahore Qalandars Cricket Club.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">After careful review, we regret to inform you that your application has not been approved at this time.</p>
      <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">We appreciate your interest in the club and encourage you to apply again in the future.</p>${extraBodyHtml}`;
    return {
      subject,
      html: createEmailTemplate(subject, greeting, body, "Warm regards,<br>Office of Alumni Relations<br>University of Lahore"),
    };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.CHAPTER_LEADERSHIP_APPROVED) {
    const subject = "Chapter Leadership Application - Approved";
    const body = `<p style="margin: 0; color: #333333; font-size: 16px;">Your chapter leadership application has been <strong>approved</strong>. Please check the portal for details.</p>${extraBodyHtml}`;
    return {
      subject,
      html: createEmailTemplate(subject, greeting, body, "Regards,<br>Office of Alumni Relations"),
    };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.CHAPTER_LEADERSHIP_NOT_APPROVED) {
    const subject = "Chapter Leadership Application - Not Approved";
    const body = `<p style="margin: 0; color: #333333; font-size: 16px;">Your chapter leadership application has been marked as <strong>not approved</strong>. Please check the portal for details.</p>${extraBodyHtml}`;
    return {
      subject,
      html: createEmailTemplate(subject, greeting, body, "Regards,<br>Office of Alumni Relations"),
    };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ASSOCIATION_LEADERSHIP_APPROVED) {
    const subject = "Association Leadership Application - Approved";
    const body = `<p style="margin: 0; color: #333333; font-size: 16px;">Your association leadership application has been <strong>approved</strong>. Please check the portal for details.</p>${extraBodyHtml}`;
    return {
      subject,
      html: createEmailTemplate(subject, greeting, body, "Regards,<br>Office of Alumni Relations"),
    };
  }

  if (input.actionType === EMAIL_ACTION_TYPE.ASSOCIATION_LEADERSHIP_NOT_APPROVED) {
    const subject = "Association Leadership Application - Not Approved";
    const body = `<p style="margin: 0; color: #333333; font-size: 16px;">Your association leadership application has been marked as <strong>not approved</strong>. Please check the portal for details.</p>${extraBodyHtml}`;
    return {
      subject,
      html: createEmailTemplate(subject, greeting, body, "Regards,<br>Office of Alumni Relations"),
    };
  }

  const subject = "Alumni Account Update";
  const body = `<p style="margin: 0; color: #333333; font-size: 16px;">Your alumni record status has been updated by the Alumni Office.</p>${extraBodyHtml}`;
  return {
    subject,
    html: createEmailTemplate(subject, greeting, body, "Regards,<br>Office of Alumni Relations"),
  };
}
