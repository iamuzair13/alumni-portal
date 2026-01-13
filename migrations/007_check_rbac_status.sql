-- ================================================
-- Diagnostic Script: Check RBAC Migration Status
-- Purpose: Verify users, roles, and access assignments
-- ================================================

-- ================================================
-- 1. CHECK USERS IN NEW RBAC SYSTEM
-- ================================================

SELECT 
    '=== USERS IN NEW RBAC SYSTEM ===' as section;

SELECT 
    u.id as new_user_id,
    u.email,
    u.legacy_userid as old_userid,
    u.legacy_type as old_type,
    u.is_active,
    STRING_AGG(r.name, ', ' ORDER BY r.name) as roles
FROM public.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
LEFT JOIN public.roles r ON ur.role_id = r.id
GROUP BY u.id, u.email, u.legacy_userid, u.legacy_type, u.is_active
ORDER BY u.email;

-- ================================================
-- 2. CHECK RESOURCES AVAILABLE
-- ================================================

SELECT 
    '=== RESOURCES AVAILABLE ===' as section;

SELECT 
    type,
    COUNT(*) as count,
    -- Simple sample of names (may be long if many resources of one type)
    STRING_AGG(name, ', ' ORDER BY name) as sample_names
FROM public.resources
GROUP BY type
ORDER BY type;

-- Show all faculties
SELECT 
    '=== ALL FACULTIES ===' as section;

SELECT 
    id,
    name,
    legacy_faculty_id,
    parent_id
FROM public.resources
WHERE type = 'faculty'
ORDER BY name;

-- ================================================
-- 3. CHECK USER ACCESS ASSIGNMENTS
-- ================================================

SELECT 
    '=== USER ACCESS ASSIGNMENTS ===' as section;

SELECT 
    u.id as user_id,
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

-- ================================================
-- 4. CHECK SPECIFIC USER (Replace email)
-- ================================================

SELECT 
    '=== DETAILED ACCESS FOR USER ===' as section;

-- Replace 'testuser@gmai.com' with actual email
SELECT 
    u.id,
    u.email,
    u.legacy_userid,
    res.type as resource_type,
    res.name as resource_name,
    res.legacy_faculty_id,
    res.legacy_department_id,
    res.legacy_program_id,
    ura.access_level
FROM public.users u
LEFT JOIN public.user_resource_access ura ON u.id = ura.user_id
LEFT JOIN public.resources res ON ura.resource_id = res.id
WHERE u.email = 'testuser@gmai.com'  -- Replace with actual email
ORDER BY res.type, res.name;

-- ================================================
-- 5. CHECK USER ID MAPPING
-- ================================================

SELECT 
    '=== USER ID MAPPING (OLD → NEW) ===' as section;

SELECT 
    tu.userid as old_userid,
    tu.email as old_email,
    tu.type as old_type,
    u.id as new_user_id,
    u.email as new_email,
    u.legacy_userid,
    STRING_AGG(r.name, ', ') as new_roles
FROM public.tbl_users tu
LEFT JOIN public.users u ON tu.userid = u.legacy_userid
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
LEFT JOIN public.roles r ON ur.role_id = r.id
WHERE LOWER(TRIM(COALESCE(tu.type, ''))) NOT IN ('alumni', '')
GROUP BY tu.userid, tu.email, tu.type, u.id, u.email, u.legacy_userid
ORDER BY tu.email;

-- ================================================
-- 6. QUICK FIX: Check if user 27 exists and has access
-- ================================================

SELECT 
    '=== CHECKING USER ID 27 ===' as section;

-- Check in old system
-- Note: Old table public.user_access_assignments may not exist anymore.
-- To avoid errors if it has been dropped, we only show the user row here.
SELECT 
    'OLD SYSTEM (NO ASSIGNMENTS TABLE)' as system,
    tu.userid,
    tu.email,
    tu.type,
    NULL::integer as assignment_count
FROM public.tbl_users tu
WHERE tu.userid = 27;

-- Check in new system
SELECT 
    'NEW SYSTEM' as system,
    u.id,
    u.email,
    u.legacy_userid,
    STRING_AGG(r.name, ', ') as roles,
    COUNT(DISTINCT ura.resource_id) as resource_count
FROM public.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
LEFT JOIN public.roles r ON ur.role_id = r.id
LEFT JOIN public.user_resource_access ura ON u.id = ura.user_id
WHERE u.legacy_userid = 27 OR u.id = 27
GROUP BY u.id, u.email, u.legacy_userid;
