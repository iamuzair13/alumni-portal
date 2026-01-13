-- ================================================
-- Validation Queries for RBAC Migration
-- Purpose: Verify migration correctness and data integrity
-- Usage: Run these queries after migration to verify
-- ================================================

-- ================================================
-- 1. USER MIGRATION VERIFICATION
-- ================================================

-- Check all users were migrated
SELECT 
    'Users Migration Check' as check_name,
    (SELECT COUNT(*) FROM public.tbl_users WHERE LOWER(TRIM(COALESCE(type, ''))) NOT IN ('alumni', '')) as old_user_count,
    (SELECT COUNT(*) FROM public.users) as new_user_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM public.users) >= (SELECT COUNT(*) FROM public.tbl_users WHERE LOWER(TRIM(COALESCE(type, ''))) NOT IN ('alumni', ''))
        THEN '✅ PASS'
        ELSE '❌ FAIL - Missing users'
    END as status;

-- Check users have roles assigned
SELECT 
    'Users with Roles' as check_name,
    COUNT(DISTINCT u.id) as users_with_roles,
    (SELECT COUNT(*) FROM public.users) as total_users,
    CASE 
        WHEN COUNT(DISTINCT u.id) = (SELECT COUNT(*) FROM public.users)
        THEN '✅ PASS'
        ELSE '❌ FAIL - Some users missing roles'
    END as status
FROM public.users u
INNER JOIN public.user_roles ur ON u.id = ur.user_id;

-- Check role distribution
SELECT 
    r.name as role_name,
    COUNT(DISTINCT ur.user_id) as user_count
FROM public.roles r
LEFT JOIN public.user_roles ur ON r.id = ur.role_id
GROUP BY r.id, r.name
ORDER BY user_count DESC;

-- ================================================
-- 2. ACCESS ASSIGNMENT VERIFICATION
-- ================================================

-- Compare old vs new access assignments
SELECT 
    'Access Assignments Comparison' as check_name,
    (SELECT COUNT(*) FROM public.user_access_assignments) as old_assignment_count,
    (SELECT COUNT(*) FROM public.user_resource_access) as new_assignment_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM public.user_resource_access) >= (SELECT COUNT(*) FROM public.user_access_assignments) * 0.8
        THEN '✅ PASS (80%+ migrated)'
        ELSE '⚠️ WARNING - Significant difference'
    END as status;

-- Check access by resource type
SELECT 
    res.type as resource_type,
    COUNT(DISTINCT ura.user_id) as users_with_access,
    COUNT(ura.id) as total_access_records
FROM public.user_resource_access ura
INNER JOIN public.resources res ON ura.resource_id = res.id
GROUP BY res.type
ORDER BY res.type;

-- Check access levels distribution
SELECT 
    access_level,
    COUNT(*) as count
FROM public.user_resource_access
GROUP BY access_level
ORDER BY access_level;

-- ================================================
-- 3. RESOURCE MIGRATION VERIFICATION
-- ================================================

-- Check all faculties migrated to resources
SELECT 
    'Faculty Resources' as check_name,
    (SELECT COUNT(*) FROM public.tbl_faculties) as old_faculty_count,
    (SELECT COUNT(*) FROM public.resources WHERE type = 'faculty') as new_faculty_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM public.resources WHERE type = 'faculty') = (SELECT COUNT(*) FROM public.tbl_faculties)
        THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as status;

-- Check all departments migrated
SELECT 
    'Department Resources' as check_name,
    (SELECT COUNT(*) FROM public.tbl_departments) as old_dept_count,
    (SELECT COUNT(*) FROM public.resources WHERE type = 'department') as new_dept_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM public.resources WHERE type = 'department') = (SELECT COUNT(*) FROM public.tbl_departments)
        THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as status;

-- Check all programs migrated
SELECT 
    'Program Resources' as check_name,
    (SELECT COUNT(*) FROM public.tbl_programs) as old_prog_count,
    (SELECT COUNT(*) FROM public.resources WHERE type = 'program') as new_prog_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM public.resources WHERE type = 'program') = (SELECT COUNT(*) FROM public.tbl_programs)
        THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as status;

-- ================================================
-- 4. DATA INTEGRITY CHECKS
-- ================================================

-- Check for orphaned user_resource_access
SELECT 
    'Orphaned Access Records' as check_name,
    COUNT(*) as orphaned_count,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ PASS'
        ELSE '❌ FAIL - Found orphaned records'
    END as status
FROM public.user_resource_access ura
LEFT JOIN public.users u ON ura.user_id = u.id
LEFT JOIN public.resources res ON ura.resource_id = res.id
WHERE u.id IS NULL OR res.id IS NULL;

-- Check for orphaned user_roles
SELECT 
    'Orphaned Role Assignments' as check_name,
    COUNT(*) as orphaned_count,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ PASS'
        ELSE '❌ FAIL - Found orphaned records'
    END as status
