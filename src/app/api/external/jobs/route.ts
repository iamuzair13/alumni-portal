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
 * GET /api/external/jobs
 * Retrieves a list of all job postings with optional filtering.
 * Returns every column present on `public.tbljobs` (see schema.sql).
 *
 * Query Parameters:
 * - category: Filter by job category (e.g., "uol", "partner")
 * - location: Filter by job location
 * - company: Filter by company name
 * - limit: Limit the number of results
 * - offset: Offset for pagination
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const location = searchParams.get('location');
    const company = searchParams.get('company');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    // Parse pagination parameters
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const offset = offsetParam ? parseInt(offsetParam, 10) : undefined;

    // Validate pagination parameters
    if (limit !== undefined && (isNaN(limit) || limit < 1 || limit > 1000)) {
      const response = NextResponse.json(
        {
          data: null,
          error: 'Invalid limit parameter. Must be between 1 and 1000.',
        },
        { status: 400 }
      );
      return addCorsHeaders(response, request);
    }

    if (offset !== undefined && (isNaN(offset) || offset < 0)) {
      const response = NextResponse.json(
        {
          data: null,
          error: 'Invalid offset parameter. Must be a non-negative integer.',
        },
        { status: 400 }
      );
      return addCorsHeaders(response, request);
    }

    // Build WHERE conditions dynamically
    let whereConditions = sql``;

    if (category && location && company) {
      const locationPattern = `%${location}%`;
      const companyPattern = `%${company}%`;
      whereConditions = sql`WHERE category = ${category} AND location ILIKE ${locationPattern} AND company ILIKE ${companyPattern}`;
    } else if (category && location) {
      const locationPattern = `%${location}%`;
      whereConditions = sql`WHERE category = ${category} AND location ILIKE ${locationPattern}`;
    } else if (category && company) {
      const companyPattern = `%${company}%`;
      whereConditions = sql`WHERE category = ${category} AND company ILIKE ${companyPattern}`;
    } else if (location && company) {
      const locationPattern = `%${location}%`;
      const companyPattern = `%${company}%`;
      whereConditions = sql`WHERE location ILIKE ${locationPattern} AND company ILIKE ${companyPattern}`;
    } else if (category) {
      whereConditions = sql`WHERE category = ${category}`;
    } else if (location) {
      const locationPattern = `%${location}%`;
      whereConditions = sql`WHERE location ILIKE ${locationPattern}`;
    } else if (company) {
      const companyPattern = `%${company}%`;
      whereConditions = sql`WHERE company ILIKE ${companyPattern}`;
    } else {
      whereConditions = sql`WHERE 1=1`;
    }

    let rows: Record<string, unknown>[];

    if (limit !== undefined && offset !== undefined) {
      rows = (await sql`
        SELECT *
        FROM public.tbljobs
        ${whereConditions}
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `) as Record<string, unknown>[];
    } else if (limit !== undefined) {
      rows = (await sql`
        SELECT *
        FROM public.tbljobs
        ${whereConditions}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `) as Record<string, unknown>[];
    } else if (offset !== undefined) {
      rows = (await sql`
        SELECT *
        FROM public.tbljobs
        ${whereConditions}
        ORDER BY created_at DESC
        OFFSET ${offset}
      `) as Record<string, unknown>[];
    } else {
      rows = (await sql`
        SELECT *
        FROM public.tbljobs
        ${whereConditions}
        ORDER BY created_at DESC
      `) as Record<string, unknown>[];
    }

    const jobs = rows.map((row) =>
      serializeTbljobsRow(row)
    );

    const response = NextResponse.json({
      data: jobs,
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
