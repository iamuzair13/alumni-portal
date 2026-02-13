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

    const isSuperAdmin = isSuperAdminUser(session.user);
    const isAdmin = isAdminUser(session.user);
    const shouldApplyFilter = !isSuperAdmin && !isAdmin;

    const accessFilter = shouldApplyFilter
      ? await buildAccessFilterSQL(session, "")
      : { sql: null, hasFilter: false };

    const chapterCounts = await sql/* sql */`
      SELECT
        COUNT(*)::int as all_count,
        COUNT(*) FILTER (WHERE cl.status = 'pending')::int as pending_count
      FROM public.chapter_leadership cl
      ${accessFilter.hasFilter && accessFilter.sql
        ? sql`WHERE EXISTS (
            SELECT 1
            FROM public.tbl_alumni a_filter
            WHERE a_filter.alumniid = cl.alumniid
              AND (${accessFilter.sql})
          )`
        : sql``}
    `;

    const associationCounts = await sql/* sql */`
      SELECT
        COUNT(*)::int as all_count,
        COUNT(*) FILTER (WHERE ass.status = 'pending')::int as pending_count
      FROM public.tblalumniassociation ass
      ${accessFilter.hasFilter && accessFilter.sql
        ? sql`WHERE EXISTS (
            SELECT 1
            FROM public.tbl_alumni a_filter
            WHERE a_filter.alumniid = ass.alumni_id
              AND (${accessFilter.sql})
          )`
        : sql``}
    `;

    const ch = chapterCounts?.[0] as { all_count?: number; pending_count?: number } | undefined;
    const as = associationCounts?.[0] as { all_count?: number; pending_count?: number } | undefined;

    const all = Number(ch?.all_count || 0) + Number(as?.all_count || 0);
    const pending = Number(ch?.pending_count || 0) + Number(as?.pending_count || 0);

    return NextResponse.json({ counts: { all, pending } }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch leadership counts";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
