import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { isSuperAdminUser, isAdminUser } from "@/lib/alumniProfile";

type OptionItem = { id: number; label: string; count: number };

const toPositiveInt = (value: string | null): number | null => {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
};

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const role = searchParams.get("role") || "all";
    const search = String(searchParams.get("search") || "").trim();
    const hasAdditionalAchievements = String(searchParams.get("hasAdditionalAchievements") || "").trim().toLowerCase();
    const selectedInternationalChapterId = toPositiveInt(searchParams.get("internationalChapterId"));
    const selectedNationalChapterId = toPositiveInt(searchParams.get("nationalChapterId"));

    const roleValues = new Set(["all", "president", "vice_president", "coordinator"]);
    if (!roleValues.has(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });

    const hasAdditionalValues = new Set(["", "0", "1", "true", "false"]);
    if (!hasAdditionalValues.has(hasAdditionalAchievements)) {
      return NextResponse.json({ error: "Invalid hasAdditionalAchievements" }, { status: 400 });
    }

    const isSuperAdmin = isSuperAdminUser(session?.user);
    const isAdmin = isAdminUser(session?.user);
    const shouldApplyFilter = !isSuperAdmin && !isAdmin;
    const accessFilter = shouldApplyFilter ? await buildAccessFilterSQL(session, "") : { sql: null, hasFilter: false };

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

    const normalizeRoleExpr = (columnExpr: any) =>
      sql`LOWER(REGEXP_REPLACE(TRIM(COALESCE(${columnExpr}, '')), '[^a-z]+', '', 'g'))`;

    const roleMatchValuesChapter =
      role === "vice_president"
        ? ["vicepresident", "chaptervicepresident"]
        : role === "coordinator"
          ? ["coordinator", "chaptercoordinator"]
          : role === "president"
            ? ["president", "chapterpresident"]
            : null;

    const roleMatchValuesAssoc =
      role === "vice_president" ? ["vicepresident"] : role === "coordinator" ? ["coordinator"] : role === "president" ? ["president"] : null;

    const chapterRoleCondition = (() => {
      if (role === "all" || !roleMatchValuesChapter || roleMatchValuesChapter.length === 0) return sql``;
      const normalized = normalizeRoleExpr(sql`cl.post`);
      if (roleMatchValuesChapter.length === 1) return sql` AND (${normalized} = ${roleMatchValuesChapter[0]})`;
      return sql` AND (${normalized} = ${roleMatchValuesChapter[0]} OR ${normalized} = ${roleMatchValuesChapter[1]})`;
    })();

    const assocRoleCondition = (() => {
      if (role === "all" || !roleMatchValuesAssoc || roleMatchValuesAssoc.length === 0) return sql``;
      const normalized = normalizeRoleExpr(sql`ass.q3`);
      return sql` AND (${normalized} = ${roleMatchValuesAssoc[0]})`;
    })();

    const hasAdditional = hasAdditionalAchievements === "1" || hasAdditionalAchievements === "true";
    const chapterAdditionalCondition = hasAdditional
      ? sql` AND cl.additional_achievements IS NOT NULL AND LENGTH(TRIM(cl.additional_achievements)) > 0`
      : sql``;
    const assocAdditionalCondition = hasAdditional
      ? sql` AND ass.additional_achievements IS NOT NULL AND LENGTH(TRIM(ass.additional_achievements)) > 0`
      : sql``;

    const chapterScopedByOtherChapterFilter =
      selectedInternationalChapterId ? sql` AND cl.chapter_id = ${selectedInternationalChapterId}` : sql``;
    const chapterScopedByNationalFilter =
      selectedNationalChapterId ? sql` AND cl.chapter_id = ${selectedNationalChapterId}` : sql``;

    const nationalRows = await sql/* sql */`
      SELECT c.id, TRIM(COALESCE(c.national_chapter, '')) AS label
      FROM public.tblchapters c
      WHERE TRIM(COALESCE(c.national_chapter, '')) <> ''
      ORDER BY TRIM(COALESCE(c.national_chapter, '')) ASC
    `;

    const internationalRows = await sql/* sql */`
      SELECT c.id, TRIM(COALESCE(c.international_chapter, '')) AS label
      FROM public.tblchapters c
      WHERE TRIM(COALESCE(c.international_chapter, '')) <> ''
      ORDER BY TRIM(COALESCE(c.international_chapter, '')) ASC
    `;

    const associationRows = await sql/* sql */`
      SELECT f.id, TRIM(COALESCE(f.faculty_name, '')) AS label
      FROM public.tbl_faculties f
      WHERE TRIM(COALESCE(f.faculty_name, '')) <> ''
      ORDER BY TRIM(COALESCE(f.faculty_name, '')) ASC
    `;

    const nationalCountsRows = await sql/* sql */`
      SELECT cl.chapter_id AS id, COUNT(*)::int AS count
      FROM public.chapter_leadership cl
      LEFT JOIN public.tbl_alumni a ON a.alumniid = cl.alumniid
      LEFT JOIN public.tblchapters ch ON ch.id = cl.chapter_id
      WHERE COALESCE(cl.status, 'pending') = 'pending'
        AND TRIM(COALESCE(ch.national_chapter, '')) <> ''
        ${searchCondition}
        ${chapterRoleCondition}
        ${chapterAdditionalCondition}
        ${chapterScopedByOtherChapterFilter}
        ${accessFilter.hasFilter && accessFilter.sql
          ? sql` AND EXISTS (
              SELECT 1 FROM public.tbl_alumni a_filter
              WHERE a_filter.alumniid = cl.alumniid
                AND (${accessFilter.sql})
            )`
          : sql``}
      GROUP BY cl.chapter_id
    `;

    const internationalCountsRows = await sql/* sql */`
      SELECT cl.chapter_id AS id, COUNT(*)::int AS count
      FROM public.chapter_leadership cl
      LEFT JOIN public.tbl_alumni a ON a.alumniid = cl.alumniid
      LEFT JOIN public.tblchapters ch ON ch.id = cl.chapter_id
      WHERE COALESCE(cl.status, 'pending') = 'pending'
        AND TRIM(COALESCE(ch.international_chapter, '')) <> ''
        ${searchCondition}
        ${chapterRoleCondition}
        ${chapterAdditionalCondition}
        ${chapterScopedByNationalFilter}
        ${accessFilter.hasFilter && accessFilter.sql
          ? sql` AND EXISTS (
              SELECT 1 FROM public.tbl_alumni a_filter
              WHERE a_filter.alumniid = cl.alumniid
                AND (${accessFilter.sql})
            )`
          : sql``}
      GROUP BY cl.chapter_id
    `;

    const associationCountsRows = await sql/* sql */`
      SELECT ass.association_id AS id, COUNT(*)::int AS count
      FROM public.tblalumniassociation ass
      LEFT JOIN public.tbl_alumni a ON a.alumniid = ass.alumni_id
      WHERE COALESCE(ass.status, 'pending') = 'pending'
        ${searchCondition}
        ${assocRoleCondition}
        ${assocAdditionalCondition}
        ${accessFilter.hasFilter && accessFilter.sql
          ? sql` AND EXISTS (
              SELECT 1 FROM public.tbl_alumni a_filter
              WHERE a_filter.alumniid = ass.alumni_id
                AND (${accessFilter.sql})
            )`
          : sql``}
      GROUP BY ass.association_id
    `;

    const nationalCountsMap = new Map<number, number>();
    for (const row of nationalCountsRows as Array<Record<string, unknown>>) {
      const id = Number(row.id);
      const count = Number(row.count ?? 0);
      if (Number.isFinite(id) && id > 0) nationalCountsMap.set(id, Number.isFinite(count) ? count : 0);
    }

    const internationalCountsMap = new Map<number, number>();
    for (const row of internationalCountsRows as Array<Record<string, unknown>>) {
      const id = Number(row.id);
      const count = Number(row.count ?? 0);
      if (Number.isFinite(id) && id > 0) internationalCountsMap.set(id, Number.isFinite(count) ? count : 0);
    }

    const associationCountsMap = new Map<number, number>();
    for (const row of associationCountsRows as Array<Record<string, unknown>>) {
      const id = Number(row.id);
      const count = Number(row.count ?? 0);
      if (Number.isFinite(id) && id > 0) associationCountsMap.set(id, Number.isFinite(count) ? count : 0);
    }

    const nationalChapters: OptionItem[] = (nationalRows as Array<Record<string, unknown>>).map((row) => {
      const id = Number(row.id);
      return {
        id,
        label: String(row.label || ""),
        count: nationalCountsMap.get(id) ?? 0,
      };
    });

    const internationalChapters: OptionItem[] = (internationalRows as Array<Record<string, unknown>>).map((row) => {
      const id = Number(row.id);
      return {
        id,
        label: String(row.label || ""),
        count: internationalCountsMap.get(id) ?? 0,
      };
    });

    const associations: OptionItem[] = (associationRows as Array<Record<string, unknown>>).map((row) => {
      const id = Number(row.id);
      return {
        id,
        label: String(row.label || ""),
        count: associationCountsMap.get(id) ?? 0,
      };
    });

    return NextResponse.json(
      {
        nationalChapters,
        internationalChapters,
        associations,
      },
      { status: 200 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch pending filter options";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
