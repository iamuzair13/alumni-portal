import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isAdminUser, isSuperAdminUser } from "@/lib/alumniProfile";
import { logAdminAction } from "@/lib/adminActivityLog";

function toInt(v: string | null, fallback: number): number {
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    const canAccess = isSuperAdminUser(session?.user);
    if (!canAccess) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const url = new URL(req.url);
    const q = url.searchParams.get("q");
    const limitRaw = toInt(url.searchParams.get("limit"), 50);
    const offsetRaw = toInt(url.searchParams.get("offset"), 0);
    const limit = Math.max(1, Math.min(200, limitRaw));
    const offset = Math.max(0, offsetRaw);

    const conditions: ReturnType<typeof sql>[] = [];
    if (q) {
      const like = `%${q}%`;
      conditions.push(sql`(
        COALESCE(title, '') ILIKE ${like}
        OR COALESCE(link, '') ILIKE ${like}
        OR COALESCE(image, '') ILIKE ${like}
      )`);
    }

    const whereSql = conditions.length
      ? conditions.reduce((acc, c) => (acc ? sql`${acc} AND ${c}` : c), null as any)
      : null;

    const totalRows = await sql/* sql */`
      SELECT COUNT(*)::bigint as count
      FROM public.newsletters
      ${whereSql ? sql`WHERE ${whereSql}` : sql``}
    ` as Array<{ count: string | number }>;

    const total = Number(totalRows?.[0]?.count ?? 0);

    const rows = await sql/* sql */`
      SELECT id, created_at, title, date, image, link
      FROM public.newsletters
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

export async function POST(req: Request) {
  try {
    const session = await auth();
    const canAccess = isSuperAdminUser(session?.user);
    if (!canAccess) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      title?: unknown;
      date?: unknown;
      image?: unknown;
      link?: unknown;
    };

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const date = typeof body.date === "string" ? body.date.trim() : "";
    const image = typeof body.image === "string" ? body.image.trim() : "";
    const link = typeof body.link === "string" ? body.link.trim() : "";

    if (!title) {
      return NextResponse.json({ error: "TITLE_REQUIRED" }, { status: 400 });
    }

    // date is optional in schema; but if provided, must be YYYY-MM-DD
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "INVALID_DATE" }, { status: 400 });
    }

    if (link && !/^https?:\/\//i.test(link)) {
      return NextResponse.json({ error: "INVALID_LINK" }, { status: 400 });
    }

    const inserted = await sql/* sql */`
      INSERT INTO public.newsletters (title, date, image, link)
      VALUES (
        ${title || null},
        ${date || null},
        ${image || null},
        ${link || null}
      )
      RETURNING id, created_at, title, date, image, link
    `;

    await logAdminAction({ session, req, input: { action: "admin.newsletter_create", entityType: "newsletters", entityId: inserted?.[0]?.id, success: true, metadata: { newsletterId: inserted?.[0]?.id, title } } });

    return NextResponse.json({ item: inserted?.[0] ?? null }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    await logAdminAction({ session: null, req, input: { action: "admin.newsletter_create", entityType: "newsletters", success: false, errorMessage: message } }).catch(() => {});
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
