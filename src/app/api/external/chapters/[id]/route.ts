import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/dbconnect';
import { handleCorsPreflight, addCorsHeaders } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const chapterId = parseInt(id, 10);

    if (isNaN(chapterId) || chapterId < 1) {
      const response = NextResponse.json(
        { data: null, error: 'Invalid chapter ID' },
        { status: 400 }
      );
      return addCorsHeaders(response, request);
    }

    // Try tblchapters first
    let result = await sql/* sql */`
      SELECT *
      FROM public.tblchapters
      WHERE id = ${chapterId}
      LIMIT 1
    `;

    // Fallback to alumnichapterslocation for backward compatibility
    if (result.length === 0) {
      result = await sql/* sql */`
        SELECT *
        FROM public.alumnichapterslocation
        WHERE chapterid = ${chapterId}
        LIMIT 1
      `;

      if (result.length > 0) {
        const locationChapter = result[0] as Record<string, unknown>;
        const response = NextResponse.json({
          data: {
            id: locationChapter.chapterid,
            national_chapter: locationChapter.chaptertitle,
            international_chapter: null,
            chapter_whatsapp: locationChapter.chapterwhatsapp,
            chapter_image: null,
            is_active: true,
            description: `Chapter located in ${locationChapter.chapterlocation}`,
            cities: locationChapter.chapterlocation
          },
          error: null
        });
        return addCorsHeaders(response, request);
      }
    }

    if (result.length === 0) {
      const response = NextResponse.json(
        { data: null, error: 'Chapter not found' },
        { status: 404 }
      );
      return addCorsHeaders(response, request);
    }

    const response = NextResponse.json({ data: result[0], error: null });
    return addCorsHeaders(response, request);
  } catch (error) {
    const response = NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
    return addCorsHeaders(response, request);
  }
}

