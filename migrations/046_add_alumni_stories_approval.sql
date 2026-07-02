-- Alumni success story approval workflow
-- Run manually against production/staging before deploying the app changes.

ALTER TABLE public.tblalumnistories
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by BIGINT NULL REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ NULL;

-- Backfill existing live stories so nothing disappears after deploy
UPDATE public.tblalumnistories
SET status = 'approved'
WHERE status IS NULL
  AND alumnistories IS NOT NULL
  AND TRIM(alumnistories) <> '';

CREATE INDEX IF NOT EXISTS idx_tblalumnistories_status
  ON public.tblalumnistories (LOWER(COALESCE(status, 'pending')));
