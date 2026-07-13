-- Migration: Create merchants table for business partners and discount management
CREATE TABLE IF NOT EXISTS public.merchants (
  id            SERIAL PRIMARY KEY,
  business_name VARCHAR(255) NOT NULL,
  discount_type VARCHAR(255) NOT NULL,
  start_date    DATE         NOT NULL,
  end_date      DATE         NOT NULL,
  discount_pct  NUMERIC(5,2) NOT NULL CHECK (discount_pct >= 0 AND discount_pct <= 100),
  status        VARCHAR(20)  NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchants_status ON public.merchants (status);
CREATE INDEX IF NOT EXISTS idx_merchants_end_date ON public.merchants (end_date);
