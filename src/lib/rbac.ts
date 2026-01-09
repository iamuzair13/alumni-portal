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
 */
export async function getUserAccessAssignmentsWithIds(userId: number): Promise<UserAccessAssignmentWithIds[]> {
  try {
    // Use ID columns directly (preferred) with fallback to name-based JOIN if IDs are NULL
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
    
    return rows || [];
  } catch (error) {
    console.error("[RBAC] Failed to fetch user access assignments with IDs:", error);
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
    console.error("[RBAC] Failed to check all faculties access:", error);
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
    console.error("[RBAC] ❌ No user ID found in session (ID-based filter):", {
      sessionExists: !!session,
      userExists: !!session?.user,
      userEmail: session?.user?.email,
      userIdInSession: (session?.user as { userId?: number })?.userId,
      userType: (session?.user as { type?: string })?.type,
      sessionKeys: session?.user ? Object.keys(session.user) : []
    });
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
    console.log("[RBAC] hasAllFacultiesAccess check:", {
      userId,
      result: allFacultiesAccess
    });
  } catch (error) {
    console.error("[RBAC] ❌ Error checking all faculties access:", error);
    // If check fails, continue to individual assignment check instead of blocking
    allFacultiesAccess = false;
  }
  
  if (allFacultiesAccess) {
    // Full access - include all alumni, including NULL faculty/department
    console.log("[RBAC] ✅ User has all faculties access - granting full access (no filtering)");
    return { sql: null, hasFilter: false };
  }
  
  // Get assignments with IDs
  let assignments;
  try {
    assignments = await getUserAccessAssignmentsWithIds(userId);
  } catch (error) {
    console.error("[RBAC] ❌ Error fetching access assignments:", error);
    // If we can't fetch assignments, allow full access as fallback to prevent locking users out
    console.error("[RBAC] Allowing full access as fallback due to assignment fetch error");
    return { sql: null, hasFilter: false };
  }
  
  console.log("[RBAC] ========== ID-BASED ACCESS FILTER DEBUG ==========");
  console.log("[RBAC] User ID:", userId);
  console.log("[RBAC] User Type:", isAdminOrViewer ? (isAdminUser(session?.user) ? "admin" : "viewer") : "unknown");
  console.log("[RBAC] Assignments count:", assignments.length);
  console.log("[RBAC] Assignments:", JSON.stringify(assignments, null, 2));
  
  if (assignments.length === 0) {
    // Default behavior: if no assignments are configured for an admin/viewer,
    // do NOT block the entire system. Treat as full access (read-only for viewer, enforced elsewhere).
    // This matches the fallback behavior in userAccess.ts
    console.log("[RBAC] ✅ No assignments found - allowing full access (no filtering)");
    console.log("[RBAC] This means the user has access to all faculties/departments/programs");
    console.log("[RBAC] ============================================");
    return { sql: null, hasFilter: false };
  }
  
  // Validate that assignments have at least some valid IDs
  const hasValidIds = assignments.some(a => 
    a.faculty_id !== null || a.department_id !== null || a.program_id !== null
  );
  
  if (!hasValidIds) {
    console.warn("[RBAC] ⚠️ Assignments found but all IDs are null - allowing full access as fallback");
    console.warn("[RBAC] This might indicate that faculty/department/program names don't match database records");
    console.warn("[RBAC] Assignments with null IDs:", JSON.stringify(assignments, null, 2));
    console.log("[RBAC] ============================================");
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
  
  console.log("[RBAC] Collected IDs:", {
    facultyIds: Array.from(facultyIds),
    departmentIds: Array.from(departmentIds),
    programIds: Array.from(programIds)
  });
  
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
    console.warn("[RBAC] ⚠️ No valid conditions generated from assignments - allowing full access as fallback");
    console.warn("[RBAC] This might indicate a mismatch between access assignments and database structure");
    console.warn("[RBAC] Assignments that failed to generate conditions:", JSON.stringify(assignments, null, 2));
    console.log("[RBAC] ============================================");
    // Return full access instead of blocking - this is safer for production
    return { sql: null, hasFilter: false };
  }
  
  // Combine all conditions with OR
  const combinedCondition = combineOrConditions(conditionsArray);
  
  console.log("[RBAC] ✅ Generated filter with", conditionsArray.length, "condition(s)");
  console.log("[RBAC] Condition summary:", {
    facultyLevel: facultyIds.size,
    departmentLevel: departmentIds.size,
    programLevel: programIds.size,
    totalConditions: conditionsArray.length
  });
  console.log("[RBAC] ============================================");
  
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
