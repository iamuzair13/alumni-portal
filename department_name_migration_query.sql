-- =====================================================
-- DEPARTMENT NAME MIGRATION QUERY
-- =====================================================
-- This script matches department names from tbl_alumni.departmentname 
-- with tbl_departments.department_name and updates the department column
-- with the corresponding department_id

-- =====================================================
-- STEP 1: SANITY CHECK - EXAMINE CURRENT DATA
-- =====================================================

-- Check current state of department data in tbl_alumni
SELECT 
    'Current Alumni Department Data Status' as analysis_type,
    COUNT(*) as total_alumni_records,
    COUNT(CASE WHEN departmentname IS NOT NULL AND departmentname != '' THEN 1 END) as records_with_departmentname,
    COUNT(CASE WHEN department IS NOT NULL THEN 1 END) as records_with_department_id,
    COUNT(CASE WHEN departmentname IS NOT NULL AND departmentname != '' AND department IS NULL THEN 1 END) as needs_migration,
    COUNT(CASE WHEN departmentname IS NULL OR departmentname = '' THEN 1 END) as missing_departmentname,
    COUNT(CASE WHEN department IS NOT NULL AND departmentname IS NOT NULL AND departmentname != '' THEN 1 END) as already_populated
FROM public.tbl_alumni;

-- Show sample of department names in tbl_alumni
SELECT 
    'Sample Alumni Department Names' as analysis_type,
    departmentname,
    COUNT(*) as count
FROM public.tbl_alumni 
WHERE departmentname IS NOT NULL AND departmentname != ''
GROUP BY departmentname
ORDER BY count DESC
LIMIT 20;

-- Show all departments available in tbl_departments
SELECT 
    'Available Departments' as analysis_type,
    id as department_id,
    department_name,
    faculty_id,
    created_at
FROM public.tbl_departments
ORDER BY department_name;

-- =====================================================
-- STEP 2: EXACT MATCH ANALYSIS
-- =====================================================

-- Find exact matches between alumni department names and departments table
SELECT 
    'Exact Matches Found' as match_type,
    a.departmentname,
    d.id as department_id,
    d.department_name,
    d.faculty_id,
    COUNT(*) as alumni_count
FROM public.tbl_alumni a
JOIN public.tbl_departments d ON TRIM(a.departmentname) = TRIM(d.department_name)
WHERE a.departmentname IS NOT NULL AND a.departmentname != ''
GROUP BY a.departmentname, d.id, d.department_name, d.faculty_id
ORDER BY alumni_count DESC;

-- Show records that will be updated (exact matches)
SELECT 
    'Records to Update (Exact Matches)' as action_type,
    COUNT(*) as total_records_to_update
FROM public.tbl_alumni a
WHERE a.departmentname IS NOT NULL 
    AND a.departmentname != ''
    AND a.department IS NULL
    AND EXISTS (
        SELECT 1 FROM public.tbl_departments d 
        WHERE TRIM(a.departmentname) = TRIM(d.department_name)
    );

-- =====================================================
-- STEP 3: FUZZY MATCH ANALYSIS (CASE INSENSITIVE, TRIMMED)
-- =====================================================

-- Find potential matches using case-insensitive comparison
SELECT 
    'Potential Case-Insensitive Matches' as match_type,
    a.departmentname as alumni_department_name,
    d.id as department_id,
    d.department_name as department_table_name,
    d.faculty_id,
    COUNT(*) as alumni_count
FROM public.tbl_alumni a
JOIN public.tbl_departments d ON LOWER(TRIM(a.departmentname)) = LOWER(TRIM(d.department_name))
WHERE a.departmentname IS NOT NULL 
    AND a.departmentname != ''
    AND NOT EXISTS (
        SELECT 1 FROM public.tbl_departments d2 
        WHERE TRIM(a.departmentname) = TRIM(d2.department_name)
    )  -- Exclude exact matches already found
GROUP BY a.departmentname, d.id, d.department_name, d.faculty_id
ORDER BY alumni_count DESC;

