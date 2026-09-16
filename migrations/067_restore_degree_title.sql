-- Migration 067: Restore degree_title column
--
-- Migration 066 incorrectly dropped degree_title along with the redundant
-- text columns (facultyname, departmentname, degreetitle). However,
-- degree_title stores the HIGHER EDUCATION degree title (e.g., "MS", "PhD"),
-- which is a separate field from the main program/degree (degreetitle -> program FK).
--
-- This migration restores degree_title. If the column still exists (migration
-- 066 was not run or was partially run), this is a no-op.

ALTER TABLE public.tbl_alumni
  ADD COLUMN IF NOT EXISTS degree_title text;
