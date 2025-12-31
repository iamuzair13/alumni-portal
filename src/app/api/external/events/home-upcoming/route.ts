import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/dbconnect';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '4', 10);

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
      WHERE category != 'Coaching and Mentorships'
        AND type = 'upcoming'
      ORDER BY fromdate ASC NULLS LAST
      LIMIT ${limit}
    `;

    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    console.error('Error in /api/external/events/home-upcoming:', error);
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

