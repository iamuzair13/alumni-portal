import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/dbconnect';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ associationId: string }> }
) {
  try {
    const { associationId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const verifiedOnly = searchParams.get('verifiedOnly') !== 'false';
    const offset = (page - 1) * limit;

    // Validate pagination
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { data: null, error: 'Invalid pagination parameters' },
        { status: 400 }
      );
    }

    let whereConditions = sql`association_id = ${associationId}`;

    if (verifiedOnly) {
      whereConditions = sql`${whereConditions} AND verify = ${'true'}`;
    }

    // Get total count
    const countQuery = sql`
      SELECT COUNT(*) as total
      FROM public.tbl_alumni
      WHERE ${whereConditions}
    `;
    const countResult = await countQuery;
    const total = parseInt(String(countResult[0]?.total || 0), 10);

    // Fetch alumni with pagination
    const result = await sql`
      SELECT alumniid, alumniname, degreetitle, yearofending, image1
      FROM public.tbl_alumni
      WHERE ${whereConditions}
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    return NextResponse.json({
      data: result,
      count: total,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      error: null
    });
  } catch (error) {
    console.error('Error in /api/external/alumni/association/[associationId]:', error);
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

