ALTER TABLE IF EXISTS public.chapter_leadership
  ADD COLUMN IF NOT EXISTS cv_file_url TEXT,
  ADD COLUMN IF NOT EXISTS additional_file1_url TEXT,
  ADD COLUMN IF NOT EXISTS additional_file2_url TEXT;

ALTER TABLE IF EXISTS public.tblalumniassociation
  ADD COLUMN IF NOT EXISTS cv_file_url TEXT,
  ADD COLUMN IF NOT EXISTS additional_file1_url TEXT,
  ADD COLUMN IF NOT EXISTS additional_file2_url TEXT;
