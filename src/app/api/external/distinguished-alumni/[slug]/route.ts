import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/dbconnect';
import { handleCorsPreflight, addCorsHeaders } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

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
      const response = NextResponse.json(
        { data: null, error: 'Story not found' },
        { status: 404 }
      );
      return addCorsHeaders(response, request);
    }

    const row = result[0] as any;
    const parsed: any = { ...row };

    const safeJsonParse = (value: unknown, fallback: unknown) => {
      if (typeof value !== "string") return value ?? fallback;
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    };

    parsed.tags = safeJsonParse(parsed.tags, []);
    parsed.stats = safeJsonParse(parsed.stats, []);
    parsed.achievements = safeJsonParse(parsed.achievements, []);
    parsed.story = safeJsonParse(parsed.story, []);

    const storyArr = Array.isArray(parsed.story) ? parsed.story : [];
    parsed.published = storyArr.length > 0;

    const response = NextResponse.json({ data: parsed, error: null });
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

