-- Migration 065: Backfill faculty, department, and program FK IDs from text-based columns
--
-- Purpose: Populate the ID-based foreign key columns (faculty, department, program)
-- from the text-based columns (facultyname, departmentname, degreetitle, degree_title)
-- so that the text-based columns can eventually be dropped.
--
-- This migration is ADDITIVE ONLY — it does not drop any columns or data.
-- It only populates FK columns that are currently NULL.
--
-- Run this BEFORE updating application code (Phase 1 of 3).
-- Phase 2: Update code to use JOINs instead of text columns.
-- Phase 3: Drop text columns (separate migration).
--
-- Safety: All updates use WHERE ... IS NULL to avoid overwriting existing FK values.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- Step 1: Backfill faculty FK from facultyname
-- ═══════════════════════════════════════════════════════════════════════════

-- Exact match (case-insensitive)
UPDATE public.tbl_alumni a
SET faculty = f.id
FROM public.tbl_faculties f
WHERE a.faculty IS NULL
  AND a.facultyname IS NOT NULL
  AND TRIM(a.facultyname) != ''
  AND LOWER(TRIM(a.facultyname)) = LOWER(TRIM(f.faculty_name));

-- Normalized match (handle "and" vs "&", HTML entities, extra spaces)
UPDATE public.tbl_alumni a
SET faculty = f.id
FROM public.tbl_faculties f
WHERE a.faculty IS NULL
  AND a.facultyname IS NOT NULL
  AND TRIM(a.facultyname) != ''
  AND LOWER(REPLACE(REPLACE(REPLACE(TRIM(a.facultyname), '&', '&'), ' and ', ' & '), '  ', ' '))
      = LOWER(REPLACE(REPLACE(REPLACE(TRIM(f.faculty_name), '&', '&'), ' and ', ' & '), '  ', ' '));

-- ═══════════════════════════════════════════════════════════════════════════
-- Step 2: Backfill department FK from departmentname
-- ═══════════════════════════════════════════════════════════════════════════

-- Exact match (case-insensitive)
UPDATE public.tbl_alumni a
SET department = d.id
FROM public.tbl_departments d
WHERE a.department IS NULL
  AND a.departmentname IS NOT NULL
  AND TRIM(a.departmentname) != ''
  AND LOWER(TRIM(a.departmentname)) = LOWER(TRIM(d.department_name));

-- Normalized match
UPDATE public.tbl_alumni a
SET department = d.id
FROM public.tbl_departments d
WHERE a.department IS NULL
  AND a.departmentname IS NOT NULL
  AND TRIM(a.departmentname) != ''
  AND LOWER(REPLACE(REPLACE(TRIM(a.departmentname), ' and ', ' & '), '  ', ' '))
      = LOWER(REPLACE(REPLACE(TRIM(d.department_name), ' and ', ' & '), '  ', ' '));

-- ═══════════════════════════════════════════════════════════════════════════
-- Step 3: Create new programs for unmatched degree titles
-- ═══════════════════════════════════════════════════════════════════════════

-- Insert unique degree titles that don't match any existing program
-- Use degreetitle as the primary source, fall back to degree_title
-- Link new programs to the department if we can determine it from the alumni record

INSERT INTO public.tbl_programs (program_name, department_id)
SELECT DISTINCT
  TRIM(a.degreetitle) AS program_name,
  a.department AS department_id
FROM public.tbl_alumni a
WHERE a.degreetitle IS NOT NULL
  AND TRIM(a.degreetitle) != ''
  AND a.program IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.tbl_programs p
    WHERE p.program_name IS NOT NULL
      AND TRIM(p.program_name) != ''
      AND LOWER(TRIM(a.degreetitle)) = LOWER(TRIM(p.program_name))
  )
  AND a.department IS NOT NULL
GROUP BY TRIM(a.degreetitle), a.department;

-- For records without a department, insert programs with NULL department_id
INSERT INTO public.tbl_programs (program_name, department_id)
SELECT DISTINCT
  TRIM(a.degreetitle) AS program_name,
  NULL AS department_id
FROM public.tbl_alumni a
WHERE a.degreetitle IS NOT NULL
  AND TRIM(a.degreetitle) != ''
  AND a.program IS NULL
  AND a.department IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.tbl_programs p
    WHERE p.program_name IS NOT NULL
      AND TRIM(p.program_name) != ''
      AND LOWER(TRIM(a.degreetitle)) = LOWER(TRIM(p.program_name))
  )
GROUP BY TRIM(a.degreetitle);

-- Also handle records that only have degree_title (not degreetitle)
INSERT INTO public.tbl_programs (program_name, department_id)
SELECT DISTINCT
  TRIM(a.degree_title) AS program_name,
  a.department AS department_id
FROM public.tbl_alumni a
WHERE (a.degreetitle IS NULL OR TRIM(a.degreetitle) = '')
  AND a.degree_title IS NOT NULL
  AND TRIM(a.degree_title) != ''
  AND a.program IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.tbl_programs p
    WHERE p.program_name IS NOT NULL
      AND TRIM(p.program_name) != ''
      AND LOWER(TRIM(a.degree_title)) = LOWER(TRIM(p.program_name))
  )
  AND a.department IS NOT NULL
GROUP BY TRIM(a.degree_title), a.department;

-- ═══════════════════════════════════════════════════════════════════════════
-- Step 4: Backfill program FK from degreetitle
-- ═══════════════════════════════════════════════════════════════════════════

-- Exact match (case-insensitive) to non-empty program_name
UPDATE public.tbl_alumni a
SET program = p.id
FROM public.tbl_programs p
WHERE a.program IS NULL
  AND a.degreetitle IS NOT NULL
  AND TRIM(a.degreetitle) != ''
  AND p.program_name IS NOT NULL
  AND TRIM(p.program_name) != ''
  AND LOWER(TRIM(a.degreetitle)) = LOWER(TRIM(p.program_name));

-- For records with only degree_title (no degreetitle), match on degree_title
UPDATE public.tbl_alumni a
SET program = p.id
FROM public.tbl_programs p
WHERE a.program IS NULL
  AND (a.degreetitle IS NULL OR TRIM(a.degreetitle) = '')
  AND a.degree_title IS NOT NULL
  AND TRIM(a.degree_title) != ''
  AND p.program_name IS NOT NULL
  AND TRIM(p.program_name) != ''
  AND LOWER(TRIM(a.degree_title)) = LOWER(TRIM(p.program_name));

-- ═══════════════════════════════════════════════════════════════════════════
-- Step 5: Verification queries (run manually after migration)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- SELECT
--   (SELECT COUNT(*) FROM public.tbl_alumni WHERE faculty IS NOT NULL) as with_faculty_fk,
--   (SELECT COUNT(*) FROM public.tbl_alumni WHERE department IS NOT NULL) as with_dept_fk,
--   (SELECT COUNT(*) FROM public.tbl_alumni WHERE program IS NOT NULL) as with_program_fk,
--   (SELECT COUNT(*) FROM public.tbl_alumni) as total_records;
--
-- -- Records still missing FK (should be only records with no text data)
-- SELECT
--   (SELECT COUNT(*) FROM public.tbl_alumni WHERE faculty IS NULL AND facultyname IS NOT NULL AND facultyname != '') as faculty_text_no_id,
--   (SELECT COUNT(*) FROM public.tbl_alumni WHERE department IS NULL AND departmentname IS NOT NULL AND departmentname != '') as dept_text_no_id,
--   (SELECT COUNT(*) FROM public.tbl_alumni WHERE program IS NULL AND degreetitle IS NOT NULL AND degreetitle != '') as degree_text_no_id;

COMMIT;
