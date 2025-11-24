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
    const userSapid = (session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid) : null;

    // If SAP ID is already in session, return it
    if (userSapid) {
      return NextResponse.json({ sapid: userSapid }, { status: 200 });
    }

    // Otherwise, look it up by email
    if (userEmail) {
      const rows = await sql/* sql */`
        SELECT sapid FROM public.tbl_alumni 
        WHERE personalemail = ${userEmail} OR officialemail = ${userEmail} OR universityemail = ${userEmail}
        ORDER BY alumniid DESC LIMIT 1`;
      
      if (rows[0]?.sapid) {
        return NextResponse.json({ sapid: String(rows[0].sapid) }, { status: 200 });
      }
    }

    return NextResponse.json({ error: "SAP ID not found" }, { status: 404 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get SAP ID";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

