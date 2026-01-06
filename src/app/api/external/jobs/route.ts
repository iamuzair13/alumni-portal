import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/dbconnect';
import { handleCorsPreflight, addCorsHeaders } from '@/lib/cors';

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
function formatJob(row: {
  id: bigint | number;
  title: string | null;
  company: string | null;
  location: string | null;
  category: string | null;
  job_link: string | null;
  deadline: Date | string | null;
  created_at: Date | string | null;
  description?: string | null;
}) {
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
 * GET /api/external/jobs
 * Retrieves a list of all job postings with optional filtering
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

    // Build the query
    // Note: We don't include description in the list endpoint (only in detail view)
    let query: ReturnType<typeof sql>;
    
    if (limit !== undefined && offset !== undefined) {
      query = sql`
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
        ${whereConditions}
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    } else if (limit !== undefined) {
      query = sql`
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
        ${whereConditions}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    } else if (offset !== undefined) {
      query = sql`
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
        ${whereConditions}
        ORDER BY created_at DESC
        OFFSET ${offset}
      `;
    } else {
      query = sql`
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
        ${whereConditions}
        ORDER BY created_at DESC
      `;
    }

    const rows = await query;

    // Format the results
    const jobs = rows.map(formatJob);

    const response = NextResponse.json({
      data: jobs,
      error: null,
    });

    return addCorsHeaders(response, request);
  } catch (error) {
    console.error('Error in /api/external/jobs:', error);
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

