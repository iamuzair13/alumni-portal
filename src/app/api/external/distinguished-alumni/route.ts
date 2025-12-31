import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/dbconnect';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const orderByParam = searchParams.get('orderBy') || 'created_at';
    const orderParam = searchParams.get('order') || 'desc';

    // Validate limit
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { data: null, error: 'Limit must be between 1 and 100' },
        { status: 400 }
      );
    }

    // Whitelist allowed columns for ORDER BY to prevent SQL injection
    const allowedOrderByColumns = ['created_at', 'name', 'slug', 'id'];
    const orderBy = allowedOrderByColumns.includes(orderByParam) ? orderByParam : 'created_at';
    
    // Validate order direction
    const order = orderParam.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Use sql.unsafe for dynamic ORDER BY column name (whitelisted above)
    const result = await sql`
      SELECT slug, name, image, role, summary
      FROM public.distinguished_alumni
      ORDER BY ${sql.unsafe(orderBy)} ${sql.unsafe(order)}
      LIMIT ${limit}
    `;

    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    console.error('Error in /api/external/distinguished-alumni:', error);
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

