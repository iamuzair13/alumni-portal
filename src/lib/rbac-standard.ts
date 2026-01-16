/**
 * Standard RBAC Utilities (New System)
 * 
 * This module provides industry-standard RBAC functions using:
 * - users, roles, permissions tables
 * - user_roles, role_permissions mappings
 * - resources (hierarchical) and user_resource_access
 * 
 * @module rbac-standard
 */

import type { Session } from "next-auth";
import { sql } from "@/lib/dbconnect";

// ================================================
// TYPES
// ================================================

export type Permission = {
  id: number;
  action: string;
  resource: string;
  description: string | null;
};

export type Role = {
  id: number;
  name: string;
  description: string | null;
};

export type Resource = {
  id: number;
  type: string;
  name: string;
  parent_id: number | null;
};

export type UserRole = {
  role_id: number;
  role_name: string;
  assigned_at: Date;
};

export type UserResourceAccess = {
  resource_id: number;
  resource_type: string;
  resource_name: string;
  access_level: 'read' | 'write' | 'admin';
};

// ================================================
// ROLE CHECKS
// ================================================

/**
 * Get user ID from session (new RBAC system)
 * Returns the users.id from the users table
 */
export async function getUserIdFromSession(session: Session | null): Promise<number | null> {
  if (!session?.user) return null;
  
  const email = session.user.email;
  if (!email) return null;
  
  try {
    const result = await sql/* sql */`
      SELECT id FROM public.users WHERE email = ${email} AND is_active = true
    ` as Array<{ id: number }>;
    
    return result[0]?.id ?? null;
  } catch (error) {
    return null;
  }
}

/**
 * Check if user has a specific role
 */
export async function hasRole(userId: number, roleName: string): Promise<boolean> {
  try {
    const result = await sql/* sql */`
      SELECT COUNT(*) as count
      FROM public.user_roles ur
      INNER JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = ${userId} AND LOWER(TRIM(r.name)) = LOWER(TRIM(${roleName}))
    ` as Array<{ count: string }>;
    
    return parseInt(result[0]?.count ?? '0') > 0;
  } catch (error) {
    return false; // Fail closed - deny access on error
  }
}

/**
 * Get all roles for a user
 */
export async function getUserRoles(userId: number): Promise<UserRole[]> {
  try {
    const result = await sql/* sql */`
      SELECT 
        r.id as role_id,
        r.name as role_name,
        ur.assigned_at
      FROM public.user_roles ur
      INNER JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = ${userId}
      ORDER BY r.name
    ` as Array<UserRole>;
    
    return result || [];
  } catch (error) {
    return [];
  }
}

/**
 * Check if user is superadmin (convenience function)
 */
export async function isSuperAdmin(userId: number | null): Promise<boolean> {
  if (!userId) return false;
  return hasRole(userId, 'superadmin');
}

/**
 * Check if user is admin (convenience function)
 */
export async function isAdmin(userId: number | null): Promise<boolean> {
  if (!userId) return false;
  return hasRole(userId, 'admin');
}

/**
 * Check if user is viewer (convenience function)
 */
export async function isViewer(userId: number | null): Promise<boolean> {
  if (!userId) return false;
  return hasRole(userId, 'viewer');
}

// ================================================
// PERMISSION CHECKS
// ================================================

/**
 * Check if user has a specific permission (via roles)
 */
export async function hasPermission(
  userId: number,
  action: string,
  resource: string
): Promise<boolean> {
  try {
    // Superadmin bypass - check first
    if (await isSuperAdmin(userId)) {
      return true;
    }
    
    const result = await sql/* sql */`
      SELECT COUNT(*) as count
      FROM public.user_roles ur
      INNER JOIN public.role_permissions rp ON ur.role_id = rp.role_id
      INNER JOIN public.permissions p ON rp.permission_id = p.id
      WHERE ur.user_id = ${userId}
        AND LOWER(TRIM(p.action)) = LOWER(TRIM(${action}))
        AND LOWER(TRIM(p.resource)) = LOWER(TRIM(${resource}))
    ` as Array<{ count: string }>;
    
    return parseInt(result[0]?.count ?? '0') > 0;
  } catch (error) {
    return false; // Fail closed
  }
}

/**
 * Get all permissions for a user (via roles)
 */
