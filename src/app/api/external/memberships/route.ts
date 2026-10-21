import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/dbconnect';
import { handleCorsPreflight, addCorsHeaders } from '@/lib/cors';
import { toAbsoluteEventImageUrl } from '@/lib/uploadsImageUrl';

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

type MemberRow = {
  name: string;
  sapId: string | null;
  facilityType: string | null;
  imageUrl: string;
  awardedAt: string | null;
};

/**
 * GET /api/external/memberships
 * Public list of alumni with approved facility memberships (gym / pool / cricket),
 * for external consumers (e.g. the UOL website).
 *
 * Returns ALL approved memberships ordered by award date, most recent first.
 * Only a sanitized, non-sensitive shape is exposed — no CNICs, emails,
 * medical details, emergency contacts, or uploaded documents.
 *
 * Query Parameters:
 * - facility: gym | pool | cricket
 * - search: matches name, SAP ID, or registration no
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search')?.trim() || '';
    const facility = searchParams.get('facility')?.trim().toLowerCase() || '';

    if (facility && !['gym', 'pool', 'cricket'].includes(facility)) {
      const response = NextResponse.json(
        { data: null, error: 'Invalid facility parameter. Must be gym, pool, or cricket.' },
        { status: 400 },
      );
      return addCorsHeaders(response, request);
    }

    const searchCondition = search
      ? sql`AND (
          COALESCE(a.alumniname, '') ILIKE ${`%${search}%`}
          OR COALESCE(a.sapid, '') ILIKE ${`%${search}%`}
          OR COALESCE(a.registrationno, '') ILIKE ${`%${search}%`}
        )`
      : sql``;

    const facilityCondition = facility ? sql`AND am.facility_type = ${facility}` : sql``;

    const rows = await sql/* sql */`
      SELECT
        a.alumniname,
        a.sapid,
        am.facility_type,
        a.image1,
        am.created_at
      FROM public.alumni_memberships am
      INNER JOIN public.tbl_alumni a ON a.alumniid = am.alumniid
      WHERE am.status = 'approved'
      ${searchCondition}
      ${facilityCondition}
      ORDER BY am.created_at DESC NULLS LAST, a.alumniid DESC
    `;

    const str = (v: unknown): string | null => {
      const s = String(v ?? '').trim();
      return s || null;
    };

    const items: MemberRow[] = (rows as Record<string, unknown>[]).map((r) => {
      const rawImage = String(r.image1 ?? '').trim();

      return {
        name: String(r.alumniname ?? ''),
        sapId: str(r.sapid),
        facilityType: str(r.facility_type),
        imageUrl:
          rawImage && rawImage !== 'null' ? toAbsoluteEventImageUrl(request, rawImage) : '',
        awardedAt: r.created_at != null ? String(r.created_at) : null,
      };
    });

    const response = NextResponse.json(
      {
        data: {
          items,
          total: items.length,
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
