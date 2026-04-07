-- Home address remains in cardaddress; structured delivery location for mail delivery.
ALTER TABLE public.tblcard
  ADD COLUMN IF NOT EXISTS delivery_city character varying,
  ADD COLUMN IF NOT EXISTS delivery_street_no character varying,
  ADD COLUMN IF NOT EXISTS delivery_house_no character varying;
