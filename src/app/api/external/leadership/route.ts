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

type LeadershipRow = {
  alumniId: number;
  sapId: string | null;
  name: string;
  email: string | null;
  picture: string;
  position: string;
  type: 'chapter' | 'association';
  organization: string | null;
};

/**
 * GET /api/external/leadership
 * Public list of approved alumni leadership members for external consumers
 * (e.g. the UOL website leadership page).
 *
 * Returns chapter + association leaders, grouped by organization,
 * presidents first within each organization.
 *
 * Query Parameters:
 * - type: "chapter" | "association" (default: all)
 * - search: matches name or SAP ID
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type')?.trim().toLowerCase() || 'all';
    const search = searchParams.get('search')?.trim() || '';

    if (type !== 'all' && type !== 'chapter' && type !== 'association') {
      const response = NextResponse.json(
        { data: null, error: 'Invalid type parameter. Use "chapter" or "association".' },
        { status: 400 },
      );
      return addCorsHeaders(response, request);
    }

    const searchCondition = search
      ? sql`AND (
          COALESCE(a.alumniname, '') ILIKE ${`%${search}%`}
          OR COALESCE(a.sapid, '') ILIKE ${`%${search}%`}
        )`
      : sql``;

    const chapterRows = type === 'association'
      ? []
      : await sql/* sql */`
        SELECT
          a.alumniid,
          a.sapid,
          a.alumniname,
          a.personalemail,
          a.officialemail,
          a.universityemail,
          a.image1,
          cl.post AS position,
          COALESCE(ch.national_chapter, ch.international_chapter) AS organization
        FROM public.tbl_alumni a
        JOIN public.chapter_leadership cl ON cl.id = a.chapter_leadership
        LEFT JOIN public.tblchapters ch ON ch.id = cl.chapter_id
        WHERE a.chapter_leadership IS NOT NULL
          AND cl.status = 'approved'
          ${searchCondition}
      `;

    const associationRows = type === 'chapter'
      ? []
      : await sql/* sql */`
        SELECT
          a.alumniid,
          a.sapid,
          a.alumniname,
          a.personalemail,
          a.officialemail,
          a.universityemail,
          a.image1,
          ass.q3 AS position,
          COALESCE(fac.faculty_name, assoc.faculty_name) AS organization
        FROM public.tbl_alumni a
        JOIN public.tblalumniassociation ass ON ass.id = a.association_job
        LEFT JOIN public.tbl_faculties fac ON fac.id = ass.association_id
        LEFT JOIN public.tbl_faculties assoc ON assoc.id = a.association_id
        WHERE a.association_job IS NOT NULL
          AND ass.status = 'approved'
          ${searchCondition}
      `;

    const str = (v: unknown): string | null => {
      const s = String(v ?? '').trim();
      return s || null;
    };

    const mapRow = (r: Record<string, unknown>, t: 'chapter' | 'association'): LeadershipRow => {
      const rawImage = String(r.image1 ?? '').trim();
      return {
        alumniId: Number(r.alumniid),
        sapId: str(r.sapid),
        name: String(r.alumniname ?? '').trim(),
        email: str(r.personalemail) ?? str(r.officialemail) ?? str(r.universityemail),
        picture: rawImage && rawImage !== 'null' ? toAbsoluteEventImageUrl(request, rawImage) : '',
        position: String(r.position ?? '').trim(),
        type: t,
        organization: str(r.organization),
      };
    };

    const positionRank = (position: string): number => {
      const p = position.toLowerCase();
      if (p.startsWith('president')) return 0;
      if (p.startsWith('vice president')) return 1;
      if (p.startsWith('secretary')) return 2;
      if (p.startsWith('coordinator')) return 3;
      return 4;
    };

    const items: LeadershipRow[] = [
      ...(chapterRows as Record<string, unknown>[]).map((r) => mapRow(r, 'chapter')),
      ...(associationRows as Record<string, unknown>[]).map((r) => mapRow(r, 'association')),
    ].sort((a, b) => {
      const org = String(a.organization ?? '').localeCompare(String(b.organization ?? ''));
      if (org !== 0) return org;
      const rank = positionRank(a.position) - positionRank(b.position);
      if (rank !== 0) return rank;
      return a.name.localeCompare(b.name);
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
