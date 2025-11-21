-- Migration script to increase password column size
-- Scrypt hashed passwords are approximately 169 characters
-- Current column is VARCHAR(50), needs to be at least VARCHAR(255)

ALTER TABLE public.tbl_alumni 
ALTER COLUMN password TYPE character varying(255);

