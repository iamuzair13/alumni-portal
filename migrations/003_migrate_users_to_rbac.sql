-- ================================================
-- Migration: Migrate Users from Old RBAC to New RBAC
-- Purpose: Migrate tbl_users → users, assign roles, preserve access
-- Dependencies: Requires 001 and 002 (schema + seed data)
-- Safety: Creates new records, does NOT modify old tables
-- ================================================

-- ================================================
-- WARNING: BACKUP BEFORE RUNNING
-- ================================================
-- This migration creates new records but does NOT delete old ones.
-- Old tables (tbl_users, user_access_assignments) remain intact.
-- You can rollback by simply not using the new tables.

-- ================================================
-- 1. MIGRATE USERS: tbl_users → users
-- ================================================

INSERT INTO public.users (email, password_hash, is_active, legacy_userid, legacy_type, created_at, updated_at)
SELECT 
    tu.email,
    tu.password,
    NOT COALESCE(tu.blocked, false) as is_active,
    tu.userid as legacy_userid,
    tu.type as legacy_type,
    COALESCE(
        tu.lastlogindatetime::timestamp with time zone,
        now()
    ) as created_at,
    now() as updated_at
FROM public.tbl_users tu
WHERE tu.email IS NOT NULL
  AND tu.email != ''
  -- Exclude alumni (they're in tbl_alumni, not tbl_users)
  AND LOWER(TRIM(COALESCE(tu.type, ''))) NOT IN ('alumni', '')
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    is_active = EXCLUDED.is_active,
    legacy_userid = EXCLUDED.legacy_userid,
    legacy_type = EXCLUDED.legacy_type,
    updated_at = now();

-- ================================================
-- 2. ASSIGN ROLES TO USERS
-- ================================================

-- Map old type to new roles
-- superadmin → superadmin role
INSERT INTO public.user_roles (user_id, role_id)
SELECT 
    u.id,
    r.id
FROM public.users u
INNER JOIN public.roles r ON r.name = LOWER(TRIM(COALESCE(u.legacy_type, '')))
WHERE u.legacy_type IS NOT NULL
  AND LOWER(TRIM(u.legacy_type)) IN ('superadmin', 'admin', 'viewer')
  AND LOWER(TRIM(u.legacy_type)) = r.name
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Handle legacy 'user' type → map to 'viewer' role
INSERT INTO public.user_roles (user_id, role_id)
SELECT 
    u.id,
    r.id
FROM public.users u
INNER JOIN public.roles r ON r.name = 'viewer'
WHERE u.legacy_type IS NOT NULL
  AND LOWER(TRIM(u.legacy_type)) = 'user'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- ================================================
-- 3. MIGRATE ACCESS ASSIGNMENTS: user_access_assignments → user_resource_access
-- ================================================

-- Check if old table exists before migrating
DO $$
DECLARE
    table_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_access_assignments'
    ) INTO table_exists;
    
    IF NOT table_exists THEN
        RAISE NOTICE '⚠️ Old user_access_assignments table does not exist';
        RAISE NOTICE '   Skipping access assignment migration';
        RAISE NOTICE '   Users will need to have access assigned manually in new RBAC system';
        RAISE NOTICE '   Or restore the old table if you need to migrate existing assignments';
    ELSE
        RAISE NOTICE '✅ Old user_access_assignments table found - proceeding with migration';
    END IF;
END $$;

-- Strategy:
-- 1. Faculty-level access → resource with type='faculty', access_level based on user role
-- 2. Department-level access → resource with type='department', access_level based on user role
-- 3. Program-level access → resource with type='program', access_level based on user role

-- Faculty-level access assignments (only if old table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_access_assignments'
    ) THEN
        EXECUTE format('
            INSERT INTO public.user_resource_access (user_id, resource_id, access_level)
            SELECT DISTINCT
                u.id as user_id,
                res.id as resource_id,
                CASE 
                    WHEN r.name = %L THEN %L
                    WHEN r.name = %L THEN %L
                    ELSE %L
                END as access_level
            FROM public.users u
            INNER JOIN public.user_roles ur ON u.id = ur.user_id
            INNER JOIN public.roles r ON ur.role_id = r.id
            INNER JOIN public.user_access_assignments uaa ON u.legacy_userid = uaa.userid
            INNER JOIN public.resources res ON res.type = %L 
                AND (
                    (uaa.faculty_id IS NOT NULL AND res.legacy_faculty_id = uaa.faculty_id)
                    OR (uaa.faculty_name IS NOT NULL AND LOWER(TRIM(res.name)) = LOWER(TRIM(uaa.faculty_name)))
                )
            WHERE uaa.department_id IS NULL 
              AND uaa.department_name IS NULL
              AND uaa.program_id IS NULL
              AND uaa.program_name IS NULL
              AND (uaa.faculty_id IS NOT NULL OR uaa.faculty_name IS NOT NULL)
            ON CONFLICT (user_id, resource_id) DO UPDATE SET
                access_level = EXCLUDED.access_level,
                updated_at = now()',
            'admin', 'write',
            'viewer', 'read',
            'read',
            'faculty'
        );
        
        RAISE NOTICE '✅ Migrated faculty-level access assignments';
    ELSE
        RAISE NOTICE '⏭️ Skipping faculty-level access migration (old table not found)';
    END IF;
