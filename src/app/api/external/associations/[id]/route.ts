import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/dbconnect';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const associationId = parseInt(id, 10);

    if (isNaN(associationId) || associationId < 1) {
      return NextResponse.json(
        { data: null, error: 'Invalid association ID' },
        { status: 400 }
      );
    }

    const result = await sql/* sql */`
      SELECT *
      FROM public.tbl_associations
      WHERE id = ${associationId}
      LIMIT 1
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { data: null, error: 'Association not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: result[0], error: null });
  } catch (error) {
    console.error('Error in /api/external/associations/[id]:', error);
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

