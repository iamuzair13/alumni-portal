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

type RecipientRow = {
  alumniId: number;
  name: string;
  sapId: string | null;
  registrationNo: string | null;
  discountType: string | null;
  applyingFor: string | null;
  degreeTitle: string | null;
  appliedDiscountPercent: number | null;
  applicationYear: number | null;
  applicationTerm: string | null;
  semester: number | null;
  faculty: string | null;
  department: string | null;
  program: string | null;
  campus: string | null;
  imageUrl: string;
  awardedAt: string | null;
};

/**
 * GET /api/external/scholarships
 * Public list of alumni who received scholarships (approved applications only),
 * for external consumers (e.g. the UOL website).
 *
 * Only a sanitized, non-sensitive shape is exposed — no CNICs, emails,
 * kinship details, uploaded documents, or rejection internals.
 *
 * Returns ALL approved recipients ordered by award date, most recent first.
 *
 * Query Parameters:
 * - search: matches name, SAP ID, registration no, or degree title
 * - discountType: filter by scholarship category slug
 * - year: filter by application_year
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search')?.trim() || '';
    const discountType = searchParams.get('discountType')?.trim() || '';
    const yearParam = searchParams.get('year');

    const year = yearParam != null && yearParam !== '' ? Number(yearParam) : null;
    if (yearParam && (!Number.isFinite(year) || year! < 2000 || year! > 2100)) {
      const response = NextResponse.json(
        { data: null, error: 'Invalid year parameter.' },
        { status: 400 },
      );
      return addCorsHeaders(response, request);
    }

    const searchCondition = search
      ? sql`AND (
          COALESCE(a.alumniname, '') ILIKE ${`%${search}%`}
          OR COALESCE(a.sapid, '') ILIKE ${`%${search}%`}
          OR COALESCE(a.registrationno, '') ILIKE ${`%${search}%`}
          OR COALESCE(s.degree_title, '') ILIKE ${`%${search}%`}
        )`
      : sql``;

    const typeCondition = discountType ? sql`AND s.discount_type = ${discountType}` : sql``;
    const yearCondition = year != null ? sql`AND s.application_year = ${year}` : sql``;

    const baseFrom = sql`
      FROM public.alumni_scholarships s
      INNER JOIN public.tbl_alumni a ON a.alumniid = s.id
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      LEFT JOIN public.tbl_departments d ON d.id = a.department
      LEFT JOIN public.tbl_programs p ON p.id = a.program
      WHERE s.status = 'approved'
    `;

    const rows = await sql/* sql */`
      SELECT
        a.alumniid,
        a.alumniname,
        a.sapid,
        a.registrationno,
        s.discount_type,
        s.apply_for,
        s.degree_title,
        s.applied_discount_percent,
        s.application_year,
        s.application_term,
        s.semester,
        f.faculty_name AS faculty,
        d.department_name AS department,
        p.program_name AS program,
        a.campusname AS campus,
        a.image1,
        s.created_at
      ${baseFrom}
      ${searchCondition}
      ${typeCondition}
      ${yearCondition}
      ORDER BY s.created_at DESC NULLS LAST, a.alumniid DESC
    `;

    const items: RecipientRow[] = (rows as Record<string, unknown>[]).map((r) => {
      const rawImage = String(r.image1 ?? '').trim();
      return {
      alumniId: Number(r.alumniid),
      name: String(r.alumniname ?? ''),
      sapId: r.sapid != null && String(r.sapid).trim() !== '' ? String(r.sapid).trim() : null,
      registrationNo:
        r.registrationno != null && String(r.registrationno).trim() !== ''
          ? String(r.registrationno).trim()
          : null,
      discountType: r.discount_type != null ? String(r.discount_type) : null,
      applyingFor: r.apply_for != null ? String(r.apply_for) : null,
      degreeTitle: r.degree_title != null ? String(r.degree_title) : null,
      appliedDiscountPercent:
        r.applied_discount_percent != null ? Number(r.applied_discount_percent) : null,
      applicationYear: r.application_year != null ? Number(r.application_year) : null,
      applicationTerm: r.application_term != null ? String(r.application_term) : null,
      semester: r.semester != null ? Number(r.semester) : null,
      faculty: r.faculty != null ? String(r.faculty) : null,
      department: r.department != null ? String(r.department) : null,
      program: r.program != null ? String(r.program) : null,
      campus: r.campus != null ? String(r.campus) : null,
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
