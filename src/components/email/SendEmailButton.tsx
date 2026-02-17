"use client";

import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { EmailPreviewModal } from "@/components/email/EmailPreviewModal";
import { useSendEmail } from "@/app/queries/send-email";
import { EMAIL_ACTION_TYPE, type EmailActionType } from "@/lib/emailTemplates";

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

  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);

  const initial = useMemo(
    () => ({ subject: preview?.subject ?? initialSubject, body: preview?.body ?? initialBody }),
    [preview?.subject, preview?.body, initialSubject, initialBody]
  );

  useEffect(() => {
    if (!open) return;

    const normalized = String(actionType || "").trim();
    if (normalized !== EMAIL_ACTION_TYPE.ALUMNI_VERIFY) return;

    let cancelled = false;
    setPreviewLoading(true);

    fetch("/api/email-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ actionType: normalized, alumniId }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          subject?: string;
          body?: string;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data?.error || `Failed to load preview (${res.status})`);
        }
        if (!cancelled && data?.ok && typeof data.subject === "string" && typeof data.body === "string") {
          setPreview({ subject: data.subject, body: data.body });
        }
      })
      .catch((e) => {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Failed to load preview");
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, actionType, alumniId]);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setPreview(null);
          setOpen(true);
        }}
        className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Preview Email
      </button>

      <EmailPreviewModal
        isOpen={open}
        onClose={() => {
          if (!mutation.isPending && !previewLoading) setOpen(false);
        }}
        initial={initial}
        sending={mutation.isPending || previewLoading}
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
