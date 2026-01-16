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

    const chapterIds = idsParam.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));

    // Limit batch size to prevent performance issues
    if (chapterIds.length > 100) {
      const response = NextResponse.json(
        { data: {}, error: 'Maximum 100 chapter IDs per request' },
        { status: 400 }
      );
      return addCorsHeaders(response, request);
    }

    if (chapterIds.length === 0) {
      const response = NextResponse.json({ data: {}, error: null });
      return addCorsHeaders(response, request);
    }

    // Check cache
    const cacheKey = `member-counts-${idsParam}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      const duration = Date.now() - startTime;
      const response = NextResponse.json({ data: cached.data, error: null });
      return addCorsHeaders(response, request);
    }

    // OPTIMIZED: Single query with UNION to handle OR conditions efficiently
    // This replaces the previous approach of multiple sequential queries
    const result = await sql/* sql */`
      WITH chapter_members AS (
        SELECT DISTINCT ac.id as alumni_id, ac.chapter1 as chapter_id
        FROM public.alumni_chapter ac
        WHERE ac.chapter1 = ANY(${chapterIds}) AND ac.chapter1 IS NOT NULL
        
        UNION
        
        SELECT DISTINCT ac.id as alumni_id, ac.chapter2 as chapter_id
        FROM public.alumni_chapter ac
        WHERE ac.chapter2 = ANY(${chapterIds}) AND ac.chapter2 IS NOT NULL
        
        UNION
        
        SELECT DISTINCT ac.id as alumni_id, ac.chapter3 as chapter_id
        FROM public.alumni_chapter ac
        WHERE ac.chapter3 = ANY(${chapterIds}) AND ac.chapter3 IS NOT NULL
      )
      SELECT 
        cm.chapter_id,
        COUNT(DISTINCT CASE WHEN a.verify = ${'true'} THEN a.alumniid END) as count
      FROM chapter_members cm
      LEFT JOIN public.tbl_alumni a ON a.alumniid = cm.alumni_id
      GROUP BY cm.chapter_id
    `;

    // Build counts object
    const counts: { [key: number]: number } = {};
    
    // Initialize all chapter IDs with 0
    chapterIds.forEach(id => {
      counts[id] = 0;
    });

    // Update with actual counts from query result
    result.forEach((row: Record<string, unknown>) => {
      const chapterId = row.chapter_id ? Number(row.chapter_id) : null;
      const count = row.count ? parseInt(String(row.count), 10) : 0;
      
      if (chapterId && chapterIds.includes(chapterId)) {
        counts[chapterId] = count;
      }
    });

    // Store in cache
    cache.set(cacheKey, { data: counts, timestamp: Date.now() });

    const duration = Date.now() - startTime;
    const response = NextResponse.json({ data: counts, error: null });
    return addCorsHeaders(response, request);
  } catch (error) {
    const duration = Date.now() - startTime;
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

