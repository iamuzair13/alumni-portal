-- Year and Term selected by alumni when submitting a scholarship application.
-- Both are mandatory on the form; existing rows remain unaffected (columns are nullable).
ALTER TABLE public.alumni_scholarships
  ADD COLUMN IF NOT EXISTS application_year integer;

ALTER TABLE public.alumni_scholarships
  ADD COLUMN IF NOT EXISTS application_term text COLLATE pg_catalog."default";

COMMENT ON COLUMN public.alumni_scholarships.application_year IS
  'Year selected by applicant on the scholarship form (e.g. 2026 onwards). Nullable for backward compatibility with existing applications.';

COMMENT ON COLUMN public.alumni_scholarships.application_term IS
  'Term selected by applicant on the scholarship form. Allowed values: Summer, Spring. Nullable for backward compatibility with existing applications.';
