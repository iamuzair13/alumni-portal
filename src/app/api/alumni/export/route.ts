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
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";

    // Build access filter for admin/viewer users
    const accessFilter = await buildAccessFilterSQL(session, "");
    const accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;

    // Build WHERE clause for verify status filtering
    let verifyFilter = sql``;
    if (status === "verified") {
      verifyFilter = sql`AND LOWER(COALESCE(verify, '')) = 'true'`;
    } else if (status === "unverified") {
      verifyFilter = sql`AND LOWER(COALESCE(verify, '')) = 'false'`;
    } else if (status === "underApproval") {
      verifyFilter = sql`AND verify = 'pending'`;
    } else if (status === "active") {
      verifyFilter = sql`AND ((lasttimelogin IS NOT NULL AND lasttimelogin != '') OR (logincount IS NOT NULL AND logincount > 0))`;
    } else if (status === "inactive") {
      verifyFilter = sql`AND ((lasttimelogin IS NULL OR lasttimelogin = '') AND (logincount IS NULL OR logincount = 0))`;
    } else if (status === "category") {
      verifyFilter = sql`AND 1 = 0`;
    }

    const baseWhere = status === "underApproval" 
      ? sql`1=1` 
      : sql`(sapid IS NOT NULL AND sapid != '' OR registrationno IS NOT NULL AND registrationno != '')`;

    let searchCondition = sql``;
    if (search && search.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      searchCondition = sql`AND (
        LOWER(sapid) LIKE ${searchTerm}
        OR LOWER(COALESCE(registrationno, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(alumniname, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(personalemail, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(officialemail, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(facultyname, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(departmentname, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(degreetitle, '')) LIKE ${searchTerm}
      )`;
    }

    // Fetch ALL fields from tbl_alumni with related data
    const query = sql/* sql */`
      SELECT 
        a.*,
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
        assoc.address as association_address,
        -- Chapter Leadership data
        cl.id as chapter_leadership_id,
        cl.post as chapter_leadership_post,
        cl.status as chapter_leadership_status,
        cl.rejection_reason as chapter_leadership_rejection_reason,
        cl.created_at as chapter_leadership_created_at,
        cl.updated_at as chapter_leadership_updated_at,
        -- Membership data
        am.gym_membership_month,
        am.swimmingpool_membership_month,
        am.created_at as membership_created_at,
        -- Scholarship data
        asch.kinship_firstname,
        asch.kinship_lastname,
        asch.kinship_cnic,
        asch.apply_for,
        asch.degree_title as scholarship_degree_title,
        asch.created_at as scholarship_created_at
      FROM public.tbl_alumni a
      LEFT JOIN public.alumni_chapter ac ON ac.id = a.alumniid
      LEFT JOIN public.tblchapters c1 ON c1.id = ac.chapter1
      LEFT JOIN public.tblchapters c2 ON c2.id = ac.chapter2
      LEFT JOIN public.tblchapters c3 ON c3.id = ac.chapter3
      LEFT JOIN public.tbl_associations assoc ON assoc.id = a.association_id
      LEFT JOIN public.chapter_leadership cl ON cl.id = a.chapter_leadership
      LEFT JOIN public.alumni_memberships am ON am.id = a.alumniid
      LEFT JOIN public.alumni_scholarships asch ON asch.id = a.alumniid
      WHERE ${baseWhere}
        ${verifyFilter}
        ${accessFilterCondition}
        ${searchCondition}
      ORDER BY a.alumniid DESC
    `;

    const rows = await query;
    
    return NextResponse.json({ items: rows }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to export alumni data";
    console.error("[API] Export error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

