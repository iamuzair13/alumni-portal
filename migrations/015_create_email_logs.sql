CREATE TABLE IF NOT EXISTS public.email_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  recipient_email TEXT NOT NULL,
  alumni_id BIGINT NULL,

  subject TEXT NOT NULL,
  body TEXT NOT NULL,

  status TEXT NOT NULL,
  error_message TEXT NULL,

  triggered_by TEXT NOT NULL,
  action_type TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_logs_alumni_id
  ON public.email_logs (alumni_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_logs_recipient_email
  ON public.email_logs (recipient_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_logs_created_at
  ON public.email_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_logs_action_type
  ON public.email_logs (action_type, created_at DESC);
