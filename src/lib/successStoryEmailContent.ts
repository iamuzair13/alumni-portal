import { EMAIL_ACTION_TYPE, generateAdminActionEmail } from "@/lib/emailTemplates";

export function pickAlumniContactEmail(
  personalemail?: string | null,
  officialemail?: string | null,
  universityemail?: string | null
): string | null {
  const email = String(personalemail || officialemail || universityemail || "").trim();
  return email || null;
}

export function successStoryPortalBase(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return String(process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://portal-alumni.uol.edu.pk").replace(
    /\/+$/,
    ""
  );
}

export function buildSuccessStoryReviewEmail(input: {
  action: "approve" | "reject";
  alumniName: string;
  storyId: string | number;
  storyTitle?: string | null;
  rejectionReason?: string | null;
  portalBase?: string;
}) {
  const portalBase = (input.portalBase || successStoryPortalBase()).replace(/\/+$/, "");
  const storyTitle = String(input.storyTitle || "Success Story").trim() || "Success Story";
  const editUrl = `${portalBase}/alumni-success/${input.storyId}/edit`;
  const viewUrl = `${portalBase}/alumni-success/${input.storyId}`;
  const alumniName = String(input.alumniName || "Alumni").trim() || "Alumni";

  const emailAction =
    input.action === "approve"
      ? EMAIL_ACTION_TYPE.SUCCESS_STORY_APPROVED
      : EMAIL_ACTION_TYPE.SUCCESS_STORY_NOT_APPROVED;

  const extraBodyHtml =
    input.action === "approve"
      ? `<p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Your story "<strong>${storyTitle}</strong>" is now live on the Alumni Portal.</p>
         <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;"><a href="${viewUrl}" style="color: #2563eb;">View your published story</a></p>`
      : `<p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Your story "<strong>${storyTitle}</strong>" could not be approved at this time.</p>
         <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;"><strong>Reason:</strong> ${String(input.rejectionReason || "").trim() || "—"}</p>
         <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">You may revise your story and submit it again for review. <a href="${editUrl}" style="color: #2563eb;">Edit your story</a></p>`;

  return generateAdminActionEmail({
    actionType: emailAction,
    alumniName,
    extraBodyHtml,
  });
}
