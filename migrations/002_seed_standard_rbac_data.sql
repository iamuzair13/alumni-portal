-- ================================================
-- Migration: Seed Standard RBAC Data
-- Purpose: Create initial roles, permissions, and seed data
-- Dependencies: Requires 001_create_standard_rbac_schema.sql
-- Safety: Idempotent (uses INSERT ... ON CONFLICT)
-- ================================================

-- ================================================
-- 1. CREATE STANDARD ROLES
-- ================================================

INSERT INTO public.roles (name, description) VALUES
    ('superadmin', 'Super Administrator - Full system access including user management')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO public.roles (name, description) VALUES
    ('admin', 'Administrator - Full data access but cannot manage users')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO public.roles (name, description) VALUES
    ('viewer', 'Viewer - Read-only access to assigned resources')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO public.roles (name, description) VALUES
    ('alumni', 'Alumni - Self-service access to own profile')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

-- ================================================
-- 2. CREATE STANDARD PERMISSIONS
-- ================================================

-- Alumni permissions
INSERT INTO public.permissions (action, resource, description) VALUES
    ('read', 'alumni', 'View alumni records'),
    ('write', 'alumni', 'Create and update alumni records'),
    ('delete', 'alumni', 'Delete alumni records'),
    ('export', 'alumni', 'Export alumni data')
ON CONFLICT (action, resource) DO UPDATE SET description = EXCLUDED.description;

-- User management permissions
INSERT INTO public.permissions (action, resource, description) VALUES
    ('read', 'users', 'View user accounts'),
    ('write', 'users', 'Create and update user accounts'),
    ('delete', 'users', 'Delete user accounts'),
    ('manage_roles', 'users', 'Assign roles to users')
ON CONFLICT (action, resource) DO UPDATE SET description = EXCLUDED.description;

-- Events permissions
INSERT INTO public.permissions (action, resource, description) VALUES
    ('read', 'events', 'View events'),
    ('write', 'events', 'Create and update events'),
    ('delete', 'events', 'Delete events')
ON CONFLICT (action, resource) DO UPDATE SET description = EXCLUDED.description;

-- Chapters permissions
INSERT INTO public.permissions (action, resource, description) VALUES
    ('read', 'chapters', 'View chapters'),
    ('write', 'chapters', 'Create and update chapters'),
    ('delete', 'chapters', 'Delete chapters')
ON CONFLICT (action, resource) DO UPDATE SET description = EXCLUDED.description;

-- Associations permissions
INSERT INTO public.permissions (action, resource, description) VALUES
    ('read', 'associations', 'View associations'),
    ('write', 'associations', 'Create and update associations'),
    ('delete', 'associations', 'Delete associations')
ON CONFLICT (action, resource) DO UPDATE SET description = EXCLUDED.description;

-- Alumni cards permissions
INSERT INTO public.permissions (action, resource, description) VALUES
    ('read', 'alumni_cards', 'View alumni card applications'),
    ('write', 'alumni_cards', 'Update alumni card status'),
    ('delete', 'alumni_cards', 'Delete alumni card applications')
ON CONFLICT (action, resource) DO UPDATE SET description = EXCLUDED.description;

-- Distinguished alumni permissions
INSERT INTO public.permissions (action, resource, description) VALUES
    ('read', 'distinguished_alumni', 'View distinguished alumni'),
    ('write', 'distinguished_alumni', 'Create and update distinguished alumni'),
    ('delete', 'distinguished_alumni', 'Delete distinguished alumni')
ON CONFLICT (action, resource) DO UPDATE SET description = EXCLUDED.description;

-- Leadership permissions
INSERT INTO public.permissions (action, resource, description) VALUES
    ('read', 'leadership', 'View leadership applications'),
    ('write', 'leadership', 'Approve/reject leadership applications'),
    ('delete', 'leadership', 'Delete leadership applications')
ON CONFLICT (action, resource) DO UPDATE SET description = EXCLUDED.description;

-- ================================================
-- 3. ASSIGN PERMISSIONS TO ROLES
-- ================================================

-- Superadmin: All permissions on all resources
DO $$
DECLARE
    superadmin_role_id bigint;
    perm_record RECORD;
BEGIN
    SELECT id INTO superadmin_role_id FROM public.roles WHERE name = 'superadmin';
    
    FOR perm_record IN SELECT id FROM public.permissions LOOP
        INSERT INTO public.role_permissions (role_id, permission_id)
        VALUES (superadmin_role_id, perm_record.id)
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END LOOP;
    
    RAISE NOTICE '✅ Assigned all permissions to superadmin role';
END $$;

-- Admin: All permissions except user management
DO $$
DECLARE
    admin_role_id bigint;
    perm_record RECORD;
