import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL, getUserIdFromSession, getUserAccessAssignments } from "@/lib/userAccess";

/**
 * Test the access filter SQL directly and show what records it would match
 */
export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = getUserIdFromSession(session);
    const assignments = userId ? await getUserAccessAssignments(userId) : [];
    const accessFilter = await buildAccessFilterSQL(session, "");

    // Build a test query
    let testQueryResult: {
      count?: number;
      success: boolean;
      error?: string;
    } | null = null;
    let rawSql = "N/A";
    
    if (accessFilter.hasFilter && accessFilter.sql) {
      try {
        // Test the filter with a simple count query
        const testQuery = sql/* sql */`
          SELECT COUNT(*) as count
          FROM public.tbl_alumni
          WHERE (sapid IS NOT NULL AND sapid != '' OR registrationno IS NOT NULL AND registrationno != '')
            AND ${accessFilter.sql}
          LIMIT 1
        `;
        
        // Try to get the SQL string representation (if possible)
        try {
          rawSql = String(testQuery);
        } catch {
          rawSql = "SQL template literal (cannot stringify)";
        }
        
        const result = await testQuery;
        testQueryResult = {
          count: Number(result[0]?.count || 0),
          success: true
        };
      } catch (err) {
        testQueryResult = {
          error: err instanceof Error ? err.message : String(err),
          success: false
        };
      }
    }

    // Also test each assignment individually (department-level and program-level)
    const individualTests: Array<{
      faculty?: string;
      department?: string | null;
      program?: string | null;
      level: string;
      count?: number;
      error?: string;
      success: boolean;
    }> = [];
    for (const assignment of assignments) {
      if (assignment.faculty_name) {
        try {
          let testQuery;
          if (assignment.program_name && assignment.department_name) {
            // Program-level assignment
            testQuery = sql/* sql */`
              SELECT COUNT(*) as count
              FROM public.tbl_alumni
              WHERE (sapid IS NOT NULL AND sapid != '' OR registrationno IS NOT NULL AND registrationno != '')
                AND facultyname IS NOT NULL AND TRIM(facultyname) != ''
                AND LOWER(TRIM(facultyname)) = LOWER(${assignment.faculty_name})
                AND departmentname IS NOT NULL AND TRIM(departmentname) != ''
                AND LOWER(TRIM(departmentname)) = LOWER(${assignment.department_name})
                AND degreetitle IS NOT NULL AND TRIM(degreetitle) != ''
                AND LOWER(TRIM(degreetitle)) = LOWER(${assignment.program_name})
              LIMIT 1
            `;
          } else if (assignment.department_name) {
            // Department-level assignment
            testQuery = sql/* sql */`
              SELECT COUNT(*) as count
              FROM public.tbl_alumni
              WHERE (sapid IS NOT NULL AND sapid != '' OR registrationno IS NOT NULL AND registrationno != '')
                AND facultyname IS NOT NULL AND TRIM(facultyname) != ''
                AND LOWER(TRIM(facultyname)) = LOWER(${assignment.faculty_name})
                AND departmentname IS NOT NULL AND TRIM(departmentname) != ''
                AND LOWER(TRIM(departmentname)) = LOWER(${assignment.department_name})
              LIMIT 1
            `;
          } else {
            // Faculty-level assignment
            testQuery = sql/* sql */`
              SELECT COUNT(*) as count
              FROM public.tbl_alumni
              WHERE (sapid IS NOT NULL AND sapid != '' OR registrationno IS NOT NULL AND registrationno != '')
                AND facultyname IS NOT NULL AND TRIM(facultyname) != ''
                AND LOWER(TRIM(facultyname)) = LOWER(${assignment.faculty_name})
              LIMIT 1
            `;
          }
          
          const result = await testQuery;
          individualTests.push({
            faculty: assignment.faculty_name,
            department: assignment.department_name,
            program: assignment.program_name,
            level: assignment.program_name ? "program" : (assignment.department_name ? "department" : "faculty"),
            count: Number(result[0]?.count || 0),
            success: true
          });
        } catch (err) {
          individualTests.push({
            faculty: assignment.faculty_name,
            department: assignment.department_name,
            program: assignment.program_name,
            level: assignment.program_name ? "program" : (assignment.department_name ? "department" : "faculty"),
            error: err instanceof Error ? err.message : String(err),
            success: false
          });
        }
      }
    }

    // Check what departments actually exist for the assigned faculty
    const facultyNames = Array.from(new Set(assignments.map(a => a.faculty_name).filter(Boolean)));
    const actualDepartments: Array<{
      faculty: string;
      departments?: Array<{ name: string; normalized: string; count: number }>;
      error?: string;
    }> = [];
    
    for (const faculty of facultyNames) {
      if (faculty) {
        try {
          const depts = await sql/* sql */`
            SELECT DISTINCT 
              departmentname,
              COUNT(*) as count
            FROM public.tbl_alumni
            WHERE LOWER(TRIM(COALESCE(facultyname, ''))) = LOWER(TRIM(${faculty}))
              AND departmentname IS NOT NULL 
              AND TRIM(departmentname) != ''
            GROUP BY departmentname
            ORDER BY count DESC
            LIMIT 20
          `;
          actualDepartments.push({
            faculty: faculty,
            departments: depts.map((d) => {
              const dept = d as { departmentname: string | null; count: number | null };
              return {
                name: dept.departmentname || "",
                normalized: dept.departmentname?.toLowerCase().trim() || "",
                count: Number(dept.count || 0)
              };
            })
          });
        } catch (err) {
          actualDepartments.push({
            faculty: faculty,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
    }

    return NextResponse.json({
      user: {
        userId: userId,
        email: session.user.email,
        type: (session.user as { type?: string })?.type
      },
      assignments: assignments.map(a => ({
        faculty_name: a.faculty_name,
        department_name: a.department_name,
        program_name: a.program_name
      })),
      accessFilter: {
        hasFilter: accessFilter.hasFilter,
        rawSql: rawSql
      },
      testQueryResult: testQueryResult,
      individualTests: individualTests,
      actualDepartments: actualDepartments,
      analysis: {
        totalAssignments: assignments.length,
        departmentLevelAssignments: assignments.filter(a => a.department_name && !a.program_name).length,
        programLevelAssignments: assignments.filter(a => a.program_name).length,
        facultyLevelAssignments: assignments.filter(a => a.faculty_name && !a.department_name && !a.program_name).length
      }
    }, { status: 200 });

  } catch (err) {
    console.error("[API] Error testing access filter:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

