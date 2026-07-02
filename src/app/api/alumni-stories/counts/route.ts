import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { buildAccessFilterSQL } from "@/lib/userAccess";

export async function GET() {
  try {
    const session = await auth();
    if (!canModify(session?.user)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const accessFilter = await buildAccessFilterSQL(session, "");
    const accessCondition =
      accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;

    const rows = await sql/* sql */`
      SELECT COUNT(*)::int AS count
      FROM public.tblalumnistories s
      INNER JOIN public.tbl_alumni a ON a.alumniid = s.alumniid
      WHERE s.alumnistories IS NOT NULL
        AND s.alumnistories != ''
        AND TRIM(s.alumnistories) != ''
        AND LOWER(COALESCE(s.status, 'pending')) = 'pending'
        ${accessCondition}
    ` as Array<{ count: number }>;

    const pending = Number(rows?.[0]?.count ?? 0);

    return NextResponse.json({ pending: Number.isFinite(pending) ? pending : 0 }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
