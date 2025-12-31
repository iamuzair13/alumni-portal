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
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const sortByParam = searchParams.get('sortBy') || 'alumniname';
    const orderParam = searchParams.get('order') || 'asc';
    const verifiedOnly = searchParams.get('verifiedOnly') !== 'false';
    const offset = (page - 1) * limit;

    // Validate pagination
    if (page < 1 || limit < 1 || limit > 100) {
      const response = NextResponse.json(
        { data: null, error: 'Invalid pagination parameters' },
        { status: 400 }
      );
      return addCorsHeaders(response, request);
    }

    // Whitelist allowed columns for ORDER BY to prevent SQL injection
    const allowedSortColumns = ['alumniname', 'degreetitle', 'yearofending', 'alumniid'];
    const sortBy = allowedSortColumns.includes(sortByParam) ? sortByParam : 'alumniname';
    
    // Validate order direction
    const order = orderParam.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const chapterId = parseInt(id, 10);
    if (isNaN(chapterId) || chapterId < 1) {
      const response = NextResponse.json(
        { data: null, error: 'Invalid chapter ID' },
        { status: 400 }
      );
      return addCorsHeaders(response, request);
    }

    // Step 1: Get alumni_chapter records for this chapter
    const chapterMembersResult = await sql/* sql */`
      SELECT id
      FROM public.alumni_chapter
      WHERE chapter1 = ${chapterId} OR chapter2 = ${chapterId} OR chapter3 = ${chapterId}
    `;

    if (chapterMembersResult.length === 0) {
      const response = NextResponse.json({
        data: [],
        count: 0,
        pagination: { page, limit, total: 0, totalPages: 0 },
        error: null
      });
      return addCorsHeaders(response, request);
    }

    const alumniIds = chapterMembersResult.map((row: Record<string, unknown>) => Number(row.id));

    // Step 2: Build WHERE conditions
    let whereConditions = sql`alumniid = ANY(${alumniIds})`;
    
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

    // Fetch verified alumni details with pagination
    // Use sql.unsafe for dynamic ORDER BY column name (whitelisted above)
    const result = await sql`
      SELECT alumniid, alumniname, degreetitle, yearofending, image1
      FROM public.tbl_alumni
      WHERE ${whereConditions}
      ORDER BY ${sql.unsafe(sortBy)} ${sql.unsafe(order)}
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const response = NextResponse.json({
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
    return addCorsHeaders(response, request);
  } catch (error) {
    console.error('Error in /api/external/chapters/[id]/members:', error);
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

