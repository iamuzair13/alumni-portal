import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL, getUserIdFromSession, getUserAccessAssignments } from "@/lib/userAccess";
import { isSuperAdminUser } from "@/lib/alumniProfile";

export async function GET() {
  try {
    const session = await auth();
    const userId = getUserIdFromSession(session);
    const isSuperAdmin = isSuperAdminUser(session?.user);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized", userId: null }, { status: 401 });
    }

    const assignments = userId ? await getUserAccessAssignments(userId) : [];
    const accessFilter = await buildAccessFilterSQL(session, "");

    // Fetch sample data from tbl_alumni for comparison
    const alumniSamples = await sql/* sql */`
      SELECT DISTINCT 
        facultyname, 
        departmentname, 
        degreetitle,
        COUNT(*) as count
      FROM public.tbl_alumni
      WHERE (facultyname IS NOT NULL AND TRIM(facultyname) != '' 
             OR departmentname IS NOT NULL AND TRIM(departmentname) != ''
             OR degreetitle IS NOT NULL AND TRIM(degreetitle) != '')
      GROUP BY facultyname, departmentname, degreetitle
      ORDER BY count DESC
      LIMIT 50;
    `;

    // Organize samples
    const facultyMap = new Map<string, number>();
    const departmentMap = new Map<string, number>();
    const programMap = new Map<string, number>();

    alumniSamples.forEach((row) => {
      const r = row as {
      facultyname: string | null;
      departmentname: string | null;
      degreetitle: string | null;
      count: number | string;
      };
      if (r.facultyname) {
        const normalized = r.facultyname.trim().toLowerCase();
        facultyMap.set(normalized, (facultyMap.get(normalized) || 0) + Number(r.count || 0));
      }
      if (r.departmentname) {
        const normalized = r.departmentname.trim().toLowerCase();
        departmentMap.set(normalized, (departmentMap.get(normalized) || 0) + Number(r.count || 0));
      }
      if (r.degreetitle) {
        const normalized = r.degreetitle.trim().toLowerCase();
        programMap.set(normalized, (programMap.get(normalized) || 0) + Number(r.count || 0));
      }
    });

    // Check for matches
    const assignmentFaculties = assignments.filter(a => a.faculty_name).map(a => ({
      original: a.faculty_name,
      normalized: a.faculty_name?.trim().toLowerCase(),
      match: a.faculty_name ? facultyMap.has(a.faculty_name.trim().toLowerCase()) : false,
      dbCount: a.faculty_name ? facultyMap.get(a.faculty_name.trim().toLowerCase()) : 0
    }));

    const assignmentDepartments = assignments.filter(a => a.department_name).map(a => ({
      original: a.department_name,
      normalized: a.department_name?.trim().toLowerCase(),
      match: a.department_name ? departmentMap.has(a.department_name.trim().toLowerCase()) : false,
      dbCount: a.department_name ? departmentMap.get(a.department_name.trim().toLowerCase()) : 0
    }));

    // Test the filter with a sample query
    let testQueryResult = null;
    try {
      const testQuery = accessFilter.hasFilter && accessFilter.sql
        ? sql/* sql */`
            SELECT COUNT(*) as count
            FROM public.tbl_alumni
            WHERE (sapid IS NOT NULL AND sapid != '' OR registrationno IS NOT NULL AND registrationno != '')
              AND ${accessFilter.sql}
            LIMIT 1
          `
        : null;
      
      if (testQuery) {
        const result = await testQuery;
        testQueryResult = {
          count: Number(result[0]?.count || 0),
          success: true
        };
      }
    } catch (err) {
      testQueryResult = {
        error: err instanceof Error ? err.message : String(err),
        success: false
      };
    }

    return NextResponse.json({
      user: {
        email: session.user.email,
        userId: userId,
        type: (session.user as { type?: string })?.type,
        isSuperAdmin: isSuperAdmin,
      },
      accessAssignments: {
        total: assignments.length,
        assignments: assignments.map(a => ({
          faculty_name: a.faculty_name,
          department_name: a.department_name,
          program_name: a.program_name,
        }))
      },
      accessFilter: {
        hasFilter: accessFilter.hasFilter,
        isSuperAdmin: !accessFilter.hasFilter
      },
      databaseSamples: {
        faculties: Array.from(facultyMap.entries()).slice(0, 20).map(([key, count]) => ({
          normalized: key,
          count: count
        })),
        departments: Array.from(departmentMap.entries()).slice(0, 20).map(([key, count]) => ({
          normalized: key,
          count: count
        })),
        programs: Array.from(programMap.entries()).slice(0, 20).map(([key, count]) => ({
          normalized: key,
          count: count
        }))
      },
      matchingAnalysis: {
        faculties: assignmentFaculties,
        departments: assignmentDepartments,
        summary: {
          totalFaculties: assignmentFaculties.length,
          matchedFaculties: assignmentFaculties.filter(f => f.match).length,
          totalDepartments: assignmentDepartments.length,
          matchedDepartments: assignmentDepartments.filter(d => d.match).length
        }
      },
      testQuery: testQueryResult,
      debugInfo: "Compare 'assignmentFaculties' and 'assignmentDepartments' with 'databaseSamples' to find mismatches. 'testQuery' shows if the filter works."
    }, { status: 200 });

  } catch (err) {

    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

