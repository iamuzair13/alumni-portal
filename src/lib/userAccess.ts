import { sql } from "@/lib/dbconnect";
import type { Session } from "next-auth";
import { isSuperAdminUser } from "./alumniProfile";
import { 
  findMatchingPrograms, 
  buildProgramMatchPattern
} from "./programMatching";
import { getAllFacultyNamesCached } from "./orgAccessLookup";
import { buildIdBasedAccessFilterSQL } from "./rbac";

export type UserAccessAssignment = {
  faculty_name: string | null;
  department_name: string | null;
  program_name: string | null;
};

/**
 * Fetch user access assignments from database
 * @deprecated This function uses the old RBAC system (user_access_assignments table).
 * Use getUserResourceAccess() from rbac-standard.ts for the new RBAC system.
 * This function will be removed in a future version.
 * 
 * Migration: Replace with:
 *   import { getUserResourceAccess } from "@/lib/rbac-standard";
 *   const access = await getUserResourceAccess(userId);
 */
export async function getUserAccessAssignments(userId: number): Promise<UserAccessAssignment[]> {

  try {
    // Check if table exists first (for migration safety)
    const tableExists = await sql/* sql */`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_access_assignments'
      ) as exists
    ` as Array<{ exists: boolean }>;
    
    if (!tableExists[0]?.exists) {

      return [];
    }
    
    const rows = await sql/* sql */`
      SELECT faculty_name, department_name, program_name
      FROM public.user_access_assignments
      WHERE userid = ${userId}
    ` as Array<UserAccessAssignment>;
    return rows || [];
  } catch (error) {
    // Check if error is "relation does not exist"
    if (error instanceof Error && error.message.includes('does not exist')) {

      return [];
    }

    return [];
  }
}

/**
 * Get user ID from session
 */
export function getUserIdFromSession(session: Session | null): number | null {
  if (!session?.user?.email) return null;
  // User ID is stored directly in session.user.userId (set in auth.ts session callback)
  const userId = (session.user as { userId?: number })?.userId;
  return userId ?? null;
}

/**
 * Build SQL WHERE clause fragment for filtering alumni data based on user access
 * 
 * @deprecated This function uses the old RBAC system (user_access_assignments table).
 * Use buildResourceAccessFilterSQL() from rbac-standard.ts for the new RBAC system.
 * This function will be removed in a future version.
 * 
 * Migration: Replace with:
 *   import { getUserIdFromSession, buildResourceAccessFilterSQL } from "@/lib/rbac-standard";
 *   const userId = await getUserIdFromSession(session);
 *   const filter = await buildResourceAccessFilterSQL(userId);
 * 
 * Rules:
 * - superadmin: no filter (full access)
 * - admin/viewer with all faculties: no filter (full access, including NULL)
 * - admin/viewer with specific assignments: filter by faculty_id and department_id
 * 
 * @param session - User session
 * @param _tableAlias - Table alias (deprecated, always uses "a")
 * @returns SQL condition and hasFilter flag
 */
