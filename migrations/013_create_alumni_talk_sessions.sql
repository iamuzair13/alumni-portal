CREATE TABLE IF NOT EXISTS public.alumni_talk_sessions (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  alumniid INTEGER NOT NULL REFERENCES public.tbl_alumni(alumniid) ON DELETE CASCADE,

  topic TEXT NULL,
  activity TEXT NULL,
  mode TEXT NULL,
  brief_outline TEXT NULL,

  date_1 DATE NULL,
  timings_1 TEXT NULL,
  date_2 DATE NULL,
  timings_2 TEXT NULL,
  date_3 DATE NULL,
  timings_3 TEXT NULL,

  status TEXT NOT NULL DEFAULT 'pending',

  confirmed_date DATE NULL,
  confirmed_timings TEXT NULL,

  admin_proposed_date DATE NULL,
  admin_proposed_timings TEXT NULL,

  admin_note TEXT NULL,
  alumni_note TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_alumni_talk_sessions_alumniid_created_at
  ON public.alumni_talk_sessions (alumniid, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alumni_talk_sessions_status
  ON public.alumni_talk_sessions (status);

ALTER TABLE public.alumni_talk_sessions
  ADD CONSTRAINT alumni_talk_sessions_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'admin_confirmed'::text,
    'admin_proposed'::text,
    'alumni_confirmed'::text,
    'reschedule_requested'::text,
    'conducted'::text,
    'cancelled'::text
  ]));
