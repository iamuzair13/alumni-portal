import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { buildAccessFilterSQL } from "@/lib/userAccess";

export async function GET(req: Request) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can export
    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "all";
    const search = searchParams.get("search") || "";

    // Build access filter
    const accessFilter = await buildAccessFilterSQL(session, "");
    const accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;

    // Build status filter
    let statusCondition = sql``;
    if (status && status !== "all") {
      if (status === "active") {
        statusCondition = sql` AND c.status IS NOT NULL AND LOWER(TRIM(c.status)) = 'delivered'`;
      } else if (status === "pending") {
        statusCondition = sql` AND NOT (c.status IS NOT NULL AND TRIM(c.status) != '' AND LOWER(TRIM(c.status)) IN ('delivered', 'rejected'))`;
      } else if (status === "onhold") {
        statusCondition = sql` AND c.status IS NOT NULL AND LOWER(TRIM(c.status)) = 'rejected'`;
      }
    }

    // Build search condition
    let searchCondition = sql``;
    if (search && search.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      searchCondition = sql` AND (
        LOWER(a.sapid) LIKE ${searchTerm}
        OR LOWER(COALESCE(a.registrationno, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(a.alumniname, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(a.personalemail, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(a.officialemail, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(f.faculty_name, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(d.department_name, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(p.program_name, a.degreetitle, '')) LIKE ${searchTerm}
      )`;
    }

    // Fetch ALL fields from tblcard and tbl_alumni with related data
    const query = sql/* sql */`
      SELECT 
        -- Card fields
        c.*,
        -- All alumni fields
        a.*,
        -- ID-based faculty, department, program names
        f.faculty_name,
        d.department_name,
        p.program_name,
        -- Chapter data
        ac.chapter1 as chapter1_id,
        ac.chapter2 as chapter2_id,
        ac.chapter3 as chapter3_id,
        ac.remarks as chapter_remarks,
        c1.national_chapter as chapter1_national,
        c1.international_chapter as chapter1_international,
        c2.national_chapter as chapter2_national,
        c2.international_chapter as chapter2_international,
        c3.national_chapter as chapter3_national,
        c3.international_chapter as chapter3_international,
        -- Association data
        assoc.id as association_id_value,
        assoc.title as association_title,
        assoc.description as association_description,
        assoc.dean as association_dean,
        assoc.phone as association_phone,
        assoc.email as association_email,
        assoc.address as association_address
      FROM public.tblcard c
      JOIN public.tbl_alumni a ON a.alumniid = c.alumniid
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      LEFT JOIN public.tbl_departments d ON d.id = a.department
      LEFT JOIN public.tbl_programs p ON p.id = a.program
      LEFT JOIN public.alumni_chapter ac ON ac.id = a.alumniid
      LEFT JOIN public.tblchapters c1 ON c1.id = ac.chapter1
      LEFT JOIN public.tblchapters c2 ON c2.id = ac.chapter2
      LEFT JOIN public.tblchapters c3 ON c3.id = ac.chapter3
      LEFT JOIN public.tbl_associations assoc ON assoc.id = a.association_id
      WHERE 1=1
        ${accessFilterCondition}
        ${statusCondition}
        ${searchCondition}
      ORDER BY c.createdat DESC
    `;

    const rows = await query;
    
    return NextResponse.json({ items: rows }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to export alumni cards data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

