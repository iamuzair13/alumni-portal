-- Admission reference / application ID for Masters/PhD scholarship applications (entered by alumni).
ALTER TABLE public.alumni_scholarships
  ADD COLUMN IF NOT EXISTS admission_application_ref text COLLATE pg_catalog."default";

COMMENT ON COLUMN public.alumni_scholarships.admission_application_ref IS
  'Admission reference number or application ID supplied by the applicant with document uploads.';