BEGIN
    SELECT id INTO admin_role_id FROM public.roles WHERE name = 'admin';
    
    FOR perm_record IN 
        SELECT id FROM public.permissions 
        WHERE NOT (action = 'write' AND resource = 'users')
          AND NOT (action = 'delete' AND resource = 'users')
          AND NOT (action = 'manage_roles' AND resource = 'users')
    LOOP
        INSERT INTO public.role_permissions (role_id, permission_id)
        VALUES (admin_role_id, perm_record.id)
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END LOOP;
    
    RAISE NOTICE '✅ Assigned permissions to admin role (excluding user management)';
END $$;

-- Viewer: Read-only permissions
DO $$
DECLARE
    viewer_role_id bigint;
    perm_record RECORD;
BEGIN
    SELECT id INTO viewer_role_id FROM public.roles WHERE name = 'viewer';
    
    FOR perm_record IN 
        SELECT id FROM public.permissions WHERE action = 'read'
    LOOP
        INSERT INTO public.role_permissions (role_id, permission_id)
        VALUES (viewer_role_id, perm_record.id)
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END LOOP;
    
    RAISE NOTICE '✅ Assigned read-only permissions to viewer role';
END $$;

-- Alumni: Self-service permissions (read own, write own)
DO $$
DECLARE
    alumni_role_id bigint;
BEGIN
    SELECT id INTO alumni_role_id FROM public.roles WHERE name = 'alumni';
    
    -- Alumni can read their own data
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT alumni_role_id, id FROM public.permissions 
    WHERE (action = 'read' AND resource = 'alumni')
       OR (action = 'write' AND resource = 'alumni' AND description LIKE '%own%')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
    
    RAISE NOTICE '✅ Assigned self-service permissions to alumni role';
END $$;

-- ================================================
-- 4. CREATE RESOURCE HIERARCHY FROM ORGANIZATIONAL STRUCTURE
-- ================================================

-- Create faculty resources
INSERT INTO public.resources (type, name, legacy_faculty_id)
SELECT 
    'faculty',
    faculty_name,
    id
FROM public.tbl_faculties
WHERE faculty_name IS NOT NULL
ON CONFLICT (type, name, parent_id) DO UPDATE SET 
    legacy_faculty_id = EXCLUDED.legacy_faculty_id;

-- Create department resources (with parent faculty)
INSERT INTO public.resources (type, name, parent_id, legacy_department_id, legacy_faculty_id)
SELECT 
    'department',
    d.department_name,
    f_res.id, -- Parent faculty resource
    d.id,
    d.faculty_id
FROM public.tbl_departments d
INNER JOIN public.tbl_faculties f ON d.faculty_id = f.id
INNER JOIN public.resources f_res ON f_res.type = 'faculty' AND f_res.legacy_faculty_id = f.id
WHERE d.department_name IS NOT NULL
ON CONFLICT (type, name, parent_id) DO UPDATE SET 
    legacy_department_id = EXCLUDED.legacy_department_id,
    legacy_faculty_id = EXCLUDED.legacy_faculty_id;

-- Create program resources (with parent department)
INSERT INTO public.resources (type, name, parent_id, legacy_program_id, legacy_department_id)
SELECT 
    'program',
    p.program_name,
    d_res.id, -- Parent department resource
    p.id,
    p.department_id
FROM public.tbl_programs p
INNER JOIN public.tbl_departments d ON p.department_id = d.id
INNER JOIN public.resources d_res ON d_res.type = 'department' AND d_res.legacy_department_id = d.id
WHERE p.program_name IS NOT NULL
ON CONFLICT (type, name, parent_id) DO UPDATE SET 
    legacy_program_id = EXCLUDED.legacy_program_id,
    legacy_department_id = EXCLUDED.legacy_department_id;

-- ================================================
-- VERIFICATION
-- ================================================

DO $$
DECLARE
    role_count integer;
    perm_count integer;
    resource_count integer;
    faculty_count integer;
    dept_count integer;
    prog_count integer;
BEGIN
    SELECT COUNT(*) INTO role_count FROM public.roles;
    SELECT COUNT(*) INTO perm_count FROM public.permissions;
    SELECT COUNT(*) INTO resource_count FROM public.resources;
    SELECT COUNT(*) INTO faculty_count FROM public.resources WHERE type = 'faculty';
    SELECT COUNT(*) INTO dept_count FROM public.resources WHERE type = 'department';
    SELECT COUNT(*) INTO prog_count FROM public.resources WHERE type = 'program';
    
    RAISE NOTICE '✅ RBAC Data Seeded:';
    RAISE NOTICE '   Roles: %', role_count;
    RAISE NOTICE '   Permissions: %', perm_count;
    RAISE NOTICE '   Resources: % (Faculties: %, Departments: %, Programs: %)', 
        resource_count, faculty_count, dept_count, prog_count;
END $$;
