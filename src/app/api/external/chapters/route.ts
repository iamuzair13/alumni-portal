import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/dbconnect';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const isActive = searchParams.get('isActive');

    // Build WHERE conditions dynamically
    let whereConditions = sql``;
    const conditions: ReturnType<typeof sql>[] = [];

    if (type === 'national') {
      conditions.push(sql`national_chapter IS NOT NULL`);
    } else if (type === 'international') {
      conditions.push(sql`international_chapter IS NOT NULL`);
    }

    if (isActive !== null) {
      const isActiveBool = isActive === 'true';
      conditions.push(sql`is_active = ${isActiveBool}`);
    }

    // Combine conditions
    if (conditions.length > 0) {
      whereConditions = conditions.reduce((acc, condition, index) => {
        if (index === 0) return condition;
        return sql`${acc} AND ${condition}`;
      });
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

