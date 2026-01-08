import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify, isViewerUser } from "@/lib/alumniProfile";

export async function GET(_: Request, ctx: { params: Promise<{ sapid: string }> }) {
  try {
    const { sapid } = await ctx.params;
    const session = await auth();
    
    // Verify the user is authenticated
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all details from tbl_alumni with faculty, department, and program names
    // Try SAP ID first, then registration number
    const normalizedIdentifier = String(sapid || "").trim();
    
    let rows = await sql/* sql */`
      SELECT 
        a.*,
        COALESCE(f.faculty_name, a.facultyname) as facultyname,
        COALESCE(d.department_name, a.departmentname) as departmentname,
        COALESCE(p.program_name, a.degreetitle) as degreetitle
      FROM public.tbl_alumni a
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      LEFT JOIN public.tbl_departments d ON d.id = a.department
      LEFT JOIN public.tbl_programs p ON p.id = a.program
      WHERE a.sapid = ${normalizedIdentifier} 
      LIMIT 1`;
    
    // If not found by SAP ID, try registration number
    if (!rows[0]) {
      rows = await sql/* sql */`
        SELECT 
          a.*,
          COALESCE(f.faculty_name, a.facultyname) as facultyname,
          COALESCE(d.department_name, a.departmentname) as departmentname,
          COALESCE(p.program_name, a.degreetitle) as degreetitle
        FROM public.tbl_alumni a
        LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
        LEFT JOIN public.tbl_departments d ON d.id = a.department
        LEFT JOIN public.tbl_programs p ON p.id = a.program
        WHERE a.registrationno = ${normalizedIdentifier} 
        LIMIT 1`;
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
    const isViewer = isViewerUser(session.user); // Checks for viewer users
    const isAdminOrViewer = canAccess || isViewer;
    
    // SECURITY: For admin/viewer users, check access filter
    if (isAdminOrViewer) {
      const { buildAccessFilterSQL } = await import("@/lib/userAccess");
      const accessFilter = await buildAccessFilterSQL(session, "");
      
      if (accessFilter.hasFilter && accessFilter.sql) {
        const alumniId = Number(row.alumniid);
        if (!alumniId) {
          return NextResponse.json({ error: "Invalid alumni record" }, { status: 400 });
        }
        const accessCheck = await sql/* sql */`
          SELECT a.alumniid FROM public.tbl_alumni a
          WHERE a.alumniid = ${alumniId} 
          AND (${accessFilter.sql})
          LIMIT 1
        `;
        
        if (!accessCheck[0]) {
          return NextResponse.json({ error: "Forbidden: You don't have access to this alumni record" }, { status: 403 });
        }
      }
    }
    
    const canView = isOwner || canAccess || isViewer; // Allow owners, admins, and viewers

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
      isViewer,
      canView,
      userType: (session.user as { type?: string })?.type
    });

    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if user is alumni (not admin)
    const userType = (session.user as { type?: string })?.type;
    const isAlumni = userType?.toLowerCase().trim() === "alumni";
    
    // Fetch chapter data
    const alumniId = Number(row.alumniid);
    const chapterRows = await sql/* sql */`
      SELECT 
        ac.chapter1,
        ac.chapter2,
        ac.chapter3,
        COALESCE(c1.national_chapter, c1.international_chapter) as chapter1_name,
        COALESCE(c2.national_chapter, c2.international_chapter) as chapter2_name,
        COALESCE(c3.national_chapter, c3.international_chapter) as chapter3_name
      FROM public.alumni_chapter ac
      LEFT JOIN public.tblchapters c1 ON c1.id = ac.chapter1
      LEFT JOIN public.tblchapters c2 ON c2.id = ac.chapter2
      LEFT JOIN public.tblchapters c3 ON c3.id = ac.chapter3
      WHERE ac.id = ${alumniId}
      LIMIT 1
    `;
    
    // Build chapters array from chapter names and get chapter IDs
    const chapters: string[] = [];
    let chapter1Id: number | null = null;
    let chapter2Id: number | null = null;
    let chapter3Id: number | null = null;
    if (chapterRows[0]) {
      const chapterData = chapterRows[0] as Record<string, unknown>;
      if (chapterData.chapter1_name) chapters.push(String(chapterData.chapter1_name));
      if (chapterData.chapter2_name) chapters.push(String(chapterData.chapter2_name));
      if (chapterData.chapter3_name) chapters.push(String(chapterData.chapter3_name));
      chapter1Id = chapterData.chapter1 ? Number(chapterData.chapter1) : null;
      chapter2Id = chapterData.chapter2 ? Number(chapterData.chapter2) : null;
      chapter3Id = chapterData.chapter3 ? Number(chapterData.chapter3) : null;
    }
    const chapterDisplay = chapters.length > 0 ? chapters.join(", ") : null;
    
    // Fetch association data
    const associationId = row.association_id ? Number(row.association_id) : null;
    let associationTitle: string | null = null;
    if (associationId) {
      const associationRows = await sql/* sql */`
        SELECT title FROM public.tbl_associations WHERE id = ${associationId} LIMIT 1
      `;
      if (associationRows[0]) {
        associationTitle = String(associationRows[0].title ?? null);
      }
    }
    
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
        // ID-based fields for faculty, department, program
        faculty: row.faculty ?? null,
        department: row.department ?? null,
        program: row.program ?? null,
        industry: row.industry ?? null,
        employeed: row.employeed ?? null,
        nameoforganization: row.nameoforganization ?? null,
        designation: row.designation ?? null,
        totalyearsofexpereince: row.totalyearsofexpereince ?? null,
        officialemail: row.officialemail ?? null,
        officialnumber: row.officialnumber ?? null,
        work_city: row.work_city ?? null,
        work_country: row.work_country ?? null,
        organization_address: row.organization_address ?? null,
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
        // SECURITY: Return password for alumni (owners) and admins who can modify
        password: (isAlumni && isOwner) || canAccess ? (row.password ?? null) : null,
        father_cnic: row.father_cnic ?? null,
        category: row.category ?? null,
        // Higher Education fields
        degree_title: row.degree_title ?? null,
        higher_education_institute_name: row.higher_education_institute_name ?? null,
        higher_education_program: row.higher_education_program ?? null,
        higher_education_institute_country: row.higher_education_institute_country ?? null,
        higher_education_institute_city: row.higher_education_institute_city ?? null,
        is_scholarship: row.is_scholarship ?? null,
        // Chapter and Association fields
        chapter: chapterDisplay,
        chapter1_id: chapter1Id,
        chapter2_id: chapter2Id,
        chapter3_id: chapter3Id,
        association: associationTitle,
        association_id: associationId,
        // Consent fields
        alumni_consent_info: row.alumni_consent_info ?? null,
        alumni_consent_pic: row.alumni_consent_pic ?? null,
      }
    }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch alumni details";
    console.error("[API] Full details error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