FROM public.user_roles ur
LEFT JOIN public.users u ON ur.user_id = u.id
LEFT JOIN public.roles r ON ur.role_id = r.id
WHERE u.id IS NULL OR r.id IS NULL;

-- Check for users without roles (admin/viewer should have roles)
SELECT 
    'Users Without Roles' as check_name,
    COUNT(*) as users_without_roles,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ PASS'
        ELSE '⚠️ WARNING - Some users missing roles'
    END as status
FROM public.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
WHERE ur.user_id IS NULL
  AND u.legacy_type IS NOT NULL
  AND LOWER(TRIM(u.legacy_type)) IN ('superadmin', 'admin', 'viewer', 'user');

-- ================================================
-- 5. PERMISSION VERIFICATION
-- ================================================

-- Check role permissions are assigned
SELECT 
    r.name as role_name,
    COUNT(DISTINCT rp.permission_id) as permission_count
FROM public.roles r
LEFT JOIN public.role_permissions rp ON r.id = rp.role_id
GROUP BY r.id, r.name
ORDER BY r.name;

-- Check superadmin has all permissions
SELECT 
    'Superadmin Permissions' as check_name,
    (SELECT COUNT(*) FROM public.permissions) as total_permissions,
    (SELECT COUNT(*) FROM public.role_permissions rp
     INNER JOIN public.roles r ON rp.role_id = r.id
     WHERE r.name = 'superadmin') as superadmin_permissions,
    CASE 
        WHEN (SELECT COUNT(*) FROM public.role_permissions rp
              INNER JOIN public.roles r ON rp.role_id = r.id
              WHERE r.name = 'superadmin') = (SELECT COUNT(*) FROM public.permissions)
        THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as status;

-- ================================================
-- 6. ACCESS PATTERN VERIFICATION
-- ================================================

-- Check users with faculty-level access
SELECT 
    u.email,
    r.name as role_name,
    COUNT(DISTINCT res.id) FILTER (WHERE res.type = 'faculty') as faculty_count,
    COUNT(DISTINCT res.id) FILTER (WHERE res.type = 'department') as department_count,
    COUNT(DISTINCT res.id) FILTER (WHERE res.type = 'program') as program_count
FROM public.users u
INNER JOIN public.user_roles ur ON u.id = ur.user_id
INNER JOIN public.roles r ON ur.role_id = r.id
LEFT JOIN public.user_resource_access ura ON u.id = ura.user_id
LEFT JOIN public.resources res ON ura.resource_id = res.id
WHERE r.name IN ('admin', 'viewer')
GROUP BY u.id, u.email, r.name
ORDER BY u.email;

-- ================================================
-- 7. COMPARISON QUERIES (Old vs New)
-- ================================================

-- Compare specific user's old vs new access
-- Replace USER_EMAIL with actual email to test
/*
SELECT 
    'Old Access' as source,
    uaa.faculty_name,
    uaa.department_name,
    uaa.program_name
FROM public.tbl_users tu
INNER JOIN public.user_access_assignments uaa ON tu.userid = uaa.userid
WHERE tu.email = 'USER_EMAIL@example.com'
UNION ALL
SELECT 
    'New Access' as source,
    res_f.name as faculty_name,
    res_d.name as department_name,
    res_p.name as program_name
FROM public.users u
INNER JOIN public.user_resource_access ura ON u.id = ura.user_id
INNER JOIN public.resources res ON ura.resource_id = res.id
LEFT JOIN public.resources res_f ON res.type = 'faculty' AND res.id = res_f.id
LEFT JOIN public.resources res_d ON res.type = 'department' AND res.id = res_d.id
LEFT JOIN public.resources res_p ON res.type = 'program' AND res.id = res_p.id
WHERE u.email = 'USER_EMAIL@example.com';
*/

-- ================================================
-- 8. SUMMARY REPORT
-- ================================================

SELECT 
    '=== RBAC MIGRATION SUMMARY ===' as report_section,
    '' as details
UNION ALL
SELECT 
    'Total Users Migrated',
    COUNT(*)::text
FROM public.users
UNION ALL
SELECT 
    'Total Roles',
    COUNT(*)::text
FROM public.roles
UNION ALL
SELECT 
    'Total Permissions',
    COUNT(*)::text
FROM public.permissions
UNION ALL
SELECT 
    'Total Resources',
    COUNT(*)::text
FROM public.resources
UNION ALL
SELECT 
    'Total Resource Access Records',
    COUNT(*)::text
FROM public.user_resource_access
UNION ALL
SELECT 
    'Users with Roles',
    COUNT(DISTINCT user_id)::text
FROM public.user_roles
UNION ALL
SELECT 
    'Roles with Permissions',
    COUNT(DISTINCT role_id)::text
FROM public.role_permissions;

-- ================================================
-- END OF VALIDATION QUERIES
-- ================================================
