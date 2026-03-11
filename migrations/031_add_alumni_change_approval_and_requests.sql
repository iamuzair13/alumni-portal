-- Add change approval status to alumni profile and a table for storing profile change requests

ALTER TABLE public.tbl_alumni
ADD COLUMN IF NOT EXISTS change_approval VARCHAR(20) DEFAULT NULL;

CREATE TABLE IF NOT EXISTS public.tbl_alumni_change_requests (
  id BIGSERIAL PRIMARY KEY,
  alumni_id INTEGER NOT NULL REFERENCES public.tbl_alumni(alumniid) ON DELETE CASCADE,
  old_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  new_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by BIGINT NULL REFERENCES public.users(id),
  approved_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_alumni_change_requests_alumni_id ON public.tbl_alumni_change_requests(alumni_id);
CREATE INDEX IF NOT EXISTS idx_alumni_change_requests_status ON public.tbl_alumni_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_tbl_alumni_change_approval ON public.tbl_alumni(change_approval);
