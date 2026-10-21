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
  alumniId: number;
  name: string;
  sapId: string | null;
  registrationNo: string | null;
  facilityType: string | null;
  membershipType: string | null;
  applyingFor: string | null;
  discountType: string | null;
  preferredTiming: string | null;
  membershipStartDate: string | null;
  validTill: string | null;
  membershipMonth: string | null;
  applicationRef: string | null;
  faculty: string | null;
  department: string | null;
  program: string | null;
  campus: string | null;
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
        a.alumniid,
        a.alumniname,
        a.sapid,
        a.registrationno,
        am.facility_type,
        am.membership_type,
        am.discount_type,
        am.preferred_timing,
        am.membership_start_date,
        am.application_ref,
        am.application_details,
        am.gym_membership_month,
        am.swimmingpool_membership_month,
        am.cricket_membership_month,
        f.faculty_name AS faculty,
        d.department_name AS department,
        p.program_name AS program,
        a.campusname AS campus,
        a.image1,
        am.created_at
      FROM public.alumni_memberships am
      INNER JOIN public.tbl_alumni a ON a.alumniid = am.alumniid
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      LEFT JOIN public.tbl_departments d ON d.id = a.department
      LEFT JOIN public.tbl_programs p ON p.id = a.program
      WHERE am.status = 'approved'
      ${searchCondition}
      ${facilityCondition}
      ORDER BY am.created_at DESC NULLS LAST, a.alumniid DESC
    `;

    const items: MemberRow[] = (rows as Record<string, unknown>[]).map((r) => {
      const rawImage = String(r.image1 ?? '').trim();
      const details = (() => {
        const raw = r.application_details;
        try {
          if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
          if (typeof raw === 'string') return JSON.parse(raw) as Record<string, unknown>;
        } catch {
          // malformed jsonb — fall back to the flat columns
        }
        return null;
      })();

      const str = (v: unknown): string | null => {
        const s = String(v ?? '').trim();
        return s || null;
      };

      return {
        alumniId: Number(r.alumniid),
        name: String(r.alumniname ?? ''),
        sapId: str(r.sapid),
        registrationNo: str(r.registrationno),
        facilityType: str(r.facility_type),
        membershipType: str(details?.membershipType ?? r.membership_type),
        applyingFor: str(details?.applyingFor),
        discountType: str(details?.discountType ?? r.discount_type),
        preferredTiming: str(details?.preferredTiming ?? r.preferred_timing),
        membershipStartDate: str(
          details?.membershipStartDate ?? r.membership_start_date,
        ),
        validTill: str(details?.validTill),
        membershipMonth: str(
          r.gym_membership_month ??
            r.swimmingpool_membership_month ??
            r.cricket_membership_month,
        ),
        applicationRef: str(r.application_ref),
        faculty: str(r.faculty),
        department: str(r.department),
        program: str(r.program),
        campus: str(r.campus),
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
