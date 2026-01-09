-- Migration: Populate faculty_id, department_id, program_id in user_access_assignments
-- This script updates existing assignments to include IDs based on names

-- Update faculty_id from faculty_name
UPDATE public.user_access_assignments uaa
SET faculty_id = f.id
FROM public.tbl_faculties f
WHERE uaa.faculty_id IS NULL
  AND uaa.faculty_name IS NOT NULL
  AND LOWER(TRIM(COALESCE(f.faculty_name, ''))) = LOWER(TRIM(COALESCE(uaa.faculty_name, '')));

-- Update department_id from department_name (with faculty_id check)
UPDATE public.user_access_assignments uaa
SET department_id = d.id
FROM public.tbl_departments d
WHERE uaa.department_id IS NULL
  AND uaa.department_name IS NOT NULL
  AND LOWER(TRIM(COALESCE(d.department_name, ''))) = LOWER(TRIM(COALESCE(uaa.department_name, '')))
  AND (uaa.faculty_id IS NULL OR d.faculty_id = uaa.faculty_id);

-- Update program_id from program_name (with department_id check)
UPDATE public.user_access_assignments uaa
SET program_id = p.id
FROM public.tbl_programs p
WHERE uaa.program_id IS NULL
  AND uaa.program_name IS NOT NULL
  AND LOWER(TRIM(COALESCE(p.program_name, ''))) = LOWER(TRIM(COALESCE(uaa.program_name, '')))
  AND (uaa.department_id IS NULL OR p.department_id = uaa.department_id);

-- Log results
DO $$
DECLARE
  total_count INTEGER;
  with_faculty_id INTEGER;
  with_department_id INTEGER;
  with_program_id INTEGER;
  fully_populated INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM public.user_access_assignments;
  SELECT COUNT(*) INTO with_faculty_id FROM public.user_access_assignments WHERE faculty_id IS NOT NULL;
  SELECT COUNT(*) INTO with_department_id FROM public.user_access_assignments WHERE department_id IS NOT NULL;
  SELECT COUNT(*) INTO with_program_id FROM public.user_access_assignments WHERE program_id IS NOT NULL;
  SELECT COUNT(*) INTO fully_populated FROM public.user_access_assignments 
    WHERE (faculty_name IS NULL OR faculty_id IS NOT NULL)
      AND (department_name IS NULL OR department_id IS NOT NULL)
      AND (program_name IS NULL OR program_id IS NOT NULL);
  
  RAISE NOTICE 'Migration Results:';
  RAISE NOTICE '  Total assignments: %', total_count;
  RAISE NOTICE '  With faculty_id: %', with_faculty_id;
  RAISE NOTICE '  With department_id: %', with_department_id;
  RAISE NOTICE '  With program_id: %', with_program_id;
  RAISE NOTICE '  Fully populated: %', fully_populated;
END $$;
