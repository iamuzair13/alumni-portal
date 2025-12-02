import { NextResponse } from "next/server";
import { z } from "zod";
import { alumniRegistrationComprehensiveSchema } from "@/lib/alumniRegistration";
import { sql, retryDbOperation } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isAdminUser } from "@/lib/alumniProfile";

// Map DB row -> form values (partial; missing columns set undefined)
interface DbAlumniRow {
  registrationno?: string | null;
  sapid?: string | null;
  alumniname?: string | null;
  gender?: string | null;
  fathername?: string | null;
  dateofbirth?: string | null;
  maritalstatus?: string | null;
  cnicpassport?: string | null;
  contactno?: string | null;
  personalemail?: string | null;
  universityemail?: string | null;
  password?: string | null;
  address?: string | null;
  province?: string | null;
  city?: string | null;
  country?: string | null;
  campusname?: string | null;
  facultyname?: string | null;
  departmentname?: string | null;
  degreetitle?: string | null;
  yearofending?: number | null;
  employeed?: string | null;
  industry?: string | null;
  nameoforganization?: string | null;
  designation?: string | null;
  totalyearsofexpereince?: number | null;
  officialemail?: string | null;
  officialnumber?: string | null;
  datasource?: string | null;
  verify?: string | boolean | null;
  alumnistatus?: string | null;
  image1?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  youtube?: string | null;
  linkedin?: string | null;
}

function mapFromDb(row: DbAlumniRow) {
  return {
    registrationNo: row.registrationno ?? undefined,
    sapId: row.sapid ?? "",
    name: row.alumniname ?? "",
    gender: row.gender ?? "Male",
    fatherName: row.fathername ?? undefined,
    dob: row.dateofbirth ?? undefined,
    maritalStatus: row.maritalstatus ?? undefined,
    cnicOrPassport: row.cnicpassport ?? "",
    countryCode: (row.contactno ?? "+92").split(" ")[0] ?? "+92",
    phoneNumber: (row.contactno ?? "").split(" ")[1] ?? "",
    personalEmail: row.personalemail ?? "",
    // SECURITY: Password removed - never return passwords in API responses
    address: row.address ?? undefined,
    province: row.province ?? undefined,
    homeCity: row.city ?? "",
    homeCountry: row.country ?? "Pakistan",

    campus: row.campusname ?? "",
    faculty: row.facultyname ?? "",
    department: row.departmentname ?? "",
    program: row.degreetitle ?? "",
    passingYear: row.yearofending ?? new Date().getFullYear(),

    employmentStatus: row.employeed ?? "Unemployed",
    sector: row.industry ?? undefined,
    subSector: undefined,
    organization: row.nameoforganization ?? undefined,
    designation: row.designation ?? undefined,
    totalExperienceYears: row.totalyearsofexpereince ?? undefined,
    officialEmail: row.officialemail ?? undefined,
    officialPhone: row.officialnumber ?? undefined,
    workCity: undefined,
    workCountry: undefined,

    source: row.datasource ?? undefined,
    verified: String(row.verify ?? "false").toLowerCase() === "true",
    category: row.alumnistatus ?? undefined,
  } as z.infer<typeof alumniRegistrationComprehensiveSchema>;
}

