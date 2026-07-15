-- Migration: Create membership settings table for campus facility membership configuration
CREATE TABLE IF NOT EXISTS public.membership_settings (
  id            SERIAL PRIMARY KEY,
  discount_basis VARCHAR(50) NOT NULL DEFAULT 'same_as_staff_student',
  payment_amount INTEGER NOT NULL DEFAULT 0,
  discount_pct   INTEGER NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by     INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT chk_membership_settings_discount_basis CHECK (
    discount_basis IN ('same_as_staff_student', 'fifty_percent_outsiders')
  ),
  CONSTRAINT chk_membership_settings_payment_amount CHECK (payment_amount >= 0),
  CONSTRAINT chk_membership_settings_discount_pct CHECK (discount_pct >= 0 AND discount_pct <= 100)
) TABLESPACE pg_default;

-- Seed a single default row so the settings always exist
INSERT INTO public.membership_settings (id, discount_basis, payment_amount, discount_pct)
VALUES (1, 'same_as_staff_student', 0, 0)
ON CONFLICT (id) DO NOTHING;
