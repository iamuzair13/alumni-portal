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
    const { alumniId, nationalChapter, internationalChapter, contactNumber } = body;

    if (!alumniId) {
      return NextResponse.json({ error: "Alumni ID is required" }, { status: 400 });
    }

    // Validate that at least one chapter is selected
    if (!nationalChapter && !internationalChapter) {
      return NextResponse.json(
        { error: "At least one chapter (National or International) must be selected" },
        { status: 400 }
      );
    }

    // Check if a record already exists for this alumni
    const existingRecord = await sql/* sql */`
      SELECT id FROM public.alumni_chapter 
      WHERE id = ${alumniId}
    `;

    if (existingRecord.length > 0) {
      // Update existing record
      // Column names in schema show "national - chapter" and "international - chapter"
      // Using quoted identifiers to handle spaces/hyphens if they exist
      // If actual columns use underscores, this will still work
      await sql/* sql */`
        UPDATE public.alumni_chapter 
        SET 
          "national_chapter" = ${nationalChapter || null},
          "international_chapter" = ${internationalChapter || null}
        WHERE id = ${alumniId}
      `;
    } else {
      // Insert new record
      // Column names in schema show "national - chapter" and "international - chapter"
      // Using quoted identifiers to handle spaces/hyphens if they exist
      await sql/* sql */`
        INSERT INTO public.alumni_chapter (id, "national_chapter", "international_chapter")
        VALUES (${alumniId}, ${nationalChapter || null}, ${internationalChapter || null})
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

