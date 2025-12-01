import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/alumniProfile";

/**
 * Check what departments actually exist in the database for a given faculty
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden - Super Admin only" }, { status: 403 });
    }

    const url = new URL(req.url);
    const faculty = url.searchParams.get("faculty") || "Faculty of Allied Health Sciences";

    // Get all departments for this faculty
    const departments = await sql/* sql */`
      SELECT DISTINCT 
        departmentname,
        COUNT(*) as count
      FROM public.tbl_alumni
      WHERE LOWER(TRIM(COALESCE(facultyname, ''))) = LOWER(TRIM(${faculty}))
        AND departmentname IS NOT NULL 
        AND TRIM(departmentname) != ''
      GROUP BY departmentname
      ORDER BY count DESC;
    `;

    // Also check what the assignment expects
    const assignments = await sql/* sql */`
      SELECT DISTINCT 
        faculty_name,
        department_name,
        program_name
      FROM public.user_access_assignments
      WHERE LOWER(TRIM(COALESCE(faculty_name, ''))) = LOWER(TRIM(${faculty}))
      ORDER BY department_name;
    `;

    // Check for potential matches (case-insensitive)
    type Assignment = { department_name: string | null; [key: string]: unknown };
    type Department = { departmentname: string | null; count?: number | string | null; [key: string]: unknown };
    
    const departmentMatches = assignments
      .filter((a) => {
        const assignment = a as Assignment;
        return assignment.department_name;
      })
      .map((assignment) => {
        const a = assignment as Assignment;
        let dbMatch: Department | undefined;
        
        for (const d of departments) {
          const dept = d as Department;
          if (dept.departmentname && a.department_name) {
            if (dept.departmentname.toLowerCase().trim() === a.department_name.toLowerCase().trim()) {
              dbMatch = dept;
              break;
            }
          }
        }
        
        return {
          assignment: a.department_name,
          dbMatch: dbMatch ? dbMatch.departmentname : null,
          count: dbMatch ? Number(dbMatch.count || 0) : 0,
          matched: !!dbMatch
        };
      });

    return NextResponse.json({
      faculty: faculty,
      databaseDepartments: departments.map((d) => {
        const dept = d as { departmentname: string | null; count: number | string | null };
        return {
          name: dept.departmentname,
          normalized: dept.departmentname?.toLowerCase().trim() || "",
          count: Number(dept.count || 0)
        };
      }),
      assignments: assignments.map((a) => {
        const assignment = a as { faculty_name: string | null; department_name: string | null; program_name: string | null };
        return {
          faculty_name: assignment.faculty_name,
          department_name: assignment.department_name,
          program_name: assignment.program_name
        };
      }),
      departmentMatches: departmentMatches,
      summary: {
        totalDbDepartments: departments.length,
        totalAssignments: assignments.length,
        matchedDepartments: departmentMatches.filter(m => m.matched).length,
        totalAlumniCount: departments.reduce((sum: number, d) => {
          const dept = d as { count: number | string | null };
          return sum + Number(dept.count || 0);
        }, 0)
      }
    }, { status: 200 });

  } catch (err) {
    console.error("[API] Error checking departments:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