export async function getUserPermissions(userId: number): Promise<Permission[]> {
  try {
    // Superadmin gets all permissions
    if (await isSuperAdmin(userId)) {
      const allPerms = await sql/* sql */`
        SELECT id, action, resource, description
        FROM public.permissions
        ORDER BY resource, action
      ` as Array<Permission>;
      return allPerms || [];
    }
    
    const result = await sql/* sql */`
      SELECT DISTINCT
        p.id,
        p.action,
        p.resource,
        p.description
      FROM public.user_roles ur
      INNER JOIN public.role_permissions rp ON ur.role_id = rp.role_id
      INNER JOIN public.permissions p ON rp.permission_id = p.id
      WHERE ur.user_id = ${userId}
      ORDER BY p.resource, p.action
    ` as Array<Permission>;
    
    return result || [];
  } catch (error) {
    return [];
  }
}

// ================================================
// RESOURCE ACCESS CHECKS
// ================================================

/**
 * Get all resources a user has access to
 */
export async function getUserResourceAccess(userId: number): Promise<UserResourceAccess[]> {
  try {
    // Superadmin has access to all resources
    if (await isSuperAdmin(userId)) {
      const allResources = await sql/* sql */`
        SELECT 
          r.id as resource_id,
          r.type as resource_type,
          r.name as resource_name,
          'admin'::text as access_level
        FROM public.resources r
        ORDER BY r.type, r.name
      ` as Array<UserResourceAccess>;
      return allResources || [];
    }
    
    const result = await sql/* sql */`
      SELECT 
        res.id as resource_id,
        res.type as resource_type,
        res.name as resource_name,
        ura.access_level
      FROM public.user_resource_access ura
      INNER JOIN public.resources res ON ura.resource_id = res.id
      WHERE ura.user_id = ${userId}
      ORDER BY res.type, res.name
    ` as Array<UserResourceAccess>;
    
    return result || [];
  } catch (error) {
    return [];
  }
}

/**
 * Check if user has access to a specific resource
 */
export async function hasResourceAccess(
  userId: number,
  resourceId: number,
  requiredLevel: 'read' | 'write' | 'admin' = 'read'
): Promise<boolean> {
  try {
    // Superadmin has full access
    if (await isSuperAdmin(userId)) {
      return true;
    }
    
    // Map access levels to hierarchy: read < write < admin
    const levelHierarchy = { read: 1, write: 2, admin: 3 };
    const requiredLevelValue = levelHierarchy[requiredLevel];
    
    const result = await sql/* sql */`
      SELECT access_level
      FROM public.user_resource_access
      WHERE user_id = ${userId} AND resource_id = ${resourceId}
    ` as Array<{ access_level: string }>;
    
    if (result.length === 0) {
      return false; // No access
    }
    
    const userLevel = result[0].access_level as keyof typeof levelHierarchy;
    const userLevelValue = levelHierarchy[userLevel] || 0;
    
    return userLevelValue >= requiredLevelValue;
  } catch (error) {
    return false; // Fail closed
  }
}

/**
 * Check if user has access to a resource by name and type
 */
export async function hasResourceAccessByName(
  userId: number,
  resourceType: string,
  resourceName: string,
  requiredLevel: 'read' | 'write' | 'admin' = 'read'
): Promise<boolean> {
  try {
    // Superadmin has full access
    if (await isSuperAdmin(userId)) {
      return true;
    }
    
    const levelHierarchy = { read: 1, write: 2, admin: 3 };
    const requiredLevelValue = levelHierarchy[requiredLevel];
    
    const result = await sql/* sql */`
      SELECT ura.access_level
      FROM public.user_resource_access ura
      INNER JOIN public.resources res ON ura.resource_id = res.id
      WHERE ura.user_id = ${userId}
        AND LOWER(TRIM(res.type)) = LOWER(TRIM(${resourceType}))
        AND LOWER(TRIM(res.name)) = LOWER(TRIM(${resourceName}))
    ` as Array<{ access_level: string }>;
    
    if (result.length === 0) {
      return false;
    }
    
    const userLevel = result[0].access_level as keyof typeof levelHierarchy;
    const userLevelValue = levelHierarchy[userLevel] || 0;
    
    return userLevelValue >= requiredLevelValue;
  } catch (error) {
    return false;
  }
}

