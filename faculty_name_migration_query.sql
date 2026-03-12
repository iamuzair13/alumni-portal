-- =====================================================
-- FACULTY NAME MIGRATION QUERY
-- =====================================================
-- This script matches faculty names from tbl_alumni.facultyname 
-- with tbl_faculties.faculty_name and updates the faculty column
-- with the corresponding faculty_id

-- =====================================================
-- STEP 1: SANITY CHECK - EXAMINE CURRENT DATA
-- =====================================================

-- Check current state of faculty data in tbl_alumni
SELECT 
    'Current Alumni Faculty Data Status' as analysis_type,
    COUNT(*) as total_alumni_records,
    COUNT(CASE WHEN facultyname IS NOT NULL AND facultyname != '' THEN 1 END) as records_with_facultyname,
    COUNT(CASE WHEN faculty IS NOT NULL THEN 1 END) as records_with_faculty_id,
    COUNT(CASE WHEN facultyname IS NOT NULL AND facultyname != '' AND faculty IS NULL THEN 1 END) as needs_migration,
    COUNT(CASE WHEN facultyname IS NULL OR facultyname = '' THEN 1 END) as missing_facultyname,
    COUNT(CASE WHEN faculty IS NOT NULL AND facultyname IS NOT NULL AND facultyname != '' THEN 1 END) as already_populated
FROM public.tbl_alumni;

-- Show sample of faculty names in tbl_alumni
SELECT 
    'Sample Alumni Faculty Names' as analysis_type,
    facultyname,
    COUNT(*) as count
FROM public.tbl_alumni 
WHERE facultyname IS NOT NULL AND facultyname != ''
GROUP BY facultyname
ORDER BY count DESC
LIMIT 20;

-- Show all faculties available in tbl_faculties
SELECT 
    'Available Faculties' as analysis_type,
    id as faculty_id,
    faculty_name,
    created_at
FROM public.tbl_faculties
ORDER BY faculty_name;

-- =====================================================
-- STEP 2: EXACT MATCH ANALYSIS
-- =====================================================

-- Find exact matches between alumni faculty names and faculties table
SELECT 
    'Exact Matches Found' as match_type,
    a.facultyname,
    f.id as faculty_id,
    f.faculty_name,
    COUNT(*) as alumni_count
FROM public.tbl_alumni a
JOIN public.tbl_faculties f ON TRIM(a.facultyname) = TRIM(f.faculty_name)
WHERE a.facultyname IS NOT NULL AND a.facultyname != ''
GROUP BY a.facultyname, f.id, f.faculty_name
ORDER BY alumni_count DESC;

-- Show records that will be updated (exact matches)
SELECT 
    'Records to Update (Exact Matches)' as action_type,
    COUNT(*) as total_records_to_update
FROM public.tbl_alumni a
WHERE a.facultyname IS NOT NULL 
    AND a.facultyname != ''
    AND a.faculty IS NULL
    AND EXISTS (
        SELECT 1 FROM public.tbl_faculties f 
        WHERE TRIM(a.facultyname) = TRIM(f.faculty_name)
    );

-- =====================================================
-- STEP 3: FUZZY MATCH ANALYSIS (CASE INSENSITIVE, TRIMMED)
-- =====================================================

-- Find potential matches using case-insensitive comparison
SELECT 
    'Potential Case-Insensitive Matches' as match_type,
    a.facultyname as alumni_faculty_name,
    f.id as faculty_id,
    f.faculty_name as faculty_table_name,
    COUNT(*) as alumni_count
FROM public.tbl_alumni a
JOIN public.tbl_faculties f ON LOWER(TRIM(a.facultyname)) = LOWER(TRIM(f.faculty_name))
WHERE a.facultyname IS NOT NULL 
    AND a.facultyname != ''
    AND NOT EXISTS (
        SELECT 1 FROM public.tbl_faculties f2 
        WHERE TRIM(a.facultyname) = TRIM(f2.faculty_name)
    )  -- Exclude exact matches already found
GROUP BY a.facultyname, f.id, f.faculty_name
ORDER BY alumni_count DESC;

-- =====================================================
-- STEP 4: UNMATCHED FACULTY NAMES ANALYSIS
-- =====================================================

-- Show faculty names that don't match any faculty in tbl_faculties
SELECT 
    'Unmatched Faculty Names' as match_type,
    facultyname,
    COUNT(*) as alumni_count,
    MIN(alumniid) as sample_alumni_id
FROM public.tbl_alumni 
WHERE facultyname IS NOT NULL 
    AND facultyname != ''
    AND faculty IS NULL
    AND NOT EXISTS (
        SELECT 1 FROM public.tbl_faculties f 
        WHERE LOWER(TRIM(facultyname)) = LOWER(TRIM(f.faculty_name))
    )
GROUP BY facultyname
ORDER BY alumni_count DESC
LIMIT 50;

-- =====================================================
-- STEP 5: DETAILED PREVIEW OF UPDATES
-- =====================================================

-- Show detailed preview of what will be updated
WITH matches_to_update AS (
    SELECT 
        a.alumniid,
        a.facultyname,
        f.id as new_faculty_id,
        f.faculty_name as matched_faculty_name
    FROM public.tbl_alumni a
    JOIN public.tbl_faculties f ON LOWER(TRIM(a.facultyname)) = LOWER(TRIM(f.faculty_name))
    WHERE a.facultyname IS NOT NULL 
        AND a.facultyname != ''
        AND a.faculty IS NULL
)
SELECT 
    'Preview of Updates' as action_type,
    alumniid,
    facultyname as current_faculty_name,
    new_faculty_id,
    matched_faculty_name,
    'Will be updated' as action
