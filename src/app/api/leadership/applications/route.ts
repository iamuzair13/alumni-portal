import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { isSuperAdminUser, isAdminUser } from "@/lib/alumniProfile";

// Get all pending leadership applications
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get("type") || "all"; // "chapter", "association", "all"
    
    // Build access filter for admin/viewer users
    // For leadership applications, super admins and admins should see ALL applications
    // Only apply access filter for viewers or admins with specific access assignments
    const isSuperAdmin = isSuperAdminUser(session?.user);
    const isAdmin = isAdminUser(session?.user);
    
    // Super admins and admins see all applications (no filter)
    // Viewers and admins with access assignments get filtered
    const shouldApplyFilter = !isSuperAdmin && !isAdmin;
    const accessFilter = shouldApplyFilter 
      ? await buildAccessFilterSQL(session, "")
      : { sql: null, hasFilter: false };
    
    // Debug logging
    console.log("[Leadership Applications] Access filter:", {
      hasFilter: accessFilter.hasFilter,
      isSuperAdmin,
      isAdmin,
      shouldApplyFilter,
      userType: session?.user ? (session.user as { type?: string })?.type : "none"
    });
    
    const applications: Array<{
      id: number;
      alumniId: number;
      sapId: string;
      name: string;
      email: string;
      faculty: string | null;
      department: string | null;
      program: string | null;
      type: "chapter" | "association";
      position: string;
      createdAt: string;
    }> = [];

    // Get chapter leadership applications (only pending status)
    if (type === "all" || type === "chapter") {
      // Get all pending applications - join with tbl_alumni using alumni_id
      const chapterRows = await sql/* sql */`
        SELECT 
          cl.id as leadership_id,
          cl.post,
          cl.created_at,
          cl.status,
          a.alumniid,
          a.sapid,
          a.alumniname,
          a.departmentname,
          a.facultyname,
          a.degreetitle,
          a.personalemail,
          a.officialemail,
          a.universityemail,
          a.registrationno
        FROM public.chapter_leadership cl
        LEFT JOIN public.tbl_alumni a ON a.alumniid = cl.alumniid
        WHERE cl.status = 'pending'
          ${accessFilter.hasFilter && accessFilter.sql 
            ? sql` AND EXISTS (
                SELECT 1 FROM public.tbl_alumni a_filter 
                WHERE a_filter.alumniid = cl.alumniid 
                AND (${accessFilter.sql})
              )`
            : sql``}
        ORDER BY cl.created_at DESC NULLS LAST
      `;
      
      console.log(`[Leadership Applications] Found ${chapterRows.length} chapter applications with status='pending'`);
      
      chapterRows.forEach((r: Record<string, unknown>) => {
        applications.push({
          id: Number(r.leadership_id),
          alumniId: Number(r.alumniid),
          sapId: String(r.sapid ?? ""),
          name: String(r.alumniname ?? ""),
          email: (r.personalemail ? String(r.personalemail) : null) || (r.officialemail ? String(r.officialemail) : null) || (r.universityemail ? String(r.universityemail) : null) || "",
          faculty: r.facultyname ? String(r.facultyname) : null,
          department: r.departmentname ? String(r.departmentname) : null,
          program: r.degreetitle ? String(r.degreetitle) : null,
          type: "chapter",
          position: r.post ? String(r.post) : "",
          createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : new Date().toISOString(),
        });
      });
    }

    // Get association leadership applications (only pending status)
    if (type === "all" || type === "association") {
      const associationRows = await sql/* sql */`
        SELECT 
          ass.id as leadership_id,
          ass.q3 as role,
          ass.createddatetime,
          ass.status,
          a.alumniid,
          a.sapid,
          a.alumniname,
          a.departmentname,
          a.facultyname,
          a.degreetitle,
          a.personalemail,
          a.officialemail,
          a.universityemail,
          a.registrationno
        FROM public.tblalumniassociation ass
        LEFT JOIN public.tbl_alumni a ON a.alumniid = ass.alumni_id
        WHERE ass.status = 'pending'
          ${accessFilter.hasFilter && accessFilter.sql 
            ? sql` AND EXISTS (
                SELECT 1 FROM public.tbl_alumni a_filter 
                WHERE a_filter.alumniid = ass.alumni_id 
                AND (${accessFilter.sql})
              )`
            : sql``}
        ORDER BY ass.createddatetime DESC NULLS LAST
      `;
      
      console.log(`[Leadership Applications] Found ${associationRows.length} association applications with status='pending'`);
      
      associationRows.forEach((r: Record<string, unknown>) => {
        applications.push({
          id: Number(r.leadership_id),
          alumniId: Number(r.alumniid),
          sapId: String(r.sapid ?? ""),
          name: String(r.alumniname ?? ""),
          email: (r.personalemail ? String(r.personalemail) : null) || (r.officialemail ? String(r.officialemail) : null) || (r.universityemail ? String(r.universityemail) : null) || "",
          faculty: r.facultyname ? String(r.facultyname) : null,
          department: r.departmentname ? String(r.departmentname) : null,
          program: r.degreetitle ? String(r.degreetitle) : null,
          type: "association",
          position: r.role ? String(r.role) : "",
          createdAt: r.createddatetime ? new Date(r.createddatetime as string).toISOString() : new Date().toISOString(),
        });
      });
    }

    // Sort by created date (newest first)
    applications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    console.log(`[Leadership Applications] Returning ${applications.length} total applications`);
    
    return NextResponse.json({ items: applications }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch applications";
    console.error("[API] Error fetching leadership applications:", msg, err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

