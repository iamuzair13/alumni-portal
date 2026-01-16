/**
 * Centralized Role-Based Access Control (RBAC) Utilities
 * 
 * This module provides a single source of truth for:
 * - Role definitions and constants
 * - ID-based faculty/department access filtering
 * - Role permission checks
 * 
 * @module rbac
 */

import type { Session } from "next-auth";
import { sql } from "@/lib/dbconnect";
import { isSuperAdminUser, isAdminUser, isViewerUser } from "./alumniProfile";
import { USER_ROLES, type UserRole } from "./rbac-constants";

// Re-export constants for backward compatibility
export { USER_ROLES, type UserRole };

/**
 * Access assignment with IDs (primary) and names (for lookup)
 */
export type UserAccessAssignmentWithIds = {
  faculty_id: number | null;
  department_id: number | null;
  program_id: number | null;
  faculty_name: string | null;
  department_name: string | null;
  program_name: string | null;
};

/**
 * Fetch user access assignments with IDs resolved from names
 * This ensures ID-based filtering while maintaining backward compatibility
 * 
 * NOW SUPPORTS BOTH OLD AND NEW RBAC SYSTEMS:
 * - First tries old system (user_access_assignments)
 * - Falls back to new system (user_resource_access) if old doesn't exist
 * 
 * @deprecated This function bridges old and new RBAC. Migrate to getUserResourceAccess() from rbac-standard.ts
 */
