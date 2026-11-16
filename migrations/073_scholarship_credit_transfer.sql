-- Migration: Add credit/course transfer fields to alumni_scholarships
-- All scholarship types now ask whether the application relates to a
-- credit/course transfer from another institution. When yes, the applicant
-- must attach the previous institution's transcript and specify the semester
-- into which the credits/courses were transferred.
-- All columns are nullable so existing applications are unaffected.

ALTER TABLE public.alumni_scholarships
  ADD COLUMN IF NOT EXISTS is_credit_transfer boolean;

ALTER TABLE public.alumni_scholarships
  ADD COLUMN IF NOT EXISTS transfer_semester integer;

ALTER TABLE public.alumni_scholarships
  ADD COLUMN IF NOT EXISTS transfer_transcript_url text;

ALTER TABLE public.alumni_scholarships
  DROP CONSTRAINT IF EXISTS alumni_scholarships_transfer_semester_chk;

ALTER TABLE public.alumni_scholarships
  ADD CONSTRAINT alumni_scholarships_transfer_semester_chk
  CHECK (transfer_semester IS NULL OR (transfer_semester >= 1 AND transfer_semester <= 8));
