-- Migration 066: Drop redundant text-based faculty/department/program columns
--
-- Phase 1 (migration 065) backfilled all foreign-key IDs from the text columns:
--   - facultyname  -> faculty   (tbl_faculties.id)
--   - departmentname -> department (tbl_departments.id)
--   - degreetitle -> program (tbl_programs.id)
--
-- Note: degree_title is NOT dropped here. It stores the higher education
-- degree title (e.g., "MS", "PhD"), which is a separate field from the
-- main program/degree. See migration 067 for details.
--
-- Phase 2 updated all application code to:
--   - SELECT joined lookup names (f.faculty_name, d.department_name, p.program_name)
--     aliased as facultyname / departmentname / degreetitle for API compatibility.
--   - Write only the FK columns (faculty, department, program) on INSERT/UPDATE.
--   - Filter/search using the joined lookup names instead of the text columns.
--
-- Phase 3 (this migration) drops the now-redundant text columns.
--
-- Safety: This migration is only safe to run AFTER all code paths have been
-- migrated. Running it earlier will break any query that still references
-- facultyname, departmentname, or degreetitle directly.
--
-- Idempotent: uses IF EXISTS so re-running is safe.

ALTER TABLE public.tbl_alumni
  DROP COLUMN IF EXISTS facultyname,
  DROP COLUMN IF EXISTS departmentname,
  DROP COLUMN IF EXISTS degreetitle;
