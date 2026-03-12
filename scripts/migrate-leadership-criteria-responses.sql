-- Migration: store explicit YES/NO responses for leadership role criteria confirmations

ALTER TABLE IF EXISTS public.leadership_criteria_confirmations
  ADD COLUMN IF NOT EXISTS response TEXT;

-- Backfill response from existing confirmed boolean for older records
UPDATE public.leadership_criteria_confirmations
SET response = CASE WHEN confirmed = true THEN 'YES' ELSE 'NO' END
WHERE response IS NULL;

-- Constrain allowed values (use NOT VALID to avoid issues if legacy unexpected values exist)
ALTER TABLE public.leadership_criteria_confirmations
  ADD CONSTRAINT leadership_criteria_confirmations_response_chk
  CHECK (response IN ('YES','NO')) NOT VALID;

-- Validate constraint after backfill
ALTER TABLE public.leadership_criteria_confirmations
  VALIDATE CONSTRAINT leadership_criteria_confirmations_response_chk;
