import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/dbconnect';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chapterId: string }> }
) {
  try {
    const { chapterId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '3', 10);
    const chapterIdNum = parseInt(chapterId, 10);

    if (isNaN(chapterIdNum) || chapterIdNum < 1) {
      return NextResponse.json(
        { data: null, error: 'Invalid chapter ID' },
        { status: 400 }
      );
    }

    // Validate limit
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { data: null, error: 'Limit must be between 1 and 100' },
        { status: 400 }
      );
    }

    const result = await sql/* sql */`
      SELECT *
      FROM public.tbl_events
      WHERE chapter_id = ${chapterIdNum}
      ORDER BY fromdate DESC NULLS LAST
      LIMIT ${limit}
    `;

    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    console.error('Error in /api/external/events/chapter/[chapterId]:', error);
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

