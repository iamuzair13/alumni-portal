-- Migration Script: Populate ID-based Faculty and Department columns
-- This script assigns faculty and department IDs from the lookup tables
-- based on matching names in the text-based columns

-- =====================================================
-- STEP 1: Populate Faculty IDs
-- =====================================================
-- Match exact faculty names and assign IDs
UPDATE public.tbl_alumni a
SET faculty = f.id
FROM public.tbl_faculties f
WHERE LOWER(TRIM(COALESCE(a.facultyname, ''))) = LOWER(TRIM(f.faculty_name))
  AND a.facultyname IS NOT NULL 
  AND a.facultyname != ''
  AND a.faculty IS NULL;

-- Check how many faculty IDs were assigned
SELECT 
  COUNT(*) as total_alumni,
  COUNT(faculty) as alumni_with_faculty_id,
  COUNT(facultyname) as alumni_with_faculty_text,
  COUNT(*) - COUNT(faculty) as alumni_missing_faculty_id
FROM public.tbl_alumni;

-- =====================================================
-- STEP 2: Populate Department IDs
-- =====================================================
-- Match exact department names and assign IDs
UPDATE public.tbl_alumni a
SET department = d.id
FROM public.tbl_departments d
WHERE LOWER(TRIM(COALESCE(a.departmentname, ''))) = LOWER(TRIM(d.department_name))
  AND a.departmentname IS NOT NULL 
  AND a.departmentname != ''
  AND a.department IS NULL;

-- Check how many department IDs were assigned
SELECT 
  COUNT(*) as total_alumni,
  COUNT(department) as alumni_with_department_id,
  COUNT(departmentname) as alumni_with_department_text,
  COUNT(*) - COUNT(department) as alumni_missing_department_id
FROM public.tbl_alumni;

-- =====================================================
-- STEP 3: Verify the migration
-- =====================================================
-- Show alumni where text exists but ID is still missing
SELECT 
  sapid,
  alumniname,
  facultyname,
  faculty as faculty_id,
  departmentname,
  department as department_id
FROM public.tbl_alumni
WHERE (facultyname IS NOT NULL AND facultyname != '' AND faculty IS NULL)
   OR (departmentname IS NOT NULL AND departmentname != '' AND department IS NULL)
LIMIT 20;

-- =====================================================
-- STEP 4: Show unique unmatched faculty names
-- =====================================================
-- These faculty names exist in alumni records but not in tbl_faculties
SELECT DISTINCT 
  TRIM(a.facultyname) as unmatched_faculty_name,
  COUNT(*) as alumni_count
FROM public.tbl_alumni a
LEFT JOIN public.tbl_faculties f ON LOWER(TRIM(a.facultyname)) = LOWER(TRIM(f.faculty_name))
WHERE a.facultyname IS NOT NULL 
  AND a.facultyname != ''
  AND f.id IS NULL
GROUP BY TRIM(a.facultyname)
ORDER BY alumni_count DESC;

-- =====================================================
-- STEP 5: Show unique unmatched department names
-- =====================================================
-- These department names exist in alumni records but not in tbl_departments
SELECT DISTINCT 
  TRIM(a.departmentname) as unmatched_department_name,
  COUNT(*) as alumni_count
FROM public.tbl_alumni a
LEFT JOIN public.tbl_departments d ON LOWER(TRIM(a.departmentname)) = LOWER(TRIM(d.department_name))
WHERE a.departmentname IS NOT NULL 
  AND a.departmentname != ''
  AND d.id IS NULL
GROUP BY TRIM(a.departmentname)
ORDER BY alumni_count DESC;