-- =====================================================
-- STEP 4: UNMATCHED DEPARTMENT NAMES ANALYSIS
-- =====================================================

-- Show department names that don't match any department in tbl_departments
SELECT 
    'Unmatched Department Names' as match_type,
    departmentname,
    COUNT(*) as alumni_count,
    MIN(alumniid) as sample_alumni_id
FROM public.tbl_alumni 
WHERE departmentname IS NOT NULL 
    AND departmentname != ''
    AND department IS NULL
    AND NOT EXISTS (
        SELECT 1 FROM public.tbl_departments d 
        WHERE LOWER(TRIM(departmentname)) = LOWER(TRIM(d.department_name))
    )
GROUP BY departmentname
ORDER BY alumni_count DESC
LIMIT 50;

-- =====================================================
-- STEP 5: DETAILED PREVIEW OF UPDATES
-- =====================================================

-- Show detailed preview of what will be updated
WITH matches_to_update AS (
    SELECT 
        a.alumniid,
        a.departmentname,
        d.id as new_department_id,
        d.department_name as matched_department_name,
        d.faculty_id as matched_faculty_id
    FROM public.tbl_alumni a
    JOIN public.tbl_departments d ON LOWER(TRIM(a.departmentname)) = LOWER(TRIM(d.department_name))
    WHERE a.departmentname IS NOT NULL 
        AND a.departmentname != ''
        AND a.department IS NULL
)
SELECT 
    'Preview of Updates' as action_type,
    alumniid,
    departmentname as current_department_name,
    new_department_id,
    matched_department_name,
    matched_faculty_id,
    'Will be updated' as action
FROM matches_to_update
ORDER BY alumniid
LIMIT 100;

-- =====================================================
-- STEP 6: CROSS-REFERENCE WITH FACULTY MIGRATION
-- =====================================================

-- Check if alumni have matching faculty and department relationships
SELECT 
    'Faculty-Department Cross-Reference' as analysis_type,
    CASE 
        WHEN a.faculty IS NOT NULL AND d.faculty_id IS NOT NULL AND a.faculty = d.faculty_id THEN 'MATCHING'
        WHEN a.faculty IS NOT NULL AND d.faculty_id IS NOT NULL AND a.faculty != d.faculty_id THEN 'MISMATCHED'
        WHEN a.faculty IS NULL AND d.faculty_id IS NOT NULL THEN 'MISSING_FACULTY'
        WHEN a.faculty IS NOT NULL AND d.faculty_id IS NULL THEN 'DEPT_NO_FACULTY'
        ELSE 'BOTH_NULL'
    END as faculty_relationship,
    COUNT(*) as alumni_count
FROM public.tbl_alumni a
JOIN public.tbl_departments d ON LOWER(TRIM(a.departmentname)) = LOWER(TRIM(d.department_name))
WHERE a.departmentname IS NOT NULL 
    AND a.departmentname != ''
    AND a.department IS NULL
GROUP BY CASE 
    WHEN a.faculty IS NOT NULL AND d.faculty_id IS NOT NULL AND a.faculty = d.faculty_id THEN 'MATCHING'
    WHEN a.faculty IS NOT NULL AND d.faculty_id IS NOT NULL AND a.faculty != d.faculty_id THEN 'MISMATCHED'
    WHEN a.faculty IS NULL AND d.faculty_id IS NOT NULL THEN 'MISSING_FACULTY'
    WHEN a.faculty IS NOT NULL AND d.faculty_id IS NULL THEN 'DEPT_NO_FACULTY'
    ELSE 'BOTH_NULL'
END
ORDER BY alumni_count DESC;

-- Show specific faculty-department mismatches for review
SELECT 
    'Faculty-Department Mismatches' as analysis_type,
    a.alumniid,
    a.departmentname as alumni_dept_name,
    d.department_name as matched_dept_name,
    a.faculty as current_faculty_id,
    d.faculty_id as expected_faculty_id,
    (SELECT f.faculty_name FROM public.tbl_faculties f WHERE f.id = a.faculty) as current_faculty_name,
    (SELECT f.faculty_name FROM public.tbl_faculties f WHERE f.id = d.faculty_id) as expected_faculty_name
