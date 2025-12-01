import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/alumniProfile";

/**
 * One-time fix endpoint to update all access assignments with the typo
 * "Faculty of Alllied health sciences" → "Faculty of Allied Health Sciences"
 * 
 * This should be run once after fixing the typo in programs-departments.ts
 */
export async function POST() {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden - Super Admin only" }, { status: 403 });
    }

    // All known faculty name corrections
    const corrections = [
      { wrong: "Faculty of Alllied health sciences", correct: "Faculty of Allied Health Sciences" },
      { wrong: "FIT", correct: "Faculty of Information Technology" },
      { wrong: "Faculty of language and literature", correct: "Faculty of Languages & Literature" },
      { wrong: "Faculty of Mangement sciences", correct: "Faculty of Management Sciences" },
      { wrong: "Faculty of medicine and Dentistry", correct: "Faculty of Medicine & Dentistry" },
    ];

    // Apply all corrections (case-insensitive match)
    const allUpdated: Array<{
      id: number;
      userid: number;
      faculty_name: string | null;
      department_name: string | null;
      program_name: string | null;
    }> = [];
    const correctionCounts: Map<string, number> = new Map();
    
    for (const correction of corrections) {
      const result = await sql/* sql */`
        UPDATE public.user_access_assignments
        SET faculty_name = ${correction.correct}
        WHERE LOWER(TRIM(COALESCE(faculty_name, ''))) = LOWER(TRIM(${correction.wrong}))
          AND faculty_name != ${correction.correct}
        RETURNING id, userid, faculty_name, department_name, program_name;
      `;
      
      if (result && result.length > 0) {
        const typedResult = result as unknown as Array<{
          id: number;
          userid: number;
          faculty_name: string | null;
          department_name: string | null;
          program_name: string | null;
        }>;
        allUpdated.push(...typedResult);
        correctionCounts.set(correction.wrong, typedResult.length);
      } else {
        correctionCounts.set(correction.wrong, 0);
      }
    }

    // Remove duplicates based on ID (in case any were updated multiple times)
    const uniqueUpdated = Array.from(
      new Map(allUpdated.map((item) => [item.id, item])).values()
    );

    return NextResponse.json({
      success: true,
      message: `Updated ${uniqueUpdated.length} access assignment(s)`,
      updated: uniqueUpdated,
      details: {
        totalUnique: uniqueUpdated.length,
        corrections: corrections.map(c => ({
          from: c.wrong,
          to: c.correct,
          updated: correctionCounts.get(c.wrong) || 0
        }))
      }
    }, { status: 200 });

  } catch (err) {
    console.error("[API] Error fixing access assignments:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ 
      error: message,
      success: false 
    }, { status: 500 });
  }
}

/**
 * GET endpoint to preview what will be updated
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

    // All known faculty name corrections
    const corrections = [
      { wrong: "Faculty of Alllied health sciences", correct: "Faculty of Allied Health Sciences" },
      { wrong: "FIT", correct: "Faculty of Information Technology" },
      { wrong: "Faculty of language and literature", correct: "Faculty of Languages & Literature" },
      { wrong: "Faculty of Mangement sciences", correct: "Faculty of Management Sciences" },
      { wrong: "Faculty of medicine and Dentistry", correct: "Faculty of Medicine & Dentistry" },
    ];

    // Find all assignments that need fixing
    const allAssignments = await sql/* sql */`
      SELECT id, userid, faculty_name, department_name, program_name
      FROM public.user_access_assignments
      WHERE faculty_name IS NOT NULL
      ORDER BY userid, id;
    `;

    // Filter assignments that match any of the wrong names
    const assignmentsToFix: Array<{
      id: number;
      userid: number;
      faculty_name: string | null;
      department_name: string | null;
      program_name: string | null;
      correction: { wrong: string; correct: string };
    }> = [];
    for (const assignment of allAssignments) {
      const matchedCorrection = corrections.find(c => 
        assignment.faculty_name && (
          assignment.faculty_name === c.wrong ||
          assignment.faculty_name.toLowerCase() === c.wrong.toLowerCase()
        )
      );
      if (matchedCorrection) {
        const assignmentRow = assignment as {
          id: number;
          userid: number;
          faculty_name: string | null;
          department_name: string | null;
          program_name: string | null;
        };
        assignmentsToFix.push({
          id: assignmentRow.id,
          userid: assignmentRow.userid,
          faculty_name: assignmentRow.faculty_name,
          department_name: assignmentRow.department_name,
          program_name: assignmentRow.program_name,
          correction: matchedCorrection
        });
      }
    }

    return NextResponse.json({
      preview: true,
      message: `Found ${assignmentsToFix.length} assignment(s) that need updating`,
      assignments: assignmentsToFix || [],
      corrections: corrections,
      note: "Send a POST request to this endpoint to apply all fixes"
    }, { status: 200 });

  } catch (err) {
    console.error("[API] Error previewing access assignments:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ 
      error: message,
      success: false 
    }, { status: 500 });
  }
}

