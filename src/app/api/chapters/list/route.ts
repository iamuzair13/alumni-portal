import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";

export async function GET() {
  try {
    const rows = await sql/* sql */`
      SELECT 
        id,
        national_chapter,
        international_chapter,
        chapter_whatsapp,
        chapter_image,
        is_active,
        description
      FROM public.tblchapters
      WHERE is_active = true
      ORDER BY 
        CASE WHEN national_chapter IS NOT NULL THEN 1 ELSE 2 END,
        COALESCE(national_chapter, international_chapter) ASC
    `;
    
    const chapters = rows.map((r: Record<string, unknown>) => ({
      id: Number(r.id),
      name: String(r.national_chapter || r.international_chapter || ""),
      type: r.national_chapter ? "national" : "international",
      whatsapp: r.chapter_whatsapp ? String(r.chapter_whatsapp) : null,
      image: r.chapter_image ? String(r.chapter_image) : null,
      description: r.description ? String(r.description) : null,
    }));
    
    // Log for debugging - show all chapters
    const nationalCount = chapters.filter(ch => ch.type === "national").length;
    const internationalCount = chapters.filter(ch => ch.type === "international").length;
    console.log(`[API] Chapters list: ${chapters.length} total (${nationalCount} national, ${internationalCount} international)`);
    console.log(`[API] National chapters:`, chapters.filter(ch => ch.type === "national").map(ch => ch.name));
    console.log(`[API] International chapters:`, chapters.filter(ch => ch.type === "international").map(ch => ch.name));
    
    return NextResponse.json({ chapters }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch chapters";
    console.error("[API] Error fetching chapters:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

