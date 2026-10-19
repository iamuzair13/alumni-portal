import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/dbconnect';
import { handleCorsPreflight, addCorsHeaders } from '@/lib/cors';
import type {
  ScholarshipCgpaDiscountTier,
  ScholarshipDiscountCategory,
} from '@/lib/scholarshipDiscount';

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

function mapCategory(row: Record<string, unknown>): ScholarshipDiscountCategory {
  return {
    id: Number(row.id),
    slug: String(row.slug ?? ''),
    label: String(row.label ?? ''),
    flow_type: String(row.flow_type) as 'fee_discount' | 'kinship',
    default_apply_for: row.default_apply_for != null ? String(row.default_apply_for) : null,
    sort_order: Number(row.sort_order) || 0,
    is_active: Boolean(row.is_active),
  };
}

function mapTier(row: Record<string, unknown>): ScholarshipCgpaDiscountTier {
  return {
    id: Number(row.id),
    category_id: Number(row.category_id),
    cgpa_min: Number(row.cgpa_min),
    cgpa_max: Number(row.cgpa_max),
    discount_percent: Number(row.discount_percent),
    sort_order: Number(row.sort_order) || 0,
  };
}

/**
 * GET /api/external/scholarships
 * Public scholarship catalog for external consumers (e.g. the UOL website).
 * Returns active scholarship discount categories, optionally with their
 * CGPA discount tiers, plus aggregate application statistics.
 *
 * No per-application PII is exposed — aggregate counts only.
 *
 * Query Parameters:
 * - includeTiers=1: include CGPA discount tiers per category
 * - stats=1: include aggregate application counts by status/category
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const includeTiers = searchParams.get('includeTiers') === '1';
    const includeStats = searchParams.get('stats') === '1';

    const categoryRows = await sql/* sql */`
      SELECT id, slug, label, flow_type, default_apply_for, sort_order, is_active
      FROM public.scholarship_discount_categories
      WHERE is_active = true
      ORDER BY sort_order ASC, id ASC
    `;
    const categories = (categoryRows as Record<string, unknown>[]).map(mapCategory);

    let items: Array<ScholarshipDiscountCategory & { tiers?: ScholarshipCgpaDiscountTier[] }> =
      categories;

    if (includeTiers && categories.length > 0) {
      const categoryIds = categories.map((c) => c.id);
      const tierRows = await sql/* sql */`
        SELECT id, category_id, cgpa_min, cgpa_max, discount_percent, sort_order
        FROM public.scholarship_cgpa_discount_tiers
        WHERE category_id = ANY(${categoryIds}::int[])
        ORDER BY sort_order ASC, id ASC
      `;
      const tiersByCategory = new Map<number, ScholarshipCgpaDiscountTier[]>();
      for (const row of tierRows as Record<string, unknown>[]) {
        const t = mapTier(row);
        const list = tiersByCategory.get(t.category_id) ?? [];
        list.push(t);
        tiersByCategory.set(t.category_id, list);
      }
      items = categories.map((c) => ({ ...c, tiers: tiersByCategory.get(c.id) ?? [] }));
    }

    let stats: unknown = undefined;
    if (includeStats) {
      const byStatus = await sql/* sql */`
        SELECT COALESCE(status, 'pending') AS status, COUNT(*)::int AS count
        FROM public.alumni_scholarships
        GROUP BY 1
        ORDER BY 2 DESC
      `;
      const byCategory = await sql/* sql */`
        SELECT discount_type, COALESCE(status, 'pending') AS status, COUNT(*)::int AS count
        FROM public.alumni_scholarships
        GROUP BY 1, 2
        ORDER BY 1, 2
      `;
      stats = {
        totalApplications: (byStatus as Record<string, unknown>[]).reduce(
          (sum, r) => sum + Number(r.count ?? 0),
          0,
        ),
        byStatus,
        byCategory,
      };
    }

    const response = NextResponse.json(
      {
        data: {
          items,
          ...(includeStats ? { stats } : {}),
        },
        error: null,
      },
      { status: 200 },
    );
    return addCorsHeaders(response, request);
  } catch (error) {
    const response = NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
    return addCorsHeaders(response, request);
  }
}
