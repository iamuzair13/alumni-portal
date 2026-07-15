-- Migration: Add original payment field to membership settings
ALTER TABLE public.membership_settings
  ADD COLUMN IF NOT EXISTS original_payment INTEGER NOT NULL DEFAULT 0;

-- Ensure original payment is never negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_membership_settings_original_payment'
      AND conrelid = 'public.membership_settings'::regclass
  ) THEN
    ALTER TABLE public.membership_settings
      ADD CONSTRAINT chk_membership_settings_original_payment CHECK (original_payment >= 0);
  END IF;
END $$;
