import { NextResponse } from "next/server";
import { z } from "zod";
import { alumniRegistrationComprehensiveSchema } from "@/lib/alumniRegistration";
import { sql } from "@/lib/dbconnect";

// Helper: map validated payload to DB columns
function mapToDb(payload: z.infer<typeof alumniRegistrationComprehensiveSchema>) {
  const contactno = `${payload.countryCode} ${payload.phoneNumber}`.trim();
  return {
    registrationno: payload.registrationNo,
    sapid: payload.sapId,
    alumniname: payload.name,
    gender: payload.gender,
    fathername: payload.fatherName ?? null,
    dateofbirth: payload.dob ?? null,
    maritalstatus: payload.maritalStatus ?? null,
    cnicpassport: payload.cnicOrPassport,
    contactno,
    personalemail: payload.personalEmail,
    password: payload.password,
    address: payload.address ?? null,
    province: payload.province ?? null,
    city: payload.homeCity,
    country: payload.homeCountry,
    campusname: payload.campus,
    facultyname: payload.faculty,
    departmentname: payload.department,
    degreetitle: payload.program,
    yearofending: payload.passingYear,
    employeed: payload.employmentStatus,
    industry: payload.sector ?? null,
    nameoforganization: payload.organization ?? null,
    designation: payload.designation ?? null,
    totalyearsofexpereince: payload.totalExperienceYears ?? null,
    officialemail: payload.officialEmail ?? null,
    officialnumber: payload.officialPhone ?? null,
    datasource: payload.source ?? null,
    verify: String(payload.verified ?? false),
    alumnistatus: payload.category ?? null,
    todaydate: new Date(),
  };
}

export async function GET() {
  // Optional: list endpoint; limit for safety
  try {
    const rows = await sql/* sql */`
      SELECT alumniid, registrationno, sapid, alumniname, facultyname, campusname, departmentname, degreetitle, yearofending, country, city
      FROM public.tbl_alumni
      ORDER BY alumniid DESC
      LIMIT 25`;
    return NextResponse.json({ items: rows }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch alumni";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = alumniRegistrationComprehensiveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const v = parsed.data;
    const d = mapToDb(v);
    const rows = await sql/* sql */`
      INSERT INTO public.tbl_alumni (
        registrationno, sapid, alumniname, gender, fathername, dateofbirth, maritalstatus,
        cnicpassport, contactno, personalemail, password, address, province, city, country,
        campusname, facultyname, departmentname, degreetitle, yearofending, employeed, industry,
        nameoforganization, designation, totalyearsofexpereince, officialemail, officialnumber,
        datasource, verify, alumnistatus, todaydate
      ) VALUES (
        ${d.registrationno}, ${d.sapid}, ${d.alumniname}, ${d.gender}, ${d.fathername}, ${d.dateofbirth}, ${d.maritalstatus},
        ${d.cnicpassport}, ${d.contactno}, ${d.personalemail}, ${d.password}, ${d.address}, ${d.province}, ${d.city}, ${d.country},
        ${d.campusname}, ${d.facultyname}, ${d.departmentname}, ${d.degreetitle}, ${d.yearofending}, ${d.employeed}, ${d.industry},
        ${d.nameoforganization}, ${d.designation}, ${d.totalyearsofexpereince}, ${d.officialemail}, ${d.officialnumber},
        ${d.datasource}, ${d.verify}, ${d.alumnistatus}, ${d.todaydate}
      )
      RETURNING alumniid, registrationno, sapid`;
    const created = rows[0];
    return NextResponse.json({ ok: true, created }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create alumni";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}