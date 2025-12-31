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
        { count: 0, error: 'Invalid chapter ID' },
        { status: 400 }
      );
    }

    // Get alumni IDs for this chapter
    const chapterMembersResult = await sql/* sql */`
      SELECT id
      FROM public.alumni_chapter
      WHERE chapter1 = ${chapterId} OR chapter2 = ${chapterId} OR chapter3 = ${chapterId}
    `;

    if (chapterMembersResult.length === 0) {
      return NextResponse.json({ count: 0, error: null });
    }

    const alumniIds = chapterMembersResult.map((row: Record<string, unknown>) => Number(row.id));

    // Count verified alumni
    const countResult = await sql/* sql */`
      SELECT COUNT(*) as total
      FROM public.tbl_alumni
      WHERE alumniid = ANY(${alumniIds}) AND verify = ${'true'}
    `;

    const count = parseInt(String(countResult[0]?.total || 0), 10);

    return NextResponse.json({
      count,
      error: null
    });
  } catch (error) {
    console.error('Error in /api/external/chapters/[id]/member-count:', error);
    return NextResponse.json(
      {
        count: 0,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

