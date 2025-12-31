import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/dbconnect';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const isActive = searchParams.get('isActive');

    // Build WHERE conditions dynamically
    let whereConditions = sql``;

    if (type === 'national' && isActive !== null) {
      const isActiveBool = isActive === 'true';
      whereConditions = sql`national_chapter IS NOT NULL AND is_active = ${isActiveBool}`;
    } else if (type === 'national') {
      whereConditions = sql`national_chapter IS NOT NULL`;
    } else if (type === 'international' && isActive !== null) {
      const isActiveBool = isActive === 'true';
      whereConditions = sql`international_chapter IS NOT NULL AND is_active = ${isActiveBool}`;
    } else if (type === 'international') {
      whereConditions = sql`international_chapter IS NOT NULL`;
    } else if (isActive !== null) {
      const isActiveBool = isActive === 'true';
      whereConditions = sql`is_active = ${isActiveBool}`;
    } else {
      whereConditions = sql`1=1`;
    }

    const result = await sql/* sql */`
      SELECT *
      FROM public.tblchapters
      WHERE ${whereConditions}
      ORDER BY id ASC
    `;

    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    console.error('Error in /api/external/chapters:', error);
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

