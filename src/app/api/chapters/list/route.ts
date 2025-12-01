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
      WHERE is_active = true OR is_active IS NULL
      ORDER BY 
        CASE WHEN national_chapter IS NOT NULL THEN 1 ELSE 2 END,
        CASE 
          WHEN national_chapter = 'Multan Chapter' THEN 1
          WHEN national_chapter = 'Sargodha–Khushab Chapter' THEN 2
          WHEN national_chapter = 'Faisalabad Chapter' THEN 3
          WHEN national_chapter = 'Gujranwala–Gujrat–Sialkot Chapter' THEN 4
          WHEN national_chapter = 'Lahore & Surrounding Chapter' THEN 5
          WHEN national_chapter = 'Peshawar & Northern KP Chapter' THEN 6
          WHEN national_chapter = 'Islamabad–Rawalpindi Chapter' THEN 7
          WHEN national_chapter = 'Southern Punjab Chapter' THEN 8
          WHEN national_chapter = 'Sahiwal–Pakpattan Chapter' THEN 9
          WHEN national_chapter = 'Bahawalpur–Bahawalnagar Chapter' THEN 10
          WHEN national_chapter = 'Northern Pakistan Chapter' THEN 11
          WHEN national_chapter = 'Balochistan Chapter' THEN 12
          WHEN national_chapter = 'Sindh Chapter' THEN 13
          WHEN national_chapter = 'Kashmir Chapter' THEN 14
          ELSE 999
        END,
        COALESCE(national_chapter, international_chapter)
    `;
    
    const chapters = rows.map((r: Record<string, unknown>) => ({
      id: Number(r.id),
      name: String(r.national_chapter || r.international_chapter || ""),
      type: r.national_chapter ? "national" : "international",
      whatsapp: r.chapter_whatsapp ? String(r.chapter_whatsapp) : null,
      image: r.chapter_image ? String(r.chapter_image) : null,
      description: r.description ? String(r.description) : null,
    }));
    
    // Log for debugging
    const nationalCount = chapters.filter(ch => ch.type === "national").length;
    const internationalCount = chapters.filter(ch => ch.type === "international").length;
    console.log(`[API] Chapters list: ${chapters.length} total (${nationalCount} national, ${internationalCount} international)`);
    
    return NextResponse.json({ chapters }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch chapters";
    console.error("[API] Error fetching chapters:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