FROM matches_to_update
ORDER BY alumniid
LIMIT 100;

-- =====================================================
-- STEP 6: SUMMARY STATISTICS
-- =====================================================

-- Comprehensive summary
WITH exact_matches AS (
    SELECT COUNT(*) as count
    FROM public.tbl_alumni a
    WHERE a.facultyname IS NOT NULL 
        AND a.facultyname != ''
        AND a.faculty IS NULL
        AND EXISTS (
            SELECT 1 FROM public.tbl_faculties f 
            WHERE TRIM(a.facultyname) = TRIM(f.faculty_name)
        )
),
fuzzy_matches AS (
    SELECT COUNT(*) as count
    FROM public.tbl_alumni a
    WHERE a.facultyname IS NOT NULL 
        AND a.facultyname != ''
        AND a.faculty IS NULL
        AND EXISTS (
            SELECT 1 FROM public.tbl_faculties f 
            WHERE LOWER(TRIM(a.facultyname)) = LOWER(TRIM(f.faculty_name))
        )
),
unmatched AS (
    SELECT COUNT(*) as count
    FROM public.tbl_alumni a
    WHERE a.facultyname IS NOT NULL 
        AND a.facultyname != ''
        AND a.faculty IS NULL
        AND NOT EXISTS (
            SELECT 1 FROM public.tbl_faculties f 
            WHERE LOWER(TRIM(a.facultyname)) = LOWER(TRIM(f.faculty_name))
        )
)
SELECT 
    'Migration Summary' as report_type,
    (SELECT COUNT(*) FROM public.tbl_alumni) as total_alumni,
    (SELECT COUNT(*) FROM public.tbl_alumni WHERE facultyname IS NOT NULL AND facultyname != '') as with_faculty_name,
    (SELECT COUNT(*) FROM public.tbl_alumni WHERE faculty IS NOT NULL) as with_faculty_id,
    (SELECT count FROM exact_matches) as exact_matches_to_update,
    (SELECT count FROM fuzzy_matches) - (SELECT count FROM exact_matches) as case_insensitive_matches,
    (SELECT count FROM fuzzy_matches) as total_matches_to_update,
    (SELECT count FROM unmatched) as unmatched_faculty_names,
    ROUND((SELECT count FROM fuzzy_matches) * 100.0 / 
          (SELECT COUNT(*) FROM public.tbl_alumni WHERE facultyname IS NOT NULL AND facultyname != ''), 2) as success_rate_percentage;

-- =====================================================
-- STEP 7: ACTUAL MIGRATION (UNCOMMENT TO EXECUTE)
-- =====================================================

-- WARNING: This will actually update records. 
-- Run the sanity checks above first and verify the results!

/*
-- Update alumni records with exact and case-insensitive matches
UPDATE public.tbl_alumni a
SET faculty = f.id
FROM public.tbl_faculties f
WHERE LOWER(TRIM(a.facultyname)) = LOWER(TRIM(f.faculty_name))
    AND a.facultyname IS NOT NULL 
    AND a.facultyname != ''
    AND a.faculty IS NULL;
*/

-- =====================================================
-- STEP 8: VERIFICATION AFTER MIGRATION (UNCOMMENT AFTER MIGRATION)
-- =====================================================

/*
-- Verify migration results
SELECT 
    'Post-Migration Verification' as verification_type,
    COUNT(*) as total_alumni,
    COUNT(CASE WHEN facultyname IS NOT NULL AND facultyname != '' THEN 1 END) as with_faculty_name,
    COUNT(CASE WHEN faculty IS NOT NULL THEN 1 END) as with_faculty_id,
    COUNT(CASE WHEN facultyname IS NOT NULL AND facultyname != '' AND faculty IS NOT NULL THEN 1 END) as successfully_migrated,
    COUNT(CASE WHEN facultyname IS NOT NULL AND facultyname != '' AND faculty IS NULL THEN 1 END) as still_unmatched,
    ROUND(COUNT(CASE WHEN facultyname IS NOT NULL AND facultyname != '' AND faculty IS NOT NULL THEN 1 END) * 100.0 / 
          COUNT(CASE WHEN facultyname IS NOT NULL AND facultyname != '' THEN 1 END), 2) as migration_success_rate
FROM public.tbl_alumni;

-- Show any remaining unmatched faculty names for manual review
SELECT 
    'Remaining Unmatched Faculty Names' as status,
    facultyname,
    COUNT(*) as alumni_count
FROM public.tbl_alumni 
WHERE facultyname IS NOT NULL 
    AND facultyname != ''
    AND faculty IS NULL
GROUP BY facultyname
ORDER BY alumni_count DESC;
*/

-- =====================================================
-- USAGE INSTRUCTIONS:
-- 1. Run Step 1 to understand current data state
-- 2. Run Step 2 to see exact matches available
-- 3. Run Step 3 to see potential case-insensitive matches
-- 4. Run Step 4 to identify unmatched faculty names
-- 5. Run Step 5 to preview specific updates
-- 6. Run Step 6 for comprehensive summary
-- 7. Review results carefully - if satisfied, uncomment and run Step 7
-- 8. Uncomment and run Step 8 to verify migration was successful
-- =====================================================
