-- Migration: Merchant categories
-- Admins create reusable categories (Food, Entertainment, ...) and assign
-- them to merchants. Many-to-many: a merchant can belong to several
-- categories, a category groups many merchants.
--
-- color stores a hex value chosen from a fixed admin palette; it is exposed
-- on the external API so the outsourced website can render matching chips.

CREATE TABLE IF NOT EXISTS public.merchant_categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  slug        VARCHAR(120) NOT NULL UNIQUE,
  color       VARCHAR(7)   NOT NULL DEFAULT '#64748B',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.merchant_category_map (
  merchant_id INTEGER NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES public.merchant_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (merchant_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_merchant_category_map_category
  ON public.merchant_category_map (category_id);

-- Starter categories; admins can rename/recolor/delete from Setup > Merchants.
INSERT INTO public.merchant_categories (name, slug, color) VALUES
  ('Food & Dining',       'food-dining',       '#EA580C'),
  ('Entertainment',       'entertainment',     '#7C3AED'),
  ('Shopping & Retail',   'shopping-retail',   '#0D9488'),
  ('Health & Wellness',   'health-wellness',   '#059669'),
  ('Travel & Hospitality','travel-hospitality','#2563EB'),
  ('Services',            'services',          '#64748B')
ON CONFLICT (slug) DO NOTHING;
