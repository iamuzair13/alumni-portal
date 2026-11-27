import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/dbconnect';
import { handleCorsPreflight, addCorsHeaders } from '@/lib/cors';

/**
 * Public merchant categories feed for the outsourced/external website.
 * GET /api/external/merchant-categories
 *   ?include_empty=false   only categories with at least one merchant (default: all)
 * Returns each category with a count of assigned merchants. Pair with
 * GET /api/external/merchants?category=<slug> for filtered listings.
 */
export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

export async function GET(request: NextRequest) {
  try {
    const includeEmpty = request.nextUrl.searchParams.get('include_empty');
    const onlyWithMerchants = includeEmpty === 'false';

    const rows = await sql/* sql */`
      SELECT c.id, c.name, c.slug, c.color,
             COUNT(mm.merchant_id)::int AS merchant_count
      FROM public.merchant_categories c
      LEFT JOIN public.merchant_category_map mm ON mm.category_id = c.id
      GROUP BY c.id, c.name, c.slug, c.color
      ${onlyWithMerchants ? sql`HAVING COUNT(mm.merchant_id) > 0` : sql``}
      ORDER BY c.name ASC
    `;

    const data = (rows as Record<string, unknown>[]).map((row) => ({
      id: Number(row.id),
      name: String(row.name ?? ''),
      slug: String(row.slug ?? ''),
      color: String(row.color ?? '#64748B'),
      merchant_count: Number(row.merchant_count ?? 0),
    }));

    const response = NextResponse.json({ data, error: null });
    return addCorsHeaders(response, request);
  } catch (error) {
    const response = NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
    return addCorsHeaders(response, request);
  }
}
