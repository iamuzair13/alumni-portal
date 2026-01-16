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
    const associationId = parseInt(id, 10);

    if (isNaN(associationId) || associationId < 1) {
      const response = NextResponse.json(
        { data: null, error: 'Invalid association ID' },
        { status: 400 }
      );
      return addCorsHeaders(response, request);
    }

    const result = await sql/* sql */`
      SELECT *
      FROM public.tbl_associations
      WHERE id = ${associationId}
      LIMIT 1
    `;

    if (result.length === 0) {
      const response = NextResponse.json(
        { data: null, error: 'Association not found' },
        { status: 404 }
      );
      return addCorsHeaders(response, request);
    }

    const response = NextResponse.json({ data: result[0], error: null });
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

