-- Migration: Add medal field to tbl_alumni
-- Values: 'Gold Medalist', 'Silver Medalist', 'Bronze Medalist', NULL (None)

ALTER TABLE public.tbl_alumni
  ADD COLUMN IF NOT EXISTS medal character varying(20) COLLATE pg_catalog."default" DEFAULT NULL;

COMMENT ON COLUMN public.tbl_alumni.medal IS 'Alumni academic medal status: Gold Medalist, Silver Medalist, Bronze Medalist, or NULL for none';
