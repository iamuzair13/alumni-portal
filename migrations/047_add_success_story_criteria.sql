-- Success story submission criteria and alumni signature confirmation
-- Run manually against production/staging before deploying the app changes.

ALTER TABLE public.tblalumnistories
  ADD COLUMN IF NOT EXISTS criteria_highlight VARCHAR(250) NULL,
  ADD COLUMN IF NOT EXISTS criteria_inspires VARCHAR(250) NULL,
  ADD COLUMN IF NOT EXISTS criteria_replicable BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS signature_confirmed BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS signature_confirmed_at TIMESTAMPTZ NULL;
