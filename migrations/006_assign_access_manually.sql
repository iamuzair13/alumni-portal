-- ================================================
-- Helper Script: Manually Assign Access in New RBAC
-- Purpose: Assign resource access to users in new RBAC system
-- Use Case: When old table doesn't exist or you need to assign access manually
-- ================================================

-- ================================================
-- STEP 1: Check Current State
-- ================================================

-- List all users in new RBAC system
SELECT 
    u.id,
    u.email,
    u.legacy_userid,
    u.legacy_type,
    STRING_AGG(r.name, ', ') as roles
FROM public.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
LEFT JOIN public.roles r ON ur.role_id = r.id
GROUP BY u.id, u.email, u.legacy_userid, u.legacy_type
ORDER BY u.email;

-- List all resources available
SELECT 
    type,
    COUNT(*) as count
FROM public.resources
GROUP BY type
ORDER BY type;

-- List users with their current access
SELECT 
    u.email,
    r.name as role_name,
    COUNT(DISTINCT ura.resource_id) as resource_count
FROM public.users u
INNER JOIN public.user_roles ur ON u.id = ur.user_id
INNER JOIN public.roles r ON ur.role_id = r.id
LEFT JOIN public.user_resource_access ura ON u.id = ura.user_id
WHERE r.name IN ('admin', 'viewer')
GROUP BY u.email, r.name
ORDER BY u.email;

-- ================================================
-- STEP 2: Assign Access to Specific User
-- ================================================
-- Replace USER_EMAIL and adjust resource selection as needed

-- Example: Grant access to ALL faculties for a user
-- Replace 'testuser@gmai.com' with actual email
/*
DO $$
DECLARE
    target_user_id bigint;
    faculty_resource RECORD;
    access_level text;
    user_role_name text;
BEGIN
    -- Get user ID
    SELECT id INTO target_user_id
    FROM public.users
    WHERE email = 'testuser@gmai.com';
    
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found: testuser@gmai.com';
    END IF;
    
    -- Get user's role to determine access level
    SELECT r.name INTO user_role_name
    FROM public.user_roles ur
    INNER JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = target_user_id
    LIMIT 1;
    
    -- Set access level based on role
    access_level := CASE 
        WHEN user_role_name = 'admin' THEN 'write'
        WHEN user_role_name = 'viewer' THEN 'read'
        ELSE 'read'
    END;
    
    -- Grant access to all faculty resources
    FOR faculty_resource IN 
        SELECT id FROM public.resources WHERE type = 'faculty'
    LOOP
        INSERT INTO public.user_resource_access (user_id, resource_id, access_level)
        VALUES (target_user_id, faculty_resource.id, access_level)
        ON CONFLICT (user_id, resource_id) DO UPDATE SET
            access_level = EXCLUDED.access_level,
            updated_at = now();
    END LOOP;
    
    RAISE NOTICE '✅ Granted % access to all faculties for user %', access_level, 'testuser@gmai.com';
END $$;
*/

-- ================================================
-- STEP 3: Assign Access to Specific Faculty
-- ================================================
-- Replace USER_EMAIL and FACULTY_NAME

/*
DO $$
DECLARE
    target_user_id bigint;
    faculty_resource_id bigint;
    access_level text;
    user_role_name text;
BEGIN
    -- Get user ID
    SELECT id INTO target_user_id
    FROM public.users
    WHERE email = 'testuser@gmai.com';
    
    -- Get faculty resource ID
    SELECT id INTO faculty_resource_id
    FROM public.resources
    WHERE type = 'faculty' 
      AND LOWER(TRIM(name)) = LOWER(TRIM('Faculty of Information Technology'));
    
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    IF faculty_resource_id IS NULL THEN
        RAISE EXCEPTION 'Faculty resource not found';
    END IF;
    
    -- Get user's role
    SELECT r.name INTO user_role_name
    FROM public.user_roles ur
    INNER JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = target_user_id
    LIMIT 1;
    
    access_level := CASE 
        WHEN user_role_name = 'admin' THEN 'write'
        WHEN user_role_name = 'viewer' THEN 'read'
        ELSE 'read'
    END;
    
    INSERT INTO public.user_resource_access (user_id, resource_id, access_level)
    VALUES (target_user_id, faculty_resource_id, access_level)
    ON CONFLICT (user_id, resource_id) DO UPDATE SET
        access_level = EXCLUDED.access_level,
        updated_at = now();
    
    RAISE NOTICE '✅ Granted % access to faculty for user', access_level;
END $$;
*/

-- ================================================
-- STEP 4: Assign Access to All Admin/Viewer Users
-- ================================================
-- This grants all faculties access to all admin/viewer users
-- Use with caution - only if you want full access for all

/*
DO $$
DECLARE
    user_record RECORD;
    faculty_resource RECORD;
    access_level text;
BEGIN
    -- For each admin/viewer user
    FOR user_record IN 
        SELECT DISTINCT u.id, u.email, r.name as role_name
        FROM public.users u
        INNER JOIN public.user_roles ur ON u.id = ur.user_id
        INNER JOIN public.roles r ON ur.role_id = r.id
        WHERE r.name IN ('admin', 'viewer')
    LOOP
        -- Determine access level
        access_level := CASE 
            WHEN user_record.role_name = 'admin' THEN 'write'
            WHEN user_record.role_name = 'viewer' THEN 'read'
            ELSE 'read'
        END;
        
        -- Grant access to all faculties
        FOR faculty_resource IN 
            SELECT id FROM public.resources WHERE type = 'faculty'
        LOOP
            INSERT INTO public.user_resource_access (user_id, resource_id, access_level)
            VALUES (user_record.id, faculty_resource.id, access_level)
            ON CONFLICT (user_id, resource_id) DO UPDATE SET
                access_level = EXCLUDED.access_level,
                updated_at = now();
        END LOOP;
        
        RAISE NOTICE '✅ Granted % access to all faculties for user %', access_level, user_record.email;
    END LOOP;
END $$;
*/

