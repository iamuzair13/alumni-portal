-- Structured delivery location: society name between city and street.
ALTER TABLE public.tblcard
  ADD COLUMN IF NOT EXISTS delivery_society_name character varying;