export async function getUserAccessAssignmentsWithIds(userId: number): Promise<UserAccessAssignmentWithIds[]> {
  try {
    // Check if old table exists first
    const tableExists = await sql/* sql */`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_access_assignments'
      ) as exists
    ` as Array<{ exists: boolean }>;
    
    if (tableExists[0]?.exists) {
      // Use old system - wrap in try-catch in case table was dropped between check and query
      try {
        const rows = await sql/* sql */`
          SELECT DISTINCT
            COALESCE(uaa.faculty_id, f.id) as faculty_id,
            COALESCE(uaa.department_id, d.id) as department_id,
            COALESCE(uaa.program_id, p.id) as program_id,
            uaa.faculty_name,
            uaa.department_name,
            uaa.program_name
          FROM public.user_access_assignments uaa
          LEFT JOIN public.tbl_faculties f ON 
            uaa.faculty_id IS NULL 
            AND LOWER(TRIM(COALESCE(f.faculty_name, ''))) = LOWER(TRIM(COALESCE(uaa.faculty_name, '')))
          LEFT JOIN public.tbl_departments d ON 
            uaa.department_id IS NULL
            AND LOWER(TRIM(COALESCE(d.department_name, ''))) = LOWER(TRIM(COALESCE(uaa.department_name, '')))
            AND (uaa.faculty_name IS NULL OR uaa.faculty_id IS NULL OR d.faculty_id = COALESCE(uaa.faculty_id, f.id))
          LEFT JOIN public.tbl_programs p ON 
            uaa.program_id IS NULL
            AND LOWER(TRIM(COALESCE(p.program_name, ''))) = LOWER(TRIM(COALESCE(uaa.program_name, '')))
            AND (uaa.department_name IS NULL OR uaa.department_id IS NULL OR p.department_id = COALESCE(uaa.department_id, d.id))
          WHERE uaa.userid = ${userId}
          ORDER BY COALESCE(uaa.faculty_id, f.id) NULLS LAST, COALESCE(uaa.department_id, d.id) NULLS LAST, COALESCE(uaa.program_id, p.id) NULLS LAST
        ` as Array<UserAccessAssignmentWithIds>;
        
        if (rows && rows.length > 0) {
          return rows;
        }
      } catch (oldTableError: unknown) {
        // Table might have been dropped between check and query
        if (oldTableError instanceof Error && oldTableError.message.includes('does not exist')) {
        } else {
          throw oldTableError; // Re-throw if it's a different error
        }
      }
    }
    
    // Fallback to new RBAC system
    // Check if new RBAC tables exist
    const newTablesExist = await sql/* sql */`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_resource_access'
      ) as exists
    ` as Array<{ exists: boolean }>;
    
    if (!newTablesExist[0]?.exists) {
      return [];
    }
    
    // Get user's RBAC user ID from users table
    // userId could be either:
    // 1. users.id - use directly
    // 2. legacy_userid - find via legacy_userid column
    const newUser = await sql/* sql */`
      SELECT id, legacy_userid, email
      FROM public.users 
      WHERE legacy_userid = ${userId} OR id = ${userId}
      LIMIT 1
    ` as Array<{ id: number; legacy_userid: number | null; email: string | null }>;
    
    let newUserId: number;
    
    if (!newUser[0]?.id) {
      // If userId doesn't match, it might already be the new user ID
      // Try one more time with direct lookup
      const directUser = await sql/* sql */`
        SELECT id, legacy_userid, email
        FROM public.users 
        WHERE id = ${userId}
        LIMIT 1
      ` as Array<{ id: number; legacy_userid: number | null; email: string | null }>;
      
      if (!directUser[0]?.id) {
        // User not in new system - check if they exist in old tbl_users and try to migrate
        // Note: tbl_users may not exist in production, so this is wrapped in try-catch
        try {
          // Check if tbl_users table exists first
          const tableExists = await sql/* sql */`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = 'tbl_users'
            ) as exists
          ` as Array<{ exists: boolean }>;
          
          if (!tableExists[0]?.exists) {
            return [];
          }
          
          const oldUser = await sql/* sql */`
            SELECT userid, email, password, firstname, lastname, department, type, blocked, lastlogindatetime
            FROM public.tbl_users
            WHERE userid = ${userId}
            LIMIT 1
          ` as Array<{
            userid: number;
            email: string | null;
            password: string | null;
            firstname: string | null;
            lastname: string | null;
            department: string | null;
            type: string | null;
            blocked: boolean | null;
            lastlogindatetime: string | null;
          }>;
          
          if (oldUser[0]?.userid) {
            // Try to create user in new system
            const migratedUser = await sql/* sql */`
              INSERT INTO public.users (
                email, password_hash, password, is_active, legacy_userid, legacy_type,
                firstname, lastname, department, type, blocked, lastlogindatetime,
                created_at, updated_at
              )
              VALUES (
                ${oldUser[0].email || `user${userId}@migrated.local`},
                ${oldUser[0].password || ''},
                ${oldUser[0].password || ''},
                ${!Boolean(oldUser[0].blocked ?? false)},
                ${oldUser[0].userid},
                ${oldUser[0].type || 'viewer'},
                ${oldUser[0].firstname || null},
                ${oldUser[0].lastname || null},
                ${oldUser[0].department || null},
                ${oldUser[0].type || 'viewer'},
                ${Boolean(oldUser[0].blocked ?? false)},
                ${oldUser[0].lastlogindatetime || null},
                now(),
                now()
              )
              ON CONFLICT (email) DO UPDATE SET
                legacy_userid = EXCLUDED.legacy_userid,
                legacy_type = EXCLUDED.legacy_type,
                updated_at = now()
              RETURNING id, legacy_userid, email
            ` as Array<{ id: number; legacy_userid: number | null; email: string | null }>;
            
            if (migratedUser[0]?.id) {
              newUserId = migratedUser[0].id;
            } else {
              return [];
            }
          } else {
            return [];
          }
        } catch (migrationError) {
          return [];
        }
      } else {
        newUserId = directUser[0].id;
      }
    } else {
      newUserId = newUser[0].id;
    }
    // Get access from new RBAC system and convert to old format
    // The new system uses hierarchical resources, so we need to extract faculty/department/program IDs
    const newAccess = await sql/* sql */`
      SELECT DISTINCT
        res.legacy_faculty_id as faculty_id,
        CASE WHEN res.type = 'faculty' THEN res.name 
             WHEN res.type = 'department' THEN parent_fac.name
             WHEN res.type = 'program' THEN grandparent_fac.name
             ELSE NULL END as faculty_name,
        res.legacy_department_id as department_id,
        CASE WHEN res.type = 'department' THEN res.name
             WHEN res.type = 'program' THEN parent_dept.name
             ELSE NULL END as department_name,
        res.legacy_program_id as program_id,
        CASE WHEN res.type = 'program' THEN res.name ELSE NULL END as program_name,
        res.type as resource_type,
        res.name as resource_name
      FROM public.user_resource_access ura
      INNER JOIN public.resources res ON ura.resource_id = res.id
      LEFT JOIN public.resources parent_dept ON res.parent_id = parent_dept.id AND parent_dept.type = 'department'
      LEFT JOIN public.resources parent_fac ON 
        (res.type = 'department' AND res.parent_id = parent_fac.id AND parent_fac.type = 'faculty')
        OR (res.type = 'program' AND parent_dept.parent_id = parent_fac.id AND parent_fac.type = 'faculty')
      LEFT JOIN public.resources grandparent_fac ON 
        res.type = 'program' AND parent_dept.parent_id = grandparent_fac.id AND grandparent_fac.type = 'faculty'
      WHERE ura.user_id = ${newUserId}
        AND res.type IN ('faculty', 'department', 'program')
      ORDER BY resource_type, resource_name
    ` as Array<UserAccessAssignmentWithIds & { resource_type?: string; resource_name?: string }>;
    
    if (newAccess && newAccess.length > 0) {
      return newAccess;
    }
    return [];
  } catch (error) {
    return [];
  }
}