export async function GET(_: Request, ctx: { params: Promise<{ sapid: string }> }) {
  try {
    const { sapid } = await ctx.params;
    const session = await auth();
    
    // SECURITY: Require authentication
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const isAdmin = isAdminUser(session?.user);
    const { isViewerUser } = await import("@/lib/alumniProfile");
    const isViewer = isViewerUser(session?.user);
    const isAdminOrViewer = isAdmin || isViewer;
    
    const normalizedIdentifier = String(sapid || "").trim();
    
    // First try to find by SAP ID
    let rows = await sql/* sql */`
      SELECT * FROM public.tbl_alumni WHERE sapid = ${normalizedIdentifier} LIMIT 1`;
    
    // If not found by SAP ID, try registration number
    if (!rows[0]) {
      rows = await sql/* sql */`
        SELECT * FROM public.tbl_alumni WHERE registrationno = ${normalizedIdentifier} LIMIT 1`;
    }
    
    if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
    
    const row = rows[0] as DbAlumniRow;
    const userType = String((session?.user as { type?: string })?.type || "").toLowerCase().trim();
    const isAlumni = userType === "alumni";
    
    // SECURITY: For admin/viewer users, check access filter
    if (isAdminOrViewer) {
      const { buildAccessFilterSQL } = await import("@/lib/userAccess");
      const accessFilter = await buildAccessFilterSQL(session, "");
      
      if (accessFilter.hasFilter && accessFilter.sql) {
        const alumniId = (row as { alumniid?: number }).alumniid;
        if (!alumniId) {
          return NextResponse.json({ error: "Invalid alumni record" }, { status: 400 });
        }
        const accessCheck = await sql/* sql */`
          SELECT alumniid FROM public.tbl_alumni 
          WHERE alumniid = ${alumniId} 
          AND (${accessFilter.sql})
          LIMIT 1
        `;
        
        if (!accessCheck[0]) {
          return NextResponse.json({ error: "Forbidden: You don't have access to this alumni record" }, { status: 403 });
        }
      }
    }
    
    // If not admin and not alumni, check if user owns this profile (by email, SAP ID, or registration number)
    if (!isAdmin && !isAlumni && session?.user) {
      const userEmail = session.user.email ? String(session.user.email) : null;
      const userSapid = (session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid) : null;
      const userRegNo = (session.user as { registrationno?: string | null })?.registrationno ? String((session.user as { registrationno?: string | null }).registrationno) : null;
      
      const isOwnerBySapid = userSapid && userSapid.toLowerCase().trim() === normalizedIdentifier.toLowerCase().trim();
      const isOwnerByRegNo = userRegNo && userRegNo.toLowerCase().trim() === normalizedIdentifier.toLowerCase().trim();
      const isOwnerByEmail = userEmail && (
        String(row.personalemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim() ||
        String(row.universityemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim() ||
        String(row.officialemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim()
      );
      
      // Also check if the identifier matches the row's SAP ID or registration number
      const identifierMatchesRow = normalizedIdentifier.toLowerCase().trim() === String(row.sapid ?? "").toLowerCase().trim() ||
                                   normalizedIdentifier.toLowerCase().trim() === String(row.registrationno ?? "").toLowerCase().trim();
      
      if (!isOwnerBySapid && !isOwnerByRegNo && !isOwnerByEmail && !identifierMatchesRow) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    
    // If alumni, check if they own this profile
    if (isAlumni && session?.user) {
      const userEmail = session.user.email ? String(session.user.email) : null;
      const userSapid = (session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid) : null;
      const userRegNo = (session.user as { registrationno?: string | null })?.registrationno ? String((session.user as { registrationno?: string | null }).registrationno) : null;
      
      const isOwnerBySapid = userSapid && userSapid.toLowerCase().trim() === normalizedIdentifier.toLowerCase().trim();
      const isOwnerByRegNo = userRegNo && userRegNo.toLowerCase().trim() === normalizedIdentifier.toLowerCase().trim();
      const isOwnerByEmail = userEmail && (
        String(row.personalemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim() ||
        String(row.universityemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim() ||
        String(row.officialemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim()
      );
      
      if (!isOwnerBySapid && !isOwnerByRegNo && !isOwnerByEmail) {
        return NextResponse.json({ error: "Forbidden: You can only access your own profile" }, { status: 403 });
      }
    }
    
    const formVals = mapFromDb(rows[0]);
    // SECURITY: Remove password from response - it's sensitive data
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safeFormVals } = formVals;
    // Include image1 and social links in the response
    return NextResponse.json({ 
      item: {
        ...safeFormVals,
        image1: row.image1 ?? undefined,
        facebook: row.facebook ?? undefined,
        instagram: row.instagram ?? undefined,
        youtube: row.youtube ?? undefined,
        linkedin: row.linkedin ?? undefined,
      }
    }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch alumni";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ sapid: string }> }) {
  try {
    const { sapid } = await ctx.params;
    const session = await auth();
    
    // SECURITY: Require authentication
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // SECURITY: Only admins/superadmins can update alumni records (viewers are read-only)
    // Alumni can update their own records
    const userType = String((session.user as { type?: string })?.type || "").toLowerCase().trim();
    const isAdmin = userType === "admin" || userType === "superadmin";
    const isAlumni = userType === "alumni";
    
    if (!isAdmin && !isAlumni) {
      return NextResponse.json({ error: "Forbidden: Only admins or alumni can update records" }, { status: 403 });
    }
    
    const body = await req.json();
    const parsed = alumniRegistrationComprehensiveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const v = parsed.data;
    const contactno = `${v.countryCode} ${v.phoneNumber}`.trim();
    const normalizedIdentifier = String(sapid || "").trim();
    
    // First try to find by SAP ID, then by registration number
    let lookupResult = await sql/* sql */`
      SELECT alumniid, sapid, registrationno, personalemail, universityemail, officialemail 
      FROM public.tbl_alumni WHERE sapid = ${normalizedIdentifier} LIMIT 1`;
    
    if (!lookupResult[0]) {
      lookupResult = await sql/* sql */`
        SELECT alumniid, sapid, registrationno, personalemail, universityemail, officialemail 
        FROM public.tbl_alumni WHERE registrationno = ${normalizedIdentifier} LIMIT 1`;
    }
    
    if (!lookupResult[0]) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    
    const row = lookupResult[0] as {
      alumniid: number;
      sapid: string | null;
      registrationno: string | null;
      personalemail: string | null;
      universityemail: string | null;
      officialemail: string | null;
    };
    
    // SECURITY: If alumni user, verify they own this record
    if (isAlumni && !isAdmin) {
      const userEmail = session.user.email ? String(session.user.email) : null;
      const userSapid = (session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid) : null;
      const userRegNo = (session.user as { registrationno?: string | null })?.registrationno ? String((session.user as { registrationno?: string | null }).registrationno) : null;
      
      const isOwnerBySapid = userSapid && row.sapid && userSapid.toLowerCase().trim() === row.sapid.toLowerCase().trim();
      const isOwnerByRegNo = userRegNo && row.registrationno && userRegNo.toLowerCase().trim() === row.registrationno.toLowerCase().trim();
      const isOwnerByEmail = userEmail && (
        (row.personalemail && row.personalemail.toLowerCase().trim() === userEmail.toLowerCase().trim()) ||
        (row.universityemail && row.universityemail.toLowerCase().trim() === userEmail.toLowerCase().trim()) ||
        (row.officialemail && row.officialemail.toLowerCase().trim() === userEmail.toLowerCase().trim())
      );
      
      if (!isOwnerBySapid && !isOwnerByRegNo && !isOwnerByEmail) {
        return NextResponse.json({ error: "Forbidden: You can only update your own record" }, { status: 403 });
      }
    }
    
    // SECURITY: For admin/viewer users, check access filter
    if (isAdmin) {
      const { buildAccessFilterSQL } = await import("@/lib/userAccess");
      const accessFilter = await buildAccessFilterSQL(session, "");
      
      if (accessFilter.hasFilter && accessFilter.sql) {
        // Check if this alumni record is within the user's access
        const accessCheck = await sql/* sql */`
          SELECT alumniid FROM public.tbl_alumni 
          WHERE alumniid = ${row.alumniid} 
          AND (${accessFilter.sql})
          LIMIT 1
        `;
        
        if (!accessCheck[0]) {
          return NextResponse.json({ error: "Forbidden: You don't have access to this alumni record" }, { status: 403 });
        }
      }
    }
    
    const alumniId = row.alumniid;
    
    // Update using alumniid (primary key) for reliability
    const res = await sql/* sql */`
      UPDATE public.tbl_alumni SET
        registrationno = ${v.registrationNo}, alumniname = ${v.name}, gender = ${v.gender}, fathername = ${v.fatherName ?? null},
        dateofbirth = ${v.dob ?? null}, maritalstatus = ${v.maritalStatus ?? null}, cnicpassport = ${v.cnicOrPassport},
        contactno = ${contactno}, personalemail = ${v.personalEmail}, password = ${v.password}, address = ${v.address ?? null},
        province = ${v.province ?? null}, city = ${v.homeCity}, country = ${v.homeCountry}, campusname = ${v.campus}, facultyname = ${v.faculty},
        departmentname = ${v.department}, degreetitle = ${v.program}, yearofending = ${v.passingYear}, employeed = ${v.employmentStatus},
        industry = ${v.sector ?? null}, nameoforganization = ${v.organization ?? null}, designation = ${v.designation ?? null},
        totalyearsofexpereince = ${v.totalExperienceYears ?? null}, officialemail = ${v.officialEmail ?? null}, officialnumber = ${v.officialPhone ?? null},
        datasource = ${v.source ?? null}, verify = ${v.verified === true ? "true" : v.verified === false ? "false" : null}, alumnistatus = ${v.category ?? null}
      WHERE alumniid = ${alumniId}
      RETURNING alumniid, sapid, registrationno`;
    if (!res[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, updated: res[0] }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update alumni";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ sapid: string }> }) {
  try {
    const { sapid } = await ctx.params;
    const session = await auth();
    
    // SECURITY: Require authentication
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // SECURITY: Only admins/superadmins can delete alumni records (viewers and alumni cannot)
    const { canModify } = await import("@/lib/alumniProfile");
    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden: Only admins can delete alumni records" }, { status: 403 });
    }
    
    console.log("[API] DELETE request received for identifier:", sapid);
    
    // Validate identifier (could be SAP ID or registration number)
    if (!sapid || sapid === "null" || sapid === "undefined" || sapid.trim() === "") {
      console.error("[API] Invalid identifier provided:", sapid);
      return NextResponse.json({ error: "Invalid identifier" }, { status: 400 });
    }
    
    const normalizedIdentifier = String(sapid).trim();
    console.log("[API] Attempting to delete alumni with identifier:", normalizedIdentifier);
    
    // SECURITY: Check access filter for admin/viewer users
    const { buildAccessFilterSQL } = await import("@/lib/userAccess");
    const accessFilter = await buildAccessFilterSQL(session, "");
    
    // First, try to get the alumniid using SAP ID
    // Use retry logic for connection timeouts
    let lookupResult = await retryDbOperation(async () => await sql/* sql */`
      SELECT alumniid, sapid, registrationno, alumniname 
      FROM public.tbl_alumni 
      WHERE sapid = ${normalizedIdentifier} 
      LIMIT 1`);
    
    // If not found by SAP ID, try registration number
    if (!lookupResult[0]) {
      console.log("[API] Not found by SAP ID, trying registration number:", normalizedIdentifier);
      lookupResult = await retryDbOperation(async () => await sql/* sql */`
        SELECT alumniid, sapid, registrationno, alumniname 
        FROM public.tbl_alumni 
        WHERE registrationno = ${normalizedIdentifier} 
        LIMIT 1`);
    }
    
    if (!lookupResult[0]) {
      console.warn("[API] No alumni found with SAP ID or Registration Number:", normalizedIdentifier);
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    
    const alumniId = lookupResult[0].alumniid as number;
    const foundSapid = lookupResult[0].sapid as string | null;
    const foundRegNo = lookupResult[0].registrationno as string | null;
    const foundName = lookupResult[0].alumniname as string | null;
    
    console.log("[API] Found alumni - ID:", alumniId, "SAP ID:", foundSapid, "Registration No:", foundRegNo, "Name:", foundName);
    
    // SECURITY: Verify admin/viewer has access to this alumni record
    if (accessFilter.hasFilter && accessFilter.sql) {
      const accessCheck = await sql/* sql */`
        SELECT alumniid FROM public.tbl_alumni 
        WHERE alumniid = ${alumniId} 
        AND (${accessFilter.sql})
        LIMIT 1
      `;
      
      if (!accessCheck[0]) {
        return NextResponse.json({ error: "Forbidden: You don't have access to this alumni record" }, { status: 403 });
      }
    }
    
    // Use a transaction to ensure atomic deletion and handle foreign key cascades properly
    // Delete by alumniid (primary key) which is more efficient and required for FK relationships
    // Use retry logic for connection timeouts
    const result = await retryDbOperation(async () => await sql.begin(async (tx) => {
      // First, manually delete records from tables without ON DELETE CASCADE
      // These tables don't have CASCADE, so we need to delete them explicitly
      try {
        await tx/* sql */`
          DELETE FROM public.alumni_memberships WHERE id = ${alumniId}`;
        console.log("[API] Deleted alumni_memberships records for alumni ID:", alumniId);
      } catch {
        // Ignore if no records exist or table doesn't exist
        console.log("[API] No alumni_memberships records to delete or table doesn't exist");
      }
      
      try {
        await tx/* sql */`
          DELETE FROM public.alumni_scholarships WHERE id = ${alumniId}`;
        console.log("[API] Deleted alumni_scholarships records for alumni ID:", alumniId);
      } catch {
        // Ignore if no records exist or table doesn't exist
        console.log("[API] No alumni_scholarships records to delete or table doesn't exist");
      }
      
      // Delete the alumni record by alumniid
      // Foreign key constraints with ON DELETE CASCADE will automatically delete related records
      // (tblcard, tblchapters, tblalumnitalks, tblalumnistories, alumni_chapter)
      const deleteResult = await tx/* sql */`
        DELETE FROM public.tbl_alumni 
        WHERE alumniid = ${alumniId} 
        RETURNING alumniid, sapid, alumniname`;
      
      if (!deleteResult[0]) {
        throw new Error("Failed to delete alumni record");
      }
      
      return deleteResult[0];
    }));
    
    console.log("[API] Successfully deleted alumni - ID:", result.alumniid, "SAP ID:", result.sapid, "Registration No:", foundRegNo, "Name:", result.alumniname);
    return NextResponse.json({ 
      ok: true, 
      deletedId: result.alumniid,
      sapid: result.sapid,
      registrationno: foundRegNo,
      name: result.alumniname
    }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete alumni";
    console.error("[API] Error deleting alumni:", message, err);
    
    // Check for specific error types
    if (err instanceof Error) {
      // Check for connection timeout errors
      const isConnectionError = err.message.includes("CONNECT_TIMEOUT") ||
        err.message.includes("ETIMEDOUT") ||
        err.message.includes("timeout") ||
        (err as Error & { code?: string }).code === 'CONNECT_TIMEOUT' ||
        (err as Error & { code?: string }).code === 'ETIMEDOUT';
      
      if (isConnectionError) {
        return NextResponse.json({ 
          error: "Database connection timeout. Please try again in a moment.",
          retryable: true
        }, { status: 503 }); // Service Unavailable
      }
      
      // Check for foreign key constraint errors
      if (err.message.includes("foreign key") || err.message.includes("constraint")) {
        return NextResponse.json({ 
          error: "Cannot delete alumni: There are related records that prevent deletion. Please remove related data first." 
        }, { status: 409 });
      }
    }
    
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ sapid: string }> }) {
  try {
    const { sapid } = await ctx.params;
    const session = await auth();
    
    // SECURITY: Require authentication
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // SECURITY: Only admins/superadmins can verify/unverify alumni (viewers and alumni cannot)
    const { canModify } = await import("@/lib/alumniProfile");
    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden: Only admins can verify/unverify alumni" }, { status: 403 });
    }
    
    const body = await req.json();
    const { verify } = body ?? {};
    if (verify === undefined) {
      return NextResponse.json({ error: "Missing 'verify' field" }, { status: 400 });
    }
    
    // Determine the target value: true -> 'true', false -> 'false'
    // Handle both boolean and string inputs
    const shouldVerify = verify === true || verify === "true" || String(verify).toLowerCase() === "true" || String(verify).toLowerCase() === "yes";
    
    console.log("[API] Updating verify for identifier:", sapid, "shouldVerify:", shouldVerify, "original value:", verify, "type:", typeof verify);
    
    // First, get the current alumni record to check if password exists and get email
    // The identifier might be sapid, registrationno, or alumniid (as string)
    // Try to find by sapid first, then by registrationno, then by alumniid
    const normalizedIdentifier = String(sapid || "").trim();
    
    let currentRecord = await sql/* sql */`
      SELECT alumniid, password, alumniname, personalemail, officialemail, universityemail, verify, sapid, registrationno
      FROM public.tbl_alumni 
      WHERE sapid = ${normalizedIdentifier} 
      LIMIT 1
    `;
    
    // If not found by sapid, try registrationno
    if (!currentRecord[0]) {
      currentRecord = await sql/* sql */`
        SELECT alumniid, password, alumniname, personalemail, officialemail, universityemail, verify, sapid, registrationno
        FROM public.tbl_alumni 
        WHERE registrationno = ${normalizedIdentifier} 
        LIMIT 1
      `;
    }
    
    // If still not found, try alumniid (if the identifier is numeric)
    if (!currentRecord[0] && !isNaN(Number(normalizedIdentifier))) {
      currentRecord = await sql/* sql */`
        SELECT alumniid, password, alumniname, personalemail, officialemail, universityemail, verify, sapid, registrationno
        FROM public.tbl_alumni 
        WHERE alumniid = ${Number(normalizedIdentifier)} 
        LIMIT 1
      `;
    }
    
    if (!currentRecord[0]) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    
    const current = currentRecord[0] as {
      alumniid: number;
      password: string | null;
      alumniname: string | null;
      personalemail: string | null;
      officialemail: string | null;
      universityemail: string | null;
      verify: string | boolean | null;
    };
    
    // SECURITY: Check access filter for admin/viewer users
    const { buildAccessFilterSQL } = await import("@/lib/userAccess");
    const accessFilter = await buildAccessFilterSQL(session, "");
    
    if (accessFilter.hasFilter && accessFilter.sql) {
      const accessCheck = await sql/* sql */`
        SELECT alumniid FROM public.tbl_alumni 
        WHERE alumniid = ${current.alumniid} 
        AND (${accessFilter.sql})
        LIMIT 1
      `;
      
      if (!accessCheck[0]) {
        return NextResponse.json({ error: "Forbidden: You don't have access to this alumni record" }, { status: 403 });
      }
    }
    
    // Check if this is a status change from 'pending' (under approval) to verified/unverified
    const wasUnderApproval = current.verify === null || current.verify === undefined || 
                              String(current.verify).trim().toLowerCase() === 'pending' || 
                              String(current.verify).trim() === "";
    
    // Always generate password and send email when admin verifies/unverifies an alumni that was under approval
    // This happens only once when status changes from NULL to verified/unverified
    let generatedPassword: string | null = null;
    let passwordToStore: string | null = null;
    
    if (wasUnderApproval) {
      // Always generate password when admin verifies/unverifies for the first time (moving from NULL to verified/unverified)
      // This is a one-time action - email will be sent only when moving from NULL status
      const { default: generateEasyPassword } = await import("@/lib/passwordUtils");
      generatedPassword = generateEasyPassword();
      passwordToStore = generatedPassword; // Store as plain text (same as create route)
      console.log("[API] Generated password for alumni (moving from under approval):", sapid);
    } else {
      // Keep existing password if alumni was already verified/unverified (admin is just changing status)
      passwordToStore = current.password;
      console.log("[API] Keeping existing password (alumni was already verified/unverified):", sapid);
    }
    
    // Verify field is now VARCHAR(10) - update with string value
    const verifyValue = shouldVerify ? "true" : "false";
    const needsPasswordUpdate = passwordToStore !== current.password;
    
    // Get the actual alumniid for the WHERE clause (more reliable than sapid which might be null)
    const actualAlumniId = current.alumniid;
    console.log("[API] Updating verify to:", verifyValue, "for identifier:", sapid, "actual alumni ID:", actualAlumniId);
    
    // Update verify field and password if needed
    // Use alumniid for the WHERE clause since it's the primary key and always exists
    let res;
    if (needsPasswordUpdate) {
      res = await sql/* sql */`
        UPDATE public.tbl_alumni 
        SET verify = ${verifyValue}, password = ${passwordToStore}
        WHERE alumniid = ${actualAlumniId} 
        RETURNING alumniid, verify, sapid, registrationno`;
    } else {
      res = await sql/* sql */`
        UPDATE public.tbl_alumni 
        SET verify = ${verifyValue}
        WHERE alumniid = ${actualAlumniId} 
        RETURNING alumniid, verify, sapid, registrationno`;
    }
    
    if (!res[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
    
    // Normalize the returned value to string for consistent response
    // Verify field is now VARCHAR(10)
    const updatedVerify = res[0].verify;
    let verifyString: string = String(updatedVerify || "").toLowerCase();
    
    // Ensure it's 'true' or 'false'
    if (verifyString !== "true" && verifyString !== "false") {
      verifyString = shouldVerify ? "true" : "false";
    }
    
    console.log("[API] Updated verify - raw:", updatedVerify, "normalized:", verifyString, "should be:", shouldVerify ? "true" : "false");
    
    // Verify the update was successful
    if (shouldVerify && verifyString !== "true") {
      console.error("[API] ERROR: Verify should be true but got:", verifyString);
    } else if (!shouldVerify && verifyString !== "false") {
      console.error("[API] ERROR: Verify should be false but got:", verifyString);
    }
    
    // Send welcome email ONLY when admin verifies/unverifies for the first time (moving from NULL to verified/unverified)
    // This is a one-time email sent only when status changes from NULL
    if (wasUnderApproval && generatedPassword) {
      try {
        const { sendWelcomeEmail } = await import("@/lib/email");
        const alumniEmail = current.personalemail || current.officialemail || current.universityemail;
        const alumniName = current.alumniname || "Alumni";
        
        if (alumniEmail) {
          console.log("[API] Sending welcome email to:", alumniEmail, "for first-time verification/unverification");
          console.log("[API] Generated password:", generatedPassword);
          try {
            const emailSent = await sendWelcomeEmail(
              alumniEmail,
              alumniName,
              generatedPassword,
              sapid
            );
            
            if (emailSent) {
              console.log("[API] Welcome email sent successfully to:", alumniEmail);
            } else {
              console.warn("[API] Welcome email was not sent (SMTP may not be configured)");
            }
          } catch (emailError) {
            const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
            console.error("[API] Failed to send welcome email:", errorMessage);
            console.error("[API] Email error details:", emailError);
            // Don't fail the request if email fails - verification is already updated
          }
        } else {
          console.warn("[API] No email address found for alumni, cannot send welcome email");
          console.warn("[API] Available emails - personal:", current.personalemail, "official:", current.officialemail, "university:", current.universityemail);
        }
      } catch (emailError) {
        const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
        console.error("[API] Error preparing welcome email:", errorMessage);
        console.error("[API] Email error details:", emailError);
        // Don't fail the request if email fails
      }
    } else if (wasUnderApproval && !generatedPassword) {
      console.error("[API] ERROR: Alumni was under approval but password was not generated!");
    }
    
    return NextResponse.json({ ok: true, verify: verifyString }, { status: 200 });
  } catch (err) {
    console.error("[API] Error updating verify:", err);
    const message = err instanceof Error ? err.message : "Failed to update verification status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}