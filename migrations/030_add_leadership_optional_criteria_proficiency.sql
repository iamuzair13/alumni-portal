ALTER TABLE IF EXISTS public.chapter_leadership
  ADD COLUMN IF NOT EXISTS optional_criteria_proficiency JSONB;

ALTER TABLE IF EXISTS public.tblalumniassociation
  ADD COLUMN IF NOT EXISTS optional_criteria_proficiency JSONB;