/**
 * Check if user has access to all faculties
 * Returns true if user has assignments covering all system faculties
 */
export async function hasAllFacultiesAccess(userId: number): Promise<boolean> {
  try {
    const assignments = await getUserAccessAssignmentsWithIds(userId);
    
    // If no assignments, no access
    if (assignments.length === 0) {
      return false;
    }
    
    // Check if there are any department/program level assignments
    const hasDepartmentOrProgramAssignments = assignments.some(
      a => a.department_id !== null || a.program_id !== null
    );
    
    // If there are department/program assignments, not "all faculties"
    if (hasDepartmentOrProgramAssignments) {
      return false;
    }
    
    // Get all faculty-only assignments
    const facultyOnlyAssignments = assignments.filter(
      a => a.faculty_id !== null && a.department_id === null && a.program_id === null
    );
    
    if (facultyOnlyAssignments.length === 0) {
      return false;
    }
    
    // Get all system faculties
    const allSystemFaculties = await sql/* sql */`
      SELECT id FROM public.tbl_faculties ORDER BY id
    ` as Array<{ id: number }>;
    
    const assignedFacultyIds = new Set(
      facultyOnlyAssignments.map(a => a.faculty_id!).filter(Boolean)
    );
    
    const systemFacultyIds = new Set(allSystemFaculties.map(f => f.id));
    
    // Check if all system faculties are assigned
    return (
      assignedFacultyIds.size === systemFacultyIds.size &&
      Array.from(systemFacultyIds).every(id => assignedFacultyIds.has(id))
    );
  } catch (error) {
    return false;
  }
}

/**
 * Build ID-based access filter SQL for alumni queries
 * 
 * Rules:
 * - superadmin: no filter (full access)
 * - admin/viewer with all faculties: no filter (full access, including NULL)
 * - admin/viewer with specific assignments: filter by faculty_id and department_id
 * 
 * Note: Conditions use "a" as table alias (standard in alumni queries)
 * 
 * @param session - User session
 * @returns SQL condition and hasFilter flag
 */