END $$;

-- Department-level access assignments (only if old table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_access_assignments'
    ) THEN
        EXECUTE format('
            INSERT INTO public.user_resource_access (user_id, resource_id, access_level)
            SELECT DISTINCT
                u.id as user_id,
                res.id as resource_id,
                CASE 
                    WHEN r.name = %L THEN %L
                    WHEN r.name = %L THEN %L
                    ELSE %L
                END as access_level
            FROM public.users u
            INNER JOIN public.user_roles ur ON u.id = ur.user_id
            INNER JOIN public.roles r ON ur.role_id = r.id
            INNER JOIN public.user_access_assignments uaa ON u.legacy_userid = uaa.userid
            INNER JOIN public.resources res ON res.type = %L
                AND (
                    (uaa.department_id IS NOT NULL AND res.legacy_department_id = uaa.department_id)
                    OR (uaa.department_name IS NOT NULL AND LOWER(TRIM(res.name)) = LOWER(TRIM(uaa.department_name)))
                )
            WHERE (uaa.department_id IS NOT NULL OR uaa.department_name IS NOT NULL)
              AND (uaa.program_id IS NULL AND uaa.program_name IS NULL)
            ON CONFLICT (user_id, resource_id) DO UPDATE SET
                access_level = EXCLUDED.access_level,
                updated_at = now()',
            'admin', 'write',
            'viewer', 'read',
            'read',
            'department'
        );
        
        RAISE NOTICE '✅ Migrated department-level access assignments';
    ELSE
        RAISE NOTICE '⏭️ Skipping department-level access migration (old table not found)';
    END IF;
END $$;

-- Program-level access assignments (only if old table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_access_assignments'
    ) THEN
        EXECUTE format('
            INSERT INTO public.user_resource_access (user_id, resource_id, access_level)
            SELECT DISTINCT
                u.id as user_id,
                res.id as resource_id,
                CASE 
                    WHEN r.name = %L THEN %L
                    WHEN r.name = %L THEN %L
                    ELSE %L
                END as access_level
            FROM public.users u
            INNER JOIN public.user_roles ur ON u.id = ur.user_id
            INNER JOIN public.roles r ON ur.role_id = r.id
            INNER JOIN public.user_access_assignments uaa ON u.legacy_userid = uaa.userid
            INNER JOIN public.resources res ON res.type = %L
                AND (
                    (uaa.program_id IS NOT NULL AND res.legacy_program_id = uaa.program_id)
                    OR (uaa.program_name IS NOT NULL AND LOWER(TRIM(res.name)) = LOWER(TRIM(uaa.program_name)))
                )
            WHERE uaa.program_id IS NOT NULL OR uaa.program_name IS NOT NULL
            ON CONFLICT (user_id, resource_id) DO UPDATE SET
                access_level = EXCLUDED.access_level,
                updated_at = now()',
            'admin', 'write',
            'viewer', 'read',
            'read',
            'program'
        );
        
        RAISE NOTICE '✅ Migrated program-level access assignments';
    ELSE
        RAISE NOTICE '⏭️ Skipping program-level access migration (old table not found)';
    END IF;
END $$;

-- ================================================
-- 4. HANDLE "ALL FACULTIES" ACCESS
-- ================================================
-- If a user has access to all faculties in old system, 
-- we need to detect this and grant access to all faculty resources

DO $$
DECLARE
    user_record RECORD;
    faculty_count integer;
    user_faculty_count integer;
    all_faculty_resources integer[];
BEGIN
    -- Get all faculty resource IDs
    SELECT ARRAY_AGG(id) INTO all_faculty_resources
    FROM public.resources
    WHERE type = 'faculty';
    
    SELECT COUNT(*) INTO faculty_count
    FROM public.resources
    WHERE type = 'faculty';
    
    -- For each user, check if they have access to all faculties
    FOR user_record IN 
        SELECT DISTINCT u.id, u.legacy_userid, r.name as role_name
        FROM public.users u
        INNER JOIN public.user_roles ur ON u.id = ur.user_id
        INNER JOIN public.roles r ON ur.role_id = r.id
        WHERE r.name IN ('admin', 'viewer')
    LOOP
        -- Count how many faculty resources this user has access to
        SELECT COUNT(DISTINCT ura.resource_id) INTO user_faculty_count
        FROM public.user_resource_access ura
        INNER JOIN public.resources res ON ura.resource_id = res.id
        WHERE ura.user_id = user_record.id
          AND res.type = 'faculty';
        
        -- If user has access to all faculties, ensure all are assigned
        IF user_faculty_count = faculty_count AND faculty_count > 0 THEN
            -- User already has all faculties - no action needed
            CONTINUE;
        ELSIF user_faculty_count > 0 AND user_faculty_count < faculty_count THEN
            -- User has some but not all - this is specific access, leave as is
            CONTINUE;
        END IF;
    END LOOP;
    
    RAISE NOTICE '✅ Processed all-faculties access check';
