-- Migration 071: alumni_birthdays table
-- Admin-curated alumni birthdays (featured birthday posts/gifts).
-- Lookup fields (name, program, chapters, association, photo) live on
-- tbl_alumni and related tables — only the curated extras are stored here.

CREATE TABLE IF NOT EXISTS public.alumni_birthdays (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alumniid integer NOT NULL REFERENCES public.tbl_alumni(alumniid)
    ON UPDATE NO ACTION ON DELETE NO ACTION,
  linkedin_post_url text,
  gift_image_url text,
  created_by integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alumni_birthdays_alumniid_unique UNIQUE (alumniid)
);

CREATE INDEX IF NOT EXISTS idx_alumni_birthdays_created_at
  ON public.alumni_birthdays(created_at DESC);
