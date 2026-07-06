"use client";

import { SendEmailButton } from "@/components/email/SendEmailButton";
import { buildSuccessStoryReviewEmail } from "@/lib/successStoryEmailContent";
import { EMAIL_ACTION_TYPE } from "@/lib/emailTemplates";

export function StoryActionEmailBlock(props: {
  action: "approve" | "reject";
  storyId: string;
  storyTitle?: string | null;
  alumniName?: string | null;
  alumniId?: number | null;
  recipientEmail?: string | null;
  rejectionReason?: string | null;
  disabled?: boolean;
}) {
  const {
    action,
    storyId,
    storyTitle,
    alumniName,
    alumniId,
    recipientEmail,
    rejectionReason,
    disabled,
  } = props;

  if (!recipientEmail || !alumniId || !Number.isFinite(alumniId) || alumniId <= 0) {
    return (
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
        No recipient email found for this alumni. You can still confirm the action, but you cannot send an email.
      </div>
    );
  }

  const tpl = buildSuccessStoryReviewEmail({
    action,
    alumniName: String(alumniName || "Alumni"),
    storyId,
    storyTitle,
    rejectionReason,
  });

  const actionType =
    action === "approve"
      ? EMAIL_ACTION_TYPE.SUCCESS_STORY_APPROVED
      : EMAIL_ACTION_TYPE.SUCCESS_STORY_NOT_APPROVED;

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
      <div>
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Preview Email</div>
        <div className="text-xs text-gray-600 dark:text-gray-400">Preview, edit, and send manually before or after confirming</div>
      </div>
      <SendEmailButton
        alumniId={alumniId}
        recipientEmail={recipientEmail}
        actionType={actionType}
        initialSubject={tpl.subject}
        initialBody={tpl.html}
        disabled={disabled}
      />
    </div>
  );
}
