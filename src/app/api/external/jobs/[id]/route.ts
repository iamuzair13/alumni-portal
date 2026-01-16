import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/dbconnect';
import { handleCorsPreflight, addCorsHeaders } from '@/lib/cors';

/**
 * Database row type for jobs
 */
type JobRow = {
  id: bigint | number;
  title: string | null;
  company: string | null;
  location: string | null;
  category: string | null;
  job_link: string | null;
  deadline: Date | string | null;
  created_at: Date | string | null;
  description?: string | null;
};

/**
 * Convert date to ISO 8601 format (UTC)
 */
function toUtcIso(date: unknown): string | null {
  try {
    if (!date) return null;
    const d = new Date(String(date));
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

/**
 * Format job data from database row
 */
function formatJob(row: JobRow) {
  return {
    id: Number(row.id),
    title: row.title || null,
    company: row.company || null,
    location: row.location || null,
    category: row.category || null,
    job_link: row.job_link || null,
    deadline: toUtcIso(row.deadline),
    created_at: toUtcIso(row.created_at),
    ...(row.description !== undefined && { description: row.description || null }),
  };
}

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

/**
 * GET /api/external/jobs/{id}
 * Retrieves a single job posting by its ID
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

    // Query the database
    // Note: We try to select description, but if the column doesn't exist,
    // PostgreSQL will return an error which we'll handle gracefully
    let rows;
    try {
      rows = await sql`
        SELECT 
          id,
          title,
          company,
          location,
          category,
          job_link,
          deadline,
          created_at,
          description
        FROM public.tbljobs
        WHERE id = ${jobId}
        LIMIT 1
      `;
    } catch (dbError) {
      // If description column doesn't exist, try without it
      if (
        dbError instanceof Error &&
        dbError.message.includes('column "description"')
      ) {
        rows = await sql`
          SELECT 
            id,
            title,
            company,
            location,
            category,
            job_link,
            deadline,
            created_at
          FROM public.tbljobs
          WHERE id = ${jobId}
          LIMIT 1
        `;
      } else {
        throw dbError;
      }
    }

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

    // Format the result
    const job = formatJob(rows[0] as unknown as JobRow);

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

