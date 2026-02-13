"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { emailHistoryKey } from "@/app/queries/fetch-email-history";

export type SendEmailPayload = {
  recipientEmail: string;
  alumniId: number;
  subject: string;
  body: string;
  actionType: string;
};

export type SendEmailResult = {
  ok: boolean;
  errorMessage?: string;
};

async function sendEmail(payload: SendEmailPayload): Promise<SendEmailResult> {
  const res = await fetch("/api/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; errorMessage?: string };

  if (!res.ok) {
    throw new Error(data?.error || `Failed to send email (${res.status})`);
  }

  return { ok: Boolean(data?.ok), errorMessage: data?.errorMessage };
}

export function useSendEmail() {
  const qc = useQueryClient();

  return useMutation<SendEmailResult, Error, SendEmailPayload>({
    mutationFn: sendEmail,
    onSuccess: async (_data, variables) => {
      await qc.invalidateQueries({ queryKey: emailHistoryKey(variables.alumniId) });
    },
  });
}
