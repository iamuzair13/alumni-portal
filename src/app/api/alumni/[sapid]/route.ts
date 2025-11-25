import { NextResponse } from "next/server";
import { z } from "zod";
import { alumniRegistrationComprehensiveSchema } from "@/lib/alumniRegistration";
import { sql } from "@/lib/dbconnect";

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
    password: row.password ?? "",
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
    const rows = await sql/* sql */`
      SELECT * FROM public.tbl_alumni WHERE sapid = ${sapid} LIMIT 1`;
    if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const formVals = mapFromDb(rows[0]);
    const row = rows[0] as DbAlumniRow;
    // Include image1 and social links in the response
    return NextResponse.json({ 
      item: {
        ...formVals,
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
    const body = await req.json();
    const parsed = alumniRegistrationComprehensiveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const v = parsed.data;
    const contactno = `${v.countryCode} ${v.phoneNumber}`.trim();
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
      WHERE sapid = ${sapid}
      RETURNING alumniid, sapid`;
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
    
    console.log("[API] DELETE request received for SAP ID:", sapid);
    
    // Validate sapid
    if (!sapid || sapid === "null" || sapid === "undefined" || sapid.trim() === "") {
      console.error("[API] Invalid SAP ID provided:", sapid);
      return NextResponse.json({ error: "Invalid SAP ID" }, { status: 400 });
    }
    
    const normalizedSapid = String(sapid).trim();
    console.log("[API] Attempting to delete alumni with SAP ID:", normalizedSapid);
    
    const res = await sql/* sql */`
      DELETE FROM public.tbl_alumni WHERE sapid = ${normalizedSapid} RETURNING alumniid`;
    
    if (!res[0]) {
      console.warn("[API] No alumni found with SAP ID:", normalizedSapid);
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    
    console.log("[API] Successfully deleted alumni with SAP ID:", normalizedSapid, "Alumni ID:", res[0].alumniid);
    return NextResponse.json({ ok: true, deletedId: res[0].alumniid }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete alumni";
    console.error("[API] Error deleting alumni:", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ sapid: string }> }) {
  try {
    const { sapid } = await ctx.params;
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
    let currentRecord = await sql/* sql */`
      SELECT alumniid, password, alumniname, personalemail, officialemail, universityemail, verify, sapid, registrationno
      FROM public.tbl_alumni 
      WHERE sapid = ${sapid} 
      LIMIT 1
    `;
    
    // If not found by sapid, try registrationno
    if (!currentRecord[0]) {
      currentRecord = await sql/* sql */`
        SELECT alumniid, password, alumniname, personalemail, officialemail, universityemail, verify, sapid, registrationno
        FROM public.tbl_alumni 
        WHERE registrationno = ${sapid} 
        LIMIT 1
      `;
    }
    
    // If still not found, try alumniid (if the identifier is numeric)
    if (!currentRecord[0] && !isNaN(Number(sapid))) {
      currentRecord = await sql/* sql */`
        SELECT alumniid, password, alumniname, personalemail, officialemail, universityemail, verify, sapid, registrationno
        FROM public.tbl_alumni 
        WHERE alumniid = ${Number(sapid)} 
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