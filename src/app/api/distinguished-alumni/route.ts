import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";

// GET - List all distinguished alumni
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const offset = (page - 1) * limit;
    const search = searchParams.get("search") || "";

    let query;
    let countQuery;

    if (search.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      query = sql/* sql */`
        SELECT *
        FROM public.distinguished_alumni
        WHERE 
          LOWER(name) LIKE ${searchTerm}
          OR LOWER(slug) LIKE ${searchTerm}
          OR LOWER(role) LIKE ${searchTerm}
          OR LOWER(summary) LIKE ${searchTerm}
          OR LOWER(headline) LIKE ${searchTerm}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      countQuery = sql/* sql */`
        SELECT COUNT(*) as total
        FROM public.distinguished_alumni
        WHERE 
          LOWER(name) LIKE ${searchTerm}
          OR LOWER(slug) LIKE ${searchTerm}
          OR LOWER(role) LIKE ${searchTerm}
          OR LOWER(summary) LIKE ${searchTerm}
          OR LOWER(headline) LIKE ${searchTerm}
      `;
    } else {
      query = sql/* sql */`
        SELECT *
        FROM public.distinguished_alumni
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      countQuery = sql/* sql */`
        SELECT COUNT(*) as total
        FROM public.distinguished_alumni
      `;
    }

    const [rows, countResult] = await Promise.all([query, countQuery]);
    const total = Number(countResult[0]?.total || 0);

    return NextResponse.json({
      items: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }, { status: 200 });
  } catch (error) {
    console.error("[API] Error fetching distinguished alumni:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch distinguished alumni" },
      { status: 500 }
    );
  }
}

// POST - Create new distinguished alumni
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      slug,
      name,
      image,
      role,
      summary,
      headline,
      quote,
      quote_by,
      tags,
      stats,
      achievements,
      story
    } = body;

    // Validation
    if (!slug || !name || !image || !role || !summary) {
      return NextResponse.json(
        { error: "Missing required fields: slug, name, image, role, summary" },
        { status: 400 }
      );
    }

    // Check if slug already exists
    const existing = await sql/* sql */`
      SELECT id FROM public.distinguished_alumni
      WHERE slug = ${slug}
      LIMIT 1
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Slug already exists. Please use a unique slug." },
        { status: 400 }
      );
    }

    // Insert new record
    const result = await sql/* sql */`
      INSERT INTO public.distinguished_alumni (
        slug, name, image, role, summary, headline, quote, quote_by,
        tags, stats, achievements, story, created_at, updated_at
      ) VALUES (
        ${slug},
        ${name},
        ${image},
        ${role},
        ${summary},
        ${headline || null},
        ${quote || null},
        ${quote_by || null},
        ${tags ? JSON.stringify(tags) : JSON.stringify([])},
        ${stats ? JSON.stringify(stats) : JSON.stringify([])},
        ${achievements ? JSON.stringify(achievements) : JSON.stringify([])},
        ${story ? JSON.stringify(story) : JSON.stringify([])},
        NOW(),
        NOW()
      )
      RETURNING *
    `;

    return NextResponse.json({ item: result[0] }, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating distinguished alumni:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create distinguished alumni" },
      { status: 500 }
    );
  }
}