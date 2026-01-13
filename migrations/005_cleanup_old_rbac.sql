-- ================================================
-- WARNING: DESTRUCTIVE OPERATION
-- ================================================
-- This script removes old RBAC tables and data.
-- 
-- ⚠️ ONLY RUN THIS AFTER:
-- 1. Migration is complete and verified
-- 2. All validation queries pass
-- 3. New RBAC system is tested in production
-- 4. You have a full database backup
-- 5. You've confirmed no code references old tables
-- 
-- This script is REVERSIBLE only if you have backups.
-- ================================================

-- ================================================
-- STEP 1: VERIFY MIGRATION COMPLETE
-- ================================================
-- Uncomment and run these checks before proceeding

/*
-- Check all users migrated
DO $$
DECLARE
    old_count integer;
    new_count integer;
BEGIN
    SELECT COUNT(*) INTO old_count
    FROM public.tbl_users
    WHERE LOWER(TRIM(COALESCE(type, ''))) NOT IN ('alumni', '');
    
    SELECT COUNT(*) INTO new_count FROM public.users;
    
    IF new_count < old_count THEN
        RAISE EXCEPTION 'Migration incomplete: % old users vs % new users', old_count, new_count;
    END IF;
    
    RAISE NOTICE '✅ User migration verified: % old, % new', old_count, new_count;
END $$;

-- Check all access assignments migrated
DO $$
DECLARE
    old_count integer;
    new_count integer;
BEGIN
    SELECT COUNT(*) INTO old_count FROM public.user_access_assignments;
    SELECT COUNT(*) INTO new_count FROM public.user_resource_access;
    
    IF new_count < old_count * 0.8 THEN
        RAISE EXCEPTION 'Migration incomplete: % old assignments vs % new assignments', old_count, new_count;
    END IF;
    
    RAISE NOTICE '✅ Access assignment migration verified: % old, % new', old_count, new_count;
END $$;
*/

-- ================================================
-- STEP 2: RENAME OLD TABLES (SAFE - REVERSIBLE)
-- ================================================
-- Rename instead of drop, so we can recover if needed

-- Rename old user_access_assignments table
ALTER TABLE IF EXISTS public.user_access_assignments 
    RENAME TO user_access_assignments_deprecated;

-- Add comment to mark as deprecated
COMMENT ON TABLE public.user_access_assignments_deprecated IS 
    'DEPRECATED: Old RBAC access assignments. Replaced by user_resource_access. Safe to drop after verification.';

-- ================================================
-- STEP 3: DROP INDEXES ON OLD TABLES
-- ================================================

DROP INDEX IF EXISTS public.idx_user_access_userid;
DROP INDEX IF EXISTS public.idx_user_access_faculty;
DROP INDEX IF EXISTS public.idx_user_access_department;
DROP INDEX IF EXISTS public.idx_user_access_program;
DROP INDEX IF EXISTS public.idx_user_access_faculty_id;
DROP INDEX IF EXISTS public.idx_user_access_department_id;
DROP INDEX IF EXISTS public.idx_user_access_program_id;

-- ================================================
-- STEP 4: REMOVE FOREIGN KEY CONSTRAINTS
-- ================================================
-- Must remove constraints before dropping tables

ALTER TABLE IF EXISTS public.user_access_assignments_deprecated
    DROP CONSTRAINT IF EXISTS user_access_assignments_userid_fkey,
    DROP CONSTRAINT IF EXISTS fk_access_faculty,
    DROP CONSTRAINT IF EXISTS fk_access_department,
    DROP CONSTRAINT IF EXISTS fk_access_program,
    DROP CONSTRAINT IF EXISTS unique_user_access,
    DROP CONSTRAINT IF EXISTS user_access_assignments_faculty_check,
    DROP CONSTRAINT IF EXISTS user_access_assignments_department_check,
    DROP CONSTRAINT IF EXISTS user_access_assignments_program_check;

-- ================================================
-- STEP 5: DROP OLD TABLES (DESTRUCTIVE)
-- ================================================
-- Uncomment only after full verification

-- DROP TABLE IF EXISTS public.user_access_assignments_deprecated;

-- ================================================
-- STEP 6: CLEAN UP LEGACY FIELDS (OPTIONAL)
-- ================================================
-- After confirming everything works, remove legacy mapping fields

-- Remove legacy fields from users table
/*
ALTER TABLE public.users
    DROP COLUMN IF EXISTS legacy_userid,
    DROP COLUMN IF EXISTS legacy_type;
*/

-- Remove legacy fields from resources table
/*
ALTER TABLE public.resources
    DROP COLUMN IF EXISTS legacy_faculty_id,
    DROP COLUMN IF EXISTS legacy_department_id,
    DROP COLUMN IF EXISTS legacy_program_id;
*/

-- ================================================
-- STEP 7: VERIFY CLEANUP
-- ================================================

DO $$
DECLARE
    deprecated_table_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_access_assignments_deprecated'
    ) INTO deprecated_table_exists;
    
    IF deprecated_table_exists THEN
        RAISE NOTICE '⚠️ Deprecated table still exists (renamed, not dropped)';
        RAISE NOTICE '   Table: user_access_assignments_deprecated';
        RAISE NOTICE '   You can drop it manually after full verification';
    ELSE
        RAISE NOTICE '✅ Old RBAC tables cleaned up';
    END IF;
END $$;

-- ================================================
-- ROLLBACK INSTRUCTIONS
-- ================================================
-- If you need to rollback:

-- 1. Restore from backup, OR
-- 2. Rename table back:
--    ALTER TABLE public.user_access_assignments_deprecated 
--        RENAME TO user_access_assignments;
-- 3. Recreate indexes and constraints (see schema.sql)

-- ================================================
-- END OF CLEANUP SCRIPT
-- ================================================
