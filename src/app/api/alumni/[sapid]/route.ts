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
        datasource = ${v.source ?? null}, verify = ${String(v.verified ?? false)}, alumnistatus = ${v.category ?? null}
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
    const res = await sql/* sql */`
      DELETE FROM public.tbl_alumni WHERE sapid = ${sapid} RETURNING alumniid`;
    if (!res[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete alumni";
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
    const normalized = String(verify).toLowerCase();
    const asBoolString = normalized === "true" || normalized === "yes" ? "true" : "false";
    const res = await sql/* sql */`
      UPDATE public.tbl_alumni SET verify = ${asBoolString} WHERE sapid = ${sapid} RETURNING alumniid, verify`;
    if (!res[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, verify: res[0].verify }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update verification status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}