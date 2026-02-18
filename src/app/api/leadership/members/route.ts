import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";

// Get approved leadership members
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get("type") || "chapter"; // "chapter" or "association"
    const search = searchParams.get("search") || "";
    const faculty = searchParams.get("faculty") || "";
    const chapter = searchParams.get("chapter") || "";
    
    // Build access filter for admin/viewer users
    const accessFilter = await buildAccessFilterSQL(session, "");
    const accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    
    let members: Array<{
      id: number;
      alumniId: number;
      sapId: string;
      registrationno?: string | null;
      name: string;
      email: string;
      faculty: string | null;
      department: string | null;
      program: string | null;
      position: string;
      createdAt: string;
      chapters?: string[];
    }> = [];

    if (type === "chapter") {
      // Get chapter leadership members
      const searchCondition = search ? sql` AND (
        a.alumniname ILIKE ${`%${search}%`}
        OR a.sapid ILIKE ${`%${search}%`}
        OR a.registrationno ILIKE ${`%${search}%`}
      )` : sql``;
      
      const facultyCondition = faculty ? sql` AND f.faculty_name = ${faculty}` : sql``;

      const rows = await sql/* sql */`
        SELECT 
          a.alumniid,
          a.sapid,
          a.alumniname,
          d.department_name as departmentname,
          f.faculty_name as facultyname,
          p.program_name as program_name,
          a.degreetitle,
          a.personalemail,
          a.officialemail,
          a.universityemail,
          a.registrationno,
          cl.id as leadership_id,
          cl.post,
          cl.created_at,
          ac.chapter1,
          ac.chapter2,
          ac.chapter3,
          COALESCE(c1.national_chapter, c1.international_chapter) as chapter1_name,
          COALESCE(c2.national_chapter, c2.international_chapter) as chapter2_name,
          COALESCE(c3.national_chapter, c3.international_chapter) as chapter3_name
        FROM public.tbl_alumni a
        JOIN public.chapter_leadership cl ON cl.id = a.chapter_leadership
        LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
        LEFT JOIN public.tbl_departments d ON d.id = a.department
        LEFT JOIN public.tbl_programs p ON p.id = a.program
        LEFT JOIN public.alumni_chapter ac ON ac.id = a.alumniid
        LEFT JOIN public.tblchapters c1 ON c1.id = ac.chapter1
        LEFT JOIN public.tblchapters c2 ON c2.id = ac.chapter2
        LEFT JOIN public.tblchapters c3 ON c3.id = ac.chapter3
        WHERE a.chapter_leadership IS NOT NULL
          AND cl.status = 'approved'
          ${accessFilterCondition}
          ${searchCondition}
          ${facultyCondition}
      `;
      
      // Process rows and filter by chapter if specified
      for (const r of rows as Array<Record<string, unknown>>) {
        const chapters: string[] = [];
        
        if (r.chapter1_name) chapters.push(String(r.chapter1_name));
        if (r.chapter2_name) chapters.push(String(r.chapter2_name));
        if (r.chapter3_name) chapters.push(String(r.chapter3_name));

        // Filter by chapter if specified
        if (chapter && chapters.length > 0 && !chapters.some(ch => ch.toLowerCase().includes(chapter.toLowerCase()))) {
          continue;
        }

        members.push({
          id: Number(r.leadership_id),
          alumniId: Number(r.alumniid),
          sapId: String(r.sapid ?? ""),
          registrationno: r.registrationno ? String(r.registrationno) : null,
          name: String(r.alumniname ?? ""),
          email: (r.personalemail ? String(r.personalemail) : null) || (r.officialemail ? String(r.officialemail) : null) || (r.universityemail ? String(r.universityemail) : null) || "",
          faculty: r.facultyname ? String(r.facultyname) : null,
          department: r.departmentname ? String(r.departmentname) : null,
          program: r.program_name ? String(r.program_name) : (r.degreetitle ? String(r.degreetitle) : null),
          position: r.post ? String(r.post) : "",
          createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : new Date().toISOString(),
          chapters,
        });
      }
    } else if (type === "association") {
      // Get association leadership members
      const searchCondition = search ? sql` AND (
        a.alumniname ILIKE ${`%${search}%`}
        OR a.sapid ILIKE ${`%${search}%`}
        OR a.registrationno ILIKE ${`%${search}%`}
      )` : sql``;
      
      const facultyCondition = faculty ? sql` AND f.faculty_name = ${faculty}` : sql``;
      
      const chapterCondition = chapter ? sql` AND assoc.title ILIKE ${`%${chapter}%`}` : sql``;

      const rows = await sql/* sql */`
        SELECT 
          a.alumniid,
          a.sapid,
          a.alumniname,
          d.department_name as departmentname,
          f.faculty_name as facultyname,
          p.program_name as program_name,
          a.degreetitle,
          a.personalemail,
          a.officialemail,
          a.universityemail,
          a.registrationno,
          ass.id as leadership_id,
          ass.q3 as role,
          ass.createddatetime,
          assoc.title as association_title
        FROM public.tbl_alumni a
        JOIN public.tblalumniassociation ass ON ass.id = a.association_job
        LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
        LEFT JOIN public.tbl_departments d ON d.id = a.department
        LEFT JOIN public.tbl_programs p ON p.id = a.program
        LEFT JOIN public.tbl_associations assoc ON assoc.id = a.association_id
        WHERE a.association_job IS NOT NULL
          AND ass.status = 'approved'
          ${accessFilterCondition}
          ${searchCondition}
          ${facultyCondition}
          ${chapterCondition}
      `;
      
      members = rows.map((r: Record<string, unknown>) => ({
        id: Number(r.leadership_id),
        alumniId: Number(r.alumniid),
        sapId: String(r.sapid ?? ""),
        registrationno: r.registrationno ? String(r.registrationno) : null,
        name: String(r.alumniname ?? ""),
        email: (r.personalemail ? String(r.personalemail) : null) || (r.officialemail ? String(r.officialemail) : null) || (r.universityemail ? String(r.universityemail) : null) || "",
        faculty: r.facultyname ? String(r.facultyname) : null,
        department: r.departmentname ? String(r.departmentname) : null,
        program: r.program_name ? String(r.program_name) : (r.degreetitle ? String(r.degreetitle) : null),
        position: r.role ? String(r.role) : "",
        createdAt: r.createddatetime ? new Date(r.createddatetime as string).toISOString() : new Date().toISOString(),
      }));
    }
    
    return NextResponse.json({ items: members }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch members";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

