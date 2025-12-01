import { sql } from "@/lib/dbconnect";
import type { Session } from "next-auth";
import { isSuperAdminUser } from "./alumniProfile";

export type UserAccessAssignment = {
  faculty_name: string | null;
  department_name: string | null;
  program_name: string | null;
};

/**
 * Fetch user access assignments from database
 */
export async function getUserAccessAssignments(userId: number): Promise<UserAccessAssignment[]> {
  try {
    const rows = await sql/* sql */`
      SELECT faculty_name, department_name, program_name
      FROM public.user_access_assignments
      WHERE userid = ${userId}
    ` as Array<UserAccessAssignment>;
    return rows || [];
  } catch (error) {
    console.error("Failed to fetch user access assignments:", error);
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
 * Returns { sql: null, hasFilter: false } if user is superadmin (no filtering needed)
 * Returns { sql: SQL condition, hasFilter: true } for admin/viewer with access assignments
 * Returns { sql: SQL condition (1=0), hasFilter: true } if no access
 */
export async function buildAccessFilterSQL(
  session: Session | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _tableAlias: string = ""
): Promise<{ sql: ReturnType<typeof sql> | null; hasFilter: boolean }> {
  // Super admin has full access - no filtering
  if (isSuperAdminUser(session?.user)) {
    return { sql: null, hasFilter: false };
  }

  // Get user ID
  const userId = getUserIdFromSession(session);
  if (!userId) {
    // If no user ID, return condition that always fails (no access)
    return { sql: sql`1 = 0`, hasFilter: true };
  }

  // Fetch access assignments
  const assignments = await getUserAccessAssignments(userId);
  
  // Debug logging - detailed
  console.log("[buildAccessFilterSQL] ========== ACCESS FILTER DEBUG ==========");
  console.log("[buildAccessFilterSQL] User ID:", userId);
  console.log("[buildAccessFilterSQL] Session user:", session?.user ? {
    email: session.user.email,
    userId: (session.user as { userId?: number })?.userId,
    type: (session.user as { type?: string })?.type
  } : "No session");
  console.log("[buildAccessFilterSQL] Assignments count:", assignments.length);
  console.log("[buildAccessFilterSQL] Assignments:", JSON.stringify(assignments, null, 2));
  
  // If no assignments, user has no access
  if (assignments.length === 0) {
    // For admin/viewer without assignments, block access
    console.log("[buildAccessFilterSQL] ⚠️ No assignments found - blocking access (returning 1=0)");
    console.log("[buildAccessFilterSQL] ============================================");
    return { sql: sql`1 = 0`, hasFilter: true };
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
  // Track which departments have program-level assignments (for fallback to department-level if no matches)
  const departmentsWithProgramAssignments = new Set<string>();
  
  if (programLevel.length > 0) {
    console.log("[buildAccessFilterSQL] 🔍 Processing program-level assignments:", programLevel.length);
    for (const item of programLevel) {
      const normalizedFaculty = (item.faculty || "").trim();
      const normalizedDept = (item.department || "").trim();
      const normalizedProgram = (item.program || "").trim();
      
      // Track this department for potential fallback
      if (normalizedDept) {
        departmentsWithProgramAssignments.add(`${normalizedFaculty.toLowerCase()}|${normalizedDept.toLowerCase()}`);
      }
      
      console.log("[buildAccessFilterSQL]   Program assignment:", {
        faculty: normalizedFaculty || "(none)",
        department: normalizedDept || "(none)",
        program: normalizedProgram || "(none)"
      });
      
      if (!normalizedProgram) {
        console.log("[buildAccessFilterSQL]   ⚠️ Skipping - program name is empty");
        continue; // Skip if program is empty
      }
      
      // Build condition based on what's specified
      // Use more flexible matching: try exact match first, but also check if program name is contained in degreetitle
      // This handles cases where degreetitle might be "BS in Cardiac Perfusion Technology" vs assignment "BS Cardiac Perfusion Technology"
      // Create a pattern that matches the program name with optional words in between (like "in", "of", etc.)
      // Use a simpler approach: match if the program name (all words) appears in the degreetitle
      // This handles cases like "BS Cardiac Perfusion Technology" matching "BS in Cardiac Perfusion Technology"
      const programWords = normalizedProgram.split(/\s+/).filter(w => w.length > 0 && w.length > 1); // Filter out single character words
      // Build pattern: each word must appear, but allow any characters between them
      const programPattern = programWords.length > 0 
        ? `%${programWords.join('%')}%` // Match all words in sequence with any characters in between
        : `%${normalizedProgram}%`;
      
      if (normalizedFaculty && normalizedDept) {
        // All three specified: faculty + department + program
        // Strict matching: exact match OR word-based pattern (handles "BS in X" vs "BS X")
        console.log("[buildAccessFilterSQL]   ✅ Adding condition: faculty + department + program (strict matching)");
        console.log("[buildAccessFilterSQL]     Program:", normalizedProgram);
        console.log("[buildAccessFilterSQL]     Pattern:", programPattern);
        conditionsArray.push(
          sql`(facultyname IS NOT NULL AND TRIM(facultyname) != '' AND LOWER(TRIM(facultyname)) = LOWER(${normalizedFaculty}) AND departmentname IS NOT NULL AND TRIM(departmentname) != '' AND LOWER(TRIM(departmentname)) = LOWER(${normalizedDept}) AND degreetitle IS NOT NULL AND TRIM(degreetitle) != '' AND (LOWER(TRIM(degreetitle)) = LOWER(${normalizedProgram}) OR LOWER(degreetitle) LIKE LOWER(${programPattern})))`
        );
      } else if (normalizedFaculty) {
        // Faculty + program (no department)
        console.log("[buildAccessFilterSQL]   ✅ Adding condition: faculty + program (strict matching)");
        console.log("[buildAccessFilterSQL]     Program:", normalizedProgram);
        console.log("[buildAccessFilterSQL]     Pattern:", programPattern);
        conditionsArray.push(
          sql`(facultyname IS NOT NULL AND TRIM(facultyname) != '' AND LOWER(TRIM(facultyname)) = LOWER(${normalizedFaculty}) AND degreetitle IS NOT NULL AND TRIM(degreetitle) != '' AND (LOWER(TRIM(degreetitle)) = LOWER(${normalizedProgram}) OR LOWER(degreetitle) LIKE LOWER(${programPattern})))`
        );
      } else if (normalizedDept) {
        // Department + program (no faculty)
        console.log("[buildAccessFilterSQL]   ✅ Adding condition: department + program (strict matching)");
        console.log("[buildAccessFilterSQL]     Program:", normalizedProgram);
        console.log("[buildAccessFilterSQL]     Pattern:", programPattern);
        conditionsArray.push(
          sql`(departmentname IS NOT NULL AND TRIM(departmentname) != '' AND LOWER(TRIM(departmentname)) = LOWER(${normalizedDept}) AND degreetitle IS NOT NULL AND TRIM(degreetitle) != '' AND (LOWER(TRIM(degreetitle)) = LOWER(${normalizedProgram}) OR LOWER(degreetitle) LIKE LOWER(${programPattern})))`
        );
      } else {
        // Program only (no faculty or department)
        console.log("[buildAccessFilterSQL]   ✅ Adding condition: program only (strict matching)");
        console.log("[buildAccessFilterSQL]     Program:", normalizedProgram);
        console.log("[buildAccessFilterSQL]     Pattern:", programPattern);
        conditionsArray.push(
          sql`(degreetitle IS NOT NULL AND TRIM(degreetitle) != '' AND (LOWER(TRIM(degreetitle)) = LOWER(${normalizedProgram}) OR LOWER(degreetitle) LIKE LOWER(${programPattern})))`
        );
      }
    }
  }
  
  // Department-level access (case-insensitive comparison with TRIM to handle whitespace)
  if (departmentLevel.length > 0) {
    console.log("[buildAccessFilterSQL] 🔍 Processing department-level assignments:", departmentLevel.length);
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
          console.log("[buildAccessFilterSQL]   ✅ Adding condition: department-level", {
            faculty: normalizedFaculty,
            department: normalizedDept
          });
          conditionsArray.push(
            sql`(facultyname IS NOT NULL AND TRIM(facultyname) != '' AND LOWER(TRIM(facultyname)) = LOWER(${normalizedFaculty}) AND departmentname IS NOT NULL AND TRIM(departmentname) != '' AND LOWER(TRIM(departmentname)) = LOWER(${normalizedDept}))`
          );
        }
      } else {
        console.log("[buildAccessFilterSQL]   ⚠️ Department assignment skipped - program-level assignments exist for this department");
      }
    }
  }
  
  // IMPORTANT: Add department-level fallback ONLY for departments with program assignments
  // This handles cases where program names in assignments don't match database values exactly
  // The fallback ensures users can still see alumni from their assigned departments
  // But it's added as a separate OR condition, so program-level matches take precedence when they work
  if (programLevel.length > 0) {
    console.log("[buildAccessFilterSQL] 🔄 Adding department-level fallback for program assignments");
    console.log("[buildAccessFilterSQL]   This ensures access even if program names don't match exactly");
    
    // Group program assignments by department (faculty + department combination)
    const deptGroups = new Map<string, { faculty: string; department: string }>();
    const facultyGroups = new Set<string>();
    
    for (const item of programLevel) {
      const normalizedFaculty = (item.faculty || "").trim();
      const normalizedDept = (item.department || "").trim();
      
      if (normalizedFaculty && normalizedDept) {
        // Faculty + Department + Program
        const deptKey = `${normalizedFaculty.toLowerCase()}|${normalizedDept.toLowerCase()}`;
        if (!deptGroups.has(deptKey)) {
          deptGroups.set(deptKey, { faculty: normalizedFaculty, department: normalizedDept });
        }
      } else if (normalizedFaculty && !normalizedDept) {
        // Faculty + Program (no department)
        facultyGroups.add(normalizedFaculty.toLowerCase());
      }
    }
    
    // Add department-level conditions as fallback for each unique department
    // This allows users to see all programs in the department if specific program names don't match
    for (const [, { faculty, department }] of deptGroups.entries()) {
      // Check if this department-level condition already exists (from departmentLevel assignments)
      const alreadyExists = departmentLevel.some(d => {
        const dFaculty = (d.faculty || "").trim().toLowerCase();
        const dDept = (d.department || "").trim().toLowerCase();
        return dFaculty === faculty.toLowerCase() && dDept === department.toLowerCase();
      });
      
      if (!alreadyExists) {
        console.log("[buildAccessFilterSQL]   ✅ Adding fallback: department-level access", {
          faculty,
          department,
          reason: "Program names may not match exactly - fallback ensures access to department"
        });
        conditionsArray.push(
          sql`(facultyname IS NOT NULL AND TRIM(facultyname) != '' AND LOWER(TRIM(facultyname)) = LOWER(${faculty}) AND departmentname IS NOT NULL AND TRIM(departmentname) != '' AND LOWER(TRIM(departmentname)) = LOWER(${department}))`
        );
      } else {
        console.log("[buildAccessFilterSQL]   ⏭️ Skipping fallback - department-level access already exists", {
          faculty,
          department
        });
      }
    }
    
    // Add faculty-level fallback for program + faculty assignments (no department)
    for (const facultyLower of facultyGroups) {
      // Find the original faculty name from programLevel
      const originalFaculty = programLevel.find(p => 
        (p.faculty || "").trim().toLowerCase() === facultyLower && !p.department
      )?.faculty;
      
      if (originalFaculty) {
        const normalizedFaculty = originalFaculty.trim();
        const alreadyExists = facultyOnly.some(f => f.toLowerCase() === normalizedFaculty.toLowerCase());
        if (!alreadyExists) {
          console.log("[buildAccessFilterSQL]   ✅ Adding fallback: faculty-level access", {
            faculty: normalizedFaculty
          });
          conditionsArray.push(
            sql`(facultyname IS NOT NULL AND TRIM(facultyname) != '' AND LOWER(TRIM(facultyname)) = LOWER(${normalizedFaculty}))`
          );
        }
      }
    }
  }
  
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
          // Wrap in parentheses to match other condition formats
          conditionsArray.push(sql`(facultyname IS NOT NULL AND TRIM(facultyname) != '' AND LOWER(TRIM(facultyname)) = LOWER(${normalizedFaculty}))`);
        }
      }
    }
  }

  if (conditionsArray.length === 0) {
    // No valid conditions - return condition that always fails (no access)
    return { sql: sql`1 = 0`, hasFilter: true };
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

  console.log("[buildAccessFilterSQL] Generated filter conditions:", {
    facultyOnly: facultyOnly.length,
    departmentLevel: departmentLevel.length,
    programLevel: programLevel.length,
    totalConditions: conditionsArray.length
  });
  
  if (facultyOnly.length > 0) {
    console.log("[buildAccessFilterSQL] 📋 Faculty names:", facultyOnly.slice(0, 3).map(f => `"${f}"`));
  }
  if (departmentLevel.length > 0) {
    console.log("[buildAccessFilterSQL] 📋 Sample departments:", departmentLevel.slice(0, 2).map(d => `${d.faculty || "(no faculty)"} - ${d.department}`));
  }
  if (programLevel.length > 0) {
    console.log("[buildAccessFilterSQL] 📋 Sample programs:", programLevel.slice(0, 5).map(p => {
      const parts = [];
      if (p.faculty) parts.push(`Faculty: "${p.faculty}"`);
      if (p.department) parts.push(`Dept: "${p.department}"`);
      parts.push(`Program: "${p.program}"`);
      return parts.join(", ");
    }));
  }
  
  console.log("[buildAccessFilterSQL] ✅ Returning filter with", conditionsArray.length, "condition(s)");
  console.log("[buildAccessFilterSQL] ============================================");

  return { sql: combinedCondition, hasFilter: true };
}
