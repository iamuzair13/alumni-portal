import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";

function toInt(v: string | null, fallback: number): number {
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!canModify(session?.user)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const url = new URL(req.url);
    const q = url.searchParams.get("q");

    const limitRaw = toInt(url.searchParams.get("limit"), 50);
    const offsetRaw = toInt(url.searchParams.get("offset"), 0);
    const limit = Math.max(1, Math.min(200, limitRaw));
    const offset = Math.max(0, offsetRaw);

    const conditions: ReturnType<typeof sql>[] = [sql`a.change_approval = 'pending'`];

    if (q) {
      const like = `%${q}%`;
      conditions.push(sql`(
        COALESCE(a.alumniname, '') ILIKE ${like}
        OR COALESCE(a.sapid, '') ILIKE ${like}
        OR COALESCE(a.registrationno, '') ILIKE ${like}
        OR COALESCE(a.personalemail, '') ILIKE ${like}
        OR COALESCE(a.officialemail, '') ILIKE ${like}
        OR COALESCE(a.universityemail, '') ILIKE ${like}
      )`);
    }

    const whereSql = conditions.length
      ? conditions.reduce((acc, c) => (acc ? sql`${acc} AND ${c}` : c), null as any)
      : null;

    const totalRows = await sql/* sql */`
      SELECT COUNT(*)::bigint as count
      FROM public.tbl_alumni a
      ${whereSql ? sql`WHERE ${whereSql}` : sql``}
    ` as Array<{ count: string | number }>;

    const total = Number(totalRows?.[0]?.count ?? 0);

    const rows = await sql/* sql */`
      SELECT
        a.alumniid,
        a.alumniname,
        a.sapid,
        a.registrationno,
        COALESCE(a.personalemail, a.officialemail, a.universityemail) as email,
        r.created_at as submitted_at,
        r.id as request_id
      FROM public.tbl_alumni a
      LEFT JOIN LATERAL (
        SELECT id, created_at
        FROM public.tbl_alumni_change_requests
        WHERE alumni_id = a.alumniid AND status = 'pending'
        ORDER BY created_at DESC
        LIMIT 1
      ) r ON true
      ${whereSql ? sql`WHERE ${whereSql}` : sql``}
      ORDER BY r.created_at DESC NULLS LAST, a.alumniid DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    return NextResponse.json({ items: rows ?? [], total, limit, offset }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
