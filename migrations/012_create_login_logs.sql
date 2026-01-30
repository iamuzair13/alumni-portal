CREATE TABLE IF NOT EXISTS public.login_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  actor_type TEXT NULL,
  actor_user_id BIGINT NULL,
  actor_email TEXT NULL,
  identifier TEXT NULL,

  success BOOLEAN NOT NULL DEFAULT TRUE,
  error_message TEXT NULL,

  ip TEXT NULL,
  user_agent TEXT NULL,
  metadata JSONB NULL
);

CREATE INDEX IF NOT EXISTS idx_login_logs_created_at
  ON public.login_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_logs_actor
  ON public.login_logs (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_logs_actor_type
  ON public.login_logs (actor_type, created_at DESC);
