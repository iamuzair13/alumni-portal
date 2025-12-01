-- Fix typo in user_access_assignments table
-- "Faculty of Alllied health sciences" → "Faculty of Allied Health Sciences"

-- Preview what will be updated
SELECT id, userid, faculty_name, department_name, program_name
FROM public.user_access_assignments
WHERE LOWER(TRIM(COALESCE(faculty_name, ''))) LIKE '%alllied%health%'
  OR LOWER(TRIM(COALESCE(faculty_name, ''))) = LOWER(TRIM('Faculty of Alllied health sciences'))
ORDER BY userid, id;

-- Apply the fix
UPDATE public.user_access_assignments
SET faculty_name = 'Faculty of Allied Health Sciences'
WHERE LOWER(TRIM(COALESCE(faculty_name, ''))) LIKE '%alllied%health%'
  AND LOWER(TRIM(COALESCE(faculty_name, ''))) NOT LIKE '%allied%health%';

-- Verify the update
SELECT id, userid, faculty_name, department_name, program_name
FROM public.user_access_assignments
WHERE LOWER(TRIM(COALESCE(faculty_name, ''))) LIKE '%health%'
ORDER BY userid, id;

