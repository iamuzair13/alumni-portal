import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/dbconnect';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const chapterId = parseInt(id, 10);

    if (isNaN(chapterId) || chapterId < 1) {
      return NextResponse.json(
        { data: null, error: 'Invalid chapter ID' },
        { status: 400 }
      );
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
        return NextResponse.json({
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
      }
    }

    if (result.length === 0) {
      return NextResponse.json(
        { data: null, error: 'Chapter not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: result[0], error: null });
  } catch (error) {
    console.error('Error in /api/external/chapters/[id]:', error);
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

