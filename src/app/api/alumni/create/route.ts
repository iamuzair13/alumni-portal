import { sql } from "@/lib/dbconnect";
import { NextResponse } from "next/server";
import generateEasyPassword from "@/lib/passwordUtils";
import { auth } from "@/lib/auth";
import { parseChapterCities } from "@/lib/chapterCities";
import { erpClient } from "@/lib/erpClient";

function normalizeCnicOrPassport(value: string, mode: "cnic" | "passport" | "auto" = "auto"): string {
  const raw = String(value ?? "");
  const stripped = raw.replace(/[^0-9a-zA-Z]/g, "");
  if (!stripped) return "";

  if (mode === "cnic") return stripped.replace(/\D/g, "");
  if (mode === "passport") return stripped.toUpperCase();

  // auto: if it is digits only -> treat as CNIC, else passport
  const isDigitsOnly = /^\d+$/.test(stripped);
  return isDigitsOnly ? stripped : stripped.toUpperCase();
}

function extractErpCnicOrPassport(erpData: unknown): string | null {
  if (!erpData) return null;

  // ERP client may return object or array (OData results)
  const record = Array.isArray(erpData) ? erpData[0] : erpData;
  if (!record || typeof record !== "object") return null;

  const obj = record as Record<string, unknown>;
  const candidates = [
    // CNIC variations
    "cnicpassport",
    "cnic_or_passport",
    "cnic",
    "cnicno",
    "cnic_no",
    "CNIC",
    "CNICNO",
    "CNIC_NO",
    // Passport variations
    "passport",
    "passportno",
    "passport_no",
    "Passport",
    "PassportNo",
    "PASSPORT",
    "PASSPORTNO",
    "PASSPORT_NO",
  ];

  for (const key of candidates) {
    const v = obj[key];
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) return s;
  }

  return null;
}

async function validateCnicPassportAgainstErp(input: {
  registrationNo?: string | null;
  sapId?: string | null;
  cnicOrPassport?: string | null;
}): Promise<boolean> {
  try {
    const registrationNo = input.registrationNo ? String(input.registrationNo).trim() : "";
    const sapId = input.sapId ? String(input.sapId).trim() : "";
    const cnicOrPassport = input.cnicOrPassport ? String(input.cnicOrPassport).trim() : "";

    // Without ERP keys we cannot compare; caller must require at least one of Registration # / SAP ID.
    if (!registrationNo && !sapId) return true;

    // If user did not provide CNIC/Passport (should be required elsewhere), allow submission here
    if (!cnicOrPassport) return true;

    // 1) Try by registration number
    let erpResponse: { success: boolean; data?: unknown; error?: string } | null = null;
    if (registrationNo) {
      erpResponse = await erpClient.fetchByRegistrationNo(registrationNo);
    }

    // 2) If not found and sapId provided, try by SAP ID
    if (
      (!erpResponse || erpResponse.success === false) &&
      (erpResponse?.error === "NOT_FOUND" || !erpResponse?.error) &&
      sapId
    ) {
      const bySap = await erpClient.fetchBySapId(sapId);
      // Prefer SAP result only if it actually has data
      erpResponse = bySap.success ? bySap : erpResponse;
      if (!erpResponse?.success && bySap.success) erpResponse = bySap;
      if (!erpResponse?.success && erpResponse?.error === "NOT_FOUND") {
        // still not found
      }
    }

    // If ERP has no data (not found) -> allow submission
    if (!erpResponse || erpResponse.success === false) {
      // ERP API fail/timeout/network -> allow submission
      return true;
    }

    const erpValueRaw = extractErpCnicOrPassport(erpResponse.data);

    // ERP returns null/empty -> allow submission
    if (!erpValueRaw) return true;

    // Determine type based on ERP value shape
    const erpStripped = String(erpValueRaw).replace(/[^0-9a-zA-Z]/g, "");
    const isErpCnic = /^\d+$/.test(erpStripped);
    const mode: "cnic" | "passport" = isErpCnic ? "cnic" : "passport";

    const normalizedErp = normalizeCnicOrPassport(erpValueRaw, mode);
    const normalizedUser = normalizeCnicOrPassport(cnicOrPassport, mode);

    if (!normalizedErp) return true;
    if (!normalizedUser) return true;

    return normalizedErp === normalizedUser;
  } catch {
    // If ERP API fails or times out: allow submission
    return true;
  }
}

type TblAlumniBody = {
  alumniemail: string | null;
  password: string | null;
  todaydate: string | null;
  registrationno: string | null;
  sapid: string | null;
  alumniname: string | null;
  gender: string | null;
  fathername: string | null;
  dateofbirth: string | null;
  maritalstatus: string | null;
  cnicpassport: string | null;
  contactno: string | null;
  contactno1: string | null;
  contactno1show: boolean | null;
  personalemail: string | null;
  personalemailshow: boolean | null;
  universityemail: string | null;
  country: string | null;
  province: string | null;
  city: string | null;
  address: string | null;
  academicsession: string | null;
  degreetitle: string | null;
  cgpa: number | null;
  yearofstarting: number | null;
  yearofending: number | null;
  faculty: number | null;
  facultyname: string | null;
  campusname: string | null;
  department: number | null;
  departmentname: string | null;
  program: number | null;
  majorsubject: string | null;
  industry: string | null;
  employeed: string | null;
  nameoforganization: string | null;
  designation: string | null;
  totalyearsofexpereince: string | null;
  officialemail: string | null;
  officialnumber: string | null;
  organization_address: string | null;
  image1: string | null;
  cv: string | null;
  aboutme: string | null;
  lasttimelogin: string | null;
  logincount: number | null;
  verify: string | null | boolean;
  emailsendcount: number | null;
  emailsendstatus: string | null;
  createddatetime: string | null;
  facebook: string | null;
  instagram: string | null;
  youtube: string | null;
  linkedin: string | null;
  datasource: string | null;
  alumnistatus: string | null;
  category?: string | null;
  // Higher Education fields
  highereducationdegreetitle: string | null;
  highereducationinstitute: string | null;
  highereducationprogram: string | null;
  scholarship: string | null;
  chapters: number[] | null; // Array of selected chapter IDs (up to 3)
  alumni_consent_info: boolean | null;
};

/**
 * POST /api/alumni/create
 * 
 * Alumni Registration Endpoint (Public - No Login Required)
 * 
 * This endpoint allows public registration without requiring authentication.
 * Access assignment validation only applies to logged-in admin/viewer users.
 */
export async function POST(req: Request) {
  try {
    // Get session if available (optional - registration is public)
    await auth();
    const body = (await req.json()) as TblAlumniBody;
    
    // NOTE: Duplicate checks now only validate PRIMARY identifiers (SAP ID, Registration Number, CNIC/Passport).
    // Personal email and contact numbers are allowed to be duplicated across multiple alumni records.
    // Registration logic depends ONLY on verify_status (see rules above).

    // Server-side validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    // Extract all identifier fields
    const regNo = body.registrationno ? String(body.registrationno).trim() : "";
    const sapId = body.sapid ? String(body.sapid).trim() : "";
    const cnic = body.cnicpassport ? String(body.cnicpassport).trim() : "";

    // Business rule: at least one of Registration # or SAP ID (matches form copy: provide at least one).
    if (!regNo && !sapId) {
      return NextResponse.json(
        { error: "Either Registration Number or SAP ID is required." },
        { status: 400 }
      );
    }
    
    const required: Array<[keyof TblAlumniBody, string]> = [
      ["alumniname", "Name"],
      ["gender", "Gender"],
      ["cnicpassport", "CNIC/Passport"],
      ["contactno", "Mobile No"],
      ["personalemail", "Personal Email"],
      ["city", "City"],
      ["country", "Country"],
      ["campusname", "Campus"],
      ["faculty", "Faculty"],
      ["department", "Department"],
      ["degreetitle", "Program"],
      ["yearofending", "Year of Passing"],
    ];
    for (const [k, label] of required) {
      const val = body[k];
      if (val === null || val === undefined || String(val).trim() === "") {
        return NextResponse.json({ error: `${label} is required` }, { status: 400 });
      }
    }

    // CNIC/Passport vs ERP validation (confidential):
    // - Only validate if ERP has a value
    // - Allow on ERP not-found/failure/timeout
    // - Never return ERP value in response
    const isCnicPassportValid = await validateCnicPassportAgainstErp({
      registrationNo: regNo || null,
      sapId: sapId || null,
      cnicOrPassport: cnic || null,
    });

    if (!isCnicPassportValid) {
      return NextResponse.json(
        { error: "Your CNIC/Passport does not match our records. Please recheck and try again." },
        { status: 400 }
      );
    }
    if (!emailPattern.test(String(body.personalemail))) {
      return NextResponse.json({ error: "Invalid personal email format" }, { status: 400 });
    }
    // Phone number has no format restrictions - only required
    // Password will be auto-generated if not provided

    // Generate password if not provided
    const plainPassword = body.password && String(body.password).trim().length > 0
      ? String(body.password).trim()
      : generateEasyPassword();

    // Store the generated password for email (will be sent if auto-generated)
    const generatedPassword = body.password && String(body.password).trim().length > 0 ? null : plainPassword;

    // Sanitize: trim empty strings to null, coerce boolean verify to Yes/No
    const clean = (v: unknown) => {
      if (v === null || v === undefined) return null;
      if (typeof v === "boolean") return v ? "Yes" : "No";
      if (typeof v === "number") return v;
      const s = String(v).trim();
      return s.length ? s : null;
    };
    
    const mapEmployeed = (value: string | null): string | null => {
      if (!value) return null;
      const val = String(value).trim();

      const lower = val.toLowerCase();

      if (val === "Employed" || val === "Employed/Business" || lower === "employed/business") return "Employed";
      if (
        val === "Self-Emplo" ||
        val === "Self-Employed" ||
        val === "Self-employed" ||
        val === "Self employed" ||
        val === "Self-Employed/Enterpreneur" ||
        lower === "self-employed/enterpreneur"
      ) {
        return "Self-Employed/Enterpreneur";
      }
      if (lower === "highered" || val === "HigherEd") return "Pursuing Higher Education";
      return val;
    };
    
    // Truncate totalyearsofexpereince to fit VARCHAR(10) constraint
    const truncateExperience = (value: string | null): string | null => {
      if (!value) return null;
      const val = String(value).trim();
      return val.length > 10 ? val.substring(0, 10) : val;
    };

    const createdDateTimeValue = clean(body.createddatetime) ?? new Date().toISOString();

    const todayDateValue = body.todaydate ? new Date(String(body.todaydate)) : null;
    // alumniemail is admin-assigned and should not be populated from public/alumni registration.

    // REGISTRATION RULES: Validation depends ONLY on verify_status
    // 1. If alumni exists and verify = 'true' → Block registration
    // 2. If alumni exists and verify = 'underApproval'/'false'/null → Allow registration, overwrite, set verify = 'underApproval'
    // 3. If no alumni record exists → Create new record, set verify = 'underApproval'
    
    // Check if alumni record already exists by PRIMARY identifiers only:
    // - SAP ID, Registration Number, CNIC/Passport (these are unique identifiers)
    // Email and phone numbers are allowed to be duplicated
    let existingRecord: { 
      alumniid: number; 
      verify: string | null; 
      registrationno: string | null; 
      sapid: string | null;
      cnicpassport: string | null;
    } | null = null;
    
    // Build query conditions for PRIMARY identifiers only using sql fragments
    const conditions: ReturnType<typeof sql>[] = [];
    
    if (regNo) {
      conditions.push(sql`(registrationno = ${regNo} AND registrationno IS NOT NULL AND registrationno != '')`);
    }
    if (sapId) {
      conditions.push(sql`(sapid = ${sapId} AND sapid IS NOT NULL AND sapid != '')`);
    }
    if (cnic) {
      conditions.push(sql`(cnicpassport = ${cnic} AND cnicpassport IS NOT NULL AND cnicpassport != '')`);
    }
    
    // Check for existing record if we have at least one identifier
    if (conditions.length > 0) {
      // Combine all conditions with OR
      const whereCondition = conditions.reduce((acc, condition, index) => {
        if (index === 0) return condition;
        return sql`${acc} OR ${condition}`;
      });
      
      const checkQuery = sql/* sql */`
        SELECT alumniid, verify, registrationno, sapid, cnicpassport
        FROM public.tbl_alumni 
        WHERE ${whereCondition}
        LIMIT 1
      `;
      
      const checkResult = await checkQuery;
      if (checkResult.length > 0) {
        existingRecord = checkResult[0] as {
          alumniid: number; 
          verify: string | null; 
          registrationno: string | null; 
          sapid: string | null;
          cnicpassport: string | null;
        };
        
        // Determine which identifier matched
        const matchedBy: string[] = [];
        if (regNo && existingRecord.registrationno && 
            String(existingRecord.registrationno).trim().toLowerCase() === regNo.toLowerCase()) {
          matchedBy.push('registrationno');
        }
        if (sapId && existingRecord.sapid && 
            String(existingRecord.sapid).trim().toLowerCase() === sapId.toLowerCase()) {
          matchedBy.push('sapid');
        }
        if (cnic && existingRecord.cnicpassport && 
            String(existingRecord.cnicpassport).trim().toLowerCase() === cnic.toLowerCase()) {
          matchedBy.push('cnicpassport');
        }

      }
    }
    
    // RULE 1: If alumni exists and verify = 'true', block registration
    if (existingRecord) {
      // Normalize verify status: handle null, empty string, and various case variations
      const rawVerify = existingRecord.verify;
      let verifyStatus: string | null = null;
      
      if (rawVerify !== null && rawVerify !== undefined) {
        const verifyStr = String(rawVerify).trim();
        if (verifyStr.length > 0) {
          verifyStatus = verifyStr.toLowerCase();
        }
      }

      // Block only if verify is exactly 'true' (case-insensitive)
      if (verifyStatus === "true") {

        return NextResponse.json({ 
          error: "This alumni is already verified and cannot register again.",
          existingRecord: {
            alumniid: existingRecord.alumniid,
            sapid: existingRecord.sapid,
            registrationno: existingRecord.registrationno
          }
        }, { status: 403 });
      }
      
      // RULE 2: If alumni exists and verify = 'underApproval'/'false'/null, allow registration and overwrite

      // Continue to update logic below (will be handled in the transaction)
      // We'll modify the INSERT to be an UPDATE when existingRecord is found
    } else {

    }

    // Updates must not leave both Registration # and SAP ID empty (merged incoming + existing).
    if (existingRecord) {
      const incomingRegNo = clean(body.registrationno);
      const incomingSapId = clean(body.sapid);
      const preservedRegNo = incomingRegNo ?? existingRecord.registrationno;
      const preservedSapId = incomingSapId ?? existingRecord.sapid;
      const hasPreservedReg =
        preservedRegNo != null && String(preservedRegNo).trim() !== "";
      const hasPreservedSap =
        preservedSapId != null && String(preservedSapId).trim() !== "";
      if (!hasPreservedReg && !hasPreservedSap) {
        return NextResponse.json(
          { error: "Either Registration Number or SAP ID is required." },
          { status: 400 }
        );
      }
    }

    // Track whether this is an update or insert for proper response status
    let isUpdate = false;

    const id = await sql.begin(async (tx) => {
      // RULE 2: If existing record found (verify = 'underApproval'/'false'/null), UPDATE it
      if (existingRecord) {
        isUpdate = true;
        const existingAlumniId = existingRecord.alumniid;
        
        // Preserve PRIMARY identifier fields only: if incoming value is missing, keep the existing value
        // Email and phone numbers are allowed to be updated (not preserved)
        const incomingRegNo = clean(body.registrationno);
        const incomingSapId = clean(body.sapid);
        const incomingCnic = clean(body.cnicpassport);
        
        const preservedRegNo = incomingRegNo ?? existingRecord.registrationno;
        const preservedSapId = incomingSapId ?? existingRecord.sapid;
        const preservedCnic = incomingCnic ?? existingRecord.cnicpassport;

        // Update existing record with new data, set verify = 'underApproval'
        const updateResult = await tx/* sql */`
          UPDATE public.tbl_alumni SET
            password = ${plainPassword},
            todaydate = ${todayDateValue},
            createddatetime = COALESCE(createddatetime, ${createdDateTimeValue}),
            registrationno = ${preservedRegNo},
            sapid = ${preservedSapId},
            cnicpassport = ${preservedCnic},
            contactno = ${clean(body.contactno)},
            personalemail = ${clean(body.personalemail)},
            universityemail = ${clean(body.universityemail)},
            officialemail = ${clean(body.officialemail)},
            alumniname = ${clean(body.alumniname)},
            gender = ${clean(body.gender)},
            fathername = ${clean(body.fathername)},
            dateofbirth = ${clean(body.dateofbirth)},
            maritalstatus = ${clean(body.maritalstatus)},
            contactno1 = ${clean(body.contactno1)},
            contactno1show = ${body.contactno1show ?? null},
            personalemailshow = ${body.personalemailshow ?? null},
            country = ${clean(body.country)},
            province = ${clean(body.province)},
            city = ${clean(body.city)},
            address = ${clean(body.address)},
            academicsession = ${clean(body.academicsession)},
            degreetitle = ${clean(body.degreetitle)},
            cgpa = ${body.cgpa ?? null},
            yearofstarting = ${body.yearofstarting ?? null},
            yearofending = ${body.yearofending ?? null},
            faculty = ${body.faculty ?? null},
            campusname = ${clean(body.campusname)},
            department = ${body.department ?? null},
            program = ${body.program ?? null},
            majorsubject = ${clean(body.majorsubject)},
            industry = ${clean(body.industry)},
            employeed = ${mapEmployeed(body.employeed)},
            nameoforganization = ${clean(body.nameoforganization)},
            designation = ${clean(body.designation)},
            totalyearsofexpereince = ${truncateExperience(body.totalyearsofexpereince)},
            officialnumber = ${clean(body.officialnumber)},
            work_city = ${clean((body as { workCity?: string | null }).workCity ?? null)},
            work_country = ${clean((body as { workCountry?: string | null }).workCountry ?? null)},
            image1 = ${clean(body.image1)},
            cv = ${clean(body.cv)},
            aboutme = ${clean(body.aboutme)},
            verify = ${'underApproval'}, /* Set verify = 'underApproval' for re-registration (Under Approval) */
            datasource = ${clean(body.datasource)},
            alumnistatus = ${clean(body.alumnistatus)},
            category = ${clean((body as { category?: string | null }).category ?? null)},
            degree_title = ${clean(body.highereducationdegreetitle)},
            higher_education_institute_name = ${clean(body.highereducationinstitute)},
            higher_education_program = ${clean(body.highereducationprogram)},
            is_scholarship = ${clean(body.scholarship)},
            higher_education_institute_country = ${clean((body as { highereducationinstituteCountry?: string | null; workCountry?: string | null }).highereducationinstituteCountry ?? (body as { workCountry?: string | null }).workCountry ?? null)},
            higher_education_institute_city = ${clean((body as { highereducationinstituteCity?: string | null; workCity?: string | null }).highereducationinstituteCity ?? (body as { workCity?: string | null }).workCity ?? null)},
            alumni_consent_info = ${body.alumni_consent_info ?? false}
          WHERE alumniid = ${existingAlumniId}
          RETURNING alumniid, verify
        `;
        
        const updated = updateResult[0];

        return updated.alumniid;
      }
      
      // RULE 3: If no existing record, create new record
      // Reset sequence if needed to prevent duplicate key errors
      // This ensures the sequence is at least as high as the highest existing alumniid
      try {
        const maxIdResult = await tx<{ max: number | null }[]>`
          SELECT MAX(alumniid) as max FROM public.tbl_alumni
        `;
        const maxId = maxIdResult[0]?.max ?? 0;
        
        if (maxId > 0) {
          await tx/* sql */`
            SELECT setval(
              pg_get_serial_sequence('public.tbl_alumni', 'alumniid'),
              ${maxId},
              true
            )
          `;
        }
      } catch (seqError) {
        // If sequence reset fails, continue anyway - PostgreSQL will handle it

      }
      
      // Build the INSERT query
      const rows = await tx<{ alumniid: number }[]>`
        INSERT INTO public.tbl_alumni (
          alumniemail,
          password,
          todaydate,
          registrationno,
          sapid,
          alumniname,
          gender,
          fathername,
          dateofbirth,
          maritalstatus,
          cnicpassport,
          contactno,
          contactno1,
          contactno1show,
          personalemail,
          personalemailshow,
          universityemail,
          country,
          province,
          city,
          address,
          academicsession,
          degreetitle,
          cgpa,
          yearofstarting,
          yearofending,
          faculty,
          campusname,
          department,
          program,
          majorsubject,
          industry,
          employeed,
          nameoforganization,
          designation,
          totalyearsofexpereince,
          officialemail,
          officialnumber,
          organization_address,
          work_city,
          work_country,
          image1,
          cv,
          aboutme,
          lasttimelogin,
          logincount,
          verify,
          emailsendcount,
          emailsendstatus,
          createddatetime,
          facebook,
          instagram,
          youtube,
          linkedin,
          datasource,
          alumnistatus,
          category,
          degree_title,
          higher_education_institute_name,
          higher_education_program,
          is_scholarship,
          higher_education_institute_country,
          higher_education_institute_city,
          alumni_consent_info
        ) VALUES (
          NULL,
          ${plainPassword},
          ${todayDateValue},
          ${clean(body.registrationno)},
          ${clean(body.sapid)},
          ${clean(body.alumniname)},
          ${clean(body.gender)},
          ${clean(body.fathername)},
          ${clean(body.dateofbirth)},
          ${clean(body.maritalstatus)},
          ${clean(body.cnicpassport)},
          ${clean(body.contactno)},
          ${clean(body.contactno1)},
          ${body.contactno1show ?? null},
          ${clean(body.personalemail)},
          ${body.personalemailshow ?? null},
          ${clean(body.universityemail)},
          ${clean(body.country)},
          ${clean(body.province)},
          ${clean(body.city)},
          ${clean(body.address)},
          ${clean(body.academicsession)},
          ${clean(body.degreetitle)},
          ${body.cgpa ?? null},
          ${body.yearofstarting ?? null},
          ${body.yearofending ?? null},
          ${body.faculty ?? null},
          ${clean(body.campusname)},
          ${body.department ?? null},
          ${body.program ?? null},
          ${clean(body.majorsubject)},
          ${clean(body.industry)},
          ${mapEmployeed(body.employeed)},
          ${clean(body.nameoforganization)},
          ${clean(body.designation)},
          ${truncateExperience(body.totalyearsofexpereince)},
          ${clean(body.officialemail)},
          ${clean(body.officialnumber)},
          ${clean((body as { organization_address?: string | null }).organization_address ?? null)},
          ${clean((body as { workCity?: string | null }).workCity ?? null)},
          ${clean((body as { workCountry?: string | null }).workCountry ?? null)},
          ${clean(body.image1)},
          ${clean(body.cv)},
          ${clean(body.aboutme)},
          ${clean(body.lasttimelogin)},
          ${body.logincount ?? null},
          ${'underApproval'}, /* verify = 'underApproval' for new registrations (Under Approval) */
          ${body.emailsendcount ?? null},
          ${clean(body.emailsendstatus)},
          ${createdDateTimeValue},
          ${clean(body.facebook)},
          ${clean(body.instagram)},
          ${clean(body.youtube)},
          ${clean(body.linkedin)},
          ${clean(body.datasource)},
          ${clean(body.alumnistatus)},
          ${clean((body as { category?: string | null }).category ?? null)},
          ${clean(body.highereducationdegreetitle)},
          ${clean(body.highereducationinstitute)},
          ${clean(body.highereducationprogram)},
          ${clean(body.scholarship)},
          ${clean((body as { highereducationinstituteCountry?: string | null }).highereducationinstituteCountry ?? null)},
          ${clean((body as { highereducationinstituteCity?: string | null }).highereducationinstituteCity ?? null)},
          ${body.alumni_consent_info ?? false}
        ) RETURNING alumniid;
      `;
      const alumniId = rows[0]?.alumniid;
      
      // Immediately verify that 'underApproval' was inserted correctly
      if (alumniId) {
        try {
          const immediateCheck = await tx/* sql */`
            SELECT verify, LENGTH(verify) as verify_length
            FROM public.tbl_alumni 
            WHERE alumniid = ${alumniId}
            LIMIT 1
          `;

          if (String(immediateCheck[0]?.verify ?? '').trim().toLowerCase() !== 'underapproval') {

            // Try to fix it within the same transaction
            await tx/* sql */`
              UPDATE public.tbl_alumni 
              SET verify = 'underApproval'
              WHERE alumniid = ${alumniId}
            `;

          }
        } catch (checkErr) {

        }
      }
      
      return alumniId;
    });

    // Save selected chapters and assign association based on faculty
    if (id) {
      try {
        // Save selected chapters from form (if provided)
        if (body.chapters && Array.isArray(body.chapters) && body.chapters.length > 0) {
          // Validate: maximum 3 chapters
          const chapterIds = body.chapters.slice(0, 3).map(ch => Number(ch)).filter(ch => !isNaN(ch) && ch > 0);
          
          if (chapterIds.length > 0) {
            // Verify all chapter IDs exist and are active
            const validChapters = await sql<{ id: number }[]>/* sql */`
              SELECT id FROM public.tblchapters 
              WHERE id = ANY(${chapterIds}) AND is_active = true
            `;
            
            const validChapterIds = validChapters.map(ch => ch.id);
            
            if (validChapterIds.length > 0) {
              // Prepare chapter values (up to 3)
              const chapter1 = validChapterIds[0] || null;
              const chapter2 = validChapterIds[1] || null;
              const chapter3 = validChapterIds[2] || null;
              
              // Check if a record already exists for this alumni
              const existingChapter = await sql/* sql */`
                SELECT id FROM public.alumni_chapter 
                WHERE id = ${id}
              `;

              if (existingChapter.length > 0) {
                // Update existing record
                await sql/* sql */`
                  UPDATE public.alumni_chapter 
                  SET 
                    "chapter1" = ${chapter1},
                    "chapter2" = ${chapter2},
                    "chapter3" = ${chapter3}
                  WHERE id = ${id}
                `;
              } else {
                // Insert new record
                await sql/* sql */`
                  INSERT INTO public.alumni_chapter (id, "chapter1", "chapter2", "chapter3")
                  VALUES (${id}, ${chapter1}, ${chapter2}, ${chapter3})
                `;
              }

            }
          }
        }

        // Auto-assign chapter based on:
        // - If home country is Pakistan => match home city against tblchapters.cities
        // - If home country is NOT Pakistan => match home country against tblchapters.cities (international alumni)
        // Only runs when no chapters are explicitly provided in the payload.
        const hasExplicitChapters = !!(body.chapters && Array.isArray(body.chapters) && body.chapters.length > 0);
        if (!hasExplicitChapters) {
          const homeCountryRaw = body.country ? String(body.country).trim() : "";
          const homeCityRaw = body.city ? String(body.city).trim() : "";
          const countryLower = homeCountryRaw.toLowerCase().trim();
          const isPakistan = countryLower === "pakistan";
          const lookupValueRaw = isPakistan ? homeCityRaw : homeCountryRaw;
          const lookupType = isPakistan ? "city" : "country";

          if (lookupValueRaw) {
            try {
              const chapters = await sql<
                {
                  id: number;
                  national_chapter: string | null;
                  international_chapter: string | null;
                  cities: unknown;
                }[]
              >/* sql */`
                SELECT id, national_chapter, international_chapter, cities
                FROM public.tblchapters
                WHERE is_active = true
                  AND cities IS NOT NULL
              `;

              const lookupLower = lookupValueRaw.toLowerCase().trim();

              const matches = chapters
                .map((ch) => {
                  const parsed = parseChapterCities(ch.cities);
                  const has = parsed.some((c) => c.toLowerCase().trim() === lookupLower);
                  return {
                    id: Number(ch.id),
                    name: String(ch.national_chapter || ch.international_chapter || ""),
                    type: ch.national_chapter ? "national" : "international",
                    has,
                  };
                })
                .filter((m) => m.has);

              // Prefer national for Pakistan-city lookups, prefer international for country lookups
              const preferredType = lookupType === "city" ? "national" : "international";
              matches.sort((a, b) => {
                const aPref = a.type === preferredType ? 0 : 1;
                const bPref = b.type === preferredType ? 0 : 1;
                if (aPref !== bPref) return aPref - bPref;
                return a.id - b.id;
              });

              const chosen = matches[0];

              if (chosen) {
                const existing = await sql<{ id: number; chapter1: number | null }[]>/* sql */`
                  SELECT id, "chapter1"
                  FROM public.alumni_chapter
                  WHERE id = ${id}
                  LIMIT 1
                `;

                const currentChapter1 = existing[0]?.chapter1 ?? null;
                if (currentChapter1) {

                } else if (existing.length > 0) {
                  await sql/* sql */`
                    UPDATE public.alumni_chapter
                    SET "chapter1" = ${chosen.id}
                    WHERE id = ${id}
                  `;

                } else {
                  await sql/* sql */`
                    INSERT INTO public.alumni_chapter (id, "chapter1", "chapter2", "chapter3")
                    VALUES (${id}, ${chosen.id}, NULL, NULL)
                  `;

                }
              }
            } catch (err) {

            }
          } else {

          }
        }

        // Auto-assign work-location chapter into chapter2:
        // - If work country is Pakistan => match work city against tblchapters.cities
        // - If work country is NOT Pakistan => match work country against tblchapters.cities
        // Only runs when no chapters are explicitly provided in the payload.
        if (!hasExplicitChapters) {
          const employeedRaw = String(body.employeed ?? "").trim();
          const isHigherEducation =
            employeedRaw.toLowerCase().trim() === "pursuing higher education" ||
            employeedRaw.toLowerCase().trim() === "highered";

          const isWorkStatus =
            employeedRaw.toLowerCase().trim() === "employed" ||
            employeedRaw.toLowerCase().trim() === "employed/business" ||
            employeedRaw.toLowerCase().trim() === "self-employed/enterpreneur";

          // If user is not employed/self-employed and not pursuing higher education, work-location chapter2 is not applicable.
          if (!isWorkStatus && !isHigherEducation) {
            // skip auto-assign
          } else {

            // Prefer institute country/city for higher education; fall back to workCountry/workCity for legacy clients.
            const instituteCountryRaw = String((body as { highereducationinstituteCountry?: string | null }).highereducationinstituteCountry ?? "").trim();
            const instituteCityRaw = String((body as { highereducationinstituteCity?: string | null }).highereducationinstituteCity ?? "").trim();
            const workCountryRaw = String((body as { workCountry?: string | null }).workCountry ?? "").trim();
            const workCityRaw = String((body as { workCity?: string | null }).workCity ?? "").trim();

            const effectiveCountryRaw = isHigherEducation ? (instituteCountryRaw || workCountryRaw) : workCountryRaw;
            const effectiveCityRaw = isHigherEducation ? (instituteCityRaw || workCityRaw) : workCityRaw;

            const isWorkPakistan = effectiveCountryRaw.toLowerCase().trim() === "pakistan";
            const workLookupType = isWorkPakistan ? "city" : "country";
            const workLookupValueRaw = isWorkPakistan ? effectiveCityRaw : effectiveCountryRaw;

            if (workLookupValueRaw) {
              try {
                const chapters = await sql<
                  {
                    id: number;
                    national_chapter: string | null;
                    international_chapter: string | null;
                    cities: unknown;
                  }[]
                >/* sql */`
                  SELECT id, national_chapter, international_chapter, cities
                  FROM public.tblchapters
                  WHERE is_active = true
                    AND cities IS NOT NULL
                `;

                const lookupLower = workLookupValueRaw.toLowerCase().trim();
                const matches = chapters
                  .map((ch) => {
                    const parsed = parseChapterCities(ch.cities);
                    const has = parsed.some((c) => c.toLowerCase().trim() === lookupLower);
                    return {
                      id: Number(ch.id),
                      name: String(ch.national_chapter || ch.international_chapter || ""),
                      type: ch.national_chapter ? "national" : "international",
                      has,
                    };
                  })
                  .filter((m) => m.has);

                const preferredType = workLookupType === "city" ? "national" : "international";
                matches.sort((a, b) => {
                  const aPref = a.type === preferredType ? 0 : 1;
                  const bPref = b.type === preferredType ? 0 : 1;
                  if (aPref !== bPref) return aPref - bPref;
                  return a.id - b.id;
                });

                const chosen = matches[0];

                if (chosen) {
                  const existing = await sql<{ id: number; chapter2: number | null }[]>/* sql */`
                    SELECT id, "chapter2"
                    FROM public.alumni_chapter
                    WHERE id = ${id}
                    LIMIT 1
                  `;

                  const currentChapter2 = existing[0]?.chapter2 ?? null;
                  if (currentChapter2) {

                  } else if (existing.length > 0) {
                    await sql/* sql */`
                      UPDATE public.alumni_chapter
                      SET "chapter2" = ${chosen.id}
                      WHERE id = ${id}
                    `;

                  } else {
                    await sql/* sql */`
                      INSERT INTO public.alumni_chapter (id, "chapter1", "chapter2", "chapter3")
                      VALUES (${id}, NULL, ${chosen.id}, NULL)
                    `;

                  }
                }
              } catch (err) {

              }
            } else {
              // Do not block registration if work/institute location is missing.
              // Auto-assign chapter2 is best-effort only.
            }
          }
        }

        // Auto-assign association based on selected faculty (first registration / when association_id is empty)
        let facultyName = "";
        if (body.faculty) {
          // Fetch faculty name from database using the ID
          const facultyRow = await sql/* sql */`
            SELECT faculty_name FROM public.tbl_faculties WHERE id = ${body.faculty} LIMIT 1
          `;
          facultyName = facultyRow.length > 0 ? String(facultyRow[0].faculty_name).trim() : "";
        }
        if (facultyName) {
          try {
            const currentAssoc = await sql<{ association_id: number | null }[]>/* sql */`
              SELECT association_id
              FROM public.tbl_alumni
              WHERE alumniid = ${id}
              LIMIT 1
            `;

            const existingAssociationId = currentAssoc[0]?.association_id ?? null;

            if (existingAssociationId) {

            } else {
              const assocRows = await sql<{ id: number; title: string | null }[]>/* sql */`
                SELECT id, title
                FROM public.tbl_associations
                WHERE (
                  (title IS NOT NULL AND LOWER(TRIM(title)) LIKE LOWER(TRIM(${`%${facultyName}%`})))
                  OR (description IS NOT NULL AND LOWER(TRIM(description)) LIKE LOWER(TRIM(${`%${facultyName}%`})))
                  OR (dean IS NOT NULL AND LOWER(TRIM(dean)) LIKE LOWER(TRIM(${`%${facultyName}%`})))
                )
                ORDER BY
                  CASE
                    WHEN title IS NOT NULL AND LOWER(TRIM(title)) = LOWER(TRIM(${facultyName})) THEN 0
                    WHEN title IS NOT NULL AND LOWER(TRIM(title)) LIKE LOWER(TRIM(${facultyName})) || '%' THEN 1
                    WHEN title IS NOT NULL AND LOWER(TRIM(title)) LIKE '%' || LOWER(TRIM(${facultyName})) || '%' THEN 2
                    ELSE 3
                  END,
                  id ASC
                LIMIT 1
              `;

              const chosen = assocRows[0];

              if (chosen?.id) {
                await sql/* sql */`
                  UPDATE public.tbl_alumni
                  SET association_id = ${chosen.id}
                  WHERE alumniid = ${id}
                `;

              }
            }
          } catch (err) {

          }
        }
      } catch (assignmentError) {
        // Don't fail the registration if chapter/association assignment fails

      }
    }

    // DO NOT send welcome email on registration
    // Email will be sent when admin verifies or unverifies the alumni




    // Verify that verify field was set to 'underApproval'
    if (id) {
      try {
        const verifyCheck = await sql/* sql */`
          SELECT verify, pg_typeof(verify) as verify_type,
                 LENGTH(verify) as verify_length,
                 TRIM(verify) as verify_trimmed,
                 LOWER(TRIM(verify)) as verify_lower_trimmed
          FROM public.tbl_alumni 
          WHERE alumniid = ${id}
          LIMIT 1
        `;

        void verifyCheck;
      } catch {
        // Ignore verification check errors
      }
    }

    // Return the generated password if it was auto-generated (for client-side display)
    const response: { 
      alumniid: number; 
      generatedPassword?: string;
      updated?: boolean;
      message?: string;
    } = { alumniid: id! };
    
    if (generatedPassword) {
      response.generatedPassword = generatedPassword;
    }

    // Set appropriate response based on whether it was an update or new record
    if (isUpdate) {
      response.updated = true;
      response.message = "Alumni record updated successfully. Status set to 'Under Approval'.";
      return NextResponse.json(response, { status: 200 });
    } else {
      response.message = "Alumni registered successfully. Status set to 'Under Approval'.";
      return NextResponse.json(response, { status: 201 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    const stack = err instanceof Error ? err.stack : undefined;

    return NextResponse.json({ error: message }, { status: 500 });
  }
}