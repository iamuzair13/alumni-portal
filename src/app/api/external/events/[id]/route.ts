import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/dbconnect';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const eventId = parseInt(id, 10);

    if (isNaN(eventId) || eventId < 1) {
      return NextResponse.json(
        { data: null, error: 'Invalid event ID' },
        { status: 400 }
      );
    }

    const result = await sql/* sql */`
      SELECT *
      FROM public.tbl_events
      WHERE id = ${eventId}
      LIMIT 1
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { data: null, error: 'Event not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: result[0], error: null });
  } catch (error) {
    console.error('Error in /api/external/events/[id]:', error);
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

