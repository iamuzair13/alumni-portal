import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { sendSwimmingPoolMembershipEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    
    const email = session.user.email ? String(session.user.email) : null;
    const userSapid = session.user ? ((session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid).trim() : null) : null;
    
    if (!email && !userSapid) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    
    const body = await req.json();
    const { alumniId, month } = body;

    if (!alumniId) {
      return NextResponse.json({ error: "Alumni ID is required" }, { status: 400 });
    }

    if (!month || typeof month !== "string" || month.trim() === "") {
      return NextResponse.json({ error: "Month is required" }, { status: 400 });
    }

    // Verify that the alumniId matches the logged-in user
    let alumRows: Array<{ alumniid: number; alumniname: string | null; personalemail: string | null; officialemail: string | null; universityemail: string | null }> = [];
    
    if (userSapid) {
      alumRows = await sql/* sql */`
        SELECT alumniid, alumniname, personalemail, officialemail, universityemail
        FROM public.tbl_alumni 
        WHERE sapid = ${userSapid} AND alumniid = ${parseInt(String(alumniId), 10)}
        LIMIT 1`;
    }
    
    // If not found by SAP ID, try by email
    if (alumRows.length === 0 && email) {
      alumRows = await sql/* sql */`
        SELECT alumniid, alumniname, personalemail, officialemail, universityemail
        FROM public.tbl_alumni 
        WHERE (personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email} OR alumniemail = ${email})
        AND alumniid = ${parseInt(String(alumniId), 10)}
        ORDER BY alumniid DESC LIMIT 1`;
    }
    
    const alum = alumRows[0];
    if (!alum || !alum.alumniid) {
      return NextResponse.json({ error: "Alumni not found or access denied" }, { status: 404 });
    }

    // Insert swimming pool membership application
    // Note: id is both primary key and foreign key to tbl_alumni(alumniid)
    await sql/* sql */`
      INSERT INTO public.alumni_memberships (id, swimmingpool_membership_month, created_at)
      VALUES (${alum.alumniid}, ${month.trim()}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        swimmingpool_membership_month = EXCLUDED.swimmingpool_membership_month,
        created_at = NOW()
    `;

    // Send confirmation email
    try {
      const alumniEmail = alum.personalemail || alum.officialemail || alum.universityemail;
      const alumniName = alum.alumniname || "Alumni";
      
      if (alumniEmail) {
        // Send email asynchronously (don't wait for it to complete)
        sendSwimmingPoolMembershipEmail(alumniEmail, alumniName, month.trim()).catch((err) => {
          console.error("[API] Failed to send swimming pool membership email:", err);
        });
      }
    } catch (emailError) {
      // Don't fail the request if email fails
      console.error("[API] Error sending swimming pool membership email:", emailError);
    }

    return NextResponse.json({ 
      success: true, 
      message: "Swimming pool membership application submitted successfully" 
    });
  } catch (error) {
    console.error("Error submitting swimming pool membership application:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to submit application";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

