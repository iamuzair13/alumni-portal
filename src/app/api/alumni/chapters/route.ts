import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { alumniId, chapters, contactNumber } = body;

    if (!alumniId) {
      return NextResponse.json({ error: "Alumni ID is required" }, { status: 400 });
    }

    // Validate that at least one chapter is selected
    if (!chapters || !Array.isArray(chapters) || chapters.length === 0) {
      return NextResponse.json(
        { error: "At least one chapter must be selected" },
        { status: 400 }
      );
    }

    // Validate maximum 3 chapters
    if (chapters.length > 3) {
      return NextResponse.json(
        { error: "You can select up to 3 chapters only" },
        { status: 400 }
      );
    }

    // Extract chapters (up to 3)
    const chapter1 = chapters[0] || null;
    const chapter2 = chapters[1] || null;
    const chapter3 = chapters[2] || null;

    // Check if a record already exists for this alumni
    const existingRecord = await sql/* sql */`
      SELECT id FROM public.alumni_chapter 
      WHERE id = ${alumniId}
    `;

    if (existingRecord.length > 0) {
      // Update existing record
      // Using quoted identifiers to handle spaces/hyphens in column names
      await sql/* sql */`
        UPDATE public.alumni_chapter 
        SET 
          "chapter1" = ${chapter1},
          "chapter2" = ${chapter2},
          "chapter3" = ${chapter3}
        WHERE id = ${alumniId}
      `;
    } else {
      // Insert new record
      // Using quoted identifiers to handle spaces/hyphens in column names
      await sql/* sql */`
        INSERT INTO public.alumni_chapter (id, "chapter1", "chapter2", "chapter3")
        VALUES (${alumniId}, ${chapter1}, ${chapter2}, ${chapter3})
      `;
    }

    // Update contact number in tbl_alumni if provided
    if (contactNumber) {
      await sql/* sql */`
        UPDATE public.tbl_alumni 
        SET contactno = ${contactNumber}
        WHERE alumniid = ${alumniId}
      `;
    }

    return NextResponse.json({ 
      success: true, 
      message: "Application submitted successfully" 
    });
  } catch (error) {
    console.error("Error submitting alumni chapters application:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to submit application";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

