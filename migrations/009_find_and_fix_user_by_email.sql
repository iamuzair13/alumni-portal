-- ================================================
-- Find and Fix User Access by Email
-- Purpose: Works for both local and production (uses email, not hardcoded ID)
-- ================================================

-- ================================================
-- STEP 1: Find User by Email
-- ================================================
-- Replace 'testuser@gmai.com' with the actual email you want to check

SELECT 
    '=== FINDING USER ===' as step,
    tu.userid as old_userid,
    tu.email as old_email,
    tu.type as old_type,
    u.id as new_user_id,
    u.email as new_email,
    u.legacy_userid,
    u.legacy_type,
    u.is_active
FROM public.tbl_users tu
LEFT JOIN public.users u ON tu.userid = u.legacy_userid
WHERE tu.email = 'testuser@gmai.com'  -- ⚠️ REPLACE WITH ACTUAL EMAIL
   OR u.email = 'testuser@gmai.com';  -- ⚠️ REPLACE WITH ACTUAL EMAIL

-- ================================================
-- STEP 2: Check User's Current Status in New RBAC
-- ================================================

SELECT 
    '=== USER STATUS IN NEW RBAC ===' as step,
    u.id as user_id,
    u.email,
    u.legacy_userid,
    STRING_AGG(DISTINCT r.name, ', ') as roles,
    COUNT(DISTINCT ura.resource_id) as resource_access_count,
    COUNT(DISTINCT CASE WHEN res.type = 'faculty' THEN res.id END) as faculty_count
FROM public.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
LEFT JOIN public.roles r ON ur.role_id = r.id
LEFT JOIN public.user_resource_access ura ON u.id = ura.user_id
LEFT JOIN public.resources res ON ura.resource_id = res.id
WHERE u.email = 'testuser@gmai.com'  -- ⚠️ REPLACE WITH ACTUAL EMAIL
GROUP BY u.id, u.email, u.legacy_userid;

-- ================================================
-- STEP 3: Grant Access to User by Email
-- ================================================
-- This will grant all faculties access to the user
-- Uncomment and run after replacing the email

/*
DO $$
DECLARE
    target_email text := 'testuser@gmai.com';  -- ⚠️ REPLACE WITH ACTUAL EMAIL
    target_user_id bigint;
    user_role_name text;
    faculty_resource RECORD;
    access_level text;
    assigned_count integer := 0;
    faculty_count integer;
BEGIN
    -- Find user by email
    SELECT id INTO target_user_id
    FROM public.users
    WHERE email = target_email;
    
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found with email: %', target_email;
    END IF;
    
    -- Get user's role
    SELECT r.name INTO user_role_name
    FROM public.user_roles ur
    INNER JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = target_user_id
    LIMIT 1;
    
    IF user_role_name IS NULL THEN
        RAISE EXCEPTION 'User % has no role assigned. Please assign a role first.', target_email;
    END IF;
    
    -- Determine access level
    access_level := CASE 
        WHEN user_role_name = 'admin' THEN 'write'
        WHEN user_role_name = 'viewer' THEN 'read'
        ELSE 'read'
    END;
    
    -- Count faculties
    SELECT COUNT(*) INTO faculty_count
    FROM public.resources
    WHERE type = 'faculty';
    
    RAISE NOTICE 'Found user: % (ID: %), Role: %, Access Level: %', 
        target_email, target_user_id, user_role_name, access_level;
    RAISE NOTICE 'Total faculty resources: %', faculty_count;
    
    -- Grant access to all faculty resources
    FOR faculty_resource IN 
        SELECT id, name FROM public.resources WHERE type = 'faculty'
    LOOP
        INSERT INTO public.user_resource_access (user_id, resource_id, access_level)
        VALUES (target_user_id, faculty_resource.id, access_level)
        ON CONFLICT (user_id, resource_id) DO UPDATE SET
            access_level = EXCLUDED.access_level,
            updated_at = now();
        
        assigned_count := assigned_count + 1;
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Successfully granted % access to % faculties for user: %', 
        access_level, assigned_count, target_email;
    RAISE NOTICE '========================================';
END $$;
*/

-- ================================================
-- STEP 4: Verify Access After Granting
-- ================================================

SELECT 
    '=== VERIFICATION ===' as step,
    u.email,
    res.type as resource_type,
    res.name as resource_name,
    ura.access_level
FROM public.users u
INNER JOIN public.user_resource_access ura ON u.id = ura.user_id
INNER JOIN public.resources res ON ura.resource_id = res.id
WHERE u.email = 'testuser@gmai.com'  -- ⚠️ REPLACE WITH ACTUAL EMAIL
ORDER BY res.type, res.name;
