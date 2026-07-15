-- Migration: Add per-facility membership settings (gym / pool / cricket)
ALTER TABLE public.membership_settings
  ADD COLUMN IF NOT EXISTS facility_type VARCHAR(20) NOT NULL DEFAULT 'gym';

-- Seed the remaining facility types if they don't exist
INSERT INTO public.membership_settings (facility_type, discount_basis, payment_amount, discount_pct)
VALUES
  ('pool', 'same_as_staff_student', 0, 0),
  ('cricket', 'same_as_staff_student', 0, 0)
ON CONFLICT (facility_type) DO NOTHING;

-- Ensure uniqueness and valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'membership_settings_facility_type_unique'
      AND conrelid = 'public.membership_settings'::regclass
  ) THEN
    ALTER TABLE public.membership_settings
      ADD CONSTRAINT membership_settings_facility_type_unique UNIQUE (facility_type);
  END IF;
END $$;

ALTER TABLE public.membership_settings
  DROP CONSTRAINT IF EXISTS chk_membership_settings_facility_type;

ALTER TABLE public.membership_settings
  ADD CONSTRAINT chk_membership_settings_facility_type CHECK (
    facility_type IN ('gym', 'pool', 'cricket')
  );
