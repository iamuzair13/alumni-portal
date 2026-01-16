import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin/viewer/superadmin
    const userType = String((session.user as { type?: string })?.type || "").toLowerCase().trim();
    const isAdminUser = userType === "admin" || userType === "viewer" || userType === "superadmin";
    
    if (isAdminUser) {
      // Fetch from users table for admin users
      const currentUserId = (session.user as { userId?: number })?.userId;
      if (currentUserId) {
        const userRows = await sql/* sql */`
          SELECT user_image FROM public.users 
          WHERE id = ${currentUserId} OR legacy_userid = ${currentUserId}
          LIMIT 1`;
        
        if (userRows[0]?.user_image) {
          const image = String(userRows[0].user_image).trim();
          if (image) {
            return NextResponse.json({ 
              image,
              timestamp: Date.now()
            }, { status: 200 });
          }
        }
      }
      // No image found for admin user
      return NextResponse.json({ image: null }, { status: 200 });
    }

    // For alumni users, use existing logic
    // First try to get SAP ID or registration number from session
    const sessionSapid = (session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid).trim() : undefined;
    const sessionRegNo = (session.user as { registrationno?: string | null })?.registrationno ? String((session.user as { registrationno?: string | null }).registrationno).trim() : undefined;
    let rows;
    
    if (sessionSapid) {
      // Use SAP ID if available
      rows = await sql/* sql */`
        SELECT image1, image2 FROM public.tbl_alumni 
        WHERE sapid = ${sessionSapid} LIMIT 1`;
    } else if (sessionRegNo) {
      // Use registration number if available
      rows = await sql/* sql */`
        SELECT image1, image2 FROM public.tbl_alumni 
        WHERE registrationno = ${sessionRegNo} LIMIT 1`;
    } else {
      // Fallback to email lookup (backward compatibility)
      const email = session?.user?.email ? String(session.user.email) : undefined;
      if (!email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      
      rows = await sql/* sql */`
        SELECT image1, image2 FROM public.tbl_alumni 
        WHERE personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email}
        ORDER BY alumniid DESC LIMIT 1`;
    }
    
    if (!rows[0]) {
      return NextResponse.json({ image: null }, { status: 200 });
    }

    const row = rows[0] as { image1: string | null; image2: string | null };
    
    // Return image2 if it exists (most recent upload), otherwise image1
    // This is for profile/header display
    const image = (row.image2 && row.image2.trim() !== "") ? row.image2 : (row.image1 || null);
    
    return NextResponse.json({ 
      image,
      timestamp: Date.now() // Add timestamp for cache busting
    }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch profile image";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

