import { sql } from "@/lib/dbconnect";
import { NextResponse } from "next/server";
import generateEasyPassword from "@/lib/passwordUtils";
import { sendWelcomeEmail } from "@/lib/email";

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
  supervisorname: string | null;
  supervisordesignation: string | null;
  supervisoremail: string | null;
  supervisornumber: string | null;
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
    const body = (await req.json()) as TblAlumniBody;
    
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
          supervisorname,
          supervisordesignation,
          supervisoremail,
          supervisornumber,
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
          ${clean(body.supervisorname)},
          ${clean(body.supervisordesignation)},
          ${clean(body.supervisoremail)},
          ${clean(body.supervisornumber)},
          ${clean(body.image1)},
          ${clean(body.cv)},
          ${clean(body.aboutme)},
          ${clean(body.lasttimelogin)},
          ${body.logincount ?? null},
          ${clean(body.verify)},
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
      return rows[0]?.alumniid;
    });

    // Send welcome email with generated password if auto-generated
    if (generatedPassword) {
      try {
        const alumniRows = await sql/* sql */`
          SELECT alumniname, personalemail, officialemail, universityemail
          FROM public.tbl_alumni 
          WHERE alumniid = ${id}
          LIMIT 1
        `;
        const alumni = alumniRows[0] as {
          alumniname: string | null;
          personalemail: string | null;
          officialemail: string | null;
          universityemail: string | null;
        } | undefined;
        
        if (alumni) {
          const alumniEmail = alumni.personalemail || alumni.officialemail || alumni.universityemail;
          const alumniName = alumni.alumniname || "Alumni";
          
          if (alumniEmail) {
            console.log("[API] Attempting to send welcome email to:", alumniEmail);
            console.log("[API] Alumni name:", alumniName);
            console.log("[API] Generated password length:", generatedPassword.length);
            
            // Send welcome email with generated password - await to ensure it completes in serverless environment
            try {
              const emailSent = await sendWelcomeEmail(
                alumniEmail, 
                alumniName, 
                generatedPassword, 
                body.sapid || body.registrationno || ""
              );
              
              if (emailSent) {
                console.log("[API] Welcome email sent successfully to:", alumniEmail);
              } else {
                console.warn("[API] Welcome email was not sent (SMTP may not be configured)");
              }
            } catch (emailError) {
              const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
              console.error("[API] Failed to send welcome email:", errorMessage);
              console.error("[API] Error details:", emailError);
              // Don't fail the request if email fails - user is already created
            }
          } else {
            console.warn("[API] No email address found for alumni, cannot send welcome email");
          }
        } else {
          console.warn("[API] Alumni record not found after creation, cannot send welcome email");
        }
      } catch (emailError) {
        // Don't fail the request if email fails
        const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
        console.error("[API] Error preparing welcome email:", errorMessage);
        console.error("[API] Error details:", emailError);
      }
    } else {
      console.log("[API] Password was provided by user, skipping welcome email");
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