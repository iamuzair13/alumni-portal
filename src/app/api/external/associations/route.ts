import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/dbconnect';
import { handleCorsPreflight, addCorsHeaders } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

export async function GET(request: NextRequest) {
  try {
    const result = await sql/* sql */`
      SELECT
        id,
        faculty_name AS title,
        NULL::text AS description,
        NULL::text AS dean,
        NULL::text AS phone,
        NULL::text AS email,
        NULL::text AS address,
        created_at
      FROM public.tbl_faculties
      ORDER BY id ASC
    `;

    const response = NextResponse.json({ data: result, error: null });
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

