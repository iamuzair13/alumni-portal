import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // First try to get SAP ID from session (if alumni logged in with SAP ID)
    const sessionSapid = (session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid).trim() : undefined;
    let rows;
    
    if (sessionSapid) {
      // Use SAP ID if available
      rows = await sql/* sql */`
        SELECT image1 FROM public.tbl_alumni 
        WHERE sapid = ${sessionSapid} LIMIT 1`;
    } else {
      // Fallback to email lookup (backward compatibility)
      const email = session?.user?.email ? String(session.user.email) : undefined;
      if (!email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      
      rows = await sql/* sql */`
        SELECT image1 FROM public.tbl_alumni 
        WHERE personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email}
        ORDER BY alumniid DESC LIMIT 1`;
    }
    
    if (!rows[0]) {
      return NextResponse.json({ image: null }, { status: 200 });
    }

    const row = rows[0] as { image1: string | null };
    
    // Return the image path with cache busting timestamp
    const image = row.image1 || null;
    
    return NextResponse.json({ 
      image,
      timestamp: Date.now() // Add timestamp for cache busting
    }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch profile image";
    console.error("[API] Current user image error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

