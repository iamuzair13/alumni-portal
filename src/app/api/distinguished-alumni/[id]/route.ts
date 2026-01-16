import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

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

    // Parse JSONB fields if they're strings
    const row = result[0] as any;
    const parsed: any = { ...row };
    
    if (typeof parsed.tags === 'string') {
      try {
        parsed.tags = JSON.parse(parsed.tags);
      } catch (e) {
        parsed.tags = [];
      }
    }
    if (typeof parsed.stats === 'string') {
      try {
        parsed.stats = JSON.parse(parsed.stats);
      } catch (e) {
        parsed.stats = null;
      }
    }
    if (typeof parsed.achievements === 'string') {
      try {
        parsed.achievements = JSON.parse(parsed.achievements);
      } catch (e) {
        parsed.achievements = [];
      }
    }
    if (typeof parsed.story === 'string') {
      try {
        parsed.story = JSON.parse(parsed.story);
      } catch (e) {
        parsed.story = [];
      }
    }

    return NextResponse.json({ item: parsed }, { status: 200 });
  } catch (error) {

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

    // Get existing record to preserve image if not uploading new one
    const existingRecord = await sql/* sql */`
      SELECT image FROM public.distinguished_alumni
      WHERE id = ${idNum}
      LIMIT 1
    `;

    if (existingRecord.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const existingImage = existingRecord[0]?.image || null;

    // Check if request is FormData (for image upload) or JSON
    const contentType = request.headers.get("content-type") || "";
    let slug: string | null = null;
    let name: string | null = null;
    let image: string | null = existingImage; // Default to existing image
    let role: string | null = null;
    let summary: string | null = null;
    let headline: string | null = null;
    let quote: string | null = null;
    let quote_by: string | null = null;
    let tags: any[] | null = null;
    let stats: any | null = null;
    let achievements: any[] | null = null;
    let story: any[] | null = null;

    if (contentType.includes("multipart/form-data")) {
      // Handle FormData with image upload
      const formData = await request.formData();
      
      slug = formData.get("slug") ? String(formData.get("slug")).trim() : null;
      name = formData.get("name") ? String(formData.get("name")).trim() : null;
      role = formData.get("role") ? String(formData.get("role")).trim() : null;
      summary = formData.get("summary") ? String(formData.get("summary")).trim() : null;
      headline = formData.get("headline") ? String(formData.get("headline")).trim() : null;
      quote = formData.get("quote") ? String(formData.get("quote")).trim() : null;
      quote_by = formData.get("quote_by") ? String(formData.get("quote_by")).trim() : null;
      
      // Parse JSON fields
      const tagsStr = formData.get("tags");
      if (tagsStr) {
        try {
          tags = JSON.parse(String(tagsStr));
        } catch (e) {
          tags = null;
        }
      }
      
      const statsStr = formData.get("stats");
      if (statsStr) {
        try {
          stats = JSON.parse(String(statsStr));
        } catch (e) {
          stats = null;
        }
      }
      
      const achievementsStr = formData.get("achievements");
      if (achievementsStr) {
        try {
          achievements = JSON.parse(String(achievementsStr));
        } catch (e) {
          achievements = null;
        }
      }
      
      const storyStr = formData.get("story");
      if (storyStr) {
        try {
          story = JSON.parse(String(storyStr));
        } catch (e) {
          story = null;
        }
      }

      // Handle image upload (optional - only if new image is provided)
      const imageFile = formData.get("image") as File | null;
      if (imageFile && imageFile.size > 0) {
        // Validate file type
        const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
        if (!allowedTypes.includes(imageFile.type)) {
          return NextResponse.json({ 
            error: "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed." 
          }, { status: 400 });
        }
        
        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (imageFile.size > maxSize) {
          return NextResponse.json({ 
            error: "File size exceeds 5MB limit" 
          }, { status: 400 });
        }
        
        // Generate unique filename
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 9);
        const extension = imageFile.name.split(".").pop() || "jpg";
        const filename = `distinguished-${timestamp}-${randomSuffix}.${extension}`;
        
        // Create uploads directory if it doesn't exist
        const uploadsDir = join(process.cwd(), "public", "images");
        if (!existsSync(uploadsDir)) {
          await mkdir(uploadsDir, { recursive: true });
        }
        
        // Save file
        const filePath = join(uploadsDir, filename);
        const bytes = await imageFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filePath, buffer);
        
        // Save just the filename to database
        image = filename;

      }
      // If no new image uploaded, image remains as existingImage (already set above)
    } else {
      // Handle JSON (backward compatibility)
      const body = await request.json();
      slug = body.slug || null;
      name = body.name || null;
      image = body.image !== undefined ? body.image : existingImage; // Use existing if not provided
      role = body.role || null;
      summary = body.summary || null;
      headline = body.headline || null;
      quote = body.quote || null;
      quote_by = body.quote_by || null;
      tags = body.tags || null;
      stats = body.stats || null;
      achievements = body.achievements || null;
      story = body.story || null;
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

    // Parse JSONB fields if they're strings
    const row = result[0] as any;
    const parsed: any = { ...row };
    
    if (typeof parsed.tags === 'string') {
      try {
        parsed.tags = JSON.parse(parsed.tags);
      } catch (e) {
        parsed.tags = [];
      }
    }
    if (typeof parsed.stats === 'string') {
      try {
        parsed.stats = JSON.parse(parsed.stats);
      } catch (e) {
        parsed.stats = null;
      }
    }
    if (typeof parsed.achievements === 'string') {
      try {
        parsed.achievements = JSON.parse(parsed.achievements);
      } catch (e) {
        parsed.achievements = [];
      }
    }
    if (typeof parsed.story === 'string') {
      try {
        parsed.story = JSON.parse(parsed.story);
      } catch (e) {
        parsed.story = [];
      }
    }

    return NextResponse.json({ item: parsed }, { status: 200 });
  } catch (error) {

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

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete distinguished alumni" },
      { status: 500 }
    );
  }
}