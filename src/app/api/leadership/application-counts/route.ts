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
    const search = String(searchParams.get("search") || "").trim();
    const hasAdditionalAchievements = String(searchParams.get("hasAdditionalAchievements") || "").trim();

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

    const counts = {
      all: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    };

    if (type === "all" || type === "chapter") {
      const rows = await sql/* sql */`
        SELECT COALESCE(cl.status, 'pending') AS status, COUNT(*)::int AS count
        FROM public.chapter_leadership cl
        LEFT JOIN public.tbl_alumni a ON a.alumniid = cl.alumniid
        WHERE 1=1
          ${searchCondition}
          ${chapterRoleCondition}
          ${chapterAdditionalCondition}
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
        else if (s === "rejected") counts.rejected += c;
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
        else if (s === "rejected") counts.rejected += c;
        else counts.pending += c;
      }
    }

    counts.all = counts.pending + counts.approved + counts.rejected;

    return NextResponse.json({ counts }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch application counts";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
