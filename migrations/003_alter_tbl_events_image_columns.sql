-- Widen event image filename columns so generated names are never truncated (was varchar(50)).
-- Filenames are stored as basenames only; files live under public/images.

ALTER TABLE public.tbl_events
  ALTER COLUMN image1 TYPE character varying(255) COLLATE pg_catalog."default",
  ALTER COLUMN image2 TYPE character varying(255) COLLATE pg_catalog."default",
  ALTER COLUMN image3 TYPE character varying(255) COLLATE pg_catalog."default",
  ALTER COLUMN image4 TYPE character varying(255) COLLATE pg_catalog."default",
  ALTER COLUMN image5 TYPE character varying(255) COLLATE pg_catalog."default";
