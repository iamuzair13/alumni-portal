import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { buildMasterFilterConditions } from "@/lib/master-filter-utils";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    // Build master filter conditions excluding chapters filters to avoid circular dependency
    const masterFilterConditions = buildMasterFilterConditions(searchParams, "chapters");

    let accessFilterCondition = sql``;
    try {
      const accessFilter = await buildAccessFilterSQL(session, "");
      accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    } catch (filterError) {
      return NextResponse.json({ error: "Failed to build access filter" }, { status: 500 });
    }

    // Get all active international chapters
    const allChapters = await sql/* sql */`
      SELECT DISTINCT international_chapter
      FROM public.tblchapters
      WHERE is_active = true 
        AND international_chapter IS NOT NULL 
        AND TRIM(COALESCE(international_chapter, '')) != ''
      ORDER BY international_chapter ASC
    `;

    const chapterNames = (allChapters as unknown as Array<{ international_chapter: string }>).map(
      (row) => row.international_chapter
    );

    // For each chapter, count alumni who are members
    const counts = await Promise.all(
      chapterNames.map(async (chapterName) => {
        // Get chapter ID
        const chapterRows = await sql/* sql */`
          SELECT id FROM public.tblchapters 
          WHERE LOWER(TRIM(COALESCE(international_chapter, ''))) = LOWER(${chapterName})
          AND is_active = true
          LIMIT 1
        `;
        
        if (!chapterRows[0]) {
          return { chapterName, count: 0 };
        }

        const chapterId = Number((chapterRows[0] as { id: number }).id);

        // Count alumni who are members of this chapter
        // Note: masterFilterConditions already includes faculty/department filters from tbl_alumni
        const countRows = await sql/* sql */`
          SELECT COUNT(DISTINCT a.alumniid) as count
          FROM public.tbl_alumni a
          INNER JOIN public.alumni_chapter ac ON ac.id = a.alumniid
          WHERE (a.sapid IS NOT NULL AND a.sapid != '' OR a.registrationno IS NOT NULL AND a.registrationno != '')
            AND (
              ac."chapter1" = ${chapterId}
              OR ac."chapter2" = ${chapterId}
              OR ac."chapter3" = ${chapterId}
            )
            ${accessFilterCondition}
            ${masterFilterConditions}
        `;

        const count = Number((countRows[0] as { count: number | string | bigint })?.count || 0);
        return { chapterName, count };
      })
    );

    const internationalChapters = counts.map(({ chapterName, count }) => ({
      value: chapterName,
      label: chapterName,
      count,
    }));
    return NextResponse.json({ success: true, chapters: internationalChapters }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch international chapters";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

