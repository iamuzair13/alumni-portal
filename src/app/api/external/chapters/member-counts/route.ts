import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/dbconnect';
import { handleCorsPreflight, addCorsHeaders } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const idsParam = searchParams.get('ids');

    if (!idsParam) {
      const response = NextResponse.json(
        { data: {}, error: 'ids parameter required' },
        { status: 400 }
      );
      return addCorsHeaders(response, request);
    }

    const chapterIds = idsParam.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));

    if (chapterIds.length === 0) {
      const response = NextResponse.json({ data: {}, error: null });
      return addCorsHeaders(response, request);
    }

    // Get all alumni_chapter records for these chapters
    const chapterMembersResult = await sql/* sql */`
      SELECT id, chapter1, chapter2, chapter3
      FROM public.alumni_chapter
      WHERE chapter1 = ANY(${chapterIds}) OR chapter2 = ANY(${chapterIds}) OR chapter3 = ANY(${chapterIds})
    `;

    // Group alumni IDs by chapter
    const chapterAlumniMap: { [key: number]: number[] } = {};
    chapterIds.forEach(id => {
      chapterAlumniMap[id] = [];
    });

    chapterMembersResult.forEach((row: Record<string, unknown>) => {
      const chapter1 = row.chapter1 ? Number(row.chapter1) : null;
      const chapter2 = row.chapter2 ? Number(row.chapter2) : null;
      const chapter3 = row.chapter3 ? Number(row.chapter3) : null;
      const alumniId = Number(row.id);

      [chapter1, chapter2, chapter3].forEach((chapterId) => {
        if (chapterId && chapterIds.includes(chapterId)) {
          if (!chapterAlumniMap[chapterId]) {
            chapterAlumniMap[chapterId] = [];
          }
          chapterAlumniMap[chapterId].push(alumniId);
        }
      });
    });

    // Count verified alumni for each chapter
    const counts: { [key: number]: number } = {};

    for (const [chapterIdStr, alumniIds] of Object.entries(chapterAlumniMap)) {
      const chapterId = parseInt(chapterIdStr, 10);
      
      if (alumniIds.length === 0) {
        counts[chapterId] = 0;
        continue;
      }

      const countResult = await sql/* sql */`
        SELECT COUNT(*) as total
        FROM public.tbl_alumni
        WHERE alumniid = ANY(${alumniIds}) AND verify = ${'true'}
      `;

      counts[chapterId] = parseInt(String(countResult[0]?.total || 0), 10);
    }

    const response = NextResponse.json({ data: counts, error: null });
    return addCorsHeaders(response, request);
  } catch (error) {
    console.error('Error in /api/external/chapters/member-counts:', error);
    const response = NextResponse.json(
      {
        data: {},
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
    return addCorsHeaders(response, request);
  }
}

