-- ================================================
-- Quick Diagnostic: Check User 27 in New RBAC
-- Purpose: Find out why user 27 has no assignments
-- ================================================

-- Step 1: Find user by email (works for both local and production)
-- ⚠️ REPLACE 'testuser@gmai.com' with the actual email you want to check
SELECT 
    'STEP 1: User in new users table?' as step,
    u.id,
    u.email,
    u.legacy_userid,
    u.legacy_type,
    u.is_active
FROM public.users u
WHERE u.email = 'testuser@gmai.com'  -- ⚠️ REPLACE WITH ACTUAL EMAIL
   OR u.legacy_userid = 27 
   OR u.id = 27;

-- Step 2: Does user have roles assigned?
-- ⚠️ REPLACE 'testuser@gmai.com' with the actual email
SELECT 
    'STEP 2: User roles?' as step,
    u.id as user_id,
    u.email,
    r.name as role_name,
    r.id as role_id
FROM public.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
LEFT JOIN public.roles r ON ur.role_id = r.id
WHERE u.email = 'testuser@gmai.com'  -- ⚠️ REPLACE WITH ACTUAL EMAIL
   OR u.legacy_userid = 27 
   OR u.id = 27;

-- Step 3: Does user have any resource access?
-- ⚠️ REPLACE 'testuser@gmai.com' with the actual email
SELECT 
    'STEP 3: Resource access?' as step,
    u.id as user_id,
    u.email,
    COUNT(DISTINCT ura.resource_id) as resource_count,
    STRING_AGG(DISTINCT res.type, ', ') as resource_types
FROM public.users u
LEFT JOIN public.user_resource_access ura ON u.id = ura.user_id
LEFT JOIN public.resources res ON ura.resource_id = res.id
WHERE u.email = 'testuser@gmai.com'  -- ⚠️ REPLACE WITH ACTUAL EMAIL
   OR u.legacy_userid = 27 
   OR u.id = 27
GROUP BY u.id, u.email;

-- Step 4: List all resources available (faculties)
SELECT 
    'STEP 4: Available faculty resources' as step,
    id,
    name,
    type,
    legacy_faculty_id
FROM public.resources
WHERE type = 'faculty'
ORDER BY name
LIMIT 10;

-- Step 5: Check if migration script created the user
SELECT 
    'STEP 5: All users in new system' as step,
    u.id,
    u.email,
    u.legacy_userid,
    u.legacy_type,
    STRING_AGG(r.name, ', ') as roles,
    COUNT(DISTINCT ura.resource_id) as access_count
FROM public.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
LEFT JOIN public.roles r ON ur.role_id = r.id
LEFT JOIN public.user_resource_access ura ON u.id = ura.user_id
GROUP BY u.id, u.email, u.legacy_userid, u.legacy_type
ORDER BY u.email;
