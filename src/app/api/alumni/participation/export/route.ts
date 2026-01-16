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
    const type = searchParams.get("type") || "all"; // "talks", "association", "all"

    // Build access filter
    const accessFilter = await buildAccessFilterSQL(session, "");
    const accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;

    const allItems: Array<Record<string, unknown>> = [];

    // Export talks/mentorship data
    if (type === "all" || type === "talks") {
      const talksRows = await sql/* sql */`
        SELECT 
          t.*,
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
        FROM public.tblalumnitalks t
        LEFT JOIN public.tbl_alumni a ON a.alumniid = t.alumniid
        LEFT JOIN public.alumni_chapter ac ON ac.id = a.alumniid
        LEFT JOIN public.tblchapters c1 ON c1.id = ac.chapter1
        LEFT JOIN public.tblchapters c2 ON c2.id = ac.chapter2
        LEFT JOIN public.tblchapters c3 ON c3.id = ac.chapter3
        LEFT JOIN public.tbl_associations assoc ON assoc.id = a.association_id
        WHERE 1=1
          ${accessFilterCondition}
        ORDER BY t.alumniid DESC
      `;
      
      talksRows.forEach((row: Record<string, unknown>) => {
        allItems.push({
          ...row,
          participation_type: "talks"
        });
      });
    }

    // Export association data
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
        WHERE a.association_job IS NOT NULL
          ${accessFilterCondition}
        ORDER BY ass.createddatetime DESC
      `;
      
      associationRows.forEach((row: Record<string, unknown>) => {
        allItems.push({
          ...row,
          participation_type: "association"
        });
      });
    }
    
    return NextResponse.json({ items: allItems }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to export participation data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

