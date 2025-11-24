import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isAdminUser } from "@/lib/alumniProfile";

export async function GET(_: Request, ctx: { params: Promise<{ sapid: string }> }) {
  try {
    const { sapid } = await ctx.params;
    const session = await auth();
    
    // Verify the user is authenticated
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all details from tbl_alumni
    const rows = await sql/* sql */`
      SELECT * FROM public.tbl_alumni WHERE sapid = ${sapid} LIMIT 1`;
    
    if (!rows[0]) {
      return NextResponse.json({ error: "Alumni not found" }, { status: 404 });
    }

    const row = rows[0] as Record<string, unknown>;

    // Verify the user has access to this profile (either owns it by SAP ID or email, or is admin)
    const userEmail = session.user.email ? String(session.user.email) : null;
    const userSapid = (session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid) : null;
    const requestedSapid = String(sapid || "").toLowerCase().trim();
    const dbSapid = String(row.sapid ?? "").toLowerCase().trim();
    
    // Check ownership by SAP ID first (since users now log in with SAP ID)
    // Compare both: session SAP ID with requested SAP ID, and session SAP ID with database SAP ID
    const isOwnerBySapid = userSapid && (
      userSapid.toLowerCase().trim() === requestedSapid ||
      dbSapid === userSapid.toLowerCase().trim() ||
      requestedSapid === dbSapid // Allow if requested SAP ID matches database SAP ID
    );
    
    // Check ownership by email (backward compatibility)
    const isOwnerByEmail = userEmail && (
      String(row.personalemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim() ||
      String(row.universityemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim() ||
      String(row.officialemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim()
    );
    
    const isOwner = isOwnerBySapid || isOwnerByEmail;
    const isAdmin = isAdminUser(session.user);

    // Debug logging
    console.log("[API] Full details auth check:", {
      requestedSapid,
      userSapid,
      dbSapid,
      userEmail,
      isOwnerBySapid,
      isOwnerByEmail,
      isOwner,
      isAdmin
    });

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Return all fields from tbl_alumni
    // Note: password is fetched from database but will be masked in UI for security
    return NextResponse.json({ 
      item: {
        alumniid: row.alumniid ?? null,
        alumniemail: row.alumniemail ?? null,
        registrationno: row.registrationno ?? null,
        sapid: row.sapid ?? null,
        alumniname: row.alumniname ?? null,
        gender: row.gender ?? null,
        fathername: row.fathername ?? null,
        dateofbirth: row.dateofbirth ?? null,
        maritalstatus: row.maritalstatus ?? null,
        cnicpassport: row.cnicpassport ?? null,
        contactno: row.contactno ?? null,
        contactno1: row.contactno1 ?? null,
        contactno1show: row.contactno1show ?? null,
        personalemail: row.personalemail ?? null,
        personalemailshow: row.personalemailshow ?? null,
        universityemail: row.universityemail ?? null,
        country: row.country ?? null,
        province: row.province ?? null,
        city: row.city ?? null,
        address: row.address ?? null,
        academicsession: row.academicsession ?? null,
        degreetitle: row.degreetitle ?? null,
        cgpa: row.cgpa ?? null,
        yearofstarting: row.yearofstarting ?? null,
        yearofending: row.yearofending ?? null,
        facultyname: row.facultyname ?? null,
        campusname: row.campusname ?? null,
        departmentname: row.departmentname ?? null,
        majorsubject: row.majorsubject ?? null,
        industry: row.industry ?? null,
        employeed: row.employeed ?? null,
        nameoforganization: row.nameoforganization ?? null,
        designation: row.designation ?? null,
        totalyearsofexpereince: row.totalyearsofexpereince ?? null,
        officialemail: row.officialemail ?? null,
        officialnumber: row.officialnumber ?? null,
        supervisorname: row.supervisorname ?? null,
        supervisordesignation: row.supervisordesignation ?? null,
        supervisoremail: row.supervisoremail ?? null,
        supervisornumber: row.supervisornumber ?? null,
        image1: row.image1 ?? null,
        cv: row.cv ?? null,
        aboutme: row.aboutme ?? null,
        lasttimelogin: row.lasttimelogin ?? null,
        logincount: row.logincount ?? null,
        verify: row.verify ?? null,
        emailsendcount: row.emailsendcount ?? null,
        emailsendstatus: row.emailsendstatus ?? null,
        createddatetime: row.createddatetime ?? null,
        facebook: row.facebook ?? null,
        instagram: row.instagram ?? null,
        youtube: row.youtube ?? null,
        linkedin: row.linkedin ?? null,
        datasource: row.datasource ?? null,
        alumnistatus: row.alumnistatus ?? null,
        password: row.password ?? null, // Fetch actual password from database
      }
    }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch alumni details";
    console.error("[API] Full details error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

