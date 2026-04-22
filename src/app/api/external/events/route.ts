import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/dbconnect';
import { handleCorsPreflight, addCorsHeaders } from '@/lib/cors';
import { mapEventRecordImageUrlsForExternalApi } from '@/lib/tblEventsPublic';

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const orderByParam = searchParams.get('orderBy') || 'fromdate';
    const orderParam = searchParams.get('order') || 'desc';
    const offset = (page - 1) * limit;

    // Validate pagination
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { data: null, error: 'Invalid pagination parameters' },
        { status: 400 }
      );
    }

    // Whitelist allowed columns for ORDER BY to prevent SQL injection
    const allowedOrderByColumns = ['fromdate', 'title', 'created_at', 'id'];
    const orderBy = allowedOrderByColumns.includes(orderByParam) ? orderByParam : 'fromdate';
    
    // Validate order direction
    const order = orderParam.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Build WHERE conditions dynamically
    let whereConditions = sql``;
    
    if (category && type && search) {
      const searchPattern = `%${search}%`;
      whereConditions = sql`category = ${category} AND type = ${type} AND (title ILIKE ${searchPattern} OR shortdescription ILIKE ${searchPattern} OR longdescription ILIKE ${searchPattern})`;
    } else if (category && type) {
      whereConditions = sql`category = ${category} AND type = ${type}`;
    } else if (category && search) {
      const searchPattern = `%${search}%`;
      whereConditions = sql`category = ${category} AND (title ILIKE ${searchPattern} OR shortdescription ILIKE ${searchPattern} OR longdescription ILIKE ${searchPattern})`;
    } else if (type && search) {
      const searchPattern = `%${search}%`;
      whereConditions = sql`type = ${type} AND (title ILIKE ${searchPattern} OR shortdescription ILIKE ${searchPattern} OR longdescription ILIKE ${searchPattern})`;
    } else if (category) {
      whereConditions = sql`category = ${category}`;
    } else if (type) {
      whereConditions = sql`type = ${type}`;
    } else if (search) {
      const searchPattern = `%${search}%`;
      whereConditions = sql`(title ILIKE ${searchPattern} OR shortdescription ILIKE ${searchPattern} OR longdescription ILIKE ${searchPattern})`;
    } else {
      whereConditions = sql`1=1`;
    }

    // Get total count
    const countQuery = sql`
      SELECT COUNT(*) as total
      FROM public.tbl_events
      WHERE ${whereConditions}
    `;
    const countResult = await countQuery;
    const total = parseInt(String(countResult[0]?.total || 0), 10);

    // Build main query with ordering and pagination
    // Use sql.unsafe for dynamic ORDER BY column name (whitelisted above)
    const mainQuery = sql`
      SELECT *
      FROM public.tbl_events
      WHERE ${whereConditions}
      ORDER BY ${sql.unsafe(orderBy)} ${sql.unsafe(order)} NULLS LAST
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const result = await mainQuery;
    const data = (result as unknown as Record<string, unknown>[]).map((row) =>
      mapEventRecordImageUrlsForExternalApi(request, row),
    );

    const response = NextResponse.json({
      data,
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

