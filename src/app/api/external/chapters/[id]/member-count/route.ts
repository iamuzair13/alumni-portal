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
        { count: 0, error: 'Invalid chapter ID' },
        { status: 400 }
      );
      return addCorsHeaders(response, request);
    }

    // OPTIMIZED: Single query with JOIN instead of two separate queries
    const countResult = await sql/* sql */`
      SELECT COUNT(DISTINCT CASE WHEN a.verify = ${'true'} THEN a.alumniid END) as total
      FROM public.alumni_chapter ac
      LEFT JOIN public.tbl_alumni a ON a.alumniid = ac.id
      WHERE (ac.chapter1 = ${chapterId} OR ac.chapter2 = ${chapterId} OR ac.chapter3 = ${chapterId})
    `;

    const count = parseInt(String(countResult[0]?.total || 0), 10);

    const response = NextResponse.json({
      count,
      error: null
    });
    return addCorsHeaders(response, request);
  } catch (error) {
    console.error('Error in /api/external/chapters/[id]/member-count:', error);
    const response = NextResponse.json(
      {
        count: 0,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
    return addCorsHeaders(response, request);
  }
}

