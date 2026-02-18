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
    const type = searchParams.get("type") || "all"; // "chapter", "association", "all"
    const status = searchParams.get("status") || "all"; // "all", "approved", "pending", "rejected"
    const role = searchParams.get("role") || "all"; // "all", "president", "vice_president", "coordinator"
    const search = String(searchParams.get("search") || "").trim();
    const hasAdditionalAchievements = String(searchParams.get("hasAdditionalAchievements") || "").trim();

    const statusValues = new Set(["all", "approved", "pending", "rejected"]);
    if (!statusValues.has(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const roleValues = new Set(["all", "president", "vice_president", "coordinator"]);
    if (!roleValues.has(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const hasAdditionalValues = new Set(["", "0", "1", "true", "false"]);
    if (!hasAdditionalValues.has(hasAdditionalAchievements.toLowerCase())) {
      return NextResponse.json({ error: "Invalid hasAdditionalAchievements" }, { status: 400 });
    }

    // Build access filter
    const accessFilter = await buildAccessFilterSQL(session, "");
    const accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;

    // Build status filter
    let statusCondition = sql``;
    if (status && status !== "all") {
      statusCondition = sql` AND status = ${status}`;
    }

    const searchCondition = search
      ? sql` AND (
          COALESCE(a.alumniname, '') ILIKE ${`%${search}%`} OR
          COALESCE(a.sapid, '') ILIKE ${`%${search}%`} OR
          COALESCE(a.registrationno, '') ILIKE ${`%${search}%`} OR
          COALESCE(a.personalemail, '') ILIKE ${`%${search}%`} OR
          COALESCE(a.officialemail, '') ILIKE ${`%${search}%`} OR
          COALESCE(a.universityemail, '') ILIKE ${`%${search}%`}
        )`
      : sql``;

    const chapterRoleCondition =
      role === "all"
        ? sql``
        : role === "vice_president"
          ? sql` AND cl.post ILIKE '%Vice%'`
          : role === "coordinator"
            ? sql` AND cl.post ILIKE '%Coordinator%'`
            : sql` AND cl.post ILIKE '%President%'`;

    const assocRoleCondition =
      role === "all"
        ? sql``
        : role === "vice_president"
          ? sql` AND ass.q3 ILIKE '%Vice%'`
          : role === "coordinator"
            ? sql` AND ass.q3 ILIKE '%Coordinator%'`
            : sql` AND ass.q3 ILIKE '%President%'`;

    const hasAdditional = hasAdditionalAchievements.toLowerCase() === "1" || hasAdditionalAchievements.toLowerCase() === "true";
    const chapterAdditionalCondition = hasAdditional
      ? sql` AND cl.additional_achievements IS NOT NULL AND LENGTH(TRIM(cl.additional_achievements)) > 0`
      : sql``;
    const assocAdditionalCondition = hasAdditional
      ? sql` AND ass.additional_achievements IS NOT NULL AND LENGTH(TRIM(ass.additional_achievements)) > 0`
      : sql``;

    const allItems: Array<Record<string, unknown>> = [];

    // Export chapter leadership
    if (type === "all" || type === "chapter") {
      const chapterRows = await sql/* sql */`
        SELECT 
          cl.*,
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
          assoc.title as association_title
        FROM public.chapter_leadership cl
        LEFT JOIN public.tbl_alumni a ON a.alumniid = cl.alumniid
        LEFT JOIN public.alumni_chapter ac ON ac.id = a.alumniid
        LEFT JOIN public.tblchapters c1 ON c1.id = ac.chapter1
        LEFT JOIN public.tblchapters c2 ON c2.id = ac.chapter2
        LEFT JOIN public.tblchapters c3 ON c3.id = ac.chapter3
        LEFT JOIN public.tbl_associations assoc ON assoc.id = a.association_id
        WHERE 1=1
          ${accessFilterCondition}
          ${statusCondition}
          ${searchCondition}
          ${chapterRoleCondition}
          ${chapterAdditionalCondition}
        ORDER BY cl.created_at DESC
      `;
      
      chapterRows.forEach((row: Record<string, unknown>) => {
        allItems.push({
          ...row,
          leadership_type: "chapter"
        });
      });
    }

    // Export association leadership
    if (type === "all" || type === "association") {
      const associationRows = await sql/* sql */`
        SELECT 
          ass.*,
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
          assoc.address as association_address
        FROM public.tblalumniassociation ass
        LEFT JOIN public.tbl_alumni a ON a.alumniid = ass.alumni_id
        LEFT JOIN public.alumni_chapter ac ON ac.id = a.alumniid
        LEFT JOIN public.tblchapters c1 ON c1.id = ac.chapter1
        LEFT JOIN public.tblchapters c2 ON c2.id = ac.chapter2
        LEFT JOIN public.tblchapters c3 ON c3.id = ac.chapter3
        LEFT JOIN public.tbl_associations assoc ON assoc.id = a.association_id
        WHERE 1=1
          ${accessFilterCondition}
          ${statusCondition}
          ${searchCondition}
          ${assocRoleCondition}
          ${assocAdditionalCondition}
        ORDER BY ass.createddatetime DESC
      `;
      
      associationRows.forEach((row: Record<string, unknown>) => {
        allItems.push({
          ...row,
          leadership_type: "association"
        });
      });
    }
    
    return NextResponse.json({ items: allItems }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to export leadership data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

