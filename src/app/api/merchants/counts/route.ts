import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await sql/* sql */`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (
          WHERE m.status = 'active'
            AND (m.end_date IS NULL OR m.end_date >= CURRENT_DATE)
        )::int AS active
      FROM public.merchants m
    `;

    const r = rows[0] as { total?: number; active?: number } | undefined;
    return NextResponse.json(
      { total: Number(r?.total ?? 0), active: Number(r?.active ?? 0) },
      { status: 200 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch merchant counts";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
