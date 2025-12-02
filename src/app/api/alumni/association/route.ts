import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { sendAssociationApplicationEmail } from "@/lib/email";
import { buildAccessFilterSQL } from "@/lib/userAccess";

export async function GET() {
  try {
    const session = await auth();
    
    // Build access filter for admin/viewer users
    const accessFilter = await buildAccessFilterSQL(session, "");
    const accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    
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
      JOIN public.tblalumniassociation ass ON ass.id = a.association_job
      WHERE a.association_job IS NOT NULL
        ${accessFilterCondition}
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
    const alumniIdNum = Number(alumniId);
    if (isNaN(alumniIdNum) || alumniIdNum <= 0) {
      return NextResponse.json({ error: "Invalid alumni ID" }, { status: 400 });
    }

    // Check if alumni already has a pending application (by alumni_id)
    const pendingApp = await sql/* sql */`
      SELECT id, status FROM public.tblalumniassociation 
      WHERE alumni_id = ${alumniIdNum} AND status = 'pending'
      LIMIT 1
    `;
    
    if (pendingApp && pendingApp.length > 0) {
      return NextResponse.json({ 
        error: "You already have a pending application. Please wait for admin approval." 
      }, { status: 400 });
    }

    // Check if alumni already has an approved leadership position
    const approvedApp = await sql/* sql */`
      SELECT ass.id, ass.status 
      FROM public.tblalumniassociation ass
      INNER JOIN public.tbl_alumni a ON a.association_job = ass.id
      WHERE a.alumniid = ${alumniIdNum} AND ass.status = 'approved'
      LIMIT 1
    `;
    
    if (approvedApp && approvedApp.length > 0) {
      return NextResponse.json({ 
        error: "You are already approved as a leader. No further application is required." 
      }, { status: 400 });
    }

    // Insert new record with status='pending' (DO NOT link to tbl_alumni yet)
    // Aligned with schema - add status, rejection_reason, updated_at, alumni_id
    const insertResult = await sql/* sql */`
      INSERT INTO public.tblalumniassociation (q3, createddatetime, status, alumni_id)
      VALUES (${roleDisplayName}, NOW(), 'pending', ${alumniIdNum})
      RETURNING id, status
    `;
    
    if (!insertResult || insertResult.length === 0) {
      throw new Error("Failed to create association leadership record");
    }
    
    const createdRecord = insertResult[0] as { id: number; status: string };
    console.log(`[Association Leadership] Application created - ID: ${createdRecord.id}, Status: ${createdRecord.status}, Alumni ID: ${alumniIdNum}`);
    
    // Verify the record was created with 'pending' status
    if (createdRecord.status !== 'pending') {
      console.error(`[Association Leadership] WARNING: Application was created with status '${createdRecord.status}' instead of 'pending'!`);
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
      message: "Application submitted successfully. It is now pending admin approval." 
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