-- ================================================
-- STEP 5: Verify Assignments
-- ================================================

-- Check user's access after assignment
SELECT 
    u.email,
    res.type as resource_type,
    res.name as resource_name,
    ura.access_level
FROM public.users u
INNER JOIN public.user_resource_access ura ON u.id = ura.user_id
INNER JOIN public.resources res ON ura.resource_id = res.id
WHERE u.email = 'testuser@gmai.com'  -- Replace with actual email
ORDER BY res.type, res.name;

-- Count assignments per user
SELECT 
    u.email,
    COUNT(DISTINCT ura.resource_id) as resource_count,
    COUNT(DISTINCT CASE WHEN res.type = 'faculty' THEN res.id END) as faculty_count,
    COUNT(DISTINCT CASE WHEN res.type = 'department' THEN res.id END) as department_count,
    COUNT(DISTINCT CASE WHEN res.type = 'program' THEN res.id END) as program_count
FROM public.users u
LEFT JOIN public.user_resource_access ura ON u.id = ura.user_id
LEFT JOIN public.resources res ON ura.resource_id = res.id
GROUP BY u.email
ORDER BY u.email;

-- ================================================
-- QUICK FIX: Grant All Faculties to All Admin/Viewer Users
-- ================================================
-- This grants access to all faculties for all admin/viewer users
-- Run this to quickly restore access after migration
-- Works for both local and production (no hardcoded IDs)

DO $$
DECLARE
    user_record RECORD;
    faculty_resource RECORD;
    access_level text;
    faculty_count integer;
    assigned_count integer;
    total_users integer := 0;
BEGIN
    -- Count total faculties
    SELECT COUNT(*) INTO faculty_count
    FROM public.resources
    WHERE type = 'faculty';
    
    RAISE NOTICE 'Found % faculty resources', faculty_count;
    
    -- For each admin/viewer user
    FOR user_record IN 
        SELECT DISTINCT u.id, u.email, u.legacy_userid, r.name as role_name
        FROM public.users u
        INNER JOIN public.user_roles ur ON u.id = ur.user_id
        INNER JOIN public.roles r ON ur.role_id = r.id
        WHERE r.name IN ('admin', 'viewer')
        ORDER BY u.email
    LOOP
        total_users := total_users + 1;
        
        -- Determine access level based on role
        access_level := CASE 
            WHEN user_record.role_name = 'admin' THEN 'write'
            WHEN user_record.role_name = 'viewer' THEN 'read'
            ELSE 'read'
        END;
        
        assigned_count := 0;
        
        -- Grant access to all faculty resources
        FOR faculty_resource IN 
            SELECT id FROM public.resources WHERE type = 'faculty'
        LOOP
            INSERT INTO public.user_resource_access (user_id, resource_id, access_level)
            VALUES (user_record.id, faculty_resource.id, access_level)
            ON CONFLICT (user_id, resource_id) DO UPDATE SET
                access_level = EXCLUDED.access_level,
                updated_at = now();
            
            assigned_count := assigned_count + 1;
        END LOOP;
        
        RAISE NOTICE '✅ [%/%] Granted % access to % faculties for: % (New ID: %, Old ID: %)', 
            total_users, 
            (SELECT COUNT(DISTINCT u2.id) FROM public.users u2 
             INNER JOIN public.user_roles ur2 ON u2.id = ur2.user_id 
             INNER JOIN public.roles r2 ON ur2.role_id = r2.id 
             WHERE r2.name IN ('admin', 'viewer')),
            access_level, 
            assigned_count, 
            user_record.email, 
            user_record.id,
            COALESCE(user_record.legacy_userid::text, 'N/A');
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Access assignment complete for % users!', total_users;
    RAISE NOTICE '========================================';
END $$;

-- ================================================
-- VERIFICATION: Check All User Access
-- ================================================

-- Verify assignments for all admin/viewer users
SELECT 
    u.id,
    u.email,
    r.name as role_name,
    COUNT(DISTINCT CASE WHEN res.type = 'faculty' THEN res.id END) as faculty_count,
    COUNT(DISTINCT CASE WHEN res.type = 'department' THEN res.id END) as department_count,
    COUNT(DISTINCT CASE WHEN res.type = 'program' THEN res.id END) as program_count,
    COUNT(DISTINCT ura.resource_id) as total_resources
FROM public.users u
INNER JOIN public.user_roles ur ON u.id = ur.user_id
INNER JOIN public.roles r ON ur.role_id = r.id
LEFT JOIN public.user_resource_access ura ON u.id = ura.user_id
LEFT JOIN public.resources res ON ura.resource_id = res.id
WHERE r.name IN ('admin', 'viewer')
GROUP BY u.id, u.email, r.name
ORDER BY u.email;

-- Check specific user (replace email)
SELECT 
    u.id,
    u.email,
    res.type as resource_type,
    res.name as resource_name,
    ura.access_level
FROM public.users u
INNER JOIN public.user_resource_access ura ON u.id = ura.user_id
INNER JOIN public.resources res ON ura.resource_id = res.id
WHERE u.email = 'testuser@gmai.com'  -- Replace with actual email
ORDER BY res.type, res.name;
