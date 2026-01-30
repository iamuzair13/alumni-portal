import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";

function toInt(v: string | null, fallback: number): number {
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const url = new URL(req.url);
    const limitRaw = toInt(url.searchParams.get("limit"), 10);
    const offsetRaw = toInt(url.searchParams.get("offset"), 0);
    const limit = Math.max(1, Math.min(50, limitRaw));
    const offset = Math.max(0, offsetRaw);

    const rows = await sql/* sql */`
      SELECT id, created_at, title, date, image, link
      FROM public.newsletters
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const totalRows = await sql/* sql */`
      SELECT COUNT(*)::bigint as count
      FROM public.newsletters
    ` as Array<{ count: string | number }>;

    const total = Number(totalRows?.[0]?.count ?? 0);

    return NextResponse.json({ items: rows ?? [], total, limit, offset }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
