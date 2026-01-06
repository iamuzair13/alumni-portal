import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/dbconnect";

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userEmail = session.user.email ? String(session.user.email) : null;
    const userSapid = (session.user as { sapid?: string | null })?.sapid
      ? String((session.user as { sapid?: string | null }).sapid)
      : null;
    const userRegNo = (session.user as { registrationno?: string | null })?.registrationno
      ? String((session.user as { registrationno?: string | null }).registrationno)
      : null;

    // If SAP ID is already in session, return it
    if (userSapid) {
      return NextResponse.json({ sapid: userSapid }, { status: 200 });
    }

    // If only registration number is available in session, use that as identifier.
    // The /api/alumni/[sapid]/full-details route already treats the identifier
    // as "SAP ID first, then registration number", so this works for both.
    if (userRegNo) {
      return NextResponse.json({ sapid: userRegNo }, { status: 200 });
    }

    // Otherwise, look it up by email
    if (userEmail) {
      const rows = await sql/* sql */`
        SELECT sapid, registrationno 
        FROM public.tbl_alumni 
        WHERE personalemail = ${userEmail} 
           OR officialemail = ${userEmail} 
           OR universityemail = ${userEmail}
        ORDER BY alumniid DESC 
        LIMIT 1`;
      
      if (rows[0]?.sapid) {
        return NextResponse.json({ sapid: String(rows[0].sapid) }, { status: 200 });
      }

      if (rows[0]?.registrationno) {
        return NextResponse.json({ sapid: String(rows[0].registrationno) }, { status: 200 });
      }
    }

    return NextResponse.json({ error: "Identifier not found for current alumni" }, { status: 404 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get SAP ID";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

