-- Add chapter/association selection support for leadership applications

ALTER TABLE public.chapter_leadership
  ADD COLUMN IF NOT EXISTS chapter_id bigint NULL;

ALTER TABLE public.tblalumniassociation
  ADD COLUMN IF NOT EXISTS association_id bigint NULL;
