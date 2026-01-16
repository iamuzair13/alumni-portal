import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/dbconnect';
import { handleCorsPreflight, addCorsHeaders } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const associationId = searchParams.get('associationId');

    let whereConditions = sql`verify = ${'true'}`;

    if (associationId) {
      whereConditions = sql`${whereConditions} AND association_id = ${associationId}`;
    }

    const result = await sql/* sql */`
      SELECT COUNT(*) as total
      FROM public.tbl_alumni
      WHERE ${whereConditions}
    `;

    const count = parseInt(String(result[0]?.total || 0), 10);

    const response = NextResponse.json({
      count,
      error: null
    });
    return addCorsHeaders(response, request);
  } catch (error) {
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

