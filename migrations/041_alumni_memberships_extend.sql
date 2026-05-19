-- Extend alumni_memberships for full campus facility application forms (gym, pool, cricket)

ALTER TABLE IF EXISTS public.alumni_memberships
  ADD COLUMN IF NOT EXISTS facility_type text;

ALTER TABLE IF EXISTS public.alumni_memberships
  ADD COLUMN IF NOT EXISTS application_ref text;

ALTER TABLE IF EXISTS public.alumni_memberships
  ADD COLUMN IF NOT EXISTS discount_type text;

ALTER TABLE IF EXISTS public.alumni_memberships
  ADD COLUMN IF NOT EXISTS membership_type text;

ALTER TABLE IF EXISTS public.alumni_memberships
  ADD COLUMN IF NOT EXISTS membership_start_date date;

ALTER TABLE IF EXISTS public.alumni_memberships
  ADD COLUMN IF NOT EXISTS preferred_timing text;

ALTER TABLE IF EXISTS public.alumni_memberships
  ADD COLUMN IF NOT EXISTS application_details jsonb;

ALTER TABLE IF EXISTS public.alumni_memberships
  ADD COLUMN IF NOT EXISTS cricket_membership_month text;
