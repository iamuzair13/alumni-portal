import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/alumniProfile";

/**
 * Check for mismatches between programs-departments.ts and database
 */
export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden - Super Admin only" }, { status: 403 });
    }

    // Get all unique faculty names from database
    const dbFaculties = await sql/* sql */`
      SELECT DISTINCT 
        facultyname,
        COUNT(*) as count
      FROM public.tbl_alumni
      WHERE facultyname IS NOT NULL AND TRIM(facultyname) != ''
      GROUP BY facultyname
      ORDER BY count DESC;
    `;

    // Get all assignments that might have issues
    const allAssignments = await sql/* sql */`
      SELECT DISTINCT 
        faculty_name,
        COUNT(*) as assignment_count
      FROM public.user_access_assignments
      WHERE faculty_name IS NOT NULL
      GROUP BY faculty_name
      ORDER BY assignment_count DESC;
    `;

    // Known issues from programs-departments.ts
    const knownIssues = [
      { wrong: "FIT", correct: "Faculty of Information Technology" },
      { wrong: "Faculty of language and literature", correct: "Faculty of Languages & Literature" },
      { wrong: "Faculty of Mangement sciences", correct: "Faculty of Management Sciences" },
      { wrong: "Faculty of medicine and Dentistry", correct: "Faculty of Medicine & Dentistry" },
      { wrong: "Faculty of Alllied health sciences", correct: "Faculty of Allied Health Sciences" },
    ];

    // Check which assignments have wrong names
    const assignmentsToFix: Array<{
      wrong: string;
      correct: string;
      assignments: Array<{ faculty_name: string; assignment_count: number }>;
      totalAssignments: number;
    }> = [];
    for (const issue of knownIssues) {
      const matching = allAssignments.filter((a) => {
        const assignment = a as { faculty_name: string | null; assignment_count: number };
        return assignment.faculty_name && (
          assignment.faculty_name === issue.wrong ||
          assignment.faculty_name.toLowerCase() === issue.wrong.toLowerCase()
        );
      }) as Array<{ faculty_name: string; assignment_count: number }>;
      if (matching.length > 0) {
        assignmentsToFix.push({
          ...issue,
          assignments: matching,
          totalAssignments: matching.reduce((sum: number, a: { assignment_count: number }) => sum + Number(a.assignment_count || 0), 0)
        });
      }
    }

    // Normalize database faculty names for comparison
    const normalizedDbFaculties = dbFaculties.map((f) => {
      const faculty = f as { facultyname: string | null; count: number | string | null };
      return {
        original: faculty.facultyname || "",
        normalized: faculty.facultyname?.trim().toLowerCase() || "",
        count: Number(faculty.count || 0)
      };
    });

    return NextResponse.json({
      databaseFaculties: normalizedDbFaculties.slice(0, 20),
      currentAssignments: allAssignments,
      knownIssues: knownIssues,
      assignmentsNeedingFix: assignmentsToFix,
      summary: {
        totalDbFaculties: dbFaculties.length,
        totalAssignments: allAssignments.length,
        assignmentsWithIssues: assignmentsToFix.reduce((sum, item) => sum + item.totalAssignments, 0)
      }
    }, { status: 200 });

  } catch (err) {
    console.error("[API] Error checking faculty mismatches:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

