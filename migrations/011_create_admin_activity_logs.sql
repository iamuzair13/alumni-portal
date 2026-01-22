CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  actor_user_id BIGINT NULL,
  actor_email TEXT NULL,
  actor_type TEXT NULL,

  action TEXT NOT NULL,
  entity_type TEXT NULL,
  entity_id TEXT NULL,

  success BOOLEAN NOT NULL DEFAULT TRUE,
  error_message TEXT NULL,

  ip TEXT NULL,
  user_agent TEXT NULL,
  request_path TEXT NULL,

  metadata JSONB NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_created_at
  ON public.admin_activity_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_actor
  ON public.admin_activity_logs (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_action
  ON public.admin_activity_logs (action, created_at DESC);
