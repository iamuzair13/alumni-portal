-- Adds optional Additional Achievements field to leadership application tables

ALTER TABLE IF EXISTS public.chapter_leadership
  ADD COLUMN IF NOT EXISTS additional_achievements TEXT;

ALTER TABLE IF EXISTS public.tblalumniassociation
  ADD COLUMN IF NOT EXISTS additional_achievements TEXT;
