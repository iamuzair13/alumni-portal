import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";

export async function GET(_: Request, ctx: { params: Promise<{ sapid: string }> }) {
  try {
    const { sapid } = await ctx.params;
    const session = await auth();
    
    // Verify the user is authenticated
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all details from tbl_alumni
    // Try SAP ID first, then registration number
    const normalizedIdentifier = String(sapid || "").trim();
    
    let rows = await sql/* sql */`
      SELECT * FROM public.tbl_alumni WHERE sapid = ${normalizedIdentifier} LIMIT 1`;
    
    // If not found by SAP ID, try registration number
    if (!rows[0]) {
      rows = await sql/* sql */`
        SELECT * FROM public.tbl_alumni WHERE registrationno = ${normalizedIdentifier} LIMIT 1`;
    }
    
    if (!rows[0]) {
      return NextResponse.json({ error: "Alumni not found" }, { status: 404 });
    }

    const row = rows[0] as Record<string, unknown>;

    // SECURITY: Verify the user has access to this profile
    // User must either own the record (by SAP ID, registration number, or email) OR be an admin
    const userEmail = session.user.email ? String(session.user.email) : null;
    const userSapid = (session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid) : null;
    const userRegNo = (session.user as { registrationno?: string | null })?.registrationno ? String((session.user as { registrationno?: string | null }).registrationno) : null;
    const dbSapid = String(row.sapid ?? "").toLowerCase().trim();
    const dbRegNo = String(row.registrationno ?? "").toLowerCase().trim();
    
    // SECURITY: Check ownership by comparing user's credentials with database record
    // Only allow access if user's SAP ID matches the record's SAP ID
    const isOwnerBySapid = userSapid && dbSapid === userSapid.toLowerCase().trim();
    
    // SECURITY: Check ownership by registration number
    // Only allow access if user's registration number matches the record's registration number
    const isOwnerByRegNo = userRegNo && dbRegNo === userRegNo.toLowerCase().trim();
    
    // SECURITY: Check ownership by email (backward compatibility)
    // Only allow access if user's email matches one of the record's emails
    const isOwnerByEmail = userEmail && (
      String(row.personalemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim() ||
      String(row.universityemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim() ||
      String(row.officialemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim()
    );
    
    const isOwner = isOwnerBySapid || isOwnerByRegNo || isOwnerByEmail;
    const canAccess = canModify(session.user); // Checks for both admin and superadmin

    // Debug logging
    console.log("[API] Full details auth check:", {
      requestedIdentifier: normalizedIdentifier,
      userSapid,
      dbSapid,
      userEmail,
      isOwnerBySapid,
      isOwnerByEmail,
      isOwner,
      canAccess,
      userType: (session.user as { type?: string })?.type
    });

    if (!isOwner && !canAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if user is alumni (not admin)
    const userType = (session.user as { type?: string })?.type;
    const isAlumni = userType?.toLowerCase().trim() === "alumni";
    
    // Return all fields from tbl_alumni
    // SECURITY: Only return password for alumni (owners), not for admins
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
        image1: row.image1 ?? null,
        image2: row.image2 ?? null,
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
        // SECURITY: Only return password for alumni (owners), not for admins
        password: (isAlumni && isOwner) ? (row.password ?? null) : null,
        father_cnic: row.father_cnic ?? null,
      }
    }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch alumni details";
    console.error("[API] Full details error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

