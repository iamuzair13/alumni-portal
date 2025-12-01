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

export async function POST(req: Request) {
  try {
    const session = await auth();
    const body = (await req.json()) as TblAlumniBody;
    
    // Validate user has access to the selected faculty/department/program
    if (body.facultyname && body.departmentname && body.degreetitle) {
      const faculty = String(body.facultyname).trim();
      const department = String(body.departmentname).trim();
      const program = String(body.degreetitle).trim();
      
      // Super admins can add to any faculty/department/program
      if (!isSuperAdminUser(session?.user)) {
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
        } else {
          return NextResponse.json({ 
            error: "You must be logged in to add alumni." 
          }, { status: 401 });
        }
      }
    }
    
    // Check for duplicate email or SAP ID before inserting
    if (body.personalemail || body.sapid || body.registrationno) {
      const emailCheck = body.personalemail ? await sql/* sql */`
        SELECT alumniid FROM public.tbl_alumni 
        WHERE personalemail = ${String(body.personalemail).trim()} 
        LIMIT 1
      ` : [];
      
      const sapidCheck = body.sapid ? await sql/* sql */`
        SELECT alumniid FROM public.tbl_alumni 
        WHERE sapid = ${String(body.sapid).trim()} 
        LIMIT 1
      ` : [];
      
      const regNoCheck = body.registrationno ? await sql/* sql */`
        SELECT alumniid FROM public.tbl_alumni 
        WHERE registrationno = ${String(body.registrationno).trim()} 
        LIMIT 1
      ` : [];
      
      if (emailCheck.length > 0) {
        return NextResponse.json({ error: "An account with this email already exists" }, { status: 400 });
      }
      if (sapidCheck.length > 0) {
        return NextResponse.json({ error: "An account with this SAP ID already exists" }, { status: 400 });
      }
      if (regNoCheck.length > 0) {
        return NextResponse.json({ error: "An account with this Registration Number already exists" }, { status: 400 });
      }
    }

    // Server-side validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    // Check that at least one of registrationno or sapid is provided
    const regNo = body.registrationno ? String(body.registrationno).trim() : "";
    const sapId = body.sapid ? String(body.sapid).trim() : "";
    if (!regNo && !sapId) {
      return NextResponse.json({ error: "Either Registration # or SAP ID is required" }, { status: 400 });
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

    // Check for duplicate email or SAP ID before inserting
    if (body.personalemail || body.sapid || body.registrationno) {
      const emailCheck = body.personalemail ? await sql/* sql */`
        SELECT alumniid FROM public.tbl_alumni 
        WHERE personalemail = ${String(body.personalemail).trim()} 
        LIMIT 1
      ` : [];
      
      const sapidCheck = body.sapid ? await sql/* sql */`
        SELECT alumniid FROM public.tbl_alumni 
        WHERE sapid = ${String(body.sapid).trim()} 
        LIMIT 1
      ` : [];
      
      const regNoCheck = body.registrationno ? await sql/* sql */`
        SELECT alumniid FROM public.tbl_alumni 
        WHERE registrationno = ${String(body.registrationno).trim()} 
        LIMIT 1
      ` : [];
      
      if (emailCheck.length > 0) {
        return NextResponse.json({ error: "An account with this email already exists" }, { status: 400 });
      }
      if (sapidCheck.length > 0) {
        return NextResponse.json({ error: "An account with this SAP ID already exists" }, { status: 400 });
      }
      if (regNoCheck.length > 0) {
        return NextResponse.json({ error: "An account with this Registration Number already exists" }, { status: 400 });
      }
    }

    const id = await sql.begin(async (tx) => {
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
    const response: { alumniid: number; generatedPassword?: string } = { alumniid: id! };
    if (generatedPassword) {
      response.generatedPassword = generatedPassword;
    }

    return NextResponse.json(response, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[API] /api/alumni/create error:", { message, stack });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}