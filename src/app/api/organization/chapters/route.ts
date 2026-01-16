import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isSuperAdminUser, isAdminUser, isViewerUser } from "@/lib/alumniProfile";
import { parseChapterCities, serializeChapterCities } from "@/lib/chapterCities";

// GET - Fetch all chapters
export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Allow admin and viewer to view chapters (read-only)
    if (!isSuperAdminUser(session.user) && !isAdminUser(session.user) && !isViewerUser(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const chapters = await sql/* sql */`
      SELECT 
        id,
        national_chapter,
        international_chapter,
        chapter_whatsapp,
        chapter_image,
        is_active,
        description,
        cities
      FROM public.tblchapters
      ORDER BY 
        CASE WHEN national_chapter IS NOT NULL THEN national_chapter ELSE international_chapter END ASC
    `;

    const mapped = (chapters as Array<Record<string, unknown>>).map((c) => ({
      ...c,
      cities: parseChapterCities(c.cities),
    }));

    return NextResponse.json({ 
      success: true, 
      chapters: mapped as unknown as Array<{ 
        id: number; 
        national_chapter: string | null;
        international_chapter: string | null;
        chapter_whatsapp: string | null;
        chapter_image: string | null;
        is_active: boolean | null;
        description: string | null;
        cities: string[];
      }>
    }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch chapters";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - Create a new chapter
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin and superadmin can create chapters
    if (!isSuperAdminUser(session.user) && !isAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { 
      national_chapter, 
      international_chapter, 
      chapter_whatsapp, 
      chapter_image, 
      is_active, 
      description,
      cities,
    } = body;

    // At least one of national_chapter or international_chapter must be provided
    if ((!national_chapter || !national_chapter.trim()) && (!international_chapter || !international_chapter.trim())) {
      return NextResponse.json({ error: "Either national chapter or international chapter is required" }, { status: 400 });
    }

    // Check if chapter already exists
    const existing = await sql/* sql */`
      SELECT id FROM public.tblchapters 
      WHERE (
        (national_chapter IS NOT NULL AND LOWER(TRIM(national_chapter)) = LOWER(TRIM(${national_chapter || ""})))
        OR
        (international_chapter IS NOT NULL AND LOWER(TRIM(international_chapter)) = LOWER(TRIM(${international_chapter || ""})))
      )
      LIMIT 1
    `;

    if (Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json({ error: "Chapter with this name already exists" }, { status: 409 });
    }

    const citiesList = parseChapterCities(cities);
    const citiesText = serializeChapterCities(citiesList);

    const result = await sql/* sql */`
      INSERT INTO public.tblchapters (
        national_chapter, 
        international_chapter, 
        chapter_whatsapp, 
        chapter_image, 
        is_active, 
        description,
        cities
      )
      VALUES (
        ${national_chapter?.trim() || null}, 
        ${international_chapter?.trim() || null}, 
        ${chapter_whatsapp?.trim() || null}, 
        ${chapter_image?.trim() || null}, 
        ${is_active !== undefined ? is_active : true}, 
        ${description?.trim() || null},
        ${citiesText}
      )
      RETURNING id, national_chapter, international_chapter, chapter_whatsapp, chapter_image, is_active, description, cities
    `;

    const newChapterRaw = Array.isArray(result) ? result[0] : result;
    const newChapter = newChapterRaw
      ? ({ ...newChapterRaw, cities: parseChapterCities((newChapterRaw as Record<string, unknown>).cities) } as Record<string, unknown>)
      : newChapterRaw;
    return NextResponse.json({ 
      success: true, 
      chapter: newChapter as { 
        id: number; 
        national_chapter: string | null;
        international_chapter: string | null;
        chapter_whatsapp: string | null;
        chapter_image: string | null;
        is_active: boolean | null;
        description: string | null;
        cities: string[];
      }
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create chapter";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - Update a chapter
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin and superadmin can update chapters
    if (!isSuperAdminUser(session.user) && !isAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { 
      id, 
      national_chapter, 
      international_chapter, 
      chapter_whatsapp, 
      chapter_image, 
      is_active, 
      description,
      cities,
    } = body;

    if (!id || typeof id !== "number") {
      return NextResponse.json({ error: "Chapter ID is required" }, { status: 400 });
    }

    // At least one of national_chapter or international_chapter must be provided
    if ((!national_chapter || !national_chapter.trim()) && (!international_chapter || !international_chapter.trim())) {
      return NextResponse.json({ error: "Either national chapter or international chapter is required" }, { status: 400 });
    }

    // Check if another chapter with the same name exists
    const existing = await sql/* sql */`
      SELECT id FROM public.tblchapters 
      WHERE (
        (national_chapter IS NOT NULL AND LOWER(TRIM(national_chapter)) = LOWER(TRIM(${national_chapter || ""})))
        OR
        (international_chapter IS NOT NULL AND LOWER(TRIM(international_chapter)) = LOWER(TRIM(${international_chapter || ""})))
      )
        AND id != ${id}
      LIMIT 1
    `;

    if (Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json({ error: "Another chapter with this name already exists" }, { status: 409 });
    }

    const citiesList = parseChapterCities(cities);
    const citiesText = serializeChapterCities(citiesList);

    const result = await sql/* sql */`
      UPDATE public.tblchapters
      SET 
        national_chapter = ${national_chapter?.trim() || null},
        international_chapter = ${international_chapter?.trim() || null},
        chapter_whatsapp = ${chapter_whatsapp?.trim() || null},
        chapter_image = ${chapter_image?.trim() || null},
        is_active = ${is_active !== undefined ? is_active : true},
        description = ${description?.trim() || null},
        cities = ${citiesText}
      WHERE id = ${id}
      RETURNING id, national_chapter, international_chapter, chapter_whatsapp, chapter_image, is_active, description, cities
    `;

    const updatedRaw = Array.isArray(result) ? result[0] : result;
    const updated = updatedRaw
      ? ({ ...updatedRaw, cities: parseChapterCities((updatedRaw as Record<string, unknown>).cities) } as Record<string, unknown>)
      : updatedRaw;
    if (!updated) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      chapter: updated as { 
        id: number; 
        national_chapter: string | null;
        international_chapter: string | null;
        chapter_whatsapp: string | null;
        chapter_image: string | null;
        is_active: boolean | null;
        description: string | null;
        cities: string[];
      }
    }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update chapter";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - Delete a chapter
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin and superadmin can delete chapters
    if (!isSuperAdminUser(session.user) && !isAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id || isNaN(Number(id))) {
      return NextResponse.json({ error: "Valid chapter ID is required" }, { status: 400 });
    }

    const chapterId = Number(id);

    // Check if chapter is used in alumni_chapter table
    const alumniChapters = await sql/* sql */`
      SELECT COUNT(*) as count FROM public.alumni_chapter 
      WHERE chapter1 = ${chapterId} OR chapter2 = ${chapterId} OR chapter3 = ${chapterId}
    `;

    const alumniCount = Array.isArray(alumniChapters) && alumniChapters.length > 0 
      ? Number((alumniChapters[0] as { count: number | string | bigint }).count) 
      : 0;

    if (alumniCount > 0) {
      return NextResponse.json({ 
        error: `Cannot delete chapter. It is associated with ${alumniCount} alumni member(s). Please reassign or remove associations first.` 
      }, { status: 409 });
    }

    const result = await sql/* sql */`
      DELETE FROM public.tblchapters
      WHERE id = ${chapterId}
      RETURNING id
    `;

    if (!result || (Array.isArray(result) && result.length === 0)) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete chapter";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

