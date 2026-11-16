-- Migration: Add banner image and location to merchants
-- banner_url stores a /api/uploads/images/<filename> path for a portrait
-- (height > width) banner image shown on the outsourced website.
-- location is a free-text address/area shown alongside the offer.
-- Nullable so existing merchant rows are unaffected.

ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS banner_url text;

ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS location VARCHAR(500);
