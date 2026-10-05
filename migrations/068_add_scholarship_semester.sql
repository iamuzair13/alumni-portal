-- Migration: Add semester column to alumni_scholarships
-- Self (fee-discount) scholarship applications now capture the semester the
-- alumni is applying for. Options are 1-8 (BS programs run up to 8 semesters).
-- Nullable so existing and kinship applications are unaffected.

ALTER TABLE public.alumni_scholarships
  ADD COLUMN IF NOT EXISTS semester integer;

ALTER TABLE public.alumni_scholarships
  DROP CONSTRAINT IF EXISTS alumni_scholarships_semester_chk;

ALTER TABLE public.alumni_scholarships
  ADD CONSTRAINT alumni_scholarships_semester_chk
  CHECK (semester IS NULL OR (semester >= 1 AND semester <= 8));
