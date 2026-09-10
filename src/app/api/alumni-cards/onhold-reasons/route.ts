import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";

export async function GET() {
  try {
    const session = await auth();

    // Build access filter for admin/viewer users
    const accessFilter = await buildAccessFilterSQL(session, "");
    const accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;

    // Fetch distinct on hold reasons with their counts from tblcard
    const rows = await sql/* sql */`
      SELECT
        TRIM(c.reason_onhold) AS reason,
        COUNT(*) AS count
      FROM public.tblcard c
      JOIN public.tbl_alumni a ON a.alumniid = c.alumniid
      WHERE c.reason_onhold IS NOT NULL
        AND TRIM(c.reason_onhold) <> ''
        ${accessFilterCondition}
      GROUP BY TRIM(c.reason_onhold)
      ORDER BY count DESC
    ` as Array<{ reason: string; count: bigint | number }>;

    const reasons = rows.map((row) => ({
      reason: String(row.reason).trim(),
      count: Number(row.count),
    }));

    return NextResponse.json({ reasons }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
