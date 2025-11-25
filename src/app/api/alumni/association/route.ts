import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { sendAssociationApplicationEmail } from "@/lib/email";

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
        ass.q3 as role,
        ass.createddatetime
      FROM public.tbl_alumni a
      JOIN public.tblalumniassociation ass ON ass.alumniid = a.alumniid
      ORDER BY ass.createddatetime DESC NULLS LAST, a.alumniid DESC`;
    
    const items = rows.map((r: Record<string, unknown>) => ({
      sapid: String(r.sapid ?? ""),
      registrationNo: r.registrationno ? String(r.registrationno) : null,
      name: String(r.alumniname ?? ""),
      department: r.departmentname ? String(r.departmentname) : null,
      faculty: r.facultyname ? String(r.facultyname) : null,
      program: r.degreetitle ? String(r.degreetitle) : null,
      email: (r.personalemail ? String(r.personalemail) : null) || (r.officialemail ? String(r.officialemail) : null) || (r.universityemail ? String(r.universityemail) : null),
      role: r.role ? String(r.role) : null,
      createdAt: r.createddatetime,
    }));
    
    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch association";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userSapid = session?.user ? ((session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid) : null) : null;
    if (!session?.user?.email && !userSapid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { alumniId, role } = body;

    if (!alumniId) {
      return NextResponse.json({ error: "Alumni ID is required" }, { status: 400 });
    }

    if (!role) {
      return NextResponse.json({ error: "Role is required" }, { status: 400 });
    }

    // Validate role
    const validRoles = ["president", "vicePresident", "coordinator"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role selected" }, { status: 400 });
    }

    // Map role values to display names
    const roleDisplayNames: Record<string, string> = {
      president: "President",
      vicePresident: "Vice President",
      coordinator: "Coordinator",
    };

    const roleDisplayName = roleDisplayNames[role] || role;

    // Check if a record already exists for this alumni
    // Note: You may need to create a table for this, or store it in an existing table
    // For now, we'll check if there's an alumni_association table or similar
    // If not, we'll create a simple storage solution
    
    // Check if a record already exists for this alumni in tblalumniassociation
    // Using q3 field to store the role (VARCHAR(50))
    const existingRecord = await sql/* sql */`
      SELECT alumniid FROM public.tblalumniassociation 
      WHERE alumniid = ${alumniId}
      LIMIT 1
    `;

    if (existingRecord.length > 0) {
      // Update existing record
      await sql/* sql */`
        UPDATE public.tblalumniassociation 
        SET q3 = ${roleDisplayName},
            createddatetime = NOW()
        WHERE alumniid = ${alumniId}
      `;
    } else {
      // Insert new record
      await sql/* sql */`
        INSERT INTO public.tblalumniassociation (alumniid, q3, createddatetime)
        VALUES (${alumniId}, ${roleDisplayName}, NOW())
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
          sendAssociationApplicationEmail(alumniEmail, alumniName, roleDisplayName).catch((err) => {
            console.error("[API] Failed to send association application email:", err);
          });
        }
      }
    } catch (emailError) {
      // Don't fail the request if email fails
      console.error("[API] Error sending association application email:", emailError);
    }

    return NextResponse.json({ 
      success: true, 
      message: "Application submitted successfully" 
    });
  } catch (error) {
    console.error("Error submitting alumni association application:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to submit application";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

