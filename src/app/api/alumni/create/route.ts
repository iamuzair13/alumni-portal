import { sql } from "@/lib/dbconnect";
import { NextResponse } from "next/server";

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
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TblAlumniBody;

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
    // Phone number and password have no format restrictions - only required

    // Sanitize: trim empty strings to null, coerce boolean verify to Yes/No
    const clean = (v: unknown) => {
      if (v === null || v === undefined) return null;
      if (typeof v === "boolean") return v ? "Yes" : "No";
      if (typeof v === "number") return v;
      const s = String(v).trim();
      return s.length ? s : null;
    };

    const todayDateValue = body.todaydate ? new Date(String(body.todaydate)) : null;
    const normalizedAlumniEmail = (body.alumniemail && String(body.alumniemail).trim().length)
      ? body.alumniemail
      : body.personalemail;

    const id = await sql.begin(async (tx) => {
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
          alumnistatus
        ) VALUES (
          ${clean(normalizedAlumniEmail)},
          ${clean(body.password)},
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
          ${clean(body.employeed)},
          ${clean(body.nameoforganization)},
          ${clean(body.designation)},
          ${clean(body.totalyearsofexpereince)},
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
          ${clean(body.alumnistatus)}
        ) RETURNING alumniid;
      `;
      return rows[0]?.alumniid;
    });

    return NextResponse.json({ alumniid: id }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[API] /api/alumni/create error:", { message, stack });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}