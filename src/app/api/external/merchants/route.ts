import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/dbconnect';
import { handleCorsPreflight, addCorsHeaders } from '@/lib/cors';

/**
 * Public merchants feed for the outsourced/external website.
 * GET /api/external/merchants
 *   ?status=active|expired   filter by derived status (default: all)
 *   ?category=<slug|id>      only merchants assigned to this category
 *   ?updated_since=<ISO>     only rows updated after this timestamp
 *   ?page=<n>&limit=<n>      pagination (limit max 100)
 * Returns merchant records with absolute banner image URLs.
 */

function toISODate(value: unknown): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(String(value));
  if (isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseCategoriesJson(raw: unknown) {
  let arr: unknown[] = [];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) arr = parsed;
    } catch {
      return [];
    }
  }
  return (arr as Record<string, unknown>[]).map((c) => ({
    id: Number(c.id),
    name: String(c.name ?? ""),
    slug: String(c.slug ?? ""),
    color: String(c.color ?? "#64748B"),
  }));
}

function toAbsoluteUrl(request: NextRequest, path: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path, request.nextUrl.origin).toString();
}

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const statusFilter = searchParams.get('status');
    const categoryFilter = searchParams.get('category');
    const updatedSince = searchParams.get('updated_since');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = (page - 1) * limit;

    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { data: null, error: 'Invalid pagination parameters' },
        { status: 400 }
      );
    }

    let where = sql`1=1`;
    if (statusFilter === 'active' || statusFilter === 'expired') {
      where = sql`${where} AND m.status = ${statusFilter}`;
    }
    if (categoryFilter) {
      const trimmed = categoryFilter.trim();
      if (!trimmed) {
        return NextResponse.json(
          { data: null, error: 'Invalid category filter' },
          { status: 400 }
        );
      }
      const categoryCondition = /^\d+$/.test(trimmed)
        ? sql`c.id = ${Number(trimmed)}`
        : sql`c.slug = ${trimmed}`;
      where = sql`${where} AND EXISTS (
        SELECT 1 FROM public.merchant_category_map mm
        JOIN public.merchant_categories c ON c.id = mm.category_id
        WHERE mm.merchant_id = m.id AND ${categoryCondition}
      )`;
    }
    if (updatedSince) {
      const since = new Date(updatedSince);
      if (isNaN(since.getTime())) {
        return NextResponse.json(
          { data: null, error: 'Invalid updated_since timestamp' },
          { status: 400 }
        );
      }
      where = sql`${where} AND m.updated_at >= ${since.toISOString()}::timestamptz`;
    }

    const countResult = await sql`
      SELECT COUNT(*) as total FROM public.merchants m WHERE ${where}
    `;
    const total = parseInt(String(countResult[0]?.total || 0), 10);

    const rows = await sql`
      SELECT m.id, m.business_name, m.discount_type, m.start_date, m.end_date,
             m.discount_pct, m.status, m.location, m.banner_url, m.created_at, m.updated_at,
             COALESCE(
               (SELECT json_agg(json_build_object(
                         'id', c.id, 'name', c.name, 'slug', c.slug, 'color', c.color)
                       ORDER BY c.name)
                FROM public.merchant_category_map mm
                JOIN public.merchant_categories c ON c.id = mm.category_id
                WHERE mm.merchant_id = m.id),
               '[]'::json
             ) AS categories
      FROM public.merchants m
      WHERE ${where}
      ORDER BY m.updated_at DESC, m.id DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const todayStart = new Date(new Date().toDateString());
    const data = (rows as unknown as Record<string, unknown>[]).map((row) => {
      const endDateStr = toISODate(row.end_date);
      const endDate = endDateStr ? new Date(endDateStr + "T00:00:00") : null;
      const expired = endDate ? endDate < todayStart : false;
      const rawStatus = String(row.status ?? "active");
      return {
        id: Number(row.id),
        business_name: String(row.business_name ?? ""),
        discount_type: String(row.discount_type ?? ""),
        discount_pct: Number(row.discount_pct ?? 0),
        start_date: toISODate(row.start_date),
        end_date: endDateStr,
        status: rawStatus === "expired" || expired ? "expired" : "active",
        location: row.location != null ? String(row.location) : null,
        banner_url: toAbsoluteUrl(request, row.banner_url != null ? String(row.banner_url) : null),
        categories: parseCategoriesJson(row.categories),
        created_at: String(row.created_at ?? ""),
        updated_at: String(row.updated_at ?? ""),
      };
    });

    const response = NextResponse.json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      error: null,
    });
    return addCorsHeaders(response, request);
  } catch (error) {
    const response = NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
    return addCorsHeaders(response, request);
  }
}
