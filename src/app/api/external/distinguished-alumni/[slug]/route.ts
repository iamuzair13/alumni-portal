import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/dbconnect';

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
      return NextResponse.json(
        { data: null, error: 'Story not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: result[0], error: null });
  } catch (error) {
    console.error('Error in /api/external/distinguished-alumni/[slug]:', error);
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

