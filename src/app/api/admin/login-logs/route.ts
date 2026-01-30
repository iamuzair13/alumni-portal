import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/alumniProfile";

function toInt(v: string | null, fallback: number): number {
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!isSuperAdminUser(session?.user)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const url = new URL(req.url);
    const actorType = url.searchParams.get("actorType");
    const actorUserId = url.searchParams.get("actorUserId");
    const success = url.searchParams.get("success");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const q = url.searchParams.get("q");

    const limitRaw = toInt(url.searchParams.get("limit"), 50);
    const offsetRaw = toInt(url.searchParams.get("offset"), 0);
    const limit = Math.max(1, Math.min(200, limitRaw));
    const offset = Math.max(0, offsetRaw);

    const conditions: ReturnType<typeof sql>[] = [];

    if (actorType) {
      const actorTypeNorm = String(actorType).toLowerCase().trim();
      if (actorTypeNorm === "staff") {
        conditions.push(sql`LOWER(TRIM(COALESCE(actor_type, ''))) IN ('admin','superadmin','viewer','user')`);
      } else {
        conditions.push(sql`LOWER(TRIM(COALESCE(actor_type, ''))) = LOWER(TRIM(${actorType}))`);
      }
    }

    if (actorUserId) {
      const n = Number(actorUserId);
      if (Number.isFinite(n)) {
        conditions.push(sql`actor_user_id = ${n}`);
      }
    }

    if (success === "true") {
      conditions.push(sql`success = true`);
    } else if (success === "false") {
      conditions.push(sql`success = false`);
    }

    if (from) {
      conditions.push(sql`created_at >= ${from}`);
    }

    if (to) {
      conditions.push(sql`created_at <= ${to}`);
    }

    if (q) {
      const like = `%${q}%`;
      conditions.push(sql`(
        COALESCE(actor_email, '') ILIKE ${like}
        OR COALESCE(actor_type, '') ILIKE ${like}
        OR COALESCE(identifier, '') ILIKE ${like}
        OR COALESCE(ip, '') ILIKE ${like}
      )`);
    }

    const whereSql = conditions.length
      ? conditions.reduce((acc, c) => (acc ? sql`${acc} AND ${c}` : c), null as any)
      : null;

    const totalRows = await sql/* sql */`
      SELECT COUNT(*)::bigint as count
      FROM public.login_logs
      ${whereSql ? sql`WHERE ${whereSql}` : sql``}
    ` as Array<{ count: string | number }>;

    const total = Number(totalRows?.[0]?.count ?? 0);

    const rows = await sql/* sql */`
      SELECT
        id,
        created_at,
        actor_type,
        actor_user_id,
        actor_email,
        identifier,
        success,
        error_message,
        ip,
        user_agent,
        metadata
      FROM public.login_logs
      ${whereSql ? sql`WHERE ${whereSql}` : sql``}
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    return NextResponse.json({ items: rows ?? [], total, limit, offset }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
