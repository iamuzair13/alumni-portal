import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const alumniIdParam = url.searchParams.get("alumniId");

    if (!alumniIdParam) {
      return NextResponse.json({ error: "Alumni ID is required" }, { status: 400 });
    }

    const alumniId = parseInt(alumniIdParam, 10);
    if (isNaN(alumniId)) {
      return NextResponse.json({ error: "Invalid alumni ID" }, { status: 400 });
    }

    // SECURITY: Authorization check
    // - Admins/superadmins can view any alumni's chapters
    // - Alumni can only view their own chapters
    const { canModify } = await import("@/lib/alumniProfile");
    const isAdminOrSuperAdmin = canModify(session.user);

    if (!isAdminOrSuperAdmin) {
      // For non-admin users, verify they are viewing their own record
      let userAlumniId: number | null = null;

      // Try to get SAP ID or registration number from session
      const sessionSapid = session.user ? ((session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid).trim() : undefined) : undefined;
      const sessionRegNo = session.user ? ((session.user as { registrationno?: string | null })?.registrationno ? String((session.user as { registrationno?: string | null }).registrationno).trim() : undefined) : undefined;

      if (sessionSapid) {
        const sapRows = await sql/* sql */`
          SELECT alumniid FROM public.tbl_alumni 
          WHERE sapid = ${sessionSapid} 
          LIMIT 1
        `;
        if (sapRows[0]) {
          userAlumniId = Number((sapRows[0] as { alumniid: number }).alumniid);
        }
      } else if (sessionRegNo) {
        const regRows = await sql/* sql */`
          SELECT alumniid FROM public.tbl_alumni 
          WHERE registrationno = ${sessionRegNo} 
          LIMIT 1
        `;
        if (regRows[0]) {
          userAlumniId = Number((regRows[0] as { alumniid: number }).alumniid);
        }
      }

      if (!userAlumniId || userAlumniId !== alumniId) {
        return NextResponse.json({ error: "Forbidden: You can only view your own chapters" }, { status: 403 });
      }
    }

    // Fetch current chapters for the alumni
    const rows = await sql/* sql */`
      SELECT 
        ac."chapter1",
        ac."chapter2",
        ac."chapter3"
      FROM public.alumni_chapter ac
      WHERE ac.id = ${alumniId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      // No chapters assigned yet
      return NextResponse.json({ chapters: [] }, { status: 200 });
    }

    const row = rows[0] as { chapter1: number | null; chapter2: number | null; chapter3: number | null };
    
    // Collect all non-null chapter IDs
    const chapterIds: number[] = [];
    if (row.chapter1 !== null) chapterIds.push(Number(row.chapter1));
    if (row.chapter2 !== null) chapterIds.push(Number(row.chapter2));
    if (row.chapter3 !== null) chapterIds.push(Number(row.chapter3));

    return NextResponse.json({ chapters: chapterIds }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch current chapters";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

