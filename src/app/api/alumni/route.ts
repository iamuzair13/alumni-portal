import { NextResponse } from "next/server";
import { z } from "zod";
import { alumniRegistrationComprehensiveSchema } from "@/lib/alumniRegistration";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { parseChapterCities } from "@/lib/chapterCities";

async function autoAssignChapter1FromHomeLocation(args: {
  alumniId: number;
  homeCountry: string | null | undefined;
  homeCity: string | null | undefined;
}) {
  const homeCountryRaw = args.homeCountry ? String(args.homeCountry).trim() : "";
  const homeCityRaw = args.homeCity ? String(args.homeCity).trim() : "";
  const isPakistan = homeCountryRaw.toLowerCase().trim() === "pakistan";
  const lookupType = isPakistan ? "city" : "country";
  const lookupValueRaw = isPakistan ? homeCityRaw : homeCountryRaw;

  if (!lookupValueRaw) {

    return;
  }

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

    const preferredType = lookupType === "city" ? "national" : "international";
    matches.sort((a, b) => {
      const aPref = a.type === preferredType ? 0 : 1;
      const bPref = b.type === preferredType ? 0 : 1;
      if (aPref !== bPref) return aPref - bPref;
      return a.id - b.id;
    });

    const chosen = matches[0];

    if (!chosen) return;

    const existing = await sql<{ id: number; chapter1: number | null }[]>/* sql */`
      SELECT id, "chapter1"
      FROM public.alumni_chapter
      WHERE id = ${args.alumniId}
      LIMIT 1
    `;

    const currentChapter1 = existing[0]?.chapter1 ?? null;
    if (currentChapter1) {

      return;
    }

    if (existing.length > 0) {
      await sql/* sql */`
        UPDATE public.alumni_chapter
        SET "chapter1" = ${chosen.id}
        WHERE id = ${args.alumniId}
      `;

    } else {
      await sql/* sql */`
        INSERT INTO public.alumni_chapter (id, "chapter1", "chapter2", "chapter3")
        VALUES (${args.alumniId}, ${chosen.id}, NULL, NULL)
      `;

    }
  } catch (err) {

  }
}

async function autoAssignChapter2FromWorkLocation(args: {
  alumniId: number;
  workCountry: string | null | undefined;
  workCity: string | null | undefined;
}) {
  const workCountryRaw = args.workCountry ? String(args.workCountry).trim() : "";
  const workCityRaw = args.workCity ? String(args.workCity).trim() : "";
  const isPakistan = workCountryRaw.toLowerCase().trim() === "pakistan";
  const lookupType = isPakistan ? "city" : "country";
  const lookupValueRaw = isPakistan ? workCityRaw : workCountryRaw;

  if (!lookupValueRaw) {

    return;
  }

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

    const preferredType = lookupType === "city" ? "national" : "international";
    matches.sort((a, b) => {
      const aPref = a.type === preferredType ? 0 : 1;
      const bPref = b.type === preferredType ? 0 : 1;
      if (aPref !== bPref) return aPref - bPref;
      return a.id - b.id;
    });

    const chosen = matches[0];

    if (!chosen) return;

    const existing = await sql<{ id: number; chapter2: number | null }[]>/* sql */`
      SELECT id, "chapter2"
      FROM public.alumni_chapter
      WHERE id = ${args.alumniId}
      LIMIT 1
    `;

    const currentChapter2 = existing[0]?.chapter2 ?? null;
    if (currentChapter2) {

      return;
    }

    if (existing.length > 0) {
      await sql/* sql */`
        UPDATE public.alumni_chapter
        SET "chapter2" = ${chosen.id}
        WHERE id = ${args.alumniId}
      `;

    } else {
      await sql/* sql */`
        INSERT INTO public.alumni_chapter (id, "chapter1", "chapter2", "chapter3")
        VALUES (${args.alumniId}, NULL, ${chosen.id}, NULL)
      `;

    }
  } catch (err) {

  }
}

async function autoAssignAssociationFromFaculty(args: { alumniId: number; facultyName: string | null | undefined }) {
  const facultyName = args.facultyName ? String(args.facultyName).trim() : "";
  if (!facultyName) {

    return;
  }

  try {
    const currentAssoc = await sql<{ association_id: number | null }[]>/* sql */`
      SELECT association_id
      FROM public.tbl_alumni
      WHERE alumniid = ${args.alumniId}
      LIMIT 1
    `;
    const existingAssociationId = currentAssoc[0]?.association_id ?? null;

    if (existingAssociationId) {

      return;
    }

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

    if (!chosen?.id) return;

    await sql/* sql */`
      UPDATE public.tbl_alumni
      SET association_id = ${chosen.id}
      WHERE alumniid = ${args.alumniId}
    `;

  } catch (err) {

  }
}

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
    work_city: payload.workCity ?? null,
    work_country: payload.workCountry ?? null,
    datasource: payload.source ?? null,
    verify: payload.verified === true ? "true" : payload.verified === false ? "false" : "underApproval", // 'underApproval' for new registrations
    alumnistatus: payload.category ?? null,
    todaydate: new Date(),
  };
}