FROM public.tbl_alumni a
JOIN public.tbl_departments d ON LOWER(TRIM(a.departmentname)) = LOWER(TRIM(d.department_name))
WHERE a.departmentname IS NOT NULL 
    AND a.departmentname != ''
    AND a.department IS NULL
    AND a.faculty IS NOT NULL 
    AND d.faculty_id IS NOT NULL 
    AND a.faculty != d.faculty_id
ORDER BY a.alumniid
LIMIT 20;

-- =====================================================
-- STEP 7: SUMMARY STATISTICS
-- =====================================================

-- Comprehensive summary
WITH exact_matches AS (
    SELECT COUNT(*) as count
    FROM public.tbl_alumni a
    WHERE a.departmentname IS NOT NULL 
        AND a.departmentname != ''
        AND a.department IS NULL
        AND EXISTS (
            SELECT 1 FROM public.tbl_departments d 
            WHERE TRIM(a.departmentname) = TRIM(d.department_name)
        )
),
fuzzy_matches AS (
    SELECT COUNT(*) as count
    FROM public.tbl_alumni a
    WHERE a.departmentname IS NOT NULL 
        AND a.departmentname != ''
        AND a.department IS NULL
        AND EXISTS (
            SELECT 1 FROM public.tbl_departments d 
            WHERE LOWER(TRIM(a.departmentname)) = LOWER(TRIM(d.department_name))
        )
),
unmatched AS (
    SELECT COUNT(*) as count
    FROM public.tbl_alumni a
    WHERE a.departmentname IS NOT NULL 
        AND a.departmentname != ''
        AND a.department IS NULL
        AND NOT EXISTS (
            SELECT 1 FROM public.tbl_departments d 
            WHERE LOWER(TRIM(a.departmentname)) = LOWER(TRIM(d.department_name))
        )
),
faculty_mismatches AS (
    SELECT COUNT(*) as count
    FROM public.tbl_alumni a
    JOIN public.tbl_departments d ON LOWER(TRIM(a.departmentname)) = LOWER(TRIM(d.department_name))
    WHERE a.departmentname IS NOT NULL 
        AND a.departmentname != ''
        AND a.department IS NULL
        AND a.faculty IS NOT NULL 
        AND d.faculty_id IS NOT NULL 
        AND a.faculty != d.faculty_id
)
SELECT 
    'Migration Summary' as report_type,
    (SELECT COUNT(*) FROM public.tbl_alumni) as total_alumni,
    (SELECT COUNT(*) FROM public.tbl_alumni WHERE departmentname IS NOT NULL AND departmentname != '') as with_department_name,
    (SELECT COUNT(*) FROM public.tbl_alumni WHERE department IS NOT NULL) as with_department_id,
    (SELECT count FROM exact_matches) as exact_matches_to_update,
    (SELECT count FROM fuzzy_matches) - (SELECT count FROM exact_matches) as case_insensitive_matches,
    (SELECT count FROM fuzzy_matches) as total_matches_to_update,
    (SELECT count from unmatched) as unmatched_department_names,
    (SELECT count from faculty_mismatches) as faculty_department_mismatches,
    ROUND((SELECT count from fuzzy_matches) * 100.0 / 
          (SELECT COUNT(*) FROM public.tbl_alumni WHERE departmentname IS NOT NULL AND departmentname != ''), 2) as success_rate_percentage;

-- =====================================================
-- STEP 8: ACTUAL MIGRATION (UNCOMMENT TO EXECUTE)
-- =====================================================

-- WARNING: This will actually update records. 
-- Run the sanity checks above first and verify the results!


-- Update alumni records with exact and case-insensitive matches
UPDATE public.tbl_alumni a
SET department = d.id
FROM public.tbl_departments d
WHERE LOWER(TRIM(a.departmentname)) = LOWER(TRIM(d.department_name))
    AND a.departmentname IS NOT NULL 
    AND a.departmentname != ''
    AND a.department IS NULL;


