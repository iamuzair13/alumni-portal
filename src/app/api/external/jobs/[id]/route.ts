import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/dbconnect';
import { handleCorsPreflight, addCorsHeaders } from '@/lib/cors';
import { serializeTbljobsRow } from '@/lib/tbljobsSerialize';

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

/**
 * GET /api/external/jobs/{id}
 * Retrieves a single job posting by its ID.
 * Returns every column present on `public.tbljobs` (see schema.sql).
 *
 * Path Parameters:
 * - id: The job ID (integer, required)
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const jobId = parseInt(id, 10);

    // Validate job ID
    if (isNaN(jobId) || jobId < 1) {
      const response = NextResponse.json(
        {
          data: null,
          error: 'Invalid job ID. Must be a positive integer.',
        },
        { status: 400 }
      );
      return addCorsHeaders(response, request);
    }

    const rows = await sql`
      SELECT *
      FROM public.tbljobs
      WHERE id = ${jobId}
      LIMIT 1
    `;

    // Check if job exists
    if (!rows || rows.length === 0) {
      const response = NextResponse.json(
        {
          data: null,
          error: 'Job not found',
        },
        { status: 404 }
      );
      return addCorsHeaders(response, request);
    }

    const job = serializeTbljobsRow(rows[0] as Record<string, unknown>);

    const response = NextResponse.json({
      data: job,
      error: null,
    });

    return addCorsHeaders(response, request);
  } catch (error) {
    const response = NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
    return addCorsHeaders(response, request);
  }
}
