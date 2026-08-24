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
    const actorUserId = url.searchParams.get("actorUserId");
    const actorType = url.searchParams.get("actorType");
    const action = url.searchParams.get("action");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const q = url.searchParams.get("q");

    const limitRaw = toInt(url.searchParams.get("limit"), 50);
    const offsetRaw = toInt(url.searchParams.get("offset"), 0);
    const limit = Math.max(1, Math.min(200, limitRaw));
    const offset = Math.max(0, offsetRaw);

    const conditions: ReturnType<typeof sql>[] = [];

    if (actorUserId) {
      const n = Number(actorUserId);
      if (Number.isFinite(n)) {
        conditions.push(sql`actor_user_id = ${n}`);
      }
    }

    if (actorType) {
      const actorTypeNorm = String(actorType).toLowerCase().trim();
      if (actorTypeNorm === "staff") {
        conditions.push(sql`LOWER(TRIM(COALESCE(actor_type, ''))) IN ('admin','superadmin','viewer','user')`);
      } else {
        conditions.push(sql`LOWER(TRIM(COALESCE(actor_type, ''))) = LOWER(TRIM(${actorType}))`);
      }
    }

    if (action) {
      const actionNorm = String(action).trim();
      if (actionNorm.includes("%") || actionNorm.includes("_")) {
        conditions.push(sql`action ILIKE ${actionNorm}`);
      } else {
        conditions.push(sql`action ILIKE ${`%${actionNorm}%`}`);
      }
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
        actor_email ILIKE ${like}
        OR actor_type ILIKE ${like}
        OR action ILIKE ${like}
        OR COALESCE(entity_type, '') ILIKE ${like}
        OR COALESCE(entity_id, '') ILIKE ${like}
        OR COALESCE(request_path, '') ILIKE ${like}
        OR COALESCE(ip, '') ILIKE ${like}
      )`);
    }

    const whereSql = conditions.length
      ? conditions.reduce((acc, c) => (acc ? sql`${acc} AND ${c}` : c), null as any)
      : null;

    const totalRows = await sql/* sql */`
      SELECT COUNT(*)::bigint as count
      FROM public.admin_activity_logs
      ${whereSql ? sql`WHERE ${whereSql}` : sql``}
    ` as Array<{ count: string | number }>;

    const total = Number(totalRows?.[0]?.count ?? 0);

    const rows = await sql/* sql */`
      SELECT
        id,
        created_at,
        actor_user_id,
        actor_email,
        actor_type,
        action,
        entity_type,
        entity_id,
        success,
        error_message,
        ip,
        user_agent,
        request_path,
        metadata
      FROM public.admin_activity_logs
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
