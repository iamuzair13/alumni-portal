import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/alumniProfile";
import { getUserAccessAssignments, getUserIdFromSession } from "@/lib/userAccess";

/**
 * Debug endpoint to check program name matching between assignments and database
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
    const userIdParam = url.searchParams.get("userId");
    const userId = userIdParam ? parseInt(userIdParam, 10) : getUserIdFromSession(session);
    if (!userId || isNaN(userId)) {
      return NextResponse.json({ error: "User ID not found" }, { status: 400 });
    }

    // Get user's assignments
    const assignments = await getUserAccessAssignments(userId);
    
    // Get program-level assignments
    const programAssignments = assignments.filter(a => a.program_name);
    
    if (programAssignments.length === 0) {
      return NextResponse.json({ 
        message: "No program-level assignments found",
        assignments: assignments 
      }, { status: 200 });
    }

    // For each program assignment, check what degreetitle values exist in the database
    const results = [];
    
    for (const assignment of programAssignments) {
      const faculty = assignment.faculty_name?.trim() || "";
      const department = assignment.department_name?.trim() || "";
      const program = assignment.program_name?.trim() || "";
      
      // First check if there are any alumni records for this faculty/department at all
      const totalAlumni = await sql/* sql */`
        SELECT COUNT(*) as total
        FROM public.tbl_alumni
        WHERE 
          (${faculty ? sql`LOWER(TRIM(COALESCE(facultyname, ''))) = LOWER(${faculty})` : sql`1=1`})
          AND (${department ? sql`LOWER(TRIM(COALESCE(departmentname, ''))) = LOWER(${department})` : sql`1=1`})
      `;
      
      // Get all degreetitle values for this faculty and department
      const dbPrograms = await sql/* sql */`
        SELECT DISTINCT 
          degreetitle,
          COUNT(*) as count
        FROM public.tbl_alumni
        WHERE 
          (${faculty ? sql`LOWER(TRIM(COALESCE(facultyname, ''))) = LOWER(${faculty})` : sql`1=1`})
          AND (${department ? sql`LOWER(TRIM(COALESCE(departmentname, ''))) = LOWER(${department})` : sql`1=1`})
          AND degreetitle IS NOT NULL 
          AND TRIM(degreetitle) != ''
        GROUP BY degreetitle
        ORDER BY count DESC
        LIMIT 20
      `;
      
      // Test the LIKE pattern matching
      const programWords = program.split(/\s+/).filter(w => w.length > 0);
      const programPattern = programWords.length > 0 
        ? `%${programWords.join('%')}%`
        : `%${program}%`;
      
      const patternMatches = await sql/* sql */`
        SELECT DISTINCT 
          degreetitle,
          COUNT(*) as count
        FROM public.tbl_alumni
        WHERE 
          (${faculty ? sql`LOWER(TRIM(COALESCE(facultyname, ''))) = LOWER(${faculty})` : sql`1=1`})
          AND (${department ? sql`LOWER(TRIM(COALESCE(departmentname, ''))) = LOWER(${department})` : sql`1=1`})
          AND degreetitle IS NOT NULL 
          AND TRIM(degreetitle) != ''
          AND LOWER(degreetitle) LIKE LOWER(${programPattern})
        GROUP BY degreetitle
        ORDER BY count DESC
        LIMIT 20
      `;
      
      // Check for exact match
      const exactMatch = dbPrograms.find((p) => {
        const row = p as { degreetitle: string | null };
        return row.degreetitle?.trim().toLowerCase() === program.toLowerCase();
      });
      
      // Check for partial matches (contains the program name)
      const partialMatches = dbPrograms.filter((p) => {
        const row = p as { degreetitle: string | null };
        const degreetitle = row.degreetitle?.toLowerCase() || "";
        return degreetitle.includes(program.toLowerCase()) ||
          program.toLowerCase().includes(degreetitle);
      });
      
      results.push({
        assignment: {
          faculty,
          department,
          program,
          program_lower: program.toLowerCase(),
          program_trimmed: program.trim(),
          program_pattern: programPattern
        },
        totalAlumniInDept: Number(totalAlumni[0]?.total || 0),
        databasePrograms: dbPrograms.map((p) => {
          const row = p as { degreetitle: string | null; count: number | string | null };
          return {
            degreetitle: row.degreetitle || "",
            degreetitle_lower: row.degreetitle?.toLowerCase() || "",
            degreetitle_trimmed: row.degreetitle?.trim() || "",
            count: Number(row.count || 0)
          };
        }),
        patternMatches: patternMatches.map((p) => {
          const row = p as { degreetitle: string | null; count: number | string | null };
          return {
            degreetitle: row.degreetitle || "",
            count: Number(row.count || 0)
          };
        }),
        exactMatch: exactMatch ? {
          degreetitle: (exactMatch as { degreetitle: string | null }).degreetitle || "",
          count: Number((exactMatch as { count: number | string | null }).count || 0)
        } : null,
        partialMatches: partialMatches.map((p) => {
          const row = p as { degreetitle: string | null; count: number | string | null };
          return {
            degreetitle: row.degreetitle || "",
            count: Number(row.count || 0)
          };
        }),
        matchFound: !!exactMatch || patternMatches.length > 0
      });
    }

    return NextResponse.json({
      userId,
      totalProgramAssignments: programAssignments.length,
      results
    }, { status: 200 });

  } catch (err) {
    console.error("[API] Error checking program matching:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

