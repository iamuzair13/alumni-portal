import "server-only";

import { sql } from "@/lib/dbconnect";

export const EMAIL_LOG_STATUS = {
  SENT: "sent",
  FAILED: "failed",
} as const;

export type EmailLogStatus = (typeof EMAIL_LOG_STATUS)[keyof typeof EMAIL_LOG_STATUS];

export const EMAIL_TRIGGERED_BY = {
  AUTO: "auto",
  ADMIN_ACTION: "admin_action",
} as const;

export type EmailTriggeredBy = (typeof EMAIL_TRIGGERED_BY)[keyof typeof EMAIL_TRIGGERED_BY];

export type EmailLogRow = {
  id: number;
  created_at: string;
  recipient_email: string;
  alumni_id: number | null;
  subject: string;
  body: string;
  status: string;
  error_message: string | null;
  triggered_by: string;
  action_type: string | null;
};

export async function insertEmailLog(input: {
  recipientEmail: string;
  alumniId?: number | null;
  subject: string;
  body: string;
  status: EmailLogStatus;
  errorMessage?: string | null;
  triggeredBy: EmailTriggeredBy;
  actionType?: string | null;
}): Promise<void> {
  await sql/* sql */`
    INSERT INTO public.email_logs (
      recipient_email,
      alumni_id,
      subject,
      body,
      status,
      error_message,
      triggered_by,
      action_type
    ) VALUES (
      ${input.recipientEmail},
      ${input.alumniId ?? null},
      ${input.subject},
      ${input.body},
      ${input.status},
      ${input.errorMessage ?? null},
      ${input.triggeredBy},
      ${input.actionType ?? null}
    )
  `;
}

export async function getEmailHistory(params: {
  alumniId?: number | null;
  recipientEmail?: string | null;
  limit?: number;
}): Promise<EmailLogRow[]> {
  const limit = Math.max(1, Math.min(200, params.limit ?? 50));

  if (params.alumniId !== undefined && params.alumniId !== null) {
    return await sql<EmailLogRow[]>/* sql */`
      SELECT id, created_at, recipient_email, alumni_id, subject, body, status, error_message, triggered_by, action_type
      FROM public.email_logs
      WHERE alumni_id = ${params.alumniId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  }

  if (params.recipientEmail) {
    return await sql<EmailLogRow[]>/* sql */`
      SELECT id, created_at, recipient_email, alumni_id, subject, body, status, error_message, triggered_by, action_type
      FROM public.email_logs
      WHERE recipient_email = ${params.recipientEmail}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  }

  return [];
}
