import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/dbconnect';
import { handleCorsPreflight, addCorsHeaders } from '@/lib/cors';
import { mapEventRecordImageUrlsForExternalApi } from '@/lib/tblEventsPublic';

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const eventId = parseInt(id, 10);

    if (isNaN(eventId) || eventId < 1) {
      const response = NextResponse.json(
        { data: null, error: 'Invalid event ID' },
        { status: 400 }
      );
      return addCorsHeaders(response, request);
    }

    const result = await sql/* sql */`
      SELECT *
      FROM public.tbl_events
      WHERE id = ${eventId}
      LIMIT 1
    `;

    if (result.length === 0) {
      const response = NextResponse.json(
        { data: null, error: 'Event not found' },
        { status: 404 }
      );
      return addCorsHeaders(response, request);
    }

    const data = mapEventRecordImageUrlsForExternalApi(
      request,
      result[0] as unknown as Record<string, unknown>,
    );
    const response = NextResponse.json({ data, error: null });
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