export async function buildIdBasedAccessFilterSQL(
  session: Session | null
): Promise<{ sql: ReturnType<typeof sql> | null; hasFilter: boolean }> {
  // Superadmin always has full access - no filtering
  if (isSuperAdminUser(session?.user)) {
    return { sql: null, hasFilter: false };
  }
  
  // Get user ID
  const userId = (session?.user as { userId?: number })?.userId;
  if (!userId) {
    // Log detailed error for debugging PM2 issues
    return { sql: sql`1 = 0`, hasFilter: true }; // No access
  }
  
  // Check if user is admin or viewer
  const isAdminOrViewer = isAdminUser(session?.user) || isViewerUser(session?.user);
  if (!isAdminOrViewer) {
    return { sql: sql`1 = 0`, hasFilter: true }; // No access
  }
  
  // Check if user has all faculties access
  let allFacultiesAccess;
  try {
    allFacultiesAccess = await hasAllFacultiesAccess(userId);
  } catch (error) {
    // If check fails, continue to individual assignment check instead of blocking
    allFacultiesAccess = false;
  }
  
  if (allFacultiesAccess) {
    // Full access - include all alumni, including NULL faculty/department
    return { sql: null, hasFilter: false };
  }
  
  // Get assignments with IDs
  let assignments;
  try {
    assignments = await getUserAccessAssignmentsWithIds(userId);
  } catch (error) {
    // If we can't fetch assignments, allow full access as fallback to prevent locking users out
    return { sql: null, hasFilter: false };
  }
  if (assignments.length === 0) {
    // Check if old table exists to determine if this is a migration scenario
    const tableExists = await sql/* sql */`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_access_assignments'
      ) as exists
    ` as Array<{ exists: boolean }>;
    
    if (!tableExists[0]?.exists) {
      // Table doesn't exist - migration scenario
      // User should have assignments in new RBAC system, but they don't
      // Deny access for safety
      return { sql: sql`1 = 0`, hasFilter: true };
    }
    
    // Table exists but no assignments - legacy behavior: allow full access
    // This matches the fallback behavior in userAccess.ts
    // Note: This should be reviewed - ideally users should have explicit assignments
    return { sql: null, hasFilter: false };
  }
  
  // Validate that assignments have at least some valid IDs
  const hasValidIds = assignments.some(a => 
    a.faculty_id !== null || a.department_id !== null || a.program_id !== null
  );
  
  if (!hasValidIds) {
    return { sql: null, hasFilter: false };
  }
  
  // Build ID-based filter conditions
  const conditionsArray: ReturnType<typeof sql>[] = [];
  
  // Collect unique IDs
  const facultyIds = new Set<number>();
  const departmentIds = new Set<number>();
  const programIds = new Set<number>();
  
  // Map of department_id -> faculty_id for validation
  const departmentToFaculty = new Map<number, number>();
  
  // Map of program_id -> department_id for validation
  const programToDepartment = new Map<number, number>();
  
  for (const assignment of assignments) {
    // Convert IDs to numbers (they may come as strings from the database)
    const programId = assignment.program_id !== null ? Number(assignment.program_id) : null;
    const departmentId = assignment.department_id !== null ? Number(assignment.department_id) : null;
    const facultyId = assignment.faculty_id !== null ? Number(assignment.faculty_id) : null;
    
    if (programId !== null && !isNaN(programId)) {
      programIds.add(programId);
      if (departmentId !== null && !isNaN(departmentId)) {
        programToDepartment.set(programId, departmentId);
      }
      if (facultyId !== null && !isNaN(facultyId)) {
        // Track faculty for program-level access
      }
    } else if (departmentId !== null && !isNaN(departmentId)) {
      departmentIds.add(departmentId);
      if (facultyId !== null && !isNaN(facultyId)) {
        departmentToFaculty.set(departmentId, facultyId);
      }
    } else if (facultyId !== null && !isNaN(facultyId)) {
      facultyIds.add(facultyId);
    }
  }
  // Build conditions: program > department > faculty (most specific first)
  // Note: We build conditions without table alias prefix since most queries use "a" as alias
  // If a different alias is needed, it should be applied when using the condition
  
  // Program-level access (most specific)
  if (programIds.size > 0) {
    const programConditions: ReturnType<typeof sql>[] = [];
    
    for (const programId of programIds) {
      const deptId = programToDepartment.get(programId);
      if (deptId !== undefined) {
        programConditions.push(
          sql`(a.department = ${deptId} AND a.program = ${programId})`
        );
      } else {
        programConditions.push(
          sql`a.program = ${programId}`
        );
      }
    }
    
    if (programConditions.length > 0) {
      const combinedProgramCondition = combineOrConditions(programConditions);
      conditionsArray.push(combinedProgramCondition);
    }
  }
  
  // Department-level access (exclude departments already covered by program assignments)
  if (departmentIds.size > 0) {
    const uncoveredDepartmentIds = Array.from(departmentIds).filter(
      deptId => !Array.from(programToDepartment.values()).includes(deptId)
    );
    
    if (uncoveredDepartmentIds.length > 0) {
      const deptConditions: ReturnType<typeof sql>[] = [];
      
      for (const deptId of uncoveredDepartmentIds) {
        const facultyId = departmentToFaculty.get(deptId);
        if (facultyId !== undefined) {
          deptConditions.push(
            sql`(a.faculty = ${facultyId} AND a.department = ${deptId})`
          );
        } else {
          deptConditions.push(
            sql`a.department = ${deptId}`
          );
        }
      }
      
      if (deptConditions.length > 0) {
        const combinedDeptCondition = combineOrConditions(deptConditions);
        conditionsArray.push(combinedDeptCondition);
      }
    }
  }
  
  // Faculty-level access (exclude faculties already covered by department/program assignments)
  if (facultyIds.size > 0) {
    const coveredFacultyIds = new Set([
      ...Array.from(departmentToFaculty.values()),
      ...Array.from(assignments.filter(a => a.program_id !== null && a.faculty_id !== null).map(a => a.faculty_id!))
    ]);
    
    const uncoveredFacultyIds = Array.from(facultyIds).filter(
      fId => !coveredFacultyIds.has(fId)
    );
    
    if (uncoveredFacultyIds.length > 0) {
      // Ensure all IDs are numbers for the SQL array
      const facultyIdArray = uncoveredFacultyIds.map(id => Number(id)).filter(id => !isNaN(id));
      if (facultyIdArray.length > 0) {
        conditionsArray.push(
          sql`a.faculty = ANY(${facultyIdArray})`
        );
      }
    }
  }
  
  if (conditionsArray.length === 0) {
    // If we have assignments but no valid conditions, it means the assignments might be invalid
    // In this case, log the issue but don't block access - allow full access as fallback
    // This prevents admin/viewer users from being locked out if there's a data mismatch
    // Return full access instead of blocking - this is safer for production
    return { sql: null, hasFilter: false };
  }
  
  // Combine all conditions with OR
  const combinedCondition = combineOrConditions(conditionsArray);
  return { sql: combinedCondition, hasFilter: true };
}

/**
 * Helper to combine OR conditions efficiently
 */
function combineOrConditions(conditions: ReturnType<typeof sql>[]): ReturnType<typeof sql> {
  if (conditions.length === 0) return sql`1 = 0`;
  if (conditions.length === 1) return conditions[0];
  if (conditions.length === 2) return sql`${conditions[0]} OR ${conditions[1]}`;
  
  // Binary tree approach to minimize nesting
  const mid = Math.ceil(conditions.length / 2);
  const left = combineOrConditions(conditions.slice(0, mid));
  const right = combineOrConditions(conditions.slice(mid));
  return sql`${left} OR ${right}`;
}

/**
 * Check if user can modify alumni data
 */
export function canModifyAlumni(user: Session["user"] | null | undefined): boolean {
  return isSuperAdminUser(user) || isAdminUser(user);
}

/**
 * Check if user can view alumni data
 */
export function canViewAlumni(user: Session["user"] | null | undefined): boolean {
  return isSuperAdminUser(user) || isAdminUser(user) || isViewerUser(user);
}