/**
 * Build SQL filter for alumni data based on user resource access
 * Returns SQL fragment and hasFilter flag
 */
export async function buildResourceAccessFilterSQL(
  userId: number | null
): Promise<{ sql: ReturnType<typeof sql> | null; hasFilter: boolean }> {
  if (!userId) {
    // No user = no access
    return { sql: sql`1 = 0`, hasFilter: true };
  }
  
  try {
    // Check if superadmin
    if (await isSuperAdmin(userId)) {
      return { sql: null, hasFilter: false }; // No filter = full access
    }
    
    // Get user's resource access
    const resourceAccess = await getUserResourceAccess(userId);
    
    if (resourceAccess.length === 0) {
      // No access = deny all
      return { sql: sql`1 = 0`, hasFilter: true };
    }
    
    // Build filter based on resource access
    // Map resources to alumni table fields:
    // - faculty resources → faculty/facultyname
    // - department resources → department/departmentname
    // - program resources → program/programname
    
    const facultyResources = resourceAccess.filter(r => r.resource_type === 'faculty');
    const departmentResources = resourceAccess.filter(r => r.resource_type === 'department');
    const programResources = resourceAccess.filter(r => r.resource_type === 'program');
    
    const conditions: ReturnType<typeof sql>[] = [];
    
    // Faculty-level access
    if (facultyResources.length > 0) {
      const facultyNames = facultyResources.map(r => r.resource_name);
      conditions.push(sql`
        (
          (facultyname IS NOT NULL AND LOWER(TRIM(facultyname)) = ANY(${facultyNames.map(n => n.toLowerCase().trim())}))
          OR (faculty IS NOT NULL AND faculty IN (
            SELECT legacy_faculty_id FROM public.resources 
            WHERE type = 'faculty' AND LOWER(TRIM(name)) = ANY(${facultyNames.map(n => n.toLowerCase().trim())})
          ))
        )
      `);
    }
    
    // Department-level access
    if (departmentResources.length > 0) {
      const deptNames = departmentResources.map(r => r.resource_name);
      conditions.push(sql`
        (
          (departmentname IS NOT NULL AND LOWER(TRIM(departmentname)) = ANY(${deptNames.map(n => n.toLowerCase().trim())}))
          OR (department IS NOT NULL AND department IN (
            SELECT legacy_department_id FROM public.resources 
            WHERE type = 'department' AND LOWER(TRIM(name)) = ANY(${deptNames.map(n => n.toLowerCase().trim())})
          ))
        )
      `);
    }
    
    // Program-level access
    if (programResources.length > 0) {
      const progNames = programResources.map(r => r.resource_name);
      conditions.push(sql`
        (
          (program IS NOT NULL AND program IN (
            SELECT legacy_program_id FROM public.resources 
            WHERE type = 'program' AND LOWER(TRIM(name)) = ANY(${progNames.map(n => n.toLowerCase().trim())})
          ))
        )
      `);
    }
    
    if (conditions.length === 0) {
      // No matching conditions = deny all
      return { sql: sql`1 = 0`, hasFilter: true };
    }
    
    // Combine conditions with OR
    const combinedFilter = conditions.reduce((acc, condition, index) => {
      if (index === 0) return condition;
      return sql`${acc} OR ${condition}`;
    }, conditions[0]);
    
    return { sql: combinedFilter, hasFilter: true };
  } catch (error) {
    // Fail closed - deny access on error
    return { sql: sql`1 = 0`, hasFilter: true };
  }
}

// ================================================
// SESSION HELPERS
// ================================================

/**
 * Get user ID from session and check role (convenience)
 */
export async function getSessionUserId(session: Session | null): Promise<number | null> {
  return getUserIdFromSession(session);
}

/**
 * Check if session user has role
 */
export async function sessionHasRole(
  session: Session | null,
  roleName: string
): Promise<boolean> {
  const userId = await getUserIdFromSession(session);
  if (!userId) return false;
  return hasRole(userId, roleName);
}

/**
 * Check if session user has permission
 */
export async function sessionHasPermission(
  session: Session | null,
  action: string,
  resource: string
): Promise<boolean> {
  const userId = await getUserIdFromSession(session);
  if (!userId) return false;
  return hasPermission(userId, action, resource);
}
