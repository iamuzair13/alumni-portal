-- Add withdrawal tracking columns to alumni_scholarships and alumni_memberships.
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE IF EXISTS public.alumni_scholarships
  ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz;

ALTER TABLE IF EXISTS public.alumni_scholarships
  ADD COLUMN IF NOT EXISTS withdrawn_by text COLLATE pg_catalog."default";

ALTER TABLE IF EXISTS public.alumni_scholarships
  ADD COLUMN IF NOT EXISTS withdrawal_reason text COLLATE pg_catalog."default";

ALTER TABLE IF EXISTS public.alumni_memberships
  ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz;

ALTER TABLE IF EXISTS public.alumni_memberships
  ADD COLUMN IF NOT EXISTS withdrawn_by text COLLATE pg_catalog."default";

ALTER TABLE IF EXISTS public.alumni_memberships
  ADD COLUMN IF NOT EXISTS withdrawal_reason text COLLATE pg_catalog."default";

COMMENT ON COLUMN public.alumni_scholarships.withdrawn_at IS
  'Timestamp when the application was withdrawn by an admin.';

COMMENT ON COLUMN public.alumni_scholarships.withdrawn_by IS
  'Email or identifier of the admin who withdrew the application.';

COMMENT ON COLUMN public.alumni_scholarships.withdrawal_reason IS
  'Reason provided by the admin when withdrawing the application.';

COMMENT ON COLUMN public.alumni_memberships.withdrawn_at IS
  'Timestamp when the application was withdrawn by an admin.';

COMMENT ON COLUMN public.alumni_memberships.withdrawn_by IS
  'Email or identifier of the admin who withdrew the application.';

COMMENT ON COLUMN public.alumni_memberships.withdrawal_reason IS
  'Reason provided by the admin when withdrawing the application.';