export async function buildAccessFilterSQL(
  session: Session | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _tableAlias: string = ""
): Promise<{ sql: ReturnType<typeof sql> | null; hasFilter: boolean }> {

  // Try ID-based filtering first (preferred method)
  try {
    const idBasedFilter = await buildIdBasedAccessFilterSQL(session);
    // If ID-based filter succeeded (either has filter or no filter needed), use it
    // hasFilter=false means full access (superadmin or all faculties)
    // hasFilter=true with sql means filtered access
    // hasFilter=true with sql=null should not happen, but fallback handles it
    if (!idBasedFilter.hasFilter || idBasedFilter.sql !== null) {
      return idBasedFilter;
    }
  } catch (error) {

    // Fall through to name-based filtering for backward compatibility
  }
  
  // Fallback to name-based filtering (for backward compatibility)
  // Super admin always has full access - no filtering
  if (isSuperAdminUser(session?.user)) {
    return { sql: null, hasFilter: false };
  }
  
  // Import isAdminUser and isViewerUser to check user type
  const { isAdminUser, isViewerUser } = await import("./alumniProfile");
  
  // For admin/viewer, check their access assignments
  // If all faculties are selected → full access (like superadmin, except user management)
  // If specific assignments → apply filtering based on assignments
  const isAdminOrViewer = isAdminUser(session?.user) || isViewerUser(session?.user);
  
  // Get user ID
  const userId = getUserIdFromSession(session);
  if (!userId) {
    // Log detailed error for debugging PM2 issues

    // If no user ID, return condition that always fails (no access)
    return { sql: sql`1 = 0`, hasFilter: true };
  }
  
  // For non-admin/viewer users (shouldn't happen, but handle gracefully)
  if (!isAdminOrViewer) {

    return { sql: sql`1 = 0`, hasFilter: true };
  }

  // Fetch access assignments
  const assignments = await getUserAccessAssignments(userId);
  
  // Debug logging - detailed

  // If no assignments, user has no access
  if (assignments.length === 0) {
    // Default behavior: if no assignments are configured for an admin/viewer,
    // do NOT block the entire system. Treat as full access (read-only for viewer, enforced elsewhere).

    return { sql: null, hasFilter: false };
  }

  // Check if ALL faculties are selected (faculty-level assignments only, no departments/programs)
  // This means the user has full access like superadmin (except user management)
  // Only check if there are NO department/program level assignments (meaning "All Faculties" was selected)
  const hasDepartmentOrProgramAssignments = assignments.some(
    a => a.department_name || a.program_name
  );
  
  if (!hasDepartmentOrProgramAssignments) {
    // Only faculty-level assignments exist - check if all faculties are assigned
    const facultyOnlyAssignments = assignments.filter(
      a => a.faculty_name && !a.department_name && !a.program_name
    );
    
    if (facultyOnlyAssignments.length > 0) {
      // Get all faculties in the system
      const allSystemFaculties = await getAllFacultyNamesCached();
      const assignedFaculties = facultyOnlyAssignments.map(a => a.faculty_name!).filter(Boolean);
      
      // Normalize for comparison (case-insensitive, trimmed)
      const normalize = (arr: string[]) => arr.map(f => f.toLowerCase().trim()).sort();
      const normalizedSystemFaculties = normalize(allSystemFaculties);
      const normalizedAssignedFaculties = normalize(assignedFaculties);
      
      // Check if all faculties are assigned (count matches and all faculties are present)
      const hasAllFaculties = 
        normalizedAssignedFaculties.length === normalizedSystemFaculties.length &&
        normalizedSystemFaculties.every(f => normalizedAssignedFaculties.includes(f));
      
      if (hasAllFaculties) {
        // All faculties are selected → full access (like superadmin, except user management)

        return { sql: null, hasFilter: false };
      }
    }
  } else {
    // Department or program level assignments exist - apply specific filtering

  }

  // Build filter conditions
  // Group assignments by specificity (program > department > faculty)
  const facultyOnly: string[] = [];
  const departmentLevel: Array<{ faculty: string; department: string }> = [];
  const programLevel: Array<{ faculty: string; department: string; program: string }> = [];

  for (const assignment of assignments) {
    if (assignment.program_name) {
      programLevel.push({
        faculty: assignment.faculty_name || "",
        department: assignment.department_name || "",
        program: assignment.program_name,
      });
    } else if (assignment.department_name) {
      departmentLevel.push({
        faculty: assignment.faculty_name || "",
        department: assignment.department_name,
      });
    } else if (assignment.faculty_name) {
      facultyOnly.push(assignment.faculty_name);
    }
  }

  // Build SQL conditions
  // Since queries don't use table aliases, we'll build conditions directly
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditionsArray: any[] = [];
  
  // Program-level access (case-insensitive comparison with TRIM to handle whitespace)
  // Program access can work with or without faculty/department specified
  // Track which departments have program-level assignments (to prevent department-level access from being added)
  const departmentsWithProgramAssignments = new Set<string>();
  
  if (programLevel.length > 0) {

    for (const item of programLevel) {
      const normalizedFaculty = (item.faculty || "").trim();
      const normalizedDept = (item.department || "").trim();
      const normalizedProgram = (item.program || "").trim();
      
      // Track this department to prevent department-level access from being added
      // When a specific program is assigned, users should ONLY see that program, not all programs in the department
      if (normalizedDept) {
        departmentsWithProgramAssignments.add(`${normalizedFaculty.toLowerCase()}|${normalizedDept.toLowerCase()}`);
      }

      if (!normalizedProgram) {

        continue; // Skip if program is empty
      }
      
      // Use improved program matching from programMatching.ts
      // Find all matching programs from the database structure (mock-programs.json contains actual database values)
      // Use a lower threshold (0.4) to catch more variations, but prioritize higher similarity matches
      const matchingPrograms = findMatchingPrograms(
        normalizedProgram,
        normalizedFaculty || null,
        normalizedDept || null,
        0.4 // Lower threshold to catch more variations
      );

      if (matchingPrograms.length > 0) {

      }
      
      // Build SQL condition that matches the assigned program OR any similar programs found in database
      // The program names from mock-programs.json are the actual values in degreetitle
      const programNamesToMatch: string[] = [];
      
      // Always include the assigned program name (exact match) - this is what was selected in the dropdown
      // This ensures that if the program name in the database matches exactly, it will be found
      programNamesToMatch.push(normalizedProgram);
      
      // Add all matching programs from database (these are actual degreetitle values)
      // Include programs with at least 40% similarity, but prioritize higher similarity
      // These are the actual program names that exist in the database (from mock-programs.json)
      const allMatchingPrograms = matchingPrograms
        .filter(m => m.similarity >= 0.4) // Include programs with at least 40% similarity
        .map(m => m.program);
      
      // Add unique program names (avoid duplicates, preserve original casing from database)
      // These program names are the actual values in tbl_alumni.degreetitle
      for (const prog of allMatchingPrograms) {
        const normalized = prog.toLowerCase().trim();
        // Only add if not already in the list (case-insensitive check)
        if (!programNamesToMatch.some(p => p.toLowerCase().trim() === normalized)) {
          programNamesToMatch.push(prog); // Use original casing from database
        }
      }
      
      // If no matching programs found, we still have the assigned program name
      // This ensures we always have at least one program to match against
      
      // Build pattern for flexible matching (extract keywords from assigned program)
      const normalizedPattern = buildProgramMatchPattern(normalizedProgram);
      
      // Build SQL condition that matches any of these program names
      // Create individual conditions for each program variation
      const programConditions: ReturnType<typeof sql>[] = [];
      
      // First, add exact matches for all program variations
      for (const prog of programNamesToMatch) {
        // Exact match (case-insensitive, trimmed) - this is the most reliable
        programConditions.push(
          sql`LOWER(TRIM(degreetitle)) = LOWER(${prog.trim()})`
        );
      }
      
      // Then add pattern-based matching for the assigned program and top matches
      // This catches variations in formatting, spacing, etc.
      const topProgramsForPattern = programNamesToMatch.slice(0, 5); // Limit to top 5 to avoid query complexity
      for (const prog of topProgramsForPattern) {
        const progPattern = buildProgramMatchPattern(prog);
        programConditions.push(
          sql`LOWER(degreetitle) LIKE LOWER(${progPattern})`
        );
      }
      
      // Combine all program conditions with OR using recursive approach
      const combineProgramConditions = (conditions: ReturnType<typeof sql>[]): ReturnType<typeof sql> => {
        if (conditions.length === 0) {
          return sql`LOWER(TRIM(degreetitle)) = LOWER(${normalizedProgram})`;
        }
        if (conditions.length === 1) {
          return conditions[0];
        }
        if (conditions.length === 2) {
          return sql`${conditions[0]} OR ${conditions[1]}`;
        }
        const mid = Math.ceil(conditions.length / 2);
        const left = combineProgramConditions(conditions.slice(0, mid));
        const right = combineProgramConditions(conditions.slice(mid));
        return sql`${left} OR ${right}`;
      };
      
      const programCondition = combineProgramConditions(programConditions);
      
      // Also add the original pattern-based matching as a final fallback
      const finalProgramCondition = sql`(${programCondition} OR LOWER(degreetitle) LIKE LOWER(${normalizedPattern}))`;




      if (matchingPrograms.length > 0) {

      }
      
      const facultyMatch =
        normalizedFaculty
          ? sql`(
              (
                facultyname IS NOT NULL
                AND TRIM(COALESCE(facultyname, '')) != ''
                AND LOWER(TRIM(COALESCE(facultyname, ''))) = LOWER(${normalizedFaculty})
              )
              OR (
                faculty IS NOT NULL
                AND faculty IN (
                  SELECT id
                  FROM public.tbl_faculties
                  WHERE LOWER(TRIM(COALESCE(faculty_name, ''))) = LOWER(${normalizedFaculty})
                )
              )
            )`
          : sql`1 = 1`;

      const departmentMatch =
        normalizedDept
          ? sql`(
              (
                departmentname IS NOT NULL
                AND TRIM(COALESCE(departmentname, '')) != ''
                AND LOWER(TRIM(COALESCE(departmentname, ''))) = LOWER(${normalizedDept})
              )
              OR (
                department IS NOT NULL
                AND department IN (
                  SELECT id
                  FROM public.tbl_departments
                  WHERE LOWER(TRIM(COALESCE(department_name, ''))) = LOWER(${normalizedDept})
                )
              )
            )`
          : sql`1 = 1`;

      const programNamesNormalized = programNamesToMatch.map((p) => p.toLowerCase().trim());
      const programFkMatch =
        programNamesNormalized.length > 0
          ? sql`(
              program IS NOT NULL
              AND program IN (
                SELECT id
                FROM public.tbl_programs
                WHERE LOWER(TRIM(COALESCE(program_name, ''))) = ANY(${programNamesNormalized})
              )
            )`
          : sql`1 = 0`;

      const programTextMatch = sql`(
        degreetitle IS NOT NULL
        AND TRIM(COALESCE(degreetitle, '')) != ''
        AND ${finalProgramCondition}
      )`;

      const programMatch = sql`(${programTextMatch} OR ${programFkMatch})`;

      if (normalizedFaculty && normalizedDept) {
        // All three specified: faculty + department + program
        // Improved matching using program matching utility

        conditionsArray.push(
          sql`(${facultyMatch} AND ${departmentMatch} AND ${programMatch})`
        );
      } else if (normalizedFaculty) {
        // Faculty + program (no department)

        conditionsArray.push(
          sql`(${facultyMatch} AND ${programMatch})`
        );
      } else if (normalizedDept) {
        // Department + program (no faculty)

        conditionsArray.push(
          sql`(${departmentMatch} AND ${programMatch})`
        );
      } else {
        // Program only (no faculty or department)

        conditionsArray.push(
          sql`(${programMatch})`
        );
      }
    }
  }
  
  // Department-level access (case-insensitive comparison with TRIM to handle whitespace)
  if (departmentLevel.length > 0) {

    for (const item of departmentLevel) {
      const itemFaculty = (item.faculty || "").trim().toLowerCase();
      const itemDept = (item.department || "").trim().toLowerCase();
      const deptKey = `${itemFaculty}|${itemDept}`;
      
      // Only add if not already covered by a program-level assignment
      // If program-level assignments exist for this department, skip department-level access
      // This ensures program-level filtering is strict - users only see their assigned programs
      const hasProgramAccess = departmentsWithProgramAssignments.has(deptKey);
      
      if (!hasProgramAccess) {
        const normalizedFaculty = (item.faculty || "").trim();
        const normalizedDept = (item.department || "").trim();
        if (normalizedFaculty && normalizedDept) {

          const facultyMatch = sql`(
            (
              facultyname IS NOT NULL
              AND TRIM(COALESCE(facultyname, '')) != ''
              AND LOWER(TRIM(COALESCE(facultyname, ''))) = LOWER(${normalizedFaculty})
            )
            OR (
              faculty IS NOT NULL
              AND faculty IN (
                SELECT id
                FROM public.tbl_faculties
                WHERE LOWER(TRIM(COALESCE(faculty_name, ''))) = LOWER(${normalizedFaculty})
              )
            )
          )`;

          const departmentMatch = sql`(
            (
              departmentname IS NOT NULL
              AND TRIM(COALESCE(departmentname, '')) != ''
              AND LOWER(TRIM(COALESCE(departmentname, ''))) = LOWER(${normalizedDept})
            )
            OR (
              department IS NOT NULL
              AND department IN (
                SELECT id
                FROM public.tbl_departments
                WHERE LOWER(TRIM(COALESCE(department_name, ''))) = LOWER(${normalizedDept})
              )
            )
          )`;

          conditionsArray.push(
            sql`(${facultyMatch} AND ${departmentMatch})`
          );
        }
      } else {

    }
  }
  }
  
  // REMOVED: Department-level fallback for program assignments
  // When a specific program is selected, users should ONLY see that program (and its variations)
  // The improved program matching logic should handle variations in program names
  // If program names don't match, it's better to show no data than to show all programs in the department
  // This ensures strict program-level access control
  
  // Faculty-level access (case-insensitive comparison with TRIM to handle whitespace)
  if (facultyOnly.length > 0) {
    // Only add if not already covered by department/program assignments
    const coveredFaculties = new Set([
      ...departmentLevel.map(d => d.faculty.toLowerCase()),
      ...programLevel.map(p => p.faculty.toLowerCase()),
    ]);
    
    const uncoveredFaculties = facultyOnly.filter(f => !coveredFaculties.has(f.toLowerCase()));
    if (uncoveredFaculties.length > 0) {
      for (const faculty of uncoveredFaculties) {
        // Normalize the faculty name for comparison (trim and lowercase)
        const normalizedFaculty = (faculty || "").trim();
        if (normalizedFaculty) {
          const facultyMatch = sql`(
            (
              facultyname IS NOT NULL
              AND TRIM(COALESCE(facultyname, '')) != ''
              AND LOWER(TRIM(COALESCE(facultyname, ''))) = LOWER(${normalizedFaculty})
            )
            OR (
              faculty IS NOT NULL
              AND faculty IN (
                SELECT id
                FROM public.tbl_faculties
                WHERE LOWER(TRIM(COALESCE(faculty_name, ''))) = LOWER(${normalizedFaculty})
              )
            )
          )`;
          conditionsArray.push(sql`(${facultyMatch})`);
        }
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
  // All conditions in conditionsArray are wrapped in parentheses
  // Build the OR chain using a binary tree approach to minimize nesting depth
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const combineOrConditions = (conditions: any[]): any => {
    if (conditions.length === 0) return sql`1 = 0`; // No access
    if (conditions.length === 1) return conditions[0];
    if (conditions.length === 2) return sql`${conditions[0]} OR ${conditions[1]}`;
    
    // Split in half and combine recursively - this creates a binary tree
    // reducing max nesting depth from N to log2(N)
    const mid = Math.ceil(conditions.length / 2);
    const left = combineOrConditions(conditions.slice(0, mid));
    const right = combineOrConditions(conditions.slice(mid));
    return sql`${left} OR ${right}`;
  };
  
  const combinedCondition = combineOrConditions(conditionsArray);

  return { sql: combinedCondition, hasFilter: true };
}
