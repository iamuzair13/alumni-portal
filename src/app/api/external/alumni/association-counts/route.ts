import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/dbconnect';
import { handleCorsPreflight, addCorsHeaders } from '@/lib/cors';

// Simple in-memory cache (5 minutes TTL)
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { data: { [key: number]: number }; timestamp: number }>();

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const idsParam = searchParams.get('ids');

    if (!idsParam) {
      const response = NextResponse.json(
        { data: {}, error: 'ids parameter required' },
        { status: 400 }
      );
      return addCorsHeaders(response, request);
    }

    const associationIds = idsParam.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));

    // Limit batch size to prevent performance issues
    if (associationIds.length > 100) {
      const response = NextResponse.json(
        { data: {}, error: 'Maximum 100 association IDs per request' },
        { status: 400 }
      );
      return addCorsHeaders(response, request);
    }

    if (associationIds.length === 0) {
      const response = NextResponse.json({ data: {}, error: null });
      return addCorsHeaders(response, request);
    }

    // Check cache
    const cacheKey = `association-counts-${idsParam}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      const duration = Date.now() - startTime;
      console.log(`[API] Association counts (cached) took ${duration}ms for ${associationIds.length} associations`);
      const response = NextResponse.json({ data: cached.data, error: null });
      return addCorsHeaders(response, request);
    }

    // OPTIMIZED: Single query to get counts for all associations
    // Count verified alumni for each association
    const result = await sql/* sql */`
      SELECT 
        association_id,
        COUNT(DISTINCT CASE WHEN verify = ${'true'} THEN alumniid END) as count
      FROM public.tbl_alumni
      WHERE association_id = ANY(${associationIds}) AND association_id IS NOT NULL
      GROUP BY association_id
    `;

    // Build counts object
    const counts: { [key: number]: number } = {};
    
    // Initialize all association IDs with 0
    associationIds.forEach(id => {
      counts[id] = 0;
    });

    // Update with actual counts from query result
    result.forEach((row: Record<string, unknown>) => {
      const associationId = row.association_id ? Number(row.association_id) : null;
      const count = row.count ? parseInt(String(row.count), 10) : 0;
      
      if (associationId && associationIds.includes(associationId)) {
        counts[associationId] = count;
      }
    });

    // Store in cache
    cache.set(cacheKey, { data: counts, timestamp: Date.now() });

    const duration = Date.now() - startTime;
    console.log(`[API] Association counts query took ${duration}ms for ${associationIds.length} associations`);

    const response = NextResponse.json({ data: counts, error: null });
    return addCorsHeaders(response, request);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[API] Error in /api/external/alumni/association-counts (${duration}ms):`, error);
    const response = NextResponse.json(
      {
        data: {},
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
    return addCorsHeaders(response, request);
  }
}