-- =====================================================
-- STEP 9: VERIFICATION AFTER MIGRATION (UNCOMMENT AFTER MIGRATION)
-- =====================================================


-- Verify migration results
SELECT 
    'Post-Migration Verification' as verification_type,
    COUNT(*) as total_alumni,
    COUNT(CASE WHEN departmentname IS NOT NULL AND departmentname != '' THEN 1 END) as with_department_name,
    COUNT(CASE WHEN department IS NOT NULL THEN 1 END) as with_department_id,
    COUNT(CASE WHEN departmentname IS NOT NULL AND departmentname != '' AND department IS NOT NULL THEN 1 END) as successfully_migrated,
    COUNT(CASE WHEN departmentname IS NOT NULL AND departmentname != '' AND department IS NULL THEN 1 END) as still_unmatched,
    ROUND(COUNT(CASE WHEN departmentname IS NOT NULL AND departmentname != '' AND department IS NOT NULL THEN 1 END) * 100.0 / 
          COUNT(CASE WHEN departmentname IS NOT NULL AND departmentname != '' THEN 1 END), 2) as migration_success_rate
FROM public.tbl_alumni;

-- Show any remaining unmatched department names for manual review
SELECT 
    'Remaining Unmatched Department Names' as status,
    departmentname,
    COUNT(*) as alumni_count
FROM public.tbl_alumni 
WHERE departmentname IS NOT NULL 
    AND departmentname != ''
    AND department IS NULL
GROUP BY departmentname
ORDER BY alumni_count DESC;

-- Verify faculty-department relationships after migration
SELECT 
    'Post-Migration Faculty-Department Analysis' as verification_type,
    CASE 
        WHEN a.faculty IS NOT NULL AND d.faculty_id IS NOT NULL AND a.faculty = d.faculty_id THEN 'MATCHING'
        WHEN a.faculty IS NOT NULL AND d.faculty_id IS NOT NULL AND a.faculty != d.faculty_id THEN 'MISMATCHED'
        WHEN a.faculty IS NULL AND d.faculty_id IS NOT NULL THEN 'MISSING_FACULTY'
        WHEN a.faculty IS NOT NULL AND d.faculty_id IS NULL THEN 'DEPT_NO_FACULTY'
        ELSE 'BOTH_NULL'
    END as faculty_relationship,
    COUNT(*) as alumni_count
FROM public.tbl_alumni a
JOIN public.tbl_departments d ON a.department = d.id
WHERE a.departmentname IS NOT NULL AND a.departmentname != ''
GROUP BY CASE 
    WHEN a.faculty IS NOT NULL AND d.faculty_id IS NOT NULL AND a.faculty = d.faculty_id THEN 'MATCHING'
    WHEN a.faculty IS NOT NULL AND d.faculty_id IS NOT NULL AND a.faculty != d.faculty_id THEN 'MISMATCHED'
    WHEN a.faculty IS NULL AND d.faculty_id IS NOT NULL THEN 'MISSING_FACULTY'
    WHEN a.faculty IS NOT NULL AND d.faculty_id IS NULL THEN 'DEPT_NO_FACULTY'
    ELSE 'BOTH_NULL'
END
ORDER BY alumni_count DESC;
*/

-- =====================================================
-- USAGE INSTRUCTIONS:
-- 1. Run Step 1 to understand current data state
-- 2. Run Step 2 to see exact matches available
-- 3. Run Step 3 to see potential case-insensitive matches
-- 4. Run Step 4 to identify unmatched department names
-- 5. Run Step 5 to preview specific updates
-- 6. Run Step 6 to check faculty-department relationships
-- 7. Run Step 7 for comprehensive summary
-- 8. Review results carefully - if satisfied, uncomment and run Step 8
-- 9. Uncomment and run Step 9 to verify migration was successful
-- =====================================================
