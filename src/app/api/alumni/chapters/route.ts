import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { sendChaptersApplicationEmail } from "@/lib/email";

export async function GET() {
  try {
    const rows = await sql/* sql */`
      SELECT 
        a.alumniid,
        a.sapid,
        a.alumniname,
        a.departmentname,
        a.facultyname,
        a.degreetitle,
        a.personalemail,
        a.officialemail,
        a.universityemail,
        a.registrationno,
        c."chapter1",
        c."chapter2",
        c."chapter3"
      FROM public.tbl_alumni a
      JOIN public.alumni_chapter c ON c.id = a.alumniid
      ORDER BY a.alumniid DESC`;
    
    const items = rows.map((r: Record<string, unknown>) => {
      const chapters: string[] = [];
      if (r.chapter1) chapters.push(String(r.chapter1));
      if (r.chapter2) chapters.push(String(r.chapter2));
      if (r.chapter3) chapters.push(String(r.chapter3));
      
      return {
        sapid: String(r.sapid ?? ""),
        registrationNo: r.registrationno ? String(r.registrationno) : null,
        name: String(r.alumniname ?? ""),
        department: r.departmentname ? String(r.departmentname) : null,
        faculty: r.facultyname ? String(r.facultyname) : null,
        program: r.degreetitle ? String(r.degreetitle) : null,
        email: (r.personalemail ? String(r.personalemail) : null) || (r.officialemail ? String(r.officialemail) : null) || (r.universityemail ? String(r.universityemail) : null),
        chapters,
      };
    });
    
    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch chapters";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

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

    // Send confirmation email
    try {
      const alumniRows = await sql/* sql */`
        SELECT alumniname, personalemail, officialemail, universityemail
        FROM public.tbl_alumni 
        WHERE alumniid = ${alumniId}
        LIMIT 1
      `;
      const alumni = alumniRows[0] as {
        alumniname: string | null;
        personalemail: string | null;
        officialemail: string | null;
        universityemail: string | null;
      } | undefined;
      
      if (alumni) {
        const alumniEmail = alumni.personalemail || alumni.officialemail || alumni.universityemail;
        const alumniName = alumni.alumniname || "Alumni";
        
        if (alumniEmail) {
          // Send email asynchronously (don't wait for it to complete)
          sendChaptersApplicationEmail(alumniEmail, alumniName, chapters).catch((err) => {
            console.error("[API] Failed to send chapters application email:", err);
          });
        }
      }
    } catch (emailError) {
      // Don't fail the request if email fails
      console.error("[API] Error sending chapters application email:", emailError);
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

