import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { isSuperAdminUser, isAdminUser } from "@/lib/alumniProfile";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get("type") || "all"; // chapter|association|all
    const role = searchParams.get("role") || "all"; // all|president|vice_president|coordinator
    const category = searchParams.get("category") || "all"; // all|national|international|association
    const categoryValues = new Set(["all", "national", "international", "association"]);
    if (!categoryValues.has(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const search = String(searchParams.get("search") || "").trim();
    const hasAdditionalAchievements = String(searchParams.get("hasAdditionalAchievements") || "").trim();
    const nationalChapterIdRaw = searchParams.get("nationalChapterId");
    const internationalChapterIdRaw = searchParams.get("internationalChapterId");
    const associationIdRaw = searchParams.get("associationId");
    const nationalChapterId = nationalChapterIdRaw ? Number(nationalChapterIdRaw) : null;
    const internationalChapterId = internationalChapterIdRaw ? Number(internationalChapterIdRaw) : null;
    const associationId = associationIdRaw ? Number(associationIdRaw) : null;
    const validNationalChapterId =
      nationalChapterId && Number.isFinite(nationalChapterId) && nationalChapterId > 0 ? nationalChapterId : null;
    const validInternationalChapterId =
      internationalChapterId && Number.isFinite(internationalChapterId) && internationalChapterId > 0 ? internationalChapterId : null;
    const validAssociationId = associationId && Number.isFinite(associationId) && associationId > 0 ? associationId : null;

    const roleValues = new Set(["all", "president", "vice_president", "coordinator"]);
    if (!roleValues.has(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const hasAdditionalValues = new Set(["", "0", "1", "true", "false"]);
    if (!hasAdditionalValues.has(hasAdditionalAchievements.toLowerCase())) {
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
      // lower + trim + remove all non-letters, so "Vice President" -> "vicepresident" and "President" -> "president"
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

    const hasAdditional = hasAdditionalAchievements.toLowerCase() === "1" || hasAdditionalAchievements.toLowerCase() === "true";
    const chapterAdditionalCondition = hasAdditional
      ? sql` AND cl.additional_achievements IS NOT NULL AND LENGTH(TRIM(cl.additional_achievements)) > 0`
      : sql``;
    const assocAdditionalCondition = hasAdditional
      ? sql` AND ass.additional_achievements IS NOT NULL AND LENGTH(TRIM(ass.additional_achievements)) > 0`
      : sql``;
    const chapterCategoryCondition =
      category === "association"
        ? sql` AND 1=0`
        : category === "national"
          ? sql` AND TRIM(COALESCE(ch.national_chapter, '')) <> ''`
          : category === "international"
            ? sql` AND TRIM(COALESCE(ch.international_chapter, '')) <> ''`
            : sql``;
    const associationCategoryCondition = category === "national" || category === "international" ? sql` AND 1=0` : sql``;

    const chapterDimensionCondition =
      validAssociationId
        ? sql` AND 1=0`
        : sql`
            ${validNationalChapterId ? sql` AND cl.chapter_id = ${validNationalChapterId} AND TRIM(COALESCE(ch.national_chapter, '')) <> ''` : sql``}
            ${validInternationalChapterId ? sql` AND cl.chapter_id = ${validInternationalChapterId} AND TRIM(COALESCE(ch.international_chapter, '')) <> ''` : sql``}
          `;
    const associationDimensionCondition =
      validNationalChapterId || validInternationalChapterId
        ? sql` AND 1=0`
        : validAssociationId
          ? sql` AND ass.association_id = ${validAssociationId}`
          : sql``;

    const counts = {
      all: 0,
      pending: 0,
      assessed: 0,
      approved: 0,
      rejected: 0,
      invalid: 0,
    };

    if (type === "all" || type === "chapter") {
      const rows = await sql/* sql */`
        SELECT COALESCE(cl.status, 'pending') AS status, COUNT(*)::int AS count
        FROM public.chapter_leadership cl
        LEFT JOIN public.tbl_alumni a ON a.alumniid = cl.alumniid
        LEFT JOIN public.tblchapters ch ON ch.id = cl.chapter_id
        WHERE 1=1
          ${searchCondition}
          ${chapterRoleCondition}
          ${chapterAdditionalCondition}
          ${chapterCategoryCondition}
          ${chapterDimensionCondition}
          ${accessFilter.hasFilter && accessFilter.sql
            ? sql` AND EXISTS (
                SELECT 1 FROM public.tbl_alumni a_filter
                WHERE a_filter.alumniid = cl.alumniid
                  AND (${accessFilter.sql})
              )`
            : sql``}
        GROUP BY COALESCE(cl.status, 'pending')
      `;

      for (const r of rows as Array<Record<string, unknown>>) {
        const s = String(r.status ?? "pending").toLowerCase();
        const c = Number(r.count ?? 0);
        if (s === "approved") counts.approved += c;
        else if (s === "assessed") counts.assessed += c;
        else if (s === "rejected") counts.rejected += c;
        else if (s === "invalid") counts.invalid += c;
        else counts.pending += c;
      }
    }

    if (type === "all" || type === "association") {
      const rows = await sql/* sql */`
        SELECT COALESCE(ass.status, 'pending') AS status, COUNT(*)::int AS count
        FROM public.tblalumniassociation ass
        LEFT JOIN public.tbl_alumni a ON a.alumniid = ass.alumni_id
        WHERE 1=1
          ${searchCondition}
          ${assocRoleCondition}
          ${assocAdditionalCondition}
          ${associationCategoryCondition}
          ${associationDimensionCondition}
          ${accessFilter.hasFilter && accessFilter.sql
            ? sql` AND EXISTS (
                SELECT 1 FROM public.tbl_alumni a_filter
                WHERE a_filter.alumniid = ass.alumni_id
                  AND (${accessFilter.sql})
              )`
            : sql``}
        GROUP BY COALESCE(ass.status, 'pending')
      `;

      for (const r of rows as Array<Record<string, unknown>>) {
        const s = String(r.status ?? "pending").toLowerCase();
        const c = Number(r.count ?? 0);
        if (s === "approved") counts.approved += c;
        else if (s === "assessed") counts.assessed += c;
        else if (s === "rejected") counts.rejected += c;
        else if (s === "invalid") counts.invalid += c;
        else counts.pending += c;
      }
    }

    counts.all = counts.pending + counts.assessed + counts.approved + counts.rejected + counts.invalid;

    return NextResponse.json({ counts }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch application counts";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
