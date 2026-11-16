-- Migration: Add pre_sap_registration flag to tbl_alumni
-- Marks alumni who registered before receiving an official SAP ID.
-- Read by the alumni full-details API and the profile UI; boolean, nullable
-- so existing rows are unaffected.

ALTER TABLE public.tbl_alumni
  ADD COLUMN IF NOT EXISTS pre_sap_registration boolean;
