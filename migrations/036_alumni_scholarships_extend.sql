-- Extends public.alumni_scholarships for discount type, Masters/PhD details, and uploaded document metadata.
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE public.alumni_scholarships
  ADD COLUMN IF NOT EXISTS discount_type text COLLATE pg_catalog."default";

ALTER TABLE public.alumni_scholarships
  ADD COLUMN IF NOT EXISTS masters_details jsonb;

ALTER TABLE public.alumni_scholarships
  ADD COLUMN IF NOT EXISTS uploaded_documents jsonb;

COMMENT ON COLUMN public.alumni_scholarships.discount_type IS
  'Application route discount key: kinship | masters-phd | masters-collaboration';

COMMENT ON COLUMN public.alumni_scholarships.masters_details IS
  'JSON payload for Masters/PhD discount (admission faculty/dept/program ids, campus, session, status).';

COMMENT ON COLUMN public.alumni_scholarships.uploaded_documents IS
  'JSON array of { label, url, filename, type, size } for uploaded files.';