export async function GET(req: Request) {
  // Fetch alumni records with pagination and optional filtering
  // Optimized: Using indexed columns and efficient ordering
  try {
    const session = await auth();
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500); // Max 500 per page for performance
    const search = searchParams.get("search") || "";
    // Get all values for multi-select filters
    const statusParams = searchParams.getAll("status");
    const facultyParams = searchParams.getAll("faculty");
    const departmentParams = searchParams.getAll("department");
    const programParams = searchParams.getAll("program");
    const status = statusParams.length > 0 ? statusParams : (searchParams.get("status") || "");
    const faculty = facultyParams.length > 0 ? facultyParams : (searchParams.get("faculty") || "");
    const department = departmentParams.length > 0 ? departmentParams : (searchParams.get("department") || "");
    const program = programParams.length > 0 ? programParams : (searchParams.get("program") || "");
    
    // Additional master filters
    const genderParams = searchParams.getAll("gender");
    const maritalStatusParams = searchParams.getAll("maritalStatus");
    const homeCountryParams = searchParams.getAll("homeCountry");
    const homeCityParams = searchParams.getAll("homeCity");
    const provinceParams = searchParams.getAll("province");
    const campusParams = searchParams.getAll("campus");
    const admissionYearParams = searchParams.getAll("admissionYear");
    const passingYearParams = searchParams.getAll("passingYear");
    const occupationStatusParams = searchParams.getAll("occupationStatus");
    const sectorParams = searchParams.getAll("sector");
    const workCityParams = searchParams.getAll("workCity");
    const workCountryParams = searchParams.getAll("workCountry");
    const employerParams = searchParams.getAll("employer");
    const institutionNameParams = searchParams.getAll("institutionName");
    const programEnrolledParams = searchParams.getAll("programEnrolled");
    const fundingSourceParams = searchParams.getAll("fundingSource");
    const institutionCountryParams = searchParams.getAll("institutionCountry");
    const institutionCityParams = searchParams.getAll("institutionCity");
    const mrNoParams = searchParams.getAll("mrNo");
    const photoConsentParams = searchParams.getAll("photoConsent");
    const sapIdStateParams = searchParams.getAll("sapIdState");
    const regNoStateParams = searchParams.getAll("regNoState");
    const personalEmailStateParams = searchParams.getAll("personalEmailState");
    const contactNoStateParams = searchParams.getAll("contactNoState");
    const categoryParams = searchParams.getAll("category");
    
    // Convert to arrays (support multi-select)
    const gender = genderParams.length > 0 ? genderParams : (searchParams.get("gender") || "");
    const maritalStatus = maritalStatusParams.length > 0 ? maritalStatusParams : (searchParams.get("maritalStatus") || "");
    const homeCountry = homeCountryParams.length > 0 ? homeCountryParams : (searchParams.get("homeCountry") || "");
    const homeCity = homeCityParams.length > 0 ? homeCityParams : (searchParams.get("homeCity") || "");
    const province = provinceParams.length > 0 ? provinceParams : (searchParams.get("province") || "");
    const campus = campusParams.length > 0 ? campusParams : (searchParams.get("campus") || "");
    const admissionYear = admissionYearParams.length > 0 ? admissionYearParams : (searchParams.get("admissionYear") || "");
    const passingYear = passingYearParams.length > 0 ? passingYearParams : (searchParams.get("passingYear") || "");
    const occupationStatus = occupationStatusParams.length > 0 ? occupationStatusParams : (searchParams.get("occupationStatus") || "");
    const sector = sectorParams.length > 0 ? sectorParams : (searchParams.get("sector") || "");
    const workCity = workCityParams.length > 0 ? workCityParams : (searchParams.get("workCity") || "");
    const workCountry = workCountryParams.length > 0 ? workCountryParams : (searchParams.get("workCountry") || "");
    const employer = employerParams.length > 0 ? employerParams : (searchParams.get("employer") || "");
    const institutionName = institutionNameParams.length > 0 ? institutionNameParams : (searchParams.get("institutionName") || "");
    const programEnrolled = programEnrolledParams.length > 0 ? programEnrolledParams : (searchParams.get("programEnrolled") || "");
    const fundingSource = fundingSourceParams.length > 0 ? fundingSourceParams : (searchParams.get("fundingSource") || "");
    const institutionCountry = institutionCountryParams.length > 0 ? institutionCountryParams : (searchParams.get("institutionCountry") || "");
    const institutionCity = institutionCityParams.length > 0 ? institutionCityParams : (searchParams.get("institutionCity") || "");
    const mrNo = mrNoParams.length > 0 ? mrNoParams : (searchParams.get("mrNo") || "");
    const photoConsent = photoConsentParams.length > 0 ? photoConsentParams : (searchParams.get("photoConsent") || "");
    const sapIdState = sapIdStateParams.length > 0 ? sapIdStateParams : (searchParams.get("sapIdState") || "");
    const regNoState = regNoStateParams.length > 0 ? regNoStateParams : (searchParams.get("regNoState") || "");
    const personalEmailState = personalEmailStateParams.length > 0 ? personalEmailStateParams : (searchParams.get("personalEmailState") || "");
    const contactNoState = contactNoStateParams.length > 0 ? contactNoStateParams : (searchParams.get("contactNoState") || "");
    const category = categoryParams.length > 0 ? categoryParams : (searchParams.get("category") || "");
    
    const getCountsOnly = searchParams.get("countsOnly") === "true";
    const offset = (page - 1) * limit;
    
    // Build access filter for admin/viewer users
    let accessFilter;
    try {
      accessFilter = await buildAccessFilterSQL(session, "");
    } catch (filterError) {

      // In production, if access filter fails, log but don't block - return empty results instead
      // This prevents the entire API from failing due to access filter issues

      // Return empty results instead of blocking everything
      return NextResponse.json({ 
        items: [], 
        total: 0,
        page,
        limit,
        totalPages: 0
      }, { status: 200 });
    }
    
    // Debug logging

    // Log the actual SQL condition for debugging (if it's a program-level filter)
    if (accessFilter.hasFilter && accessFilter.sql) {

      // Try to log a sample of what the condition might look like

    } else if (!accessFilter.hasFilter) {

    }
    
    // Build access filter condition for WHERE clause
    // Wrap the entire OR chain in parentheses since AND has higher precedence than OR
    const accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    
    // Helper function to combine SQL conditions with OR
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const combineOrConditions = (conditions: any[]): any => {
      if (conditions.length === 0) return sql``;
      if (conditions.length === 1) return conditions[0];
      if (conditions.length === 2) return sql`${conditions[0]} OR ${conditions[1]}`;
      const mid = Math.ceil(conditions.length / 2);
      const left = combineOrConditions(conditions.slice(0, mid));
      const right = combineOrConditions(conditions.slice(mid));
      return sql`${left} OR ${right}`;
    };
    
    // Build filters for faculty, department, and program (handle arrays)
    // Faculty and department are now text-based from tbl_alumni columns
    let facultyFilter = sql``;
    if (faculty && (Array.isArray(faculty) ? faculty.length > 0 : faculty)) {
      if (Array.isArray(faculty) && faculty.length > 0) {
        // Faculty is now ID-based (tbl_alumni.faculty)
        const facultyConditions = faculty.map((f) => {
          const normalized = String(f).trim();
          if (normalized === "NULL" || normalized === "null") {
            return sql`(a.faculty IS NULL)`;
          }
          const id = Number.parseInt(normalized, 10);
          if (Number.isNaN(id)) return sql`1 = 0`;
          return sql`(a.faculty = ${id})`;
        });
        facultyFilter = sql`AND (${combineOrConditions(facultyConditions)})`;
      } else if (!Array.isArray(faculty) && faculty) {
        const normalized = String(faculty).trim();
        if (normalized === "NULL" || normalized === "null") {
          facultyFilter = sql`AND (a.faculty IS NULL)`;
        } else {
          const id = Number.parseInt(normalized, 10);
          if (!Number.isNaN(id)) {
            facultyFilter = sql`AND (a.faculty = ${id})`;
          } else {
            facultyFilter = sql`AND 1 = 0`;
          }
        }
      }

    }
    
    let departmentFilter = sql``;
    if (department && (Array.isArray(department) ? department.length > 0 : department)) {
      if (Array.isArray(department) && department.length > 0) {
        // Department is now ID-based (tbl_alumni.department)
        const departmentConditions = department.map((dept) => {
          const normalized = String(dept).trim();
          if (normalized === "NULL" || normalized === "null") {
            return sql`(a.department IS NULL)`;
          }
          const id = Number.parseInt(normalized, 10);
          if (Number.isNaN(id)) return sql`1 = 0`;
          return sql`(a.department = ${id})`;
        });
        departmentFilter = sql`AND (${combineOrConditions(departmentConditions)})`;
      } else if (!Array.isArray(department) && department) {
        const normalized = String(department).trim();
        if (normalized === "NULL" || normalized === "null") {
          departmentFilter = sql`AND (a.department IS NULL)`;
        } else {
          const id = Number.parseInt(normalized, 10);
          if (!Number.isNaN(id)) {
            departmentFilter = sql`AND (a.department = ${id})`;
          } else {
            departmentFilter = sql`AND 1 = 0`;
          }
        }
      }

    }
    
    let programFilter = sql``;
    if (program && (Array.isArray(program) ? program.length > 0 : program)) {
      if (Array.isArray(program) && program.length > 0) {
        // Build OR conditions for multiple programs
        const programConditions = program.map((prog) => {
          const normalized = String(prog).trim();
          if (normalized === "NULL" || normalized === "null") {
            return sql`(p.program_name IS NULL AND (a.degreetitle IS NULL OR TRIM(COALESCE(a.degreetitle, '')) = ''))`;
          }
          return sql`(LOWER(TRIM(COALESCE(a.degreetitle, ''))) = LOWER(TRIM(${prog})))`;
        });
        const combinedCondition = combineOrConditions(programConditions);
        programFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(program) && program) {
        const normalized = String(program).trim();
        if (normalized === "NULL" || normalized === "null") {
          programFilter = sql`AND (a.degreetitle IS NULL OR TRIM(COALESCE(a.degreetitle, '')) = '')`;
        } else {
        programFilter = sql`AND (LOWER(TRIM(COALESCE(a.degreetitle, ''))) = LOWER(TRIM(${program})))`;
        }
      }

    }
    
    // Build individual filters for each field (following existing pattern)
    // Gender filter
    let genderFilter = sql``;
    if (gender && (Array.isArray(gender) ? gender.length > 0 : gender)) {
      if (Array.isArray(gender) && gender.length > 0) {
        const genderConditions = gender.map(g => {
          const normalized = String(g).trim();
          if (normalized === "NULL" || normalized === "null") {
            return sql`(gender IS NULL OR TRIM(COALESCE(gender, '')) = '')`;
          }
          return sql`LOWER(TRIM(COALESCE(gender, ''))) = LOWER(TRIM(${g}))`;
        });
        const combinedCondition = combineOrConditions(genderConditions);
        genderFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(gender) && gender) {
        const normalized = String(gender).trim();
        if (normalized === "NULL" || normalized === "null") {
          genderFilter = sql`AND (gender IS NULL OR TRIM(COALESCE(gender, '')) = '')`;
        } else {
          genderFilter = sql`AND LOWER(TRIM(COALESCE(gender, ''))) = LOWER(TRIM(${gender}))`;
        }
      }
    }

    // Employer filter
    // Handle any unique value from the database, including NULL
    let employerFilter = sql``;
    if (employer && (Array.isArray(employer) ? employer.length > 0 : employer)) {
      if (Array.isArray(employer) && employer.length > 0) {
        const conditions = employer.map((e) => {
          const normalized = String(e).trim();
          if (normalized === "NULL" || normalized === "null") {
            return sql`(nameoforganization IS NULL OR TRIM(COALESCE(nameoforganization, '')) = '')`;
          }
          return sql`LOWER(TRIM(COALESCE(nameoforganization, ''))) = LOWER(TRIM(${e}))`;
        });
        const combinedCondition = combineOrConditions(conditions);
        employerFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(employer) && employer) {
        const normalized = String(employer).trim();
        if (normalized === "NULL" || normalized === "null") {
          employerFilter = sql`AND (nameoforganization IS NULL OR TRIM(COALESCE(nameoforganization, '')) = '')`;
        } else {
          employerFilter = sql`AND LOWER(TRIM(COALESCE(nameoforganization, ''))) = LOWER(TRIM(${employer}))`;
        }
      }
    }
    
    // Marital Status filter
    // Handle any unique value from the database, including NULL
    let maritalStatusFilter = sql``;
    if (maritalStatus && (Array.isArray(maritalStatus) ? maritalStatus.length > 0 : maritalStatus)) {
      if (Array.isArray(maritalStatus) && maritalStatus.length > 0) {
        const conditions = maritalStatus.map(m => {
          const normalized = String(m).trim();
          // Handle NULL values (from dropdown, value is "NULL" but label is "Null")
          if (normalized === "NULL" || normalized === "null") {
            return sql`(maritalstatus IS NULL OR TRIM(COALESCE(maritalstatus, '')) = '')`;
          }
          // Handle any other value - match exactly as stored in database (case-insensitive)
          return sql`LOWER(TRIM(COALESCE(maritalstatus, ''))) = LOWER(TRIM(${m}))`;
        });
        const combinedCondition = combineOrConditions(conditions);
        maritalStatusFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(maritalStatus) && maritalStatus) {
        const normalized = String(maritalStatus).trim();
        if (normalized === "NULL" || normalized === "null") {
          maritalStatusFilter = sql`AND (maritalstatus IS NULL OR TRIM(COALESCE(maritalstatus, '')) = '')`;
        } else {
          // Handle any other value - match exactly as stored in database (case-insensitive)
          maritalStatusFilter = sql`AND LOWER(TRIM(COALESCE(maritalstatus, ''))) = LOWER(TRIM(${maritalStatus}))`;
        }
      }
    }
    
    // Home Country filter
    // Handle any unique value from the database, including NULL
    let homeCountryFilter = sql``;
    if (homeCountry && (Array.isArray(homeCountry) ? homeCountry.length > 0 : homeCountry)) {
      if (Array.isArray(homeCountry) && homeCountry.length > 0) {
        const conditions = homeCountry.map(c => {
          const normalized = String(c).trim();
          // Handle NULL values (from dropdown, value is "NULL" but label is "Null")
          if (normalized === "NULL" || normalized === "null") {
            return sql`(country IS NULL OR TRIM(COALESCE(country, '')) = '')`;
          }
          // Handle any other value - match exactly as stored in database (case-insensitive)
          return sql`LOWER(TRIM(COALESCE(country, ''))) = LOWER(TRIM(${c}))`;
        });
        const combinedCondition = combineOrConditions(conditions);
        homeCountryFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(homeCountry) && homeCountry) {
        const normalized = String(homeCountry).trim();
        if (normalized === "NULL" || normalized === "null") {
          homeCountryFilter = sql`AND (country IS NULL OR TRIM(COALESCE(country, '')) = '')`;
        } else {
          homeCountryFilter = sql`AND LOWER(TRIM(COALESCE(country, ''))) = LOWER(TRIM(${homeCountry}))`;
        }
      }
    }
    
    // Home City filter
    // Handle any unique value from the database, including NULL
    let homeCityFilter = sql``;
    if (homeCity && (Array.isArray(homeCity) ? homeCity.length > 0 : homeCity)) {
      if (Array.isArray(homeCity) && homeCity.length > 0) {
        const conditions = homeCity.map(c => {
          const normalized = String(c).trim();
          // Handle NULL values (from dropdown, value is "NULL" but label is "Null")
          if (normalized === "NULL" || normalized === "null") {
            return sql`(city IS NULL OR TRIM(COALESCE(city, '')) = '')`;
          }
          // Handle any other value - match exactly as stored in database (case-insensitive)
          return sql`LOWER(TRIM(COALESCE(city, ''))) = LOWER(TRIM(${c}))`;
        });
        const combinedCondition = combineOrConditions(conditions);
        homeCityFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(homeCity) && homeCity) {
        const normalized = String(homeCity).trim();
        if (normalized === "NULL" || normalized === "null") {
          homeCityFilter = sql`AND (city IS NULL OR TRIM(COALESCE(city, '')) = '')`;
        } else {
          homeCityFilter = sql`AND LOWER(TRIM(COALESCE(city, ''))) = LOWER(TRIM(${homeCity}))`;
        }
      }
    }
    
    // Province filter
    // Handle any unique value from the database, including NULL
    let provinceFilter = sql``;
    if (province && (Array.isArray(province) ? province.length > 0 : province)) {
      if (Array.isArray(province) && province.length > 0) {
        const conditions = province.map(p => {
          const normalized = String(p).trim();
          // Handle NULL values (from dropdown, value is "NULL" but label is "Null")
          if (normalized === "NULL" || normalized === "null") {
            return sql`(province IS NULL OR TRIM(COALESCE(province, '')) = '')`;
          }
          // Handle any other value - match exactly as stored in database (case-insensitive)
          return sql`LOWER(TRIM(COALESCE(province, ''))) = LOWER(TRIM(${p}))`;
        });
        const combinedCondition = combineOrConditions(conditions);
        provinceFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(province) && province) {
        const normalized = String(province).trim();
        if (normalized === "NULL" || normalized === "null") {
          provinceFilter = sql`AND (province IS NULL OR TRIM(COALESCE(province, '')) = '')`;
        } else {
          provinceFilter = sql`AND LOWER(TRIM(COALESCE(province, ''))) = LOWER(TRIM(${province}))`;
        }
      }
    }
    
    // Campus filter
    // Handle any unique value from the database, including NULL
    let campusFilter = sql``;
    if (campus && (Array.isArray(campus) ? campus.length > 0 : campus)) {
      if (Array.isArray(campus) && campus.length > 0) {
        const conditions = campus.map(c => {
          const normalized = String(c).trim();
          // Handle NULL values (from dropdown, value is "NULL" but label is "Null")
          if (normalized === "NULL" || normalized === "null") {
            return sql`(campusname IS NULL OR TRIM(COALESCE(campusname, '')) = '')`;
          }
          // Handle any other value - match exactly as stored in database (case-insensitive)
          return sql`LOWER(TRIM(COALESCE(campusname, ''))) = LOWER(TRIM(${c}))`;
        });
        const combinedCondition = combineOrConditions(conditions);
        campusFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(campus) && campus) {
        const normalized = String(campus).trim();
        if (normalized === "NULL" || normalized === "null") {
          campusFilter = sql`AND (campusname IS NULL OR TRIM(COALESCE(campusname, '')) = '')`;
        } else {
          campusFilter = sql`AND LOWER(TRIM(COALESCE(campusname, ''))) = LOWER(TRIM(${campus}))`;
        }
      }
    }
    
    // Admission Year filter (integer)
    // Handle any unique value from the database, including NULL
    let admissionYearFilter = sql``;
    if (admissionYear && (Array.isArray(admissionYear) ? admissionYear.length > 0 : admissionYear)) {
      if (Array.isArray(admissionYear) && admissionYear.length > 0) {
        const conditions = admissionYear.map(y => {
          const normalized = String(y).trim();
          // Handle NULL values (from dropdown, value is "NULL" but label is "Null")
          if (normalized === "NULL" || normalized === "null") {
            return sql`(yearofstarting IS NULL)`;
          }
          const year = parseInt(y, 10);
          if (isNaN(year)) return sql`1=0`;
          return sql`yearofstarting = ${year}`;
        });
        const combinedCondition = combineOrConditions(conditions);
        admissionYearFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(admissionYear) && admissionYear) {
        const normalized = String(admissionYear).trim();
        if (normalized === "NULL" || normalized === "null") {
          admissionYearFilter = sql`AND (yearofstarting IS NULL)`;
        } else {
          const year = parseInt(admissionYear, 10);
          if (!isNaN(year)) {
            admissionYearFilter = sql`AND yearofstarting = ${year}`;
          }
        }
      }
    }
    
    // Passing Year filter (integer)
    // Handle any unique value from the database, including NULL
    let passingYearFilter = sql``;
    if (passingYear && (Array.isArray(passingYear) ? passingYear.length > 0 : passingYear)) {
      if (Array.isArray(passingYear) && passingYear.length > 0) {
        const conditions = passingYear.map(y => {
          const normalized = String(y).trim();
          // Handle NULL values (from dropdown, value is "NULL" but label is "Null")
          if (normalized === "NULL" || normalized === "null") {
            return sql`(yearofending IS NULL)`;
          }
          const year = parseInt(y, 10);
          if (isNaN(year)) return sql`1=0`;
          return sql`yearofending = ${year}`;
        });
        const combinedCondition = combineOrConditions(conditions);
        passingYearFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(passingYear) && passingYear) {
        const normalized = String(passingYear).trim();
        if (normalized === "NULL" || normalized === "null") {
          passingYearFilter = sql`AND (yearofending IS NULL)`;
        } else {
          const year = parseInt(passingYear, 10);
          if (!isNaN(year)) {
            passingYearFilter = sql`AND yearofending = ${year}`;
          }
        }
      }
    }
    
    // Occupation Status filter
    // Handle any unique value from the database, including NULL
    let occupationStatusFilter = sql``;
    if (occupationStatus && (Array.isArray(occupationStatus) ? occupationStatus.length > 0 : occupationStatus)) {
      const statusArray = Array.isArray(occupationStatus) ? occupationStatus : [occupationStatus];
      const conditions: ReturnType<typeof sql>[] = [];
      
      statusArray.forEach(status => {
        const normalized = String(status).trim();
        // Handle NULL values (from dropdown, value is "NULL" but label is "Null")
        if (normalized === "NULL" || normalized === "null") {
          conditions.push(sql`(employeed IS NULL OR TRIM(COALESCE(employeed, '')) = '')`);
        } else {
          // Handle any other value - match exactly as stored in database (case-insensitive)
          conditions.push(sql`LOWER(TRIM(COALESCE(employeed, ''))) = LOWER(TRIM(${status}))`);
        }
      });
      
      if (conditions.length > 0) {
        const combinedCondition = combineOrConditions(conditions);
        occupationStatusFilter = sql`AND (${combinedCondition})`;
      }
    }
    
    // Sector filter (partial matching with LIKE for text input)
    // Handle any unique value from the database, including NULL
    let sectorFilter = sql``;
    if (sector && (Array.isArray(sector) ? sector.length > 0 : sector)) {
      if (Array.isArray(sector) && sector.length > 0) {
        const conditions = sector.map(s => {
          const normalized = String(s).trim();
          // Handle NULL values (from dropdown, value is "NULL" but label is "Null")
          if (normalized === "NULL" || normalized === "null") {
            return sql`(industry IS NULL OR TRIM(COALESCE(industry, '')) = '')`;
          }
          // Handle any other value - partial match (case-insensitive)
          const searchTerm = `%${normalized.toLowerCase()}%`;
          return sql`LOWER(TRIM(COALESCE(industry, ''))) LIKE ${searchTerm}`;
        });
        const combinedCondition = combineOrConditions(conditions);
        sectorFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(sector) && sector) {
        const normalized = String(sector).trim();
        if (normalized === "NULL" || normalized === "null") {
          sectorFilter = sql`AND (industry IS NULL OR TRIM(COALESCE(industry, '')) = '')`;
        } else {
          const searchTerm = `%${normalized.toLowerCase()}%`;
          sectorFilter = sql`AND LOWER(TRIM(COALESCE(industry, ''))) LIKE ${searchTerm}`;
        }
      }
    }
    
    // Work City filter
    // Handle any unique value from the database, including NULL
    let workCityFilter = sql``;
    if (workCity && (Array.isArray(workCity) ? workCity.length > 0 : workCity)) {
      if (Array.isArray(workCity) && workCity.length > 0) {
        const conditions = workCity.map(w => {
          const normalized = String(w).trim();
          // Handle NULL values (from dropdown, value is "NULL" but label is "Null")
          if (normalized === "NULL" || normalized === "null") {
            return sql`(work_city IS NULL OR TRIM(COALESCE(work_city, '')) = '')`;
          }
          // Handle any other value - match exactly as stored in database (case-insensitive)
          return sql`LOWER(TRIM(COALESCE(work_city, ''))) = LOWER(TRIM(${w}))`;
        });
        const combinedCondition = combineOrConditions(conditions);
        workCityFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(workCity) && workCity) {
        const normalized = String(workCity).trim();
        if (normalized === "NULL" || normalized === "null") {
          workCityFilter = sql`AND (work_city IS NULL OR TRIM(COALESCE(work_city, '')) = '')`;
        } else {
          workCityFilter = sql`AND LOWER(TRIM(COALESCE(work_city, ''))) = LOWER(TRIM(${workCity}))`;
        }
      }
    }
    
    // Work Country filter
    // Handle any unique value from the database, including NULL
    let workCountryFilter = sql``;
    if (workCountry && (Array.isArray(workCountry) ? workCountry.length > 0 : workCountry)) {
      if (Array.isArray(workCountry) && workCountry.length > 0) {
        const conditions = workCountry.map(w => {
          const normalized = String(w).trim();
          // Handle NULL values (from dropdown, value is "NULL" but label is "Null")
          if (normalized === "NULL" || normalized === "null") {
            return sql`(work_country IS NULL OR TRIM(COALESCE(work_country, '')) = '')`;
          }
          // Handle any other value - match exactly as stored in database (case-insensitive)
          return sql`LOWER(TRIM(COALESCE(work_country, ''))) = LOWER(TRIM(${w}))`;
        });
        const combinedCondition = combineOrConditions(conditions);
        workCountryFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(workCountry) && workCountry) {
        const normalized = String(workCountry).trim();
        if (normalized === "NULL" || normalized === "null") {
          workCountryFilter = sql`AND (work_country IS NULL OR TRIM(COALESCE(work_country, '')) = '')`;
        } else {
          workCountryFilter = sql`AND LOWER(TRIM(COALESCE(work_country, ''))) = LOWER(TRIM(${workCountry}))`;
        }
      }
    }
    
    // Institution Name filter
    // Handle any unique value from the database, including NULL
    let institutionNameFilter = sql``;
    if (institutionName && (Array.isArray(institutionName) ? institutionName.length > 0 : institutionName)) {
      if (Array.isArray(institutionName) && institutionName.length > 0) {
        const conditions = institutionName.map(i => {
          const normalized = String(i).trim();
          // Handle NULL values (from dropdown, value is "NULL" but label is "Null")
          if (normalized === "NULL" || normalized === "null") {
            return sql`(higher_education_institute_name IS NULL OR TRIM(COALESCE(higher_education_institute_name, '')) = '')`;
          }
          // Handle any other value - match exactly as stored in database (case-insensitive)
          return sql`LOWER(TRIM(COALESCE(higher_education_institute_name, ''))) = LOWER(TRIM(${i}))`;
        });
        const combinedCondition = combineOrConditions(conditions);
        institutionNameFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(institutionName) && institutionName) {
        const normalized = String(institutionName).trim();
        if (normalized === "NULL" || normalized === "null") {
          institutionNameFilter = sql`AND (higher_education_institute_name IS NULL OR TRIM(COALESCE(higher_education_institute_name, '')) = '')`;
        } else {
          institutionNameFilter = sql`AND LOWER(TRIM(COALESCE(higher_education_institute_name, ''))) = LOWER(TRIM(${institutionName}))`;
        }
      }
    }
    
    // Program Enrolled filter
    // Handle any unique value from the database, including NULL
    let programEnrolledFilter = sql``;
    if (programEnrolled && (Array.isArray(programEnrolled) ? programEnrolled.length > 0 : programEnrolled)) {
      if (Array.isArray(programEnrolled) && programEnrolled.length > 0) {
        const conditions = programEnrolled.map(p => {
          const normalized = String(p).trim();
          // Handle NULL values (from dropdown, value is "NULL" but label is "Null")
          if (normalized === "NULL" || normalized === "null") {
            return sql`(higher_education_program IS NULL OR TRIM(COALESCE(higher_education_program, '')) = '')`;
          }
          // Handle any other value - match exactly as stored in database (case-insensitive)
          return sql`LOWER(TRIM(COALESCE(higher_education_program, ''))) = LOWER(TRIM(${p}))`;
        });
        const combinedCondition = combineOrConditions(conditions);
        programEnrolledFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(programEnrolled) && programEnrolled) {
        const normalized = String(programEnrolled).trim();
        if (normalized === "NULL" || normalized === "null") {
          programEnrolledFilter = sql`AND (higher_education_program IS NULL OR TRIM(COALESCE(higher_education_program, '')) = '')`;
        } else {
          programEnrolledFilter = sql`AND LOWER(TRIM(COALESCE(higher_education_program, ''))) = LOWER(TRIM(${programEnrolled}))`;
        }
      }
    }
    
    // Funding Source filter
    // Handle any unique value from the database, including NULL
    let fundingSourceFilter = sql``;
    if (fundingSource && (Array.isArray(fundingSource) ? fundingSource.length > 0 : fundingSource)) {
      if (Array.isArray(fundingSource) && fundingSource.length > 0) {
        const conditions = fundingSource.map(f => {
          const normalized = String(f).trim();
          // Handle NULL values (from dropdown, value is "NULL" but label is "Null")
          if (normalized === "NULL" || normalized === "null") {
            return sql`(is_scholarship IS NULL OR TRIM(COALESCE(is_scholarship, '')) = '')`;
          }
          // Handle any other value - match exactly as stored in database (case-insensitive)
          return sql`LOWER(TRIM(COALESCE(is_scholarship, ''))) = LOWER(TRIM(${f}))`;
        });
        const combinedCondition = combineOrConditions(conditions);
        fundingSourceFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(fundingSource) && fundingSource) {
        const normalized = String(fundingSource).trim();
        if (normalized === "NULL" || normalized === "null") {
          fundingSourceFilter = sql`AND (is_scholarship IS NULL OR TRIM(COALESCE(is_scholarship, '')) = '')`;
        } else {
          fundingSourceFilter = sql`AND LOWER(TRIM(COALESCE(is_scholarship, ''))) = LOWER(TRIM(${fundingSource}))`;
        }
      }
    }
    
    // Institution Country filter
    // Handle any unique value from the database, including NULL
    let institutionCountryFilter = sql``;
    if (institutionCountry && (Array.isArray(institutionCountry) ? institutionCountry.length > 0 : institutionCountry)) {
      if (Array.isArray(institutionCountry) && institutionCountry.length > 0) {
        const conditions = institutionCountry.map(i => {
          const normalized = String(i).trim();
          // Handle NULL values (from dropdown, value is "NULL" but label is "Null")
          if (normalized === "NULL" || normalized === "null") {
            return sql`(higher_education_institute_country IS NULL OR TRIM(COALESCE(higher_education_institute_country, '')) = '')`;
          }
          // Handle any other value - match exactly as stored in database (case-insensitive)
          return sql`LOWER(TRIM(COALESCE(higher_education_institute_country, ''))) = LOWER(TRIM(${i}))`;
        });
        const combinedCondition = combineOrConditions(conditions);
        institutionCountryFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(institutionCountry) && institutionCountry) {
        const normalized = String(institutionCountry).trim();
        if (normalized === "NULL" || normalized === "null") {
          institutionCountryFilter = sql`AND (higher_education_institute_country IS NULL OR TRIM(COALESCE(higher_education_institute_country, '')) = '')`;
        } else {
          institutionCountryFilter = sql`AND LOWER(TRIM(COALESCE(higher_education_institute_country, ''))) = LOWER(TRIM(${institutionCountry}))`;
        }
      }
    }
    
    // Institution City filter
    // Handle any unique value from the database, including NULL
    let institutionCityFilter = sql``;
    if (institutionCity && (Array.isArray(institutionCity) ? institutionCity.length > 0 : institutionCity)) {
      if (Array.isArray(institutionCity) && institutionCity.length > 0) {
        const conditions = institutionCity.map(i => {
          const normalized = String(i).trim();
          // Handle NULL values (from dropdown, value is "NULL" but label is "Null")
          if (normalized === "NULL" || normalized === "null") {
            return sql`(higher_education_institute_city IS NULL OR TRIM(COALESCE(higher_education_institute_city, '')) = '')`;
          }
          // Handle any other value - match exactly as stored in database (case-insensitive)
          return sql`LOWER(TRIM(COALESCE(higher_education_institute_city, ''))) = LOWER(TRIM(${i}))`;
        });
        const combinedCondition = combineOrConditions(conditions);
        institutionCityFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(institutionCity) && institutionCity) {
        const normalized = String(institutionCity).trim();
        if (normalized === "NULL" || normalized === "null") {
          institutionCityFilter = sql`AND (higher_education_institute_city IS NULL OR TRIM(COALESCE(higher_education_institute_city, '')) = '')`;
        } else {
          institutionCityFilter = sql`AND LOWER(TRIM(COALESCE(higher_education_institute_city, ''))) = LOWER(TRIM(${institutionCity}))`;
        }
      }
    }
    
    // Photo Consent filter
    let photoConsentFilter = sql``;
    if (photoConsent && (Array.isArray(photoConsent) ? photoConsent.length > 0 : photoConsent)) {
      if (Array.isArray(photoConsent) && photoConsent.length > 0) {
        const conditions = photoConsent.map(c => {
          const normalized = String(c).trim();
          if (normalized === "NULL" || normalized === "null") {
            return sql`(alumni_consent_pic IS NULL)`;
          } else if (normalized === "Allowed" || normalized === "allowed") {
            return sql`alumni_consent_pic = true`;
          } else if (normalized === "Not Allowed" || normalized === "not allowed" || normalized === "NotAllowed") {
            return sql`alumni_consent_pic = false`;
          }
          return sql`(alumni_consent_pic IS NULL)`;
        });
        const combinedCondition = combineOrConditions(conditions);
        photoConsentFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(photoConsent) && photoConsent) {
        const normalized = String(photoConsent).trim();
        if (normalized === "NULL" || normalized === "null") {
          photoConsentFilter = sql`AND (alumni_consent_pic IS NULL)`;
        } else if (normalized === "Allowed" || normalized === "allowed") {
          photoConsentFilter = sql`AND alumni_consent_pic = true`;
        } else if (normalized === "Not Allowed" || normalized === "not allowed" || normalized === "NotAllowed") {
          photoConsentFilter = sql`AND alumni_consent_pic = false`;
        } else {
          photoConsentFilter = sql`AND (alumni_consent_pic IS NULL)`;
        }
      }
    }

    // MR No (Registration No) filter
    let mrNoFilter = sql``;
    if (mrNo && (Array.isArray(mrNo) ? mrNo.length > 0 : mrNo)) {
      if (Array.isArray(mrNo) && mrNo.length > 0) {
        const conditions = mrNo.map(m => {
          const normalized = String(m).trim();
          if (normalized === "NULL" || normalized === "null") {
            return sql`(registrationno IS NULL OR TRIM(COALESCE(registrationno, '')) = '')`;
          }
          return sql`LOWER(TRIM(COALESCE(registrationno, ''))) = LOWER(TRIM(${m}))`;
        });
        const combinedCondition = combineOrConditions(conditions);
        mrNoFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(mrNo) && mrNo) {
        const normalized = String(mrNo).trim();
        if (normalized === "NULL" || normalized === "null") {
          mrNoFilter = sql`AND (registrationno IS NULL OR TRIM(COALESCE(registrationno, '')) = '')`;
        } else {
          mrNoFilter = sql`AND LOWER(TRIM(COALESCE(registrationno, ''))) = LOWER(TRIM(${mrNo}))`;
        }
      }
    }

    // SAP ID state filter (NULL/EXISTS)
    let sapIdStateFilter = sql``;
    const hasSapIdStateFilter = sapIdState && (Array.isArray(sapIdState) ? sapIdState.length > 0 : sapIdState);
    if (hasSapIdStateFilter) {
      const states = Array.isArray(sapIdState) ? sapIdState : [sapIdState];
      const conditions = states.map(s => {
        const normalized = String(s).trim().toUpperCase();
        if (normalized === "NULL") {
          return sql`(
            a.sapid IS NULL
            OR TRIM(COALESCE(a.sapid, '')) = ''
            OR LOWER(TRIM(COALESCE(a.sapid, ''))) = 'null'
          )`;
        } else if (normalized === "EXISTS") {
          return sql`(
            a.sapid IS NOT NULL
            AND TRIM(COALESCE(a.sapid, '')) != ''
            AND LOWER(TRIM(COALESCE(a.sapid, ''))) != 'null'
          )`;
        }
        return sql`1 = 0`;
      });
      const combinedCondition = combineOrConditions(conditions);
      sapIdStateFilter = sql`AND (${combinedCondition})`;
    }

    // Registration No state filter (NULL/EXISTS)
    let regNoStateFilter = sql``;
    const hasRegNoStateFilter = regNoState && (Array.isArray(regNoState) ? regNoState.length > 0 : regNoState);
    if (hasRegNoStateFilter) {
      const states = Array.isArray(regNoState) ? regNoState : [regNoState];
      const conditions = states.map(s => {
        const normalized = String(s).trim().toUpperCase();
        if (normalized === "NULL") {
          return sql`(
            a.registrationno IS NULL
            OR TRIM(COALESCE(a.registrationno, '')) = ''
            OR LOWER(TRIM(COALESCE(a.registrationno, ''))) = 'null'
          )`;
        } else if (normalized === "EXISTS") {
          return sql`(
            a.registrationno IS NOT NULL
            AND TRIM(COALESCE(a.registrationno, '')) != ''
            AND LOWER(TRIM(COALESCE(a.registrationno, ''))) != 'null'
          )`;
        }
        return sql`1 = 0`;
      });
      const combinedCondition = combineOrConditions(conditions);
      regNoStateFilter = sql`AND (${combinedCondition})`;
    }

    // Personal Email state filter (NULL/EXISTS)
    let personalEmailStateFilter = sql``;
    const hasPersonalEmailStateFilter = personalEmailState && (Array.isArray(personalEmailState) ? personalEmailState.length > 0 : personalEmailState);
    if (hasPersonalEmailStateFilter) {
      const states = Array.isArray(personalEmailState) ? personalEmailState : [personalEmailState];
      const conditions = states.map(s => {
        const normalized = String(s).trim().toUpperCase();
        if (normalized === "NULL") {
          return sql`(
            a.personalemail IS NULL
            OR TRIM(COALESCE(a.personalemail, '')) = ''
            OR LOWER(TRIM(COALESCE(a.personalemail, ''))) = 'null'
          )`;
        } else if (normalized === "EXISTS") {
          return sql`(
            a.personalemail IS NOT NULL
            AND TRIM(COALESCE(a.personalemail, '')) != ''
            AND LOWER(TRIM(COALESCE(a.personalemail, ''))) != 'null'
          )`;
        }
        return sql`1 = 0`;
      });
      const combinedCondition = combineOrConditions(conditions);
      personalEmailStateFilter = sql`AND (${combinedCondition})`;
    }

    // Contact No state filter (NULL/EXISTS)
    let contactNoStateFilter = sql``;
    const hasContactNoStateFilter = contactNoState && (Array.isArray(contactNoState) ? contactNoState.length > 0 : contactNoState);
    if (hasContactNoStateFilter) {
      const states = Array.isArray(contactNoState) ? contactNoState : [contactNoState];
      const conditions = states.map(s => {
        const normalized = String(s).trim().toUpperCase();
        if (normalized === "NULL") {
          return sql`(
            (
              a.contactno IS NULL
              OR TRIM(COALESCE(a.contactno, '')) = ''
              OR LOWER(TRIM(COALESCE(a.contactno, ''))) = 'null'
            )
          )`;
        } else if (normalized === "EXISTS") {
          return sql`(
            a.contactno IS NOT NULL
            AND TRIM(COALESCE(a.contactno, '')) != ''
            AND LOWER(TRIM(COALESCE(a.contactno, ''))) != 'null'
          )`;
        }
        return sql`1 = 0`;
      });
      const combinedCondition = combineOrConditions(conditions);
      contactNoStateFilter = sql`AND (${combinedCondition})`;
    }

    // Build category filter (separate from status filter) - moved before getCountsOnly
    let categoryFilter = sql``;
    if (category && (Array.isArray(category) ? category.length > 0 : category)) {
      if (Array.isArray(category) && category.length > 0) {
        const categoryConditions: ReturnType<typeof sql>[] = [];
        
        category.forEach(c => {
          if (c === "category:aPlus") {
            categoryConditions.push(sql`(LOWER(TRIM(COALESCE(a.category, ''))) = 'a+' OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'a+%')`);
          } else if (c === "category:a") {
            categoryConditions.push(sql`(LOWER(TRIM(COALESCE(a.category, ''))) = 'a' OR (LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'a%' AND LOWER(TRIM(COALESCE(a.category, ''))) NOT LIKE 'a+%'))`);
          } else if (c === "category:b") {
            categoryConditions.push(sql`(LOWER(TRIM(COALESCE(a.category, ''))) = 'b' OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'b%')`);
          } else if (c === "category:c") {
            categoryConditions.push(sql`(LOWER(TRIM(COALESCE(a.category, ''))) = 'c' OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'c%')`);
          } else if (c === "category:d") {
            categoryConditions.push(sql`(LOWER(TRIM(COALESCE(a.category, ''))) = 'd' OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'd%')`);
          } else if (c === "NULL" || c === "null") {
            categoryConditions.push(sql`(a.category IS NULL OR TRIM(COALESCE(a.category, '')) = '')`);
          }
        });
        
        if (categoryConditions.length > 0) {
          const combinedCondition = combineOrConditions(categoryConditions);
          categoryFilter = sql`AND (${combinedCondition})`;
        }
      } else if (!Array.isArray(category)) {
        // Single category filter (backward compatibility)
        if (category === "category:aPlus") {
          categoryFilter = sql`AND (LOWER(TRIM(COALESCE(a.category, ''))) = 'a+' OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'a+%')`;
        } else if (category === "category:a") {
          categoryFilter = sql`AND (LOWER(TRIM(COALESCE(a.category, ''))) = 'a' OR (LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'a%' AND LOWER(TRIM(COALESCE(a.category, ''))) NOT LIKE 'a+%'))`;
        } else if (category === "category:b") {
          categoryFilter = sql`AND (LOWER(TRIM(COALESCE(a.category, ''))) = 'b' OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'b%')`;
        } else if (category === "category:c") {
          categoryFilter = sql`AND (LOWER(TRIM(COALESCE(a.category, ''))) = 'c' OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'c%')`;
        } else if (category === "category:d") {
          categoryFilter = sql`AND (LOWER(TRIM(COALESCE(a.category, ''))) = 'd' OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'd%')`;
        } else if (category === "NULL" || category === "null") {
          categoryFilter = sql`AND (a.category IS NULL OR TRIM(COALESCE(a.category, '')) = '')`;
        }
      }
    }
    
    // If only counts are needed, return early with just counts
    if (getCountsOnly) {
      const searchTermForCount = search && search.trim() ? `%${search.trim().toLowerCase()}%` : null;
      const countQuery = searchTermForCount
        ? sql/* sql */`
            SELECT COUNT(*) as total
            FROM public.tbl_alumni a
            LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
            LEFT JOIN public.tbl_departments d ON d.id = a.department
            LEFT JOIN public.tbl_programs p ON p.id = a.program
            WHERE a.sapid IS NOT NULL AND a.sapid != ''
              ${categoryFilter}
              ${facultyFilter}
              ${departmentFilter}
              ${programFilter}
              ${genderFilter}
              ${maritalStatusFilter}
              ${homeCountryFilter}
              ${homeCityFilter}
              ${provinceFilter}
              ${campusFilter}
              ${admissionYearFilter}
              ${passingYearFilter}
              ${occupationStatusFilter}
              ${sectorFilter}
              ${workCityFilter}
              ${workCountryFilter}
              ${employerFilter}
              ${institutionNameFilter}
              ${programEnrolledFilter}
              ${fundingSourceFilter}
              ${institutionCountryFilter}
              ${institutionCityFilter}
              ${photoConsentFilter}
              ${mrNoFilter}
              ${accessFilterCondition}
              AND (
                LOWER(a.sapid) LIKE ${searchTermForCount}
                OR LOWER(COALESCE(a.registrationno, '')) LIKE ${searchTermForCount}
                OR LOWER(COALESCE(a.alumniname, '')) LIKE ${searchTermForCount}
                OR LOWER(COALESCE(a.personalemail, '')) LIKE ${searchTermForCount}
                OR LOWER(COALESCE(a.officialemail, '')) LIKE ${searchTermForCount}
                OR LOWER(COALESCE(f.faculty_name, a.facultyname, '')) LIKE ${searchTermForCount}
                OR LOWER(COALESCE(d.department_name, a.departmentname, '')) LIKE ${searchTermForCount}
                OR LOWER(COALESCE(a.degreetitle, '')) LIKE ${searchTermForCount}
              )`
        : sql/* sql */`
            SELECT COUNT(*) as total
            FROM public.tbl_alumni a
            LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
            LEFT JOIN public.tbl_departments d ON d.id = a.department
            LEFT JOIN public.tbl_programs p ON p.id = a.program
            WHERE a.sapid IS NOT NULL AND a.sapid != ''
              ${categoryFilter}
              ${facultyFilter}
              ${departmentFilter}
              ${programFilter}
              ${genderFilter}
              ${maritalStatusFilter}
              ${homeCountryFilter}
              ${homeCityFilter}
              ${provinceFilter}
              ${campusFilter}
              ${admissionYearFilter}
              ${passingYearFilter}
              ${occupationStatusFilter}
              ${sectorFilter}
              ${workCityFilter}
              ${workCountryFilter}
              ${institutionNameFilter}
              ${programEnrolledFilter}
              ${fundingSourceFilter}
              ${institutionCountryFilter}
              ${institutionCityFilter}
              ${photoConsentFilter}
              ${mrNoFilter}
              ${accessFilterCondition}`;
      
      const countResult = await countQuery;
      const total = Number(countResult[0]?.total || 0);
      
      return NextResponse.json({ 
        total,
        page: 1,
        limit: 1,
        totalPages: 1,
        items: []
      }, { status: 200 });
    }

    // Build WHERE clause for verify status filtering (handle arrays)
    // Verify field is now VARCHAR(10) - handle as string only
    let verifyFilter = sql``;
    if (status && (Array.isArray(status) ? status.length > 0 : status)) {
      if (Array.isArray(status) && status.length > 0) {
        // Build OR conditions for multiple statuses
        const statusConditions: ReturnType<typeof sql>[] = [];
        
        status.forEach(s => {
          if (s === "verified") {
            statusConditions.push(sql`LOWER(COALESCE(verify, '')) = 'true'`);
          } else if (s === "unverified") {
            statusConditions.push(sql`LOWER(COALESCE(verify, '')) = 'false'`);
          } else if (s === "underApproval") {
            statusConditions.push(sql`LOWER(TRIM(COALESCE(verify, ''))) = 'underapproval'`);
          } else if (s === "active") {
            statusConditions.push(sql`((lasttimelogin IS NOT NULL AND lasttimelogin != '') OR (logincount IS NOT NULL AND logincount > 0))`);
          } else if (s === "inactive") {
            statusConditions.push(sql`((lasttimelogin IS NULL OR lasttimelogin = '') AND (logincount IS NULL OR logincount = 0))`);
          } else if (s === "category:aPlus") {
            statusConditions.push(sql`(LOWER(TRIM(COALESCE(category, ''))) = 'a+' OR LOWER(TRIM(COALESCE(category, ''))) LIKE 'a+%')`);
          } else if (s === "category:a") {
            statusConditions.push(sql`(LOWER(TRIM(COALESCE(category, ''))) = 'a' OR (LOWER(TRIM(COALESCE(category, ''))) LIKE 'a%' AND LOWER(TRIM(COALESCE(category, ''))) NOT LIKE 'a+%'))`);
          } else if (s === "category:b") {
            statusConditions.push(sql`(LOWER(TRIM(COALESCE(category, ''))) = 'b' OR LOWER(TRIM(COALESCE(category, ''))) LIKE 'b%')`);
          } else if (s === "category:c") {
            statusConditions.push(sql`(LOWER(TRIM(COALESCE(category, ''))) = 'c' OR LOWER(TRIM(COALESCE(category, ''))) LIKE 'c%')`);
          } else if (s === "category:d") {
            statusConditions.push(sql`(LOWER(TRIM(COALESCE(category, ''))) = 'd' OR LOWER(TRIM(COALESCE(category, ''))) LIKE 'd%')`);
          }
        });
        
        if (statusConditions.length > 0) {
          const combinedCondition = combineOrConditions(statusConditions);
          verifyFilter = sql`AND (${combinedCondition})`;
        }

      } else if (!Array.isArray(status)) {
        // Single status filter (backward compatibility)
        if (status === "verified") {
          verifyFilter = sql`AND LOWER(COALESCE(verify, '')) = 'true'`;

        } else if (status === "unverified") {
          verifyFilter = sql`AND LOWER(COALESCE(verify, '')) = 'false'`;

        } else if (status === "underApproval") {
          verifyFilter = sql`AND LOWER(TRIM(COALESCE(verify, ''))) = 'underapproval'`;

        } else if (status === "active") {
          verifyFilter = sql`AND ((lasttimelogin IS NOT NULL AND lasttimelogin != '') OR (logincount IS NOT NULL AND logincount > 0))`;

        } else if (status === "inactive") {
          verifyFilter = sql`AND ((lasttimelogin IS NULL OR lasttimelogin = '') AND (logincount IS NULL OR logincount = 0))`;

        } else if (status === "category:aPlus") {
          verifyFilter = sql`AND (LOWER(TRIM(COALESCE(category, ''))) = 'a+' OR LOWER(TRIM(COALESCE(category, ''))) LIKE 'a+%')`;

        } else if (status === "category:a") {
          verifyFilter = sql`AND (LOWER(TRIM(COALESCE(category, ''))) = 'a' OR (LOWER(TRIM(COALESCE(category, ''))) LIKE 'a%' AND LOWER(TRIM(COALESCE(category, ''))) NOT LIKE 'a+%'))`;

        } else if (status === "category:b") {
          verifyFilter = sql`AND (LOWER(TRIM(COALESCE(category, ''))) = 'b' OR LOWER(TRIM(COALESCE(category, ''))) LIKE 'b%')`;

        } else if (status === "category:c") {
          verifyFilter = sql`AND (LOWER(TRIM(COALESCE(category, ''))) = 'c' OR LOWER(TRIM(COALESCE(category, ''))) LIKE 'c%')`;

        } else if (status === "category:d") {
          verifyFilter = sql`AND (LOWER(TRIM(COALESCE(category, ''))) = 'd' OR LOWER(TRIM(COALESCE(category, ''))) LIKE 'd%')`;

        }
      }
    } else {

    }
    
    // Build query with optional search and status filter
    let query;
    // Base WHERE clause: require either sapid OR registrationno (except for underApproval which we handle separately)
    const hasUnderApproval = Array.isArray(status) 
      ? status.includes("underApproval")
      : status === "underApproval";
    const baseWhere = hasUnderApproval || hasSapIdStateFilter || hasRegNoStateFilter
      ? sql`1=1` 
      : sql`(sapid IS NOT NULL AND sapid != '' OR registrationno IS NOT NULL AND registrationno != '')`;
    
    if (search && search.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      query = sql/* sql */`
        SELECT
        a.alumniid,
        a.registrationno,
        a.sapid,
        a.alumniname,
        a.gender,
        a.maritalstatus,
        COALESCE(f.faculty_name, a.facultyname) as facultyname,
        a.campusname,
        COALESCE(d.department_name, a.departmentname) as departmentname,
        a.degreetitle,
        a.yearofstarting,
        a.yearofending,
        a.country,
        a.city,
        a.province,
        a.verify,
        a.employeed,
        a.industry,
        a.work_city,
        a.work_country,
        a.nameoforganization,
        a.designation,
        a.higher_education_institute_name,
        a.higher_education_program,
        a.is_scholarship,
        a.higher_education_institute_country,
        a.higher_education_institute_city,
        a.officialnumber,
        a.officialemail,
        a.personalemail,
        a.createddatetime,
        a.contactno,
        a.lasttimelogin,
        a.logincount,
        a.category
        FROM public.tbl_alumni a
        LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
        LEFT JOIN public.tbl_departments d ON d.id = a.department
        LEFT JOIN public.tbl_programs p ON p.id = a.program
        WHERE ${baseWhere}
          ${verifyFilter}
          ${categoryFilter}
          ${facultyFilter}
          ${departmentFilter}
          ${programFilter}
          ${genderFilter}
          ${maritalStatusFilter}
          ${homeCountryFilter}
          ${homeCityFilter}
          ${provinceFilter}
          ${campusFilter}
          ${admissionYearFilter}
          ${passingYearFilter}
          ${occupationStatusFilter}
          ${sectorFilter}
          ${workCityFilter}
          ${workCountryFilter}
          ${employerFilter}
          ${institutionNameFilter}
          ${programEnrolledFilter}
          ${fundingSourceFilter}
          ${institutionCountryFilter}
          ${institutionCityFilter}
          ${photoConsentFilter}
          ${mrNoFilter}
          ${sapIdStateFilter}
          ${regNoStateFilter}
          ${personalEmailStateFilter}
          ${contactNoStateFilter}
          ${accessFilterCondition}
          AND (
            LOWER(COALESCE(a.sapid, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(a.registrationno, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(a.alumniname, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(a.personalemail, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(a.officialemail, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(f.faculty_name, a.facultyname, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(d.department_name, a.departmentname, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(a.degreetitle, '')) LIKE ${searchTerm}
          )
        ORDER BY a.alumniid DESC
        LIMIT ${limit} OFFSET ${offset}`;
    } else {
      query = sql/* sql */`
      SELECT
        a.alumniid,
        a.registrationno,
        a.sapid,
        a.alumniname,
        a.gender,
        a.maritalstatus,
        COALESCE(f.faculty_name, a.facultyname) as facultyname,
        a.campusname,
        COALESCE(d.department_name, a.departmentname) as departmentname,
        a.degreetitle,
        a.yearofstarting,
        a.yearofending,
        a.country,
        a.city,
        a.province,
        a.verify,
        a.employeed,
        a.industry,
        a.work_city,
        a.work_country,
        a.nameoforganization,
        a.designation,
        a.higher_education_institute_name,
        a.higher_education_program,
        a.is_scholarship,
        a.higher_education_institute_country,
        a.higher_education_institute_city,
        a.officialnumber,
        a.officialemail,
        a.personalemail,
        a.createddatetime,
        a.contactno,
        a.lasttimelogin,
        a.logincount,
        a.category
      FROM public.tbl_alumni a
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      LEFT JOIN public.tbl_departments d ON d.id = a.department
      LEFT JOIN public.tbl_programs p ON p.id = a.program
      WHERE ${baseWhere}
        ${verifyFilter}
        ${categoryFilter}
        ${facultyFilter}
        ${departmentFilter}
        ${programFilter}
        ${genderFilter}
        ${maritalStatusFilter}
        ${homeCountryFilter}
        ${homeCityFilter}
        ${provinceFilter}
        ${campusFilter}
        ${admissionYearFilter}
        ${passingYearFilter}
        ${occupationStatusFilter}
        ${sectorFilter}
        ${workCityFilter}
        ${workCountryFilter}
        ${employerFilter}
        ${institutionNameFilter}
        ${programEnrolledFilter}
        ${fundingSourceFilter}
        ${institutionCountryFilter}
          ${institutionCityFilter}
          ${photoConsentFilter}
          ${mrNoFilter}
          ${sapIdStateFilter}
          ${regNoStateFilter}
          ${personalEmailStateFilter}
          ${contactNoStateFilter}
          ${accessFilterCondition}
      ORDER BY a.alumniid DESC
      LIMIT ${limit} OFFSET ${offset}`;
    }

    const rows = await query;
    
    // Debug logging

    if (status === "underApproval" && rows.length > 0) {

    } else if (status === "underApproval" && rows.length === 0) {

      // Quick check to see if there are any 'underApproval' verify records
      const checkPending = await sql/* sql */`
        SELECT COUNT(*) as count FROM public.tbl_alumni 
        WHERE sapid IS NOT NULL AND sapid != '' AND LOWER(TRIM(COALESCE(verify, ''))) = 'underapproval'
      `;

      // Get sample records to see what's actually there
      const samplePendingRecords = await sql/* sql */`
        SELECT alumniid, sapid, registrationno, verify, LENGTH(verify) as verify_length
        FROM public.tbl_alumni 
        WHERE (sapid IS NOT NULL AND sapid != '' OR registrationno IS NOT NULL AND registrationno != '')
        AND LOWER(TRIM(COALESCE(verify, ''))) = 'underapproval'
        ORDER BY alumniid DESC
        LIMIT 5
      `;

      // Check specifically for the recently registered alumni (ID 30714, SAP ID 123432)
      const checkSpecificAlumni = await sql/* sql */`
        SELECT alumniid, sapid, verify, LENGTH(verify) as verify_length, createddatetime
        FROM public.tbl_alumni 
        WHERE alumniid = 30714 OR sapid = '123432'
        LIMIT 5
      `;

      // Get sample records with 'underApproval' to see what's actually stored
      const samplePending = await sql/* sql */`
        SELECT alumniid, sapid, registrationno, verify,
               LENGTH(verify) as verify_length,
               TRIM(verify) as verify_trimmed,
               LOWER(TRIM(verify)) as verify_lower_trimmed
        FROM public.tbl_alumni 
        WHERE sapid IS NOT NULL AND sapid != '' 
        AND (verify = 'underApproval' OR LOWER(TRIM(COALESCE(verify, ''))) = 'underapproval')
        LIMIT 5
      `;

      // Check the most recently registered alumni (last 10 by alumniid DESC)
      const recentAlumni = await sql/* sql */`
        SELECT alumniid, sapid, verify, LENGTH(verify) as verify_length,
               TRIM(verify) as verify_trimmed,
               LOWER(TRIM(verify)) as verify_lower_trimmed,
               createddatetime
        FROM public.tbl_alumni 
        WHERE sapid IS NOT NULL AND sapid != ''
        ORDER BY alumniid DESC
        LIMIT 10
      `;

      // Check for case variations
      const checkCaseVariations = await sql/* sql */`
        SELECT verify, LENGTH(verify) as verify_length, COUNT(*) as count
        FROM public.tbl_alumni 
        WHERE sapid IS NOT NULL AND sapid != '' 
        AND (LOWER(verify) LIKE '%underapproval%' OR verify LIKE '%underApproval%')
        GROUP BY verify, LENGTH(verify)
        ORDER BY count DESC
        LIMIT 10
      `;

      // Also check what verify values actually exist
      const verifySamples = await sql/* sql */`
        SELECT verify, pg_typeof(verify) as verify_type, COUNT(*) as count
        FROM public.tbl_alumni 
        WHERE sapid IS NOT NULL AND sapid != ''
        GROUP BY verify, pg_typeof(verify)
        ORDER BY count DESC
        LIMIT 10
      `;

    }
    
    // Get total count for pagination (only if needed)
    // IMPORTANT: Include all the same filters as the main query to get accurate filtered count
    const searchTermForCount = search && search.trim() ? `%${search.trim().toLowerCase()}%` : null;
    const countQuery = searchTermForCount
      ? sql/* sql */`
          SELECT COUNT(*) as total
          FROM public.tbl_alumni a
          LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
          LEFT JOIN public.tbl_departments d ON d.id = a.department
          LEFT JOIN public.tbl_programs p ON p.id = a.program
          WHERE ${baseWhere}
            ${verifyFilter}
            ${categoryFilter}
            ${facultyFilter}
            ${departmentFilter}
            ${programFilter}
            ${genderFilter}
            ${maritalStatusFilter}
            ${homeCountryFilter}
            ${homeCityFilter}
            ${provinceFilter}
            ${campusFilter}
            ${admissionYearFilter}
            ${passingYearFilter}
            ${occupationStatusFilter}
            ${sectorFilter}
            ${workCityFilter}
            ${workCountryFilter}
            ${institutionNameFilter}
            ${programEnrolledFilter}
            ${fundingSourceFilter}
            ${institutionCountryFilter}
          ${institutionCityFilter}
          ${mrNoFilter}
          ${sapIdStateFilter}
          ${regNoStateFilter}
          ${accessFilterCondition}
            AND (
              LOWER(a.sapid) LIKE ${searchTermForCount}
              OR LOWER(COALESCE(a.registrationno, '')) LIKE ${searchTermForCount}
              OR LOWER(COALESCE(a.alumniname, '')) LIKE ${searchTermForCount}
              OR LOWER(COALESCE(a.personalemail, '')) LIKE ${searchTermForCount}
              OR LOWER(COALESCE(a.officialemail, '')) LIKE ${searchTermForCount}
              OR LOWER(COALESCE(f.faculty_name, a.facultyname, '')) LIKE ${searchTermForCount}
              OR LOWER(COALESCE(d.department_name, a.departmentname, '')) LIKE ${searchTermForCount}
              OR LOWER(COALESCE(a.degreetitle, '')) LIKE ${searchTermForCount}
            )`
          : sql/* sql */`
              SELECT COUNT(*) as total
              FROM public.tbl_alumni a
              LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
              LEFT JOIN public.tbl_departments d ON d.id = a.department
              LEFT JOIN public.tbl_programs p ON p.id = a.program
              WHERE ${baseWhere}
                ${verifyFilter}
                ${categoryFilter}
                ${facultyFilter}
                ${departmentFilter}
                ${programFilter}
                ${genderFilter}
                ${maritalStatusFilter}
                ${homeCountryFilter}
                ${homeCityFilter}
                ${provinceFilter}
                ${campusFilter}
                ${admissionYearFilter}
                ${passingYearFilter}
                ${occupationStatusFilter}
                ${sectorFilter}
                ${workCityFilter}
                ${workCountryFilter}
                ${institutionNameFilter}
                ${programEnrolledFilter}
                ${fundingSourceFilter}
                ${institutionCountryFilter}
                ${institutionCityFilter}
                ${photoConsentFilter}
                ${mrNoFilter}
                ${sapIdStateFilter}
                ${regNoStateFilter}
                ${accessFilterCondition}`;
    
    const countResult = await countQuery;
    const total = countResult[0]?.total || 0;

    return NextResponse.json({ 
      items: rows, 
      total: Number(total),
      page,
      limit,
      totalPages: Math.ceil(Number(total) / limit)
    }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch alumni";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/alumni
 * 
 * Alumni Registration Endpoint
 * 
 * REGISTRATION RULES (Updated):
 * Validation now depends ONLY on verify_status of the alumni record.
 * 
 * Rules:
 * 1. If alumni record exists AND verify = 'true':
 *    → Block registration
 *    → Return error: "This alumni is already verified and cannot register again."
 * 
 * 2. If alumni record exists AND verify = 'false'/'pending'/null:
 *    → Allow registration
 *    → Overwrite existing record with new submitted data
 *    → Keep the same record ID (alumniid)
 * 
 * 3. If no alumni record exists:
 *    → Create new record normally
 * 
 * NOTE: Duplicate checks on CNIC/SADID, email, or other fields have been removed.
 * Format validation (email format, CNIC format, etc.) still applies via schema validation.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Parse and validate the request body using the schema
    // Note: Schema validation still applies for data format (email format, CNIC format, etc.)
    // but we no longer block registration based on duplicate CNIC/email/SAP ID
    const parsed = alumniRegistrationComprehensiveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const v = parsed.data;
    const d = mapToDb(v);
    
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
    
    // Extract all identifier fields
    const regNo = d.registrationno ? String(d.registrationno).trim() : null;
    const sapId = d.sapid ? String(d.sapid).trim() : null;
    const cnic = d.cnicpassport ? String(d.cnicpassport).trim() : null;
    const phone = d.contactno ? String(d.contactno).trim() : null;
    const personalEmail = d.personalemail ? String(d.personalemail).trim().toLowerCase() : null;
    const officialEmail = d.officialemail ? String(d.officialemail).trim().toLowerCase() : null;
    
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
    if (officialEmail) {
      conditions.push(sql`(LOWER(officialemail) = ${officialEmail} AND officialemail IS NOT NULL AND officialemail != '')`);
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
        if (officialEmail && existingRecord.officialemail && 
            String(existingRecord.officialemail).trim().toLowerCase() === officialEmail) {
          matchedBy.push('officialemail');
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
      
      // RULE 2: If alumni exists and verify = 'false'/'pending'/null, allow registration and overwrite
      // Update the existing record with new data, keeping the same alumniid
      // IMPORTANT: Always set verify = 'underApproval' when re-registering (regardless of payload)
      // IMPORTANT: Preserve identifier fields - if incoming value is missing, keep the existing value

      const alumniId = existingRecord.alumniid;
      
      // Preserve identifier fields: if incoming value is missing, keep the existing value
      // This prevents losing any identifier when re-registering with only some identifiers
      const preservedRegNo = d.registrationno ?? existingRecord.registrationno;
      const preservedSapId = d.sapid ?? existingRecord.sapid;
      const preservedCnic = d.cnicpassport ?? existingRecord.cnicpassport;
      const preservedPhone = d.contactno ?? existingRecord.contactno;
      const preservedPersonalEmail = d.personalemail ?? existingRecord.personalemail;
      const preservedOfficialEmail = d.officialemail ?? existingRecord.officialemail;

      const updateResult = await sql/* sql */`
        UPDATE public.tbl_alumni SET
          registrationno = ${preservedRegNo},
          sapid = ${preservedSapId},
          cnicpassport = ${preservedCnic},
          contactno = ${preservedPhone},
          personalemail = ${preservedPersonalEmail},
          officialemail = ${preservedOfficialEmail},
          alumniname = ${d.alumniname},
          gender = ${d.gender},
          fathername = ${d.fathername},
          dateofbirth = ${d.dateofbirth},
          maritalstatus = ${d.maritalstatus},
          password = ${d.password},
          address = ${d.address},
          province = ${d.province},
          city = ${d.city},
          country = ${d.country},
          work_city = ${d.work_city},
          work_country = ${d.work_country},
          campusname = ${d.campusname},
          facultyname = ${d.facultyname},
          departmentname = ${d.departmentname},
          degreetitle = ${d.degreetitle},
          yearofending = ${d.yearofending},
          employeed = ${d.employeed},
          industry = ${d.industry},
          nameoforganization = ${d.nameoforganization},
          designation = ${d.designation},
          totalyearsofexpereince = ${d.totalyearsofexpereince},
          officialemail = ${d.officialemail},
          officialnumber = ${d.officialnumber},
          datasource = ${d.datasource},
          verify = ${'underApproval'}, /* Always set verify = 'underApproval' for re-registration (Under Approval) */
          alumnistatus = ${d.alumnistatus},
          todaydate = ${d.todaydate}
        WHERE alumniid = ${alumniId}
        RETURNING alumniid, registrationno, sapid, verify
      `;
      
      const updated = updateResult[0];

      // Auto-assign chapter1 based on home location (Pakistan=>city, otherwise=>country)
      await autoAssignChapter1FromHomeLocation({
        alumniId: Number(updated.alumniid),
        homeCountry: d.country,
        homeCity: d.city,
      });

      // Auto-assign chapter2 based on work location (Pakistan=>work city, otherwise=>work country)
      await autoAssignChapter2FromWorkLocation({
        alumniId: Number(updated.alumniid),
        workCountry: d.work_country,
        workCity: d.work_city,
      });

      await autoAssignAssociationFromFaculty({
        alumniId: Number(updated.alumniid),
        facultyName: d.facultyname,
      });
      
      return NextResponse.json({ 
        ok: true, 
        updated: true,
        message: "Alumni record updated successfully. Status set to 'Under Approval'.",
        created: {
          alumniid: updated.alumniid,
          registrationno: updated.registrationno,
          sapid: updated.sapid,
          verify: updated.verify
        }
      }, { status: 200 });
    }
    
    // RULE 3: If no alumni record exists, create a new record normally
    const rows = await sql/* sql */`
      INSERT INTO public.tbl_alumni (
        registrationno, sapid, alumniname, gender, fathername, dateofbirth, maritalstatus,
        cnicpassport, contactno, personalemail, password, address, province, city, country,
        work_city, work_country,
        campusname, facultyname, departmentname, degreetitle, yearofending, employeed, industry,
        nameoforganization, designation, totalyearsofexpereince, officialemail, officialnumber,
        datasource, verify, alumnistatus, todaydate
      ) VALUES (
        ${d.registrationno}, ${d.sapid}, ${d.alumniname}, ${d.gender}, ${d.fathername}, ${d.dateofbirth}, ${d.maritalstatus},
        ${d.cnicpassport}, ${d.contactno}, ${d.personalemail}, ${d.password}, ${d.address}, ${d.province}, ${d.city}, ${d.country},
        ${d.work_city}, ${d.work_country},
        ${d.campusname}, ${d.facultyname}, ${d.departmentname}, ${d.degreetitle}, ${d.yearofending}, ${d.employeed}, ${d.industry},
        ${d.nameoforganization}, ${d.designation}, ${d.totalyearsofexpereince}, ${d.officialemail}, ${d.officialnumber},
        ${d.datasource}, ${d.verify}, ${d.alumnistatus}, ${d.todaydate}
      )
      RETURNING alumniid, registrationno, sapid, verify`;
    const created = rows[0];

    // Auto-assign chapter1 based on home location (Pakistan=>city, otherwise=>country)
    await autoAssignChapter1FromHomeLocation({
      alumniId: Number((created as { alumniid: number }).alumniid),
      homeCountry: d.country,
      homeCity: d.city,
    });

    // Auto-assign chapter2 based on work location (Pakistan=>work city, otherwise=>work country)
    await autoAssignChapter2FromWorkLocation({
      alumniId: Number((created as { alumniid: number }).alumniid),
      workCountry: d.work_country,
      workCity: d.work_city,
    });

    await autoAssignAssociationFromFaculty({
      alumniId: Number((created as { alumniid: number }).alumniid),
      facultyName: d.facultyname,
    });

    return NextResponse.json({ ok: true, created }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create alumni";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}