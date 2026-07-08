-- Add achievements field to success stories
-- Run manually against production/staging before deploying the app changes.

ALTER TABLE public.tblalumnistories
  ADD COLUMN IF NOT EXISTS achievements VARCHAR(250) NULL;
