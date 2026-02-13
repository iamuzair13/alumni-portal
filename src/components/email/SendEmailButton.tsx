"use client";

import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";

import { EmailPreviewModal } from "@/components/email/EmailPreviewModal";
import { useSendEmail } from "@/app/queries/send-email";
import type { EmailActionType } from "@/lib/emailTemplates";

export function SendEmailButton(props: {
  alumniId: number;
  recipientEmail: string;
  actionType: EmailActionType | string;
  initialSubject: string;
  initialBody: string;
  disabled?: boolean;
}) {
  const { alumniId, recipientEmail, actionType, initialSubject, initialBody, disabled } = props;
  const [open, setOpen] = useState(false);
  const mutation = useSendEmail();

  const initial = useMemo(
    () => ({ subject: initialSubject, body: initialBody }),
    [initialSubject, initialBody]
  );

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Send Email
      </button>

      <EmailPreviewModal
        isOpen={open}
        onClose={() => {
          if (!mutation.isPending) setOpen(false);
        }}
        initial={initial}
        sending={mutation.isPending}
        onSend={async (payload) => {
          try {
            const res = await mutation.mutateAsync({
              alumniId,
              recipientEmail,
              actionType: String(actionType),
              subject: payload.subject,
              body: payload.body,
            });

            if (res.ok) {
              toast.success("Email sent");
              setOpen(false);
            } else {
              toast.error(res.errorMessage || "Failed to send email");
            }
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to send email");
          }
        }}
      />
    </>
  );
}
