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

type BirthdayRow = {
  alumniId: number;
  name: string;
  sapId: string | null;
  registrationNo: string | null;
  program: string | null;
  passingOutYear: number | null;
  association: string | null;
  chapters: string[];
  imageUrl: string;
  linkedinPostUrl: string | null;
  giftImageUrl: string;
  createdAt: string | null;
};

/**
 * GET /api/external/birthdays
 * Public list of curated alumni birthday entries for external consumers
 * (e.g. the UOL website).
 *
 * Returns ALL entries ordered by creation date, most recent first.
 * Sanitized shape — no CNICs, emails, or other PII.
 *
 * Query Parameters:
 * - search: matches name, SAP ID, or registration no
 * - year: filter by passing-out year
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search')?.trim() || '';
    const yearParam = searchParams.get('year');

    const year = yearParam != null && yearParam !== '' ? Number(yearParam) : null;
    if (yearParam && (!Number.isFinite(year) || year! < 1900 || year! > 2100)) {
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
        )`
      : sql``;
    const yearCondition = year != null ? sql`AND a.yearofending = ${year}` : sql``;

    const rows = await sql/* sql */`
      SELECT
        a.alumniid,
        a.alumniname,
        a.sapid,
        a.registrationno,
        a.degree_title,
        a.yearofending,
        a.image1,
        p.program_name,
        COALESCE(assoc.faculty_name, f.faculty_name) AS association_title,
        ac.chapter1,
        ac.chapter2,
        ac.chapter3,
        b.linkedin_post_url,
        b.gift_image_url,
        b.created_at
      FROM public.alumni_birthdays b
      INNER JOIN public.tbl_alumni a ON a.alumniid = b.alumniid
      LEFT JOIN public.tbl_programs p ON p.id = a.program
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      LEFT JOIN public.tbl_faculties assoc ON assoc.id = a.association_id
      LEFT JOIN public.alumni_chapter ac ON ac.id = a.alumniid
      WHERE 1=1
      ${searchCondition}
      ${yearCondition}
      ORDER BY b.created_at DESC, b.id DESC
    `;

    // Resolve all referenced chapters in one query
    const chapterIds = new Set<number>();
    for (const r of rows as Record<string, unknown>[]) {
      for (const key of ['chapter1', 'chapter2', 'chapter3']) {
        const v = r[key];
        if (v != null && Number.isFinite(Number(v))) chapterIds.add(Number(v));
      }
    }

    const chapterTitles = new Map<number, string>();
    if (chapterIds.size > 0) {
      const chRows = await sql/* sql */`
        SELECT id, COALESCE(national_chapter, international_chapter) AS title
        FROM public.tblchapters
        WHERE id = ANY(${[...chapterIds]}::int[])
      `;
      for (const c of chRows as Record<string, unknown>[]) {
        const t = String(c.title ?? '').trim();
        if (t) chapterTitles.set(Number(c.id), t);
      }
    }

    const str = (v: unknown): string | null => {
      const s = String(v ?? '').trim();
      return s || null;
    };

    const items: BirthdayRow[] = (rows as Record<string, unknown>[]).map((r) => {
      const rawImage = String(r.image1 ?? '').trim();
      const rawGift = String(r.gift_image_url ?? '').trim();

      return {
        alumniId: Number(r.alumniid),
        name: String(r.alumniname ?? ''),
        sapId: str(r.sapid),
        registrationNo: str(r.registrationno),
        program: str(r.degree_title) ?? str(r.program_name),
        passingOutYear:
          r.yearofending != null && Number.isFinite(Number(r.yearofending))
            ? Number(r.yearofending)
            : null,
        association: str(r.association_title),
        chapters: ['chapter1', 'chapter2', 'chapter3']
          .map((k) => chapterTitles.get(Number(r[k])))
          .filter((t): t is string => Boolean(t)),
        imageUrl:
          rawImage && rawImage !== 'null' ? toAbsoluteEventImageUrl(request, rawImage) : '',
        linkedinPostUrl: str(r.linkedin_post_url),
        giftImageUrl:
          rawGift && rawGift !== 'null' ? toAbsoluteEventImageUrl(request, rawGift) : '',
        createdAt: r.created_at != null ? String(r.created_at) : null,
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
