import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/dbconnect';
import { handleCorsPreflight, addCorsHeaders } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const result = await sql/* sql */`
      SELECT *
      FROM public.distinguished_alumni
      WHERE slug = ${slug}
      LIMIT 1
    `;

    if (result.length === 0) {
      const response = NextResponse.json(
        { data: null, error: 'Story not found' },
        { status: 404 }
      );
      return addCorsHeaders(response, request);
    }

    const response = NextResponse.json({ data: result[0], error: null });
    return addCorsHeaders(response, request);
  } catch (error) {
    console.error('Error in /api/external/distinguished-alumni/[slug]:', error);
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

