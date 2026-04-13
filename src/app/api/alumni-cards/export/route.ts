import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { mapUIStatusToDb, type CardStatus } from "@/lib/card-status-config";

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
    const statusParam = (searchParams.get("status") || "all") as CardStatus | "overdue";
    const overdueType = searchParams.get("overdueType") || "";
    const search = searchParams.get("search") || "";

    // Build access filter
    const accessFilter = await buildAccessFilterSQL(session, "");
    const accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;

    // Build status filter
    // Align this logic with /api/alumni-cards/applicants so that
    // the rows exported for a given status exactly match the UI list.
    //
    // Database values: "UnderReview", "UnderPrinting", "Active", "Onhold", "Delivered"
    // Legacy: "Pending" → "UnderReview", "Process" → "UnderPrinting"
    // NULL or empty status should be treated as "UnderReview" (default status)
    let statusCondition = sql``;
    let overdueCondition = sql``;
    if (statusParam && statusParam !== "all" && statusParam !== "overdue") {
      const dbStatus = mapUIStatusToDb(statusParam as CardStatus);

      if (dbStatus === "UnderReview") {
        // UnderReview: NULL, empty, legacy "Pending", or "UnderReview" (case-insensitive)
        statusCondition = sql`
          AND (
            c.status IS NULL
            OR TRIM(c.status) = ''
            OR UPPER(TRIM(c.status)) = 'PENDING'
            OR UPPER(TRIM(c.status)) = 'UNDERREVIEW'
          )
        `;
      } else if (dbStatus === "UnderPrinting") {
        // UnderPrinting: legacy "Process" or "UnderPrinting"
        statusCondition = sql`
          AND c.status IS NOT NULL
          AND (
            UPPER(TRIM(c.status)) = 'PROCESS'
            OR UPPER(TRIM(c.status)) = 'UNDERPRINTING'
          )
        `;
      } else if (dbStatus === "Active") {
        // Ready for Delivery
        statusCondition = sql`
          AND c.status IS NOT NULL
          AND UPPER(TRIM(c.status)) = 'ACTIVE'
        `;
      } else if (dbStatus === "Onhold") {
        statusCondition = sql`
          AND c.status IS NOT NULL
          AND UPPER(TRIM(c.status)) = 'ONHOLD'
        `;
      } else if (dbStatus === "Delivered") {
        statusCondition = sql`
          AND c.status IS NOT NULL
          AND UPPER(TRIM(c.status)) = 'DELIVERED'
        `;
      }
    } else if (statusParam === "overdue") {
      // Overdue tab - match /api/alumni-cards/applicants behavior
      if (overdueType === "under-review") {
        statusCondition = sql`
          AND (
            c.status IS NULL
            OR TRIM(c.status) = ''
            OR UPPER(TRIM(c.status)) = 'PENDING'
            OR UPPER(TRIM(c.status)) = 'UNDERREVIEW'
          )
        `;
        overdueCondition = sql` AND c.createdat < NOW() - INTERVAL '7 days'`;
      } else if (overdueType === "under-printing") {
        statusCondition = sql`
          AND c.status IS NOT NULL
          AND (
            UPPER(TRIM(c.status)) = 'PROCESS'
            OR UPPER(TRIM(c.status)) = 'UNDERPRINTING'
          )
        `;
        overdueCondition = sql` AND c.createdat < NOW() - INTERVAL '7 days'`;
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
        assoc.faculty_name as association_title,
        NULL::text as association_description,
        NULL::text as association_dean,
        NULL::text as association_phone,
        NULL::text as association_email,
        NULL::text as association_address
      FROM public.tblcard c
      JOIN public.tbl_alumni a ON a.alumniid = c.alumniid
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      LEFT JOIN public.tbl_departments d ON d.id = a.department
      LEFT JOIN public.tbl_programs p ON p.id = a.program
      LEFT JOIN public.alumni_chapter ac ON ac.id = a.alumniid
      LEFT JOIN public.tblchapters c1 ON c1.id = ac.chapter1
      LEFT JOIN public.tblchapters c2 ON c2.id = ac.chapter2
      LEFT JOIN public.tblchapters c3 ON c3.id = ac.chapter3
      LEFT JOIN public.tbl_faculties assoc ON assoc.id = a.association_id
      WHERE 1=1
        ${accessFilterCondition}
        ${statusCondition}
        ${overdueCondition}
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

