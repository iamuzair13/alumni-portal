import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";

// GET - Get single distinguished alumni by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const idNum = parseInt(id, 10);

    if (isNaN(idNum)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const result = await sql/* sql */`
      SELECT *
      FROM public.distinguished_alumni
      WHERE id = ${idNum}
      LIMIT 1
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ item: result[0] }, { status: 200 });
  } catch (error) {
    console.error("[API] Error fetching distinguished alumni:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch distinguished alumni" },
      { status: 500 }
    );
  }
}

// PUT - Update distinguished alumni
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const idNum = parseInt(id, 10);

    if (isNaN(idNum)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
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

    // Check if record exists
    const existing = await sql/* sql */`
      SELECT id FROM public.distinguished_alumni
      WHERE id = ${idNum}
      LIMIT 1
    `;

    if (existing.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Check if slug is being changed and if new slug already exists
    if (slug) {
      const slugCheck = await sql/* sql */`
        SELECT id FROM public.distinguished_alumni
        WHERE slug = ${slug} AND id != ${idNum}
        LIMIT 1
      `;

      if (slugCheck.length > 0) {
        return NextResponse.json(
          { error: "Slug already exists. Please use a unique slug." },
          { status: 400 }
        );
      }
    }

    // Update record
    const result = await sql/* sql */`
      UPDATE public.distinguished_alumni
      SET
        slug = COALESCE(${slug}, slug),
        name = COALESCE(${name}, name),
        image = COALESCE(${image}, image),
        role = COALESCE(${role}, role),
        summary = COALESCE(${summary}, summary),
        headline = COALESCE(${headline}, headline),
        quote = COALESCE(${quote}, quote),
        quote_by = COALESCE(${quote_by}, quote_by),
        tags = COALESCE(${tags ? JSON.stringify(tags) : null}, tags),
        stats = COALESCE(${stats ? JSON.stringify(stats) : null}, stats),
        achievements = COALESCE(${achievements ? JSON.stringify(achievements) : null}, achievements),
        story = COALESCE(${story ? JSON.stringify(story) : null}, story),
        updated_at = NOW()
      WHERE id = ${idNum}
      RETURNING *
    `;

    return NextResponse.json({ item: result[0] }, { status: 200 });
  } catch (error) {
    console.error("[API] Error updating distinguished alumni:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update distinguished alumni" },
      { status: 500 }
    );
  }
}

// DELETE - Delete distinguished alumni
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const idNum = parseInt(id, 10);

    if (isNaN(idNum)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // Check if record exists
    const existing = await sql/* sql */`
      SELECT id, name FROM public.distinguished_alumni
      WHERE id = ${idNum}
      LIMIT 1
    `;

    if (existing.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Delete record
    await sql/* sql */`
      DELETE FROM public.distinguished_alumni
      WHERE id = ${idNum}
    `;

    return NextResponse.json(
      { message: "Distinguished alumni deleted successfully", deletedItem: existing[0] },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] Error deleting distinguished alumni:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete distinguished alumni" },
      { status: 500 }
    );
  }
}