import { sql } from "@/lib/dbconnect";
import { NextResponse } from "next/server";
import generateEasyPassword from "@/lib/passwordUtils";
import { auth } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/alumniProfile";
import { getUserAccessAssignments, getUserIdFromSession } from "@/lib/userAccess";
import { validateProgramAssignment, getFacultyByDepartment } from "@/data/programs-departments";

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
  facultyname: string | null;
  campusname: string | null;
  departmentname: string | null;
  majorsubject: string | null;
  industry: string | null;
  employeed: string | null;
  nameoforganization: string | null;
  designation: string | null;
  totalyearsofexpereince: string | null;
  officialemail: string | null;
  officialnumber: string | null;
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
  // Higher Education fields
  highereducationdegreetitle: string | null;
  highereducationinstitute: string | null;
  highereducationprogram: string | null;
  scholarship: string | null;
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
    const session = await auth();
    const body = (await req.json()) as TblAlumniBody;
    
    // Check if user is alumni - alumni can self-register without access assignment checks
    const userType = session?.user ? ((session.user as { type?: string | null })?.type ? String((session.user as { type?: string | null }).type).toLowerCase().trim() : "") : "";
    const isAlumni = userType === "alumni";
    
    // Validate user has access to the selected faculty/department/program
    // Only apply this check if user is logged in as admin/viewer (not for public registration)
    // Skip this check for:
    // - Alumni users (they can register themselves)
    // - Super admins (they have full access)
    // - Unauthenticated users (public registration allowed)
    // NOTE: This check is skipped for public registration (no session) and alumni self-registration
    console.log("[API] Access assignment check:", {
      hasSession: !!session,
      isAlumni,
      isSuperAdmin: session?.user ? isSuperAdminUser(session.user) : false,
      hasFacultyDeptProgram: !!(body.facultyname && body.departmentname && body.degreetitle),
      willCheckAccess: !!(body.facultyname && body.departmentname && body.degreetitle && !isAlumni && session?.user && !isSuperAdminUser(session.user))
    });
    
    if (body.facultyname && body.departmentname && body.degreetitle && !isAlumni && session?.user && !isSuperAdminUser(session.user)) {
      const faculty = String(body.facultyname).trim();
      const department = String(body.departmentname).trim();
      const program = String(body.degreetitle).trim();
      
      console.log("[API] Checking access assignment for:", { faculty, department, program });
      
      // Super admins can add to any faculty/department/program
      if (!isSuperAdminUser(session.user)) {
        const userId = getUserIdFromSession(session);
        if (userId) {
          const assignments = await getUserAccessAssignments(userId);
          
          if (assignments.length === 0) {
            return NextResponse.json({ 
              error: "You do not have permission to add alumni. Please contact an administrator." 
            }, { status: 403 });
          }
          
          // Check if user has access to this specific combination
          let hasAccess = false;
          
          // Check program-level access
          const programAccess = assignments.find(a => 
            a.program_name && 
            a.program_name.toLowerCase().trim() === program.toLowerCase().trim() &&
            (!a.department_name || a.department_name.toLowerCase().trim() === department.toLowerCase().trim()) &&
            (!a.faculty_name || a.faculty_name.toLowerCase().trim() === faculty.toLowerCase().trim())
          );
          
          if (programAccess) {
            hasAccess = true;
          } else {
            // Check department-level access
            const deptAccess = assignments.find(a => 
              a.department_name && 
              !a.program_name &&
              a.department_name.toLowerCase().trim() === department.toLowerCase().trim() &&
              (!a.faculty_name || a.faculty_name.toLowerCase().trim() === faculty.toLowerCase().trim())
            );
            
            if (deptAccess) {
              // Verify the program actually belongs to this department
              if (validateProgramAssignment(faculty, department, program)) {
                hasAccess = true;
              }
            } else {
              // Check faculty-level access
              const facultyAccess = assignments.find(a => 
                a.faculty_name && 
                !a.department_name && 
                !a.program_name &&
                a.faculty_name.toLowerCase().trim() === faculty.toLowerCase().trim()
              );
              
              if (facultyAccess) {
                // Verify the department and program belong to this faculty
                const deptFaculty = getFacultyByDepartment(department);
                if (deptFaculty && deptFaculty.toLowerCase().trim() === faculty.toLowerCase().trim()) {
                  if (validateProgramAssignment(faculty, department, program)) {
                    hasAccess = true;
                  }
                }
              }
            }
          }
          
          if (!hasAccess) {
            return NextResponse.json({ 
              error: `You do not have permission to add alumni to ${faculty} > ${department} > ${program}. Please select a faculty, department, and program you have access to.` 
            }, { status: 403 });
          }
        }
        // If no userId but user is logged in (shouldn't happen for admin/viewer), allow registration
        // This handles edge cases gracefully
      }
    }
    
    // NOTE: Duplicate checks based on email/SAP ID/Registration Number have been removed.
    // Registration logic now depends ONLY on verify_status (see rules above).

    // Server-side validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    // Extract all identifier fields
    const regNo = body.registrationno ? String(body.registrationno).trim() : "";
    const sapId = body.sapid ? String(body.sapid).trim() : "";
    const cnic = body.cnicpassport ? String(body.cnicpassport).trim() : "";
    const phone = body.contactno ? String(body.contactno).trim() : "";
    const personalEmail = body.personalemail ? String(body.personalemail).trim().toLowerCase() : "";
    const universityEmail = body.universityemail ? String(body.universityemail).trim().toLowerCase() : "";
    const officialEmail = body.officialemail ? String(body.officialemail).trim().toLowerCase() : "";
    const alumniEmail = body.alumniemail ? String(body.alumniemail).trim().toLowerCase() : "";
    
    // Check that at least one identifier is provided
    // Identifiers: SAP ID, Registration No, CNIC, Phone, or Email (any of: personal, university, official, alumni)
    const hasIdentifier = regNo || sapId || cnic || phone || personalEmail || universityEmail || officialEmail || alumniEmail;
    if (!hasIdentifier) {
      return NextResponse.json({ 
        error: "At least one identifier is required: Registration #, SAP ID, CNIC/Passport, Phone Number, or Email" 
      }, { status: 400 });
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
      ["facultyname", "Faculty"],
      ["departmentname", "Department"],
      ["degreetitle", "Program"],
      ["yearofending", "Year of Passing"],
    ];
    for (const [k, label] of required) {
      const val = body[k];
      if (val === null || val === undefined || String(val).trim() === "") {
        return NextResponse.json({ error: `${label} is required` }, { status: 400 });
      }
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
    
    // Map employeed values to fit VARCHAR(10) constraint
    const mapEmployeed = (value: string | null): string | null => {
      if (!value) return null;
      const val = String(value).trim();
      if (val === "Pursuing Higher Education") return "HigherEd";
      if (val === "Unemployed") return "Unemployed"; // 10 chars, at limit
      if (val === "Employed") return "Employed"; // 8 chars
      // Truncate to 10 characters if longer
      return val.length > 10 ? val.substring(0, 10) : val;
    };
    
    // Truncate totalyearsofexpereince to fit VARCHAR(10) constraint
    const truncateExperience = (value: string | null): string | null => {
      if (!value) return null;
      const val = String(value).trim();
      return val.length > 10 ? val.substring(0, 10) : val;
    };

    const todayDateValue = body.todaydate ? new Date(String(body.todaydate)) : null;
    const normalizedAlumniEmail = (body.alumniemail && String(body.alumniemail).trim().length)
      ? body.alumniemail
      : body.personalemail;

    // REGISTRATION RULES: Validation depends ONLY on verify_status
    // 1. If alumni exists and verify = 'true' → Block registration
    // 2. If alumni exists and verify = 'pending'/'false'/null → Allow registration, overwrite, set verify = 'pending'
    // 3. If no alumni record exists → Create new record, set verify = 'pending'
    
    // Check if alumni record already exists by ANY identifier:
    // - SAP ID, Registration Number, CNIC/Passport, Phone Number, or Email (personal/university/official/alumni)
    // If ANY identifier matches, we update the existing record
    let existingRecord: { 
      alumniid: number; 
      verify: string | null; 
      registrationno: string | null; 
      sapid: string | null;
      cnicpassport: string | null;
      contactno: string | null;
      personalemail: string | null;
      universityemail: string | null;
      officialemail: string | null;
      alumniemail: string | null;
    } | null = null;
    
    // Build query conditions for all identifiers using sql fragments
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
    if (phone) {
      conditions.push(sql`(contactno = ${phone} AND contactno IS NOT NULL AND contactno != '')`);
    }
    if (personalEmail) {
      conditions.push(sql`(LOWER(personalemail) = ${personalEmail} AND personalemail IS NOT NULL AND personalemail != '')`);
    }
    if (universityEmail) {
      conditions.push(sql`(LOWER(universityemail) = ${universityEmail} AND universityemail IS NOT NULL AND universityemail != '')`);
    }
    if (officialEmail) {
      conditions.push(sql`(LOWER(officialemail) = ${officialEmail} AND officialemail IS NOT NULL AND officialemail != '')`);
    }
    if (alumniEmail) {
      conditions.push(sql`(LOWER(alumniemail) = ${alumniEmail} AND alumniemail IS NOT NULL AND alumniemail != '')`);
    }
    
    // Check for existing record if we have at least one identifier
    if (conditions.length > 0) {
      // Combine all conditions with OR
      const whereCondition = conditions.reduce((acc, condition, index) => {
        if (index === 0) return condition;
        return sql`${acc} OR ${condition}`;
      });
      
      const checkQuery = sql/* sql */`
        SELECT alumniid, verify, registrationno, sapid, cnicpassport, contactno, 
               personalemail, universityemail, officialemail, alumniemail
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
          contactno: string | null;
          personalemail: string | null;
          universityemail: string | null;
          officialemail: string | null;
          alumniemail: string | null;
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
        if (phone && existingRecord.contactno && 
            String(existingRecord.contactno).trim().toLowerCase() === phone.toLowerCase()) {
          matchedBy.push('contactno');
        }
        if (personalEmail && existingRecord.personalemail && 
            String(existingRecord.personalemail).trim().toLowerCase() === personalEmail) {
          matchedBy.push('personalemail');
        }
        if (universityEmail && existingRecord.universityemail && 
            String(existingRecord.universityemail).trim().toLowerCase() === universityEmail) {
          matchedBy.push('universityemail');
        }
        if (officialEmail && existingRecord.officialemail && 
            String(existingRecord.officialemail).trim().toLowerCase() === officialEmail) {
          matchedBy.push('officialemail');
        }
        if (alumniEmail && existingRecord.alumniemail && 
            String(existingRecord.alumniemail).trim().toLowerCase() === alumniEmail) {
          matchedBy.push('alumniemail');
        }
        
        console.log("[API] Found existing record:", {
          alumniid: existingRecord.alumniid,
          verify: existingRecord.verify,
          verifyType: typeof existingRecord.verify,
          registrationno: existingRecord.registrationno,
          sapid: existingRecord.sapid,
          cnicpassport: existingRecord.cnicpassport,
          contactno: existingRecord.contactno,
          personalemail: existingRecord.personalemail,
          universityemail: existingRecord.universityemail,
          officialemail: existingRecord.officialemail,
          alumniemail: existingRecord.alumniemail,
          matchedBy: matchedBy.length > 0 ? matchedBy.join(', ') : 'unknown',
          incomingIdentifiers: {
            regNo: regNo || null,
            sapId: sapId || null,
            cnic: cnic || null,
            phone: phone || null,
            personalEmail: personalEmail || null,
            universityEmail: universityEmail || null,
            officialEmail: officialEmail || null,
            alumniEmail: alumniEmail || null
          }
        });
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
      
      console.log("[API] Verify status check:", {
        rawVerify,
        verifyStatus,
        isTrue: verifyStatus === "true",
        willBlock: verifyStatus === "true"
      });
      
      // Block only if verify is exactly 'true' (case-insensitive)
      if (verifyStatus === "true") {
        console.log("[API] BLOCKING: Alumni is verified (verify='true'), cannot re-register");
        return NextResponse.json({ 
          error: "This alumni is already verified and cannot register again.",
          existingRecord: {
            alumniid: existingRecord.alumniid,
            sapid: existingRecord.sapid,
            registrationno: existingRecord.registrationno
          }
        }, { status: 403 });
      }
      
      // RULE 2: If alumni exists and verify = 'pending'/'false'/null, allow registration and overwrite
      console.log("[API] ALLOWING: Alumni exists but verify is not 'true', allowing re-registration:", {
        verify: rawVerify,
        verifyStatus,
        willUpdate: true
      });
      
      // Continue to update logic below (will be handled in the transaction)
      // We'll modify the INSERT to be an UPDATE when existingRecord is found
    } else {
      console.log("[API] No existing record found, will create new record");
    }

    // Track whether this is an update or insert for proper response status
    let isUpdate = false;

    const id = await sql.begin(async (tx) => {
      // RULE 2: If existing record found (verify = 'pending'/'false'/null), UPDATE it
      if (existingRecord) {
        isUpdate = true;
        const existingAlumniId = existingRecord.alumniid;
        
        // Preserve identifier fields: if incoming value is missing, keep the existing value
        // This prevents losing any identifier when re-registering with only some identifiers
        const incomingRegNo = clean(body.registrationno);
        const incomingSapId = clean(body.sapid);
        const incomingCnic = clean(body.cnicpassport);
        const incomingPhone = clean(body.contactno);
        const incomingPersonalEmail = clean(body.personalemail);
        const incomingUniversityEmail = clean(body.universityemail);
        const incomingOfficialEmail = clean(body.officialemail);
        const incomingAlumniEmail = clean(normalizedAlumniEmail);
        
        const preservedRegNo = incomingRegNo ?? existingRecord.registrationno;
        const preservedSapId = incomingSapId ?? existingRecord.sapid;
        const preservedCnic = incomingCnic ?? existingRecord.cnicpassport;
        const preservedPhone = incomingPhone ?? existingRecord.contactno;
        const preservedPersonalEmail = incomingPersonalEmail ?? existingRecord.personalemail;
        const preservedUniversityEmail = incomingUniversityEmail ?? existingRecord.universityemail;
        const preservedOfficialEmail = incomingOfficialEmail ?? existingRecord.officialemail;
        const preservedAlumniEmail = incomingAlumniEmail ?? existingRecord.alumniemail;
        
        console.log("[API] Preserving identifier fields:", {
          existing: {
            regNo: existingRecord.registrationno,
            sapId: existingRecord.sapid,
            cnic: existingRecord.cnicpassport,
            phone: existingRecord.contactno,
            personalEmail: existingRecord.personalemail,
            universityEmail: existingRecord.universityemail,
            officialEmail: existingRecord.officialemail,
            alumniEmail: existingRecord.alumniemail
          },
          incoming: {
            regNo: incomingRegNo,
            sapId: incomingSapId,
            cnic: incomingCnic,
            phone: incomingPhone,
            personalEmail: incomingPersonalEmail,
            universityEmail: incomingUniversityEmail,
            officialEmail: incomingOfficialEmail,
            alumniEmail: incomingAlumniEmail
          },
          preserved: {
            regNo: preservedRegNo,
            sapId: preservedSapId,
            cnic: preservedCnic,
            phone: preservedPhone,
            personalEmail: preservedPersonalEmail,
            universityEmail: preservedUniversityEmail,
            officialEmail: preservedOfficialEmail,
            alumniEmail: preservedAlumniEmail
          }
        });
        
        // Update existing record with new data, set verify = 'pending'
        const updateResult = await tx/* sql */`
          UPDATE public.tbl_alumni SET
            alumniemail = ${preservedAlumniEmail},
            password = ${plainPassword},
            todaydate = ${todayDateValue},
            registrationno = ${preservedRegNo},
            sapid = ${preservedSapId},
            cnicpassport = ${preservedCnic},
            contactno = ${preservedPhone},
            personalemail = ${preservedPersonalEmail},
            universityemail = ${preservedUniversityEmail},
            officialemail = ${preservedOfficialEmail},
            alumniname = ${clean(body.alumniname)},
            gender = ${clean(body.gender)},
            fathername = ${clean(body.fathername)},
            dateofbirth = ${clean(body.dateofbirth)},
            maritalstatus = ${clean(body.maritalstatus)},
            cnicpassport = ${clean(body.cnicpassport)},
            contactno = ${clean(body.contactno)},
            contactno1 = ${clean(body.contactno1)},
            contactno1show = ${body.contactno1show ?? null},
            personalemail = ${clean(body.personalemail)},
            personalemailshow = ${body.personalemailshow ?? null},
            universityemail = ${clean(body.universityemail)},
            country = ${clean(body.country)},
            province = ${clean(body.province)},
            city = ${clean(body.city)},
            address = ${clean(body.address)},
            academicsession = ${clean(body.academicsession)},
            degreetitle = ${clean(body.degreetitle)},
            cgpa = ${body.cgpa ?? null},
            yearofstarting = ${body.yearofstarting ?? null},
            yearofending = ${body.yearofending ?? null},
            facultyname = ${clean(body.facultyname)},
            campusname = ${clean(body.campusname)},
            departmentname = ${clean(body.departmentname)},
            majorsubject = ${clean(body.majorsubject)},
            industry = ${clean(body.industry)},
            employeed = ${mapEmployeed(body.employeed)},
            nameoforganization = ${clean(body.nameoforganization)},
            designation = ${clean(body.designation)},
            totalyearsofexpereince = ${truncateExperience(body.totalyearsofexpereince)},
            officialemail = ${clean(body.officialemail)},
            officialnumber = ${clean(body.officialnumber)},
            work_city = ${clean((body as { workCity?: string | null }).workCity ?? null)},
            work_country = ${clean((body as { workCountry?: string | null }).workCountry ?? null)},
            image1 = ${clean(body.image1)},
            cv = ${clean(body.cv)},
            aboutme = ${clean(body.aboutme)},
            verify = ${'pending'}, /* Set verify = 'pending' for re-registration (Under Approval) */
            datasource = ${clean(body.datasource)},
            alumnistatus = ${clean(body.alumnistatus)},
            degree_title = ${clean(body.highereducationdegreetitle)},
            higher_education_institute_name = ${clean(body.highereducationinstitute)},
            higher_education_program = ${clean(body.highereducationprogram)},
            is_scholarship = ${clean(body.scholarship)}
          WHERE alumniid = ${existingAlumniId}
          RETURNING alumniid, verify
        `;
        
        const updated = updateResult[0];
        console.log("[API] Updated existing alumni record:", {
          alumniid: updated.alumniid,
          verify: updated.verify,
          previousVerify: existingRecord.verify
        });
        
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
        console.warn("[API] Could not reset sequence, continuing with insert:", seqError);
      }
      
      // Build the INSERT query - handle verify field separately to ensure NULL is inserted correctly
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
          facultyname,
          campusname,
          departmentname,
          majorsubject,
          industry,
          employeed,
          nameoforganization,
          designation,
          totalyearsofexpereince,
          officialemail,
          officialnumber,
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
          degree_title,
          higher_education_institute_name,
          higher_education_program,
          is_scholarship
        ) VALUES (
          ${clean(normalizedAlumniEmail)},
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
          ${clean(body.facultyname)},
          ${clean(body.campusname)},
          ${clean(body.departmentname)},
          ${clean(body.majorsubject)},
          ${clean(body.industry)},
          ${mapEmployeed(body.employeed)},
          ${clean(body.nameoforganization)},
          ${clean(body.designation)},
          ${truncateExperience(body.totalyearsofexpereince)},
          ${clean(body.officialemail)},
          ${clean(body.officialnumber)},
          ${clean((body as { workCity?: string | null }).workCity ?? null)},
          ${clean((body as { workCountry?: string | null }).workCountry ?? null)},
          ${clean(body.image1)},
          ${clean(body.cv)},
          ${clean(body.aboutme)},
          ${clean(body.lasttimelogin)},
          ${body.logincount ?? null},
          ${'pending'}, /* verify = 'pending' for new registrations (Under Approval) */
          ${body.emailsendcount ?? null},
          ${clean(body.emailsendstatus)},
          ${clean(body.createddatetime)},
          ${clean(body.facebook)},
          ${clean(body.instagram)},
          ${clean(body.youtube)},
          ${clean(body.linkedin)},
          ${clean(body.datasource)},
          ${clean(body.alumnistatus)},
          ${clean(body.highereducationdegreetitle)},
          ${clean(body.highereducationinstitute)},
          ${clean(body.highereducationprogram)},
          ${clean(body.scholarship)}
        ) RETURNING alumniid;
      `;
      const alumniId = rows[0]?.alumniid;
      
      // Immediately verify that 'pending' was inserted correctly
      if (alumniId) {
        try {
          const immediateCheck = await tx/* sql */`
            SELECT verify, LENGTH(verify) as verify_length
            FROM public.tbl_alumni 
            WHERE alumniid = ${alumniId}
            LIMIT 1
          `;
          console.log("[API] Immediate verify check after INSERT (within transaction):", immediateCheck[0]);
          if (immediateCheck[0]?.verify !== 'pending') {
            console.error("[API] CRITICAL: verify is NOT 'pending' immediately after INSERT! Value:", immediateCheck[0]?.verify);
            // Try to fix it within the same transaction
            await tx/* sql */`
              UPDATE public.tbl_alumni 
              SET verify = 'pending'
              WHERE alumniid = ${alumniId}
            `;
            console.log("[API] Attempted to fix verify to 'pending' within transaction");
          }
        } catch (checkErr) {
          console.error("[API] Error checking verify immediately after INSERT:", checkErr);
        }
      }
      
      return alumniId;
    });

    // Automatically store home city in chapter1 and work city in chapter2
    if (id) {
      try {
        // Get home city from body
        const homeCity = body.city ? String(body.city).trim() : null;
        
        // Get work city from body or fetch from database
        let workCity = (body as { workCity?: string | null }).workCity 
          ? String((body as { workCity?: string | null }).workCity).trim() 
          : null;

        // If workCity wasn't in body, fetch it from the database (it was just saved)
        if (!workCity) {
          const workCityRow = await sql/* sql */`
            SELECT work_city FROM public.tbl_alumni 
            WHERE alumniid = ${id} 
            LIMIT 1
          `;
          workCity = workCityRow[0]?.work_city 
            ? String(workCityRow[0].work_city).trim() 
            : null;
        }

        // Only create chapter record if at least one city is provided
        if (homeCity || workCity) {
          // Check if a record already exists for this alumni
          const existingChapter = await sql/* sql */`
            SELECT id FROM public.alumni_chapter 
            WHERE id = ${id}
          `;

          if (existingChapter.length > 0) {
            // Update existing record - only update if city is provided
            await sql/* sql */`
              UPDATE public.alumni_chapter 
              SET 
                "chapter1" = COALESCE(${homeCity}, "chapter1"),
                "chapter2" = COALESCE(${workCity}, "chapter2")
              WHERE id = ${id}
            `;
          } else {
            // Insert new record
            await sql/* sql */`
              INSERT INTO public.alumni_chapter (id, "chapter1", "chapter2", "chapter3")
              VALUES (${id}, ${homeCity}, ${workCity}, NULL)
            `;
          }
          console.log("[API] Automatically stored cities in chapters:", { 
            alumniId: id, 
            chapter1: homeCity, 
            chapter2: workCity 
          });
        }
      } catch (chapterError) {
        // Don't fail the registration if chapter insertion fails
        console.error("[API] Error storing cities in chapters:", chapterError);
      }
    }

    // DO NOT send welcome email on registration
    // Email will be sent when admin verifies or unverifies the alumni
    console.log("[API] ========================================");
    console.log("[API] Alumni registered successfully. Email will be sent when admin verifies/unverifies.");
    console.log("[API] New alumni ID:", id, "SAP ID:", body.sapid || body.registrationno);
    console.log("[API] ========================================");
    
    // Verify that verify field was set to 'pending'
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
        console.log("[API] Verify field after insert:", verifyCheck[0]);
        const verifyValue = verifyCheck[0]?.verify;
        if (verifyValue === 'pending' || String(verifyValue).toLowerCase().trim() === 'pending') {
          console.log("[API] SUCCESS: verify field is 'pending' as expected");
        } else {
          console.error("[API] ERROR: verify field is not 'pending'! Value:", verifyValue, "Type:", verifyCheck[0]?.verify_type, "Length:", verifyCheck[0]?.verify_length);
          console.error("[API] Trimmed:", verifyCheck[0]?.verify_trimmed, "Lower trimmed:", verifyCheck[0]?.verify_lower_trimmed);
        }
      } catch (checkErr) {
        console.error("[API] Error checking verify field:", checkErr);
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
    console.error("[API] /api/alumni/create error:", { message, stack });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}