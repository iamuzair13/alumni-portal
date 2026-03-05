ALTER TABLE IF EXISTS public.chapter_leadership
  ADD COLUMN IF NOT EXISTS plan_strategy TEXT;

ALTER TABLE IF EXISTS public.tblalumniassociation
  ADD COLUMN IF NOT EXISTS plan_strategy TEXT;