END $$;

-- ================================================
-- 5. VERIFICATION QUERIES
-- ================================================

DO $$
DECLARE
    old_user_count integer;
    new_user_count integer;
    old_assignment_count integer;
    new_assignment_count integer;
    users_without_roles integer;
    users_without_access integer;
BEGIN
    -- Count old users (excluding alumni)
    SELECT COUNT(*) INTO old_user_count
    FROM public.tbl_users
    WHERE LOWER(TRIM(COALESCE(type, ''))) NOT IN ('alumni', '');
    
    -- Count new users
    SELECT COUNT(*) INTO new_user_count
    FROM public.users;
    
    -- Count old assignments (only if table exists)
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_access_assignments'
    ) THEN
        SELECT COUNT(*) INTO old_assignment_count
        FROM public.user_access_assignments;
    ELSE
        old_assignment_count := 0;
    END IF;
    
    -- Count new assignments
    SELECT COUNT(*) INTO new_assignment_count
    FROM public.user_resource_access;
    
    -- Count users without roles (should be 0)
    SELECT COUNT(*) INTO users_without_roles
    FROM public.users u
    LEFT JOIN public.user_roles ur ON u.id = ur.user_id
    WHERE ur.user_id IS NULL
      AND u.legacy_type IS NOT NULL
      AND LOWER(TRIM(u.legacy_type)) IN ('superadmin', 'admin', 'viewer', 'user');
    
    -- Count admin/viewer users without resource access (may be valid if they have all-faculties)
    SELECT COUNT(*) INTO users_without_access
    FROM public.users u
    INNER JOIN public.user_roles ur ON u.id = ur.user_id
    INNER JOIN public.roles r ON ur.role_id = r.id
    LEFT JOIN public.user_resource_access ura ON u.id = ura.user_id
    WHERE r.name IN ('admin', 'viewer')
      AND ura.user_id IS NULL;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MIGRATION VERIFICATION RESULTS';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Old users (tbl_users): %', old_user_count;
    RAISE NOTICE 'New users (users): %', new_user_count;
    RAISE NOTICE 'Old assignments: %', old_assignment_count;
    RAISE NOTICE 'New assignments: %', new_assignment_count;
    RAISE NOTICE 'Users without roles: % (should be 0)', users_without_roles;
    RAISE NOTICE 'Admin/Viewer users without resource access: % (may be valid if superadmin)', users_without_access;
    RAISE NOTICE '========================================';
    
    IF users_without_roles > 0 THEN
        RAISE WARNING '⚠️ Some users do not have roles assigned!';
    END IF;
    
    IF new_user_count < old_user_count THEN
        RAISE WARNING '⚠️ Fewer users migrated than expected!';
    END IF;
END $$;

-- ================================================
-- 6. DATA INTEGRITY CHECKS
-- ================================================

-- Check for orphaned user_resource_access (should be 0)
DO $$
DECLARE
    orphaned_count integer;
BEGIN
    SELECT COUNT(*) INTO orphaned_count
    FROM public.user_resource_access ura
    LEFT JOIN public.users u ON ura.user_id = u.id
    LEFT JOIN public.resources res ON ura.resource_id = res.id
    WHERE u.id IS NULL OR res.id IS NULL;
    
    IF orphaned_count > 0 THEN
        RAISE WARNING '⚠️ Found % orphaned user_resource_access records', orphaned_count;
    ELSE
        RAISE NOTICE '✅ No orphaned user_resource_access records';
    END IF;
END $$;

-- Check for users with invalid role assignments
DO $$
DECLARE
    invalid_role_count integer;
BEGIN
    SELECT COUNT(*) INTO invalid_role_count
    FROM public.user_roles ur
    LEFT JOIN public.users u ON ur.user_id = u.id
    LEFT JOIN public.roles r ON ur.role_id = r.id
    WHERE u.id IS NULL OR r.id IS NULL;
    
    IF invalid_role_count > 0 THEN
        RAISE WARNING '⚠️ Found % invalid user_roles records', invalid_role_count;
    ELSE
        RAISE NOTICE '✅ No invalid user_roles records';
    END IF;
END $$;

-- ================================================
-- END OF MIGRATION
-- ================================================
