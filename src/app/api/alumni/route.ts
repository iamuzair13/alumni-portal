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

  console.log("[AUTO-CHAPTER] start", {
    alumniId: args.alumniId,
    homeCountry: homeCountryRaw || null,
    homeCity: homeCityRaw || null,
    lookupType,
    lookupValue: lookupValueRaw || null,
  });

  if (!lookupValueRaw) {
    console.log("[AUTO-CHAPTER] skip", {
      alumniId: args.alumniId,
      reason: isPakistan ? "Pakistan selected but home city missing" : "Home country missing",
    });
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
    console.log("[AUTO-CHAPTER] matched", {
      alumniId: args.alumniId,
      lookupType,
      lookupValue: lookupValueRaw,
      matchedCount: matches.length,
      chosen: chosen ? { chapterId: chosen.id, chapterName: chosen.name, chapterType: chosen.type } : null,
    });

    if (!chosen) return;

    const existing = await sql<{ id: number; chapter1: number | null }[]>/* sql */`
      SELECT id, "chapter1"
      FROM public.alumni_chapter
      WHERE id = ${args.alumniId}
      LIMIT 1
    `;

    const currentChapter1 = existing[0]?.chapter1 ?? null;
    if (currentChapter1) {
      console.log("[AUTO-CHAPTER] skip", {
        alumniId: args.alumniId,
        reason: "chapter1 already set",
        currentChapter1,
        attemptedChapter1: chosen.id,
      });
      return;
    }

    if (existing.length > 0) {
      await sql/* sql */`
        UPDATE public.alumni_chapter
        SET "chapter1" = ${chosen.id}
        WHERE id = ${args.alumniId}
      `;
      console.log("[AUTO-CHAPTER] update", { alumniId: args.alumniId, chapter1: chosen.id });
    } else {
      await sql/* sql */`
        INSERT INTO public.alumni_chapter (id, "chapter1", "chapter2", "chapter3")
        VALUES (${args.alumniId}, ${chosen.id}, NULL, NULL)
      `;
      console.log("[AUTO-CHAPTER] insert", { alumniId: args.alumniId, chapter1: chosen.id });
    }
  } catch (err) {
    console.error("[AUTO-CHAPTER] error", { alumniId: args.alumniId, err });
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

  console.log("[AUTO-CHAPTER2] start", {
    alumniId: args.alumniId,
    workCountry: workCountryRaw || null,
    workCity: workCityRaw || null,
    lookupType,
    lookupValue: lookupValueRaw || null,
  });

  if (!lookupValueRaw) {
    console.log("[AUTO-CHAPTER2] skip", {
      alumniId: args.alumniId,
      reason: isPakistan ? "Pakistan selected but work city missing" : "Work country missing",
    });
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
    console.log("[AUTO-CHAPTER2] matched", {
      alumniId: args.alumniId,
      lookupType,
      lookupValue: lookupValueRaw,
      matchedCount: matches.length,
      chosen: chosen ? { chapterId: chosen.id, chapterName: chosen.name, chapterType: chosen.type } : null,
    });

    if (!chosen) return;

    const existing = await sql<{ id: number; chapter2: number | null }[]>/* sql */`
      SELECT id, "chapter2"
      FROM public.alumni_chapter
      WHERE id = ${args.alumniId}
      LIMIT 1
    `;

    const currentChapter2 = existing[0]?.chapter2 ?? null;
    if (currentChapter2) {
      console.log("[AUTO-CHAPTER2] skip", {
        alumniId: args.alumniId,
        reason: "chapter2 already set",
        currentChapter2,
        attemptedChapter2: chosen.id,
      });
      return;
    }

    if (existing.length > 0) {
      await sql/* sql */`
        UPDATE public.alumni_chapter
        SET "chapter2" = ${chosen.id}
        WHERE id = ${args.alumniId}
      `;
      console.log("[AUTO-CHAPTER2] update", { alumniId: args.alumniId, chapter2: chosen.id });
    } else {
      await sql/* sql */`
        INSERT INTO public.alumni_chapter (id, "chapter1", "chapter2", "chapter3")
        VALUES (${args.alumniId}, NULL, ${chosen.id}, NULL)
      `;
      console.log("[AUTO-CHAPTER2] insert", { alumniId: args.alumniId, chapter2: chosen.id });
    }
  } catch (err) {
    console.error("[AUTO-CHAPTER2] error", { alumniId: args.alumniId, err });
  }
}

async function autoAssignAssociationFromFaculty(args: { alumniId: number; facultyName: string | null | undefined }) {
  const facultyName = args.facultyName ? String(args.facultyName).trim() : "";
  if (!facultyName) {
    console.log("[AUTO-ASSOCIATION] skip", { alumniId: args.alumniId, reason: "facultyName missing" });
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
    console.log("[AUTO-ASSOCIATION] start", { alumniId: args.alumniId, facultyName, existingAssociationId });

    if (existingAssociationId) {
      console.log("[AUTO-ASSOCIATION] skip", {
        alumniId: args.alumniId,
        facultyName,
        reason: "association_id already set",
        existingAssociationId,
      });
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

    console.log("[AUTO-ASSOCIATION] matched", {
      alumniId: args.alumniId,
      facultyName,
      chosen: chosen ? { associationId: chosen.id, title: chosen.title } : null,
    });

    if (!chosen?.id) return;

    await sql/* sql */`
      UPDATE public.tbl_alumni
      SET association_id = ${chosen.id}
      WHERE alumniid = ${args.alumniId}
    `;
    console.log("[AUTO-ASSOCIATION] update", { alumniId: args.alumniId, associationId: chosen.id });
  } catch (err) {
    console.error("[AUTO-ASSOCIATION] error", { alumniId: args.alumniId, facultyName, err });
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
    verify: payload.verified === true ? "true" : payload.verified === false ? "false" : "pending", // 'pending' for new registrations
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
    const institutionNameParams = searchParams.getAll("institutionName");
    const programEnrolledParams = searchParams.getAll("programEnrolled");
    const fundingSourceParams = searchParams.getAll("fundingSource");
    const institutionCountryParams = searchParams.getAll("institutionCountry");
    const institutionCityParams = searchParams.getAll("institutionCity");
    const mrNoParams = searchParams.getAll("mrNo");
    
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
    const institutionName = institutionNameParams.length > 0 ? institutionNameParams : (searchParams.get("institutionName") || "");
    const programEnrolled = programEnrolledParams.length > 0 ? programEnrolledParams : (searchParams.get("programEnrolled") || "");
    const fundingSource = fundingSourceParams.length > 0 ? fundingSourceParams : (searchParams.get("fundingSource") || "");
    const institutionCountry = institutionCountryParams.length > 0 ? institutionCountryParams : (searchParams.get("institutionCountry") || "");
    const institutionCity = institutionCityParams.length > 0 ? institutionCityParams : (searchParams.get("institutionCity") || "");
    const mrNo = mrNoParams.length > 0 ? mrNoParams : (searchParams.get("mrNo") || "");
    
    const getCountsOnly = searchParams.get("countsOnly") === "true";
    const offset = (page - 1) * limit;
    
    // Build access filter for admin/viewer users
    const accessFilter = await buildAccessFilterSQL(session, "");
    
    // Debug logging
    console.log("[alumni/route] Access filter:", {
      hasFilter: accessFilter.hasFilter,
      isSuperAdmin: !accessFilter.hasFilter
    });
    
    // Log the actual SQL condition for debugging (if it's a program-level filter)
    if (accessFilter.hasFilter && accessFilter.sql) {
      console.log("[alumni/route] Access filter SQL condition is active");
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
    let facultyFilter = sql``;
    if (faculty && (Array.isArray(faculty) ? faculty.length > 0 : faculty)) {
      if (Array.isArray(faculty) && faculty.length > 0) {
        // Build OR conditions for multiple faculties
        const facultyConditions = faculty.map((f) => {
          const normalized = String(f).trim();
          if (normalized === "NULL" || normalized === "null") {
            return sql`(facultyname IS NULL OR TRIM(COALESCE(facultyname, '')) = '')`;
          }
          return sql`LOWER(TRIM(COALESCE(facultyname, ''))) = LOWER(TRIM(${f}))`;
        });
        const combinedCondition = combineOrConditions(facultyConditions);
        facultyFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(faculty) && faculty) {
        const normalized = String(faculty).trim();
        if (normalized === "NULL" || normalized === "null") {
          facultyFilter = sql`AND (facultyname IS NULL OR TRIM(COALESCE(facultyname, '')) = '')`;
        } else {
          facultyFilter = sql`AND LOWER(TRIM(COALESCE(facultyname, ''))) = LOWER(TRIM(${faculty}))`;
        }
      }
      console.log("[API] Filtering for faculty:", faculty);
    }
    
    let departmentFilter = sql``;
    if (department && (Array.isArray(department) ? department.length > 0 : department)) {
      if (Array.isArray(department) && department.length > 0) {
        // Build OR conditions for multiple departments
        const departmentConditions = department.map((d) => {
          const normalized = String(d).trim();
          if (normalized === "NULL" || normalized === "null") {
            return sql`(departmentname IS NULL OR TRIM(COALESCE(departmentname, '')) = '')`;
          }
          return sql`LOWER(TRIM(COALESCE(departmentname, ''))) = LOWER(TRIM(${d}))`;
        });
        const combinedCondition = combineOrConditions(departmentConditions);
        departmentFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(department) && department) {
        const normalized = String(department).trim();
        if (normalized === "NULL" || normalized === "null") {
          departmentFilter = sql`AND (departmentname IS NULL OR TRIM(COALESCE(departmentname, '')) = '')`;
        } else {
          departmentFilter = sql`AND LOWER(TRIM(COALESCE(departmentname, ''))) = LOWER(TRIM(${department}))`;
        }
      }
      console.log("[API] Filtering for department:", department);
    }
    
    let programFilter = sql``;
    if (program && (Array.isArray(program) ? program.length > 0 : program)) {
      if (Array.isArray(program) && program.length > 0) {
        // Build OR conditions for multiple programs
        const programConditions = program.map((p) => {
          const normalized = String(p).trim();
          if (normalized === "NULL" || normalized === "null") {
            return sql`(degreetitle IS NULL OR TRIM(COALESCE(degreetitle, '')) = '')`;
          }
          return sql`LOWER(TRIM(COALESCE(degreetitle, ''))) = LOWER(TRIM(${p}))`;
        });
        const combinedCondition = combineOrConditions(programConditions);
        programFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(program) && program) {
        const normalized = String(program).trim();
        if (normalized === "NULL" || normalized === "null") {
          programFilter = sql`AND (degreetitle IS NULL OR TRIM(COALESCE(degreetitle, '')) = '')`;
        } else {
          programFilter = sql`AND LOWER(TRIM(COALESCE(degreetitle, ''))) = LOWER(TRIM(${program}))`;
        }
      }
      console.log("[API] Filtering for program:", program);
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
    let homeCountryFilter = sql``;
    if (homeCountry && (Array.isArray(homeCountry) ? homeCountry.length > 0 : homeCountry)) {
      if (Array.isArray(homeCountry) && homeCountry.length > 0) {
        const conditions = homeCountry.map(c => sql`LOWER(TRIM(COALESCE(country, ''))) = LOWER(TRIM(${c}))`);
        const combinedCondition = combineOrConditions(conditions);
        homeCountryFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(homeCountry) && homeCountry) {
        homeCountryFilter = sql`AND LOWER(TRIM(COALESCE(country, ''))) = LOWER(TRIM(${homeCountry}))`;
      }
    }
    
    // Home City filter
    let homeCityFilter = sql``;
    if (homeCity && (Array.isArray(homeCity) ? homeCity.length > 0 : homeCity)) {
      if (Array.isArray(homeCity) && homeCity.length > 0) {
        const conditions = homeCity.map(c => sql`LOWER(TRIM(COALESCE(city, ''))) = LOWER(TRIM(${c}))`);
        const combinedCondition = combineOrConditions(conditions);
        homeCityFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(homeCity) && homeCity) {
        homeCityFilter = sql`AND LOWER(TRIM(COALESCE(city, ''))) = LOWER(TRIM(${homeCity}))`;
      }
    }
    
    // Province filter
    let provinceFilter = sql``;
    if (province && (Array.isArray(province) ? province.length > 0 : province)) {
      if (Array.isArray(province) && province.length > 0) {
        const conditions = province.map(p => sql`LOWER(TRIM(COALESCE(province, ''))) = LOWER(TRIM(${p}))`);
        const combinedCondition = combineOrConditions(conditions);
        provinceFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(province) && province) {
        provinceFilter = sql`AND LOWER(TRIM(COALESCE(province, ''))) = LOWER(TRIM(${province}))`;
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
    let admissionYearFilter = sql``;
    if (admissionYear && (Array.isArray(admissionYear) ? admissionYear.length > 0 : admissionYear)) {
      if (Array.isArray(admissionYear) && admissionYear.length > 0) {
        const conditions = admissionYear.map(y => {
          const year = parseInt(y, 10);
          if (isNaN(year)) return sql`1=0`;
          return sql`yearofstarting = ${year}`;
        });
        const combinedCondition = combineOrConditions(conditions);
        admissionYearFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(admissionYear) && admissionYear) {
        const year = parseInt(admissionYear, 10);
        if (!isNaN(year)) {
          admissionYearFilter = sql`AND yearofstarting = ${year}`;
        }
      }
    }
    
    // Passing Year filter (integer)
    let passingYearFilter = sql``;
    if (passingYear && (Array.isArray(passingYear) ? passingYear.length > 0 : passingYear)) {
      if (Array.isArray(passingYear) && passingYear.length > 0) {
        const conditions = passingYear.map(y => {
          const year = parseInt(y, 10);
          if (isNaN(year)) return sql`1=0`;
          return sql`yearofending = ${year}`;
        });
        const combinedCondition = combineOrConditions(conditions);
        passingYearFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(passingYear) && passingYear) {
        const year = parseInt(passingYear, 10);
        if (!isNaN(year)) {
          passingYearFilter = sql`AND yearofending = ${year}`;
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
    let sectorFilter = sql``;
    if (sector && (Array.isArray(sector) ? sector.length > 0 : sector)) {
      if (Array.isArray(sector) && sector.length > 0) {
        const conditions = sector.map(s => {
          const searchTerm = `%${s.trim().toLowerCase()}%`;
          return sql`LOWER(TRIM(COALESCE(industry, ''))) LIKE ${searchTerm}`;
        });
        const combinedCondition = combineOrConditions(conditions);
        sectorFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(sector) && sector) {
        const searchTerm = `%${sector.trim().toLowerCase()}%`;
        sectorFilter = sql`AND LOWER(TRIM(COALESCE(industry, ''))) LIKE ${searchTerm}`;
      }
    }
    
    // Work City filter
    let workCityFilter = sql``;
    if (workCity && (Array.isArray(workCity) ? workCity.length > 0 : workCity)) {
      if (Array.isArray(workCity) && workCity.length > 0) {
        const conditions = workCity.map(w => sql`LOWER(TRIM(COALESCE(work_city, ''))) = LOWER(TRIM(${w}))`);
        const combinedCondition = combineOrConditions(conditions);
        workCityFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(workCity) && workCity) {
        workCityFilter = sql`AND LOWER(TRIM(COALESCE(work_city, ''))) = LOWER(TRIM(${workCity}))`;
      }
    }
    
    // Work Country filter
    let workCountryFilter = sql``;
    if (workCountry && (Array.isArray(workCountry) ? workCountry.length > 0 : workCountry)) {
      if (Array.isArray(workCountry) && workCountry.length > 0) {
        const conditions = workCountry.map(w => sql`LOWER(TRIM(COALESCE(work_country, ''))) = LOWER(TRIM(${w}))`);
        const combinedCondition = combineOrConditions(conditions);
        workCountryFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(workCountry) && workCountry) {
        workCountryFilter = sql`AND LOWER(TRIM(COALESCE(work_country, ''))) = LOWER(TRIM(${workCountry}))`;
      }
    }
    
    // Institution Name filter
    let institutionNameFilter = sql``;
    if (institutionName && (Array.isArray(institutionName) ? institutionName.length > 0 : institutionName)) {
      if (Array.isArray(institutionName) && institutionName.length > 0) {
        const conditions = institutionName.map(i => sql`LOWER(TRIM(COALESCE(higher_education_institute_name, ''))) = LOWER(TRIM(${i}))`);
        const combinedCondition = combineOrConditions(conditions);
        institutionNameFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(institutionName) && institutionName) {
        institutionNameFilter = sql`AND LOWER(TRIM(COALESCE(higher_education_institute_name, ''))) = LOWER(TRIM(${institutionName}))`;
      }
    }
    
    // Program Enrolled filter
    let programEnrolledFilter = sql``;
    if (programEnrolled && (Array.isArray(programEnrolled) ? programEnrolled.length > 0 : programEnrolled)) {
      if (Array.isArray(programEnrolled) && programEnrolled.length > 0) {
        const conditions = programEnrolled.map(p => sql`LOWER(TRIM(COALESCE(higher_education_program, ''))) = LOWER(TRIM(${p}))`);
        const combinedCondition = combineOrConditions(conditions);
        programEnrolledFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(programEnrolled) && programEnrolled) {
        programEnrolledFilter = sql`AND LOWER(TRIM(COALESCE(higher_education_program, ''))) = LOWER(TRIM(${programEnrolled}))`;
      }
    }
    
    // Funding Source filter
    let fundingSourceFilter = sql``;
    if (fundingSource && (Array.isArray(fundingSource) ? fundingSource.length > 0 : fundingSource)) {
      if (Array.isArray(fundingSource) && fundingSource.length > 0) {
        const conditions = fundingSource.map(f => sql`LOWER(TRIM(COALESCE(is_scholarship, ''))) = LOWER(TRIM(${f}))`);
        const combinedCondition = combineOrConditions(conditions);
        fundingSourceFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(fundingSource) && fundingSource) {
        fundingSourceFilter = sql`AND LOWER(TRIM(COALESCE(is_scholarship, ''))) = LOWER(TRIM(${fundingSource}))`;
      }
    }
    
    // Institution Country filter
    let institutionCountryFilter = sql``;
    if (institutionCountry && (Array.isArray(institutionCountry) ? institutionCountry.length > 0 : institutionCountry)) {
      if (Array.isArray(institutionCountry) && institutionCountry.length > 0) {
        const conditions = institutionCountry.map(i => sql`LOWER(TRIM(COALESCE(higher_education_institute_country, ''))) = LOWER(TRIM(${i}))`);
        const combinedCondition = combineOrConditions(conditions);
        institutionCountryFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(institutionCountry) && institutionCountry) {
        institutionCountryFilter = sql`AND LOWER(TRIM(COALESCE(higher_education_institute_country, ''))) = LOWER(TRIM(${institutionCountry}))`;
      }
    }
    
    // Institution City filter
    let institutionCityFilter = sql``;
    if (institutionCity && (Array.isArray(institutionCity) ? institutionCity.length > 0 : institutionCity)) {
      if (Array.isArray(institutionCity) && institutionCity.length > 0) {
        const conditions = institutionCity.map(i => sql`LOWER(TRIM(COALESCE(higher_education_institute_city, ''))) = LOWER(TRIM(${i}))`);
        const combinedCondition = combineOrConditions(conditions);
        institutionCityFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(institutionCity) && institutionCity) {
        institutionCityFilter = sql`AND LOWER(TRIM(COALESCE(higher_education_institute_city, ''))) = LOWER(TRIM(${institutionCity}))`;
      }
    }
    
    // MR No (Registration No) filter
    let mrNoFilter = sql``;
    if (mrNo && (Array.isArray(mrNo) ? mrNo.length > 0 : mrNo)) {
      if (Array.isArray(mrNo) && mrNo.length > 0) {
        const conditions = mrNo.map(m => sql`LOWER(TRIM(COALESCE(registrationno, ''))) = LOWER(TRIM(${m}))`);
        const combinedCondition = combineOrConditions(conditions);
        mrNoFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(mrNo) && mrNo) {
        mrNoFilter = sql`AND LOWER(TRIM(COALESCE(registrationno, ''))) = LOWER(TRIM(${mrNo}))`;
      }
    }
    
    // If only counts are needed, return early with just counts
    if (getCountsOnly) {
      const searchTermForCount = search && search.trim() ? `%${search.trim().toLowerCase()}%` : null;
      const countQuery = searchTermForCount
        ? sql/* sql */`
            SELECT COUNT(*) as total
            FROM public.tbl_alumni
            WHERE sapid IS NOT NULL AND sapid != ''
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
              ${accessFilterCondition}
              AND (
                LOWER(sapid) LIKE ${searchTermForCount}
                OR LOWER(COALESCE(registrationno, '')) LIKE ${searchTermForCount}
                OR LOWER(COALESCE(alumniname, '')) LIKE ${searchTermForCount}
                OR LOWER(COALESCE(personalemail, '')) LIKE ${searchTermForCount}
                OR LOWER(COALESCE(officialemail, '')) LIKE ${searchTermForCount}
                OR LOWER(COALESCE(facultyname, '')) LIKE ${searchTermForCount}
                OR LOWER(COALESCE(departmentname, '')) LIKE ${searchTermForCount}
                OR LOWER(COALESCE(degreetitle, '')) LIKE ${searchTermForCount}
              )`
        : sql/* sql */`
            SELECT COUNT(*) as total
            FROM public.tbl_alumni
            WHERE sapid IS NOT NULL AND sapid != ''
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
            statusConditions.push(sql`verify = 'pending'`);
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
          }
        });
        
        if (statusConditions.length > 0) {
          const combinedCondition = combineOrConditions(statusConditions);
          verifyFilter = sql`AND (${combinedCondition})`;
        }
        console.log("[API] Filtering for multiple statuses:", status);
      } else if (!Array.isArray(status)) {
        // Single status filter (backward compatibility)
        if (status === "verified") {
          verifyFilter = sql`AND LOWER(COALESCE(verify, '')) = 'true'`;
          console.log("[API] Filtering for verified alumni");
        } else if (status === "unverified") {
          verifyFilter = sql`AND LOWER(COALESCE(verify, '')) = 'false'`;
          console.log("[API] Filtering for unverified alumni");
        } else if (status === "underApproval") {
          verifyFilter = sql`AND verify = 'pending'`;
          console.log("[API] Filtering for under approval alumni (verify = 'pending', including null sapid/registrationno)");
        } else if (status === "active") {
          verifyFilter = sql`AND ((lasttimelogin IS NOT NULL AND lasttimelogin != '') OR (logincount IS NOT NULL AND logincount > 0))`;
          console.log("[API] Filtering for active alumni (has logged in)");
        } else if (status === "inactive") {
          verifyFilter = sql`AND ((lasttimelogin IS NULL OR lasttimelogin = '') AND (logincount IS NULL OR logincount = 0))`;
          console.log("[API] Filtering for inactive alumni (never logged in)");
        } else if (status === "category:aPlus") {
          verifyFilter = sql`AND (LOWER(TRIM(COALESCE(category, ''))) = 'a+' OR LOWER(TRIM(COALESCE(category, ''))) LIKE 'a+%')`;
          console.log("[API] Filtering for A+ category");
        } else if (status === "category:a") {
          verifyFilter = sql`AND (LOWER(TRIM(COALESCE(category, ''))) = 'a' OR (LOWER(TRIM(COALESCE(category, ''))) LIKE 'a%' AND LOWER(TRIM(COALESCE(category, ''))) NOT LIKE 'a+%'))`;
          console.log("[API] Filtering for A category");
        } else if (status === "category:b") {
          verifyFilter = sql`AND (LOWER(TRIM(COALESCE(category, ''))) = 'b' OR LOWER(TRIM(COALESCE(category, ''))) LIKE 'b%')`;
          console.log("[API] Filtering for B category");
        } else if (status === "category:c") {
          verifyFilter = sql`AND (LOWER(TRIM(COALESCE(category, ''))) = 'c' OR LOWER(TRIM(COALESCE(category, ''))) LIKE 'c%')`;
          console.log("[API] Filtering for C category");
        }
      }
    } else {
      console.log("[API] No status filter applied, status:", status);
    }
    
    // Build query with optional search and status filter
    let query;
    // Base WHERE clause: require either sapid OR registrationno (except for underApproval which we handle separately)
    const hasUnderApproval = Array.isArray(status) 
      ? status.includes("underApproval")
      : status === "underApproval";
    const baseWhere = hasUnderApproval
      ? sql`1=1` 
      : sql`(sapid IS NOT NULL AND sapid != '' OR registrationno IS NOT NULL AND registrationno != '')`;
    
    if (search && search.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      query = sql/* sql */`
        SELECT
          alumniid,
          registrationno,
          sapid,
          alumniname,
          gender,
          maritalstatus,
          facultyname,
          campusname,
          departmentname,
          degreetitle,
          yearofstarting,
          yearofending,
          country,
          city,
          province,
          verify,
          employeed,
          industry,
          work_city,
          work_country,
          nameoforganization,
          designation,
          higher_education_institute_name,
          higher_education_program,
          is_scholarship,
          higher_education_institute_country,
          higher_education_institute_city,
          officialnumber,
          officialemail,
          personalemail,
          contactno,
          lasttimelogin,
          logincount,
          category
        FROM public.tbl_alumni
        WHERE ${baseWhere}
          ${verifyFilter}
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
          ${accessFilterCondition}
          AND (
            LOWER(sapid) LIKE ${searchTerm}
            OR LOWER(COALESCE(registrationno, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(alumniname, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(personalemail, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(officialemail, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(facultyname, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(departmentname, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(degreetitle, '')) LIKE ${searchTerm}
          )
        ORDER BY alumniid DESC
        LIMIT ${limit} OFFSET ${offset}`;
    } else {
      query = sql/* sql */`
      SELECT
        alumniid,
        registrationno,
        sapid,
        alumniname,
        gender,
        maritalstatus,
        facultyname,
        campusname,
        departmentname,
        degreetitle,
        yearofstarting,
        yearofending,
        country,
        city,
        province,
        verify,
        employeed,
        industry,
        work_city,
        work_country,
        nameoforganization,
        designation,
        higher_education_institute_name,
        higher_education_program,
        is_scholarship,
        higher_education_institute_country,
        higher_education_institute_city,
        officialnumber,
        officialemail,
        personalemail,
        contactno,
        lasttimelogin,
        logincount,
        category
      FROM public.tbl_alumni
      WHERE ${baseWhere}
        ${verifyFilter}
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
        ${accessFilterCondition}
        ORDER BY alumniid DESC
        LIMIT ${limit} OFFSET ${offset}`;
    }

    const rows = await query;
    
    // Debug logging
    console.log("[API] Query executed with status:", status || "none", "Returned rows:", rows.length);
    if (status === "underApproval" && rows.length > 0) {
      console.log("[API] Under approval items - verify values:", rows.map((r: Record<string, unknown>) => ({ sapid: String(r.sapid ?? ""), verify: r.verify, verifyType: typeof r.verify })));
    } else if (status === "underApproval" && rows.length === 0) {
      console.log("[API] WARNING: No under approval items found! Checking database...");
      // Quick check to see if there are any 'pending' verify records
      const checkPending = await sql/* sql */`
        SELECT COUNT(*) as count FROM public.tbl_alumni 
        WHERE sapid IS NOT NULL AND sapid != '' AND verify = 'pending'
      `;
      console.log("[API] Total records with verify = 'pending' (exact match):", checkPending[0]?.count || 0);
      
      // Get sample records to see what's actually there
      const samplePendingRecords = await sql/* sql */`
        SELECT alumniid, sapid, registrationno, verify, LENGTH(verify) as verify_length
        FROM public.tbl_alumni 
        WHERE (sapid IS NOT NULL AND sapid != '' OR registrationno IS NOT NULL AND registrationno != '')
        AND verify = 'pending'
        ORDER BY alumniid DESC
        LIMIT 5
      `;
      console.log("[API] Sample records with verify = 'pending':", samplePendingRecords);
      
      // Check specifically for the recently registered alumni (ID 30714, SAP ID 123432)
      const checkSpecificAlumni = await sql/* sql */`
        SELECT alumniid, sapid, verify, LENGTH(verify) as verify_length, createddatetime
        FROM public.tbl_alumni 
        WHERE alumniid = 30714 OR sapid = '123432'
        LIMIT 5
      `;
      console.log("[API] Check for alumni ID 30714 or SAP ID 123432:", checkSpecificAlumni);
      
      // Get sample records with 'pending' to see what's actually stored
      const samplePending = await sql/* sql */`
        SELECT sapid, verify, LENGTH(verify) as verify_length, 
               TRIM(verify) as verify_trimmed,
               LOWER(TRIM(verify)) as verify_lower_trimmed
        FROM public.tbl_alumni 
        WHERE sapid IS NOT NULL AND sapid != '' 
        AND (verify = 'pending' OR LOWER(TRIM(COALESCE(verify, ''))) = 'pending')
        LIMIT 5
      `;
      console.log("[API] Sample records with 'pending':", samplePending);
      
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
      console.log("[API] Most recently registered alumni (last 10):", recentAlumni);
      
      // Check for case variations
      const checkCaseVariations = await sql/* sql */`
        SELECT verify, LENGTH(verify) as verify_length, COUNT(*) as count
        FROM public.tbl_alumni 
        WHERE sapid IS NOT NULL AND sapid != '' 
        AND (LOWER(verify) LIKE '%pending%' OR verify LIKE '%pending%')
        GROUP BY verify, LENGTH(verify)
        ORDER BY count DESC
        LIMIT 10
      `;
      console.log("[API] Records containing 'pending' (any case):", checkCaseVariations);
      
      // Also check what verify values actually exist
      const verifySamples = await sql/* sql */`
        SELECT verify, pg_typeof(verify) as verify_type, COUNT(*) as count
        FROM public.tbl_alumni 
        WHERE sapid IS NOT NULL AND sapid != ''
        GROUP BY verify, pg_typeof(verify)
        ORDER BY count DESC
        LIMIT 10
      `;
      console.log("[API] Sample verify values in database:", verifySamples);
    }
    
    // Get total count for pagination (only if needed)
    // IMPORTANT: Include all the same filters as the main query to get accurate filtered count
    const searchTermForCount = search && search.trim() ? `%${search.trim().toLowerCase()}%` : null;
    const countQuery = searchTermForCount
      ? sql/* sql */`
          SELECT COUNT(*) as total
          FROM public.tbl_alumni
          WHERE ${baseWhere}
            ${verifyFilter}
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
            ${accessFilterCondition}
            AND (
              LOWER(sapid) LIKE ${searchTermForCount}
              OR LOWER(COALESCE(registrationno, '')) LIKE ${searchTermForCount}
              OR LOWER(COALESCE(alumniname, '')) LIKE ${searchTermForCount}
              OR LOWER(COALESCE(personalemail, '')) LIKE ${searchTermForCount}
              OR LOWER(COALESCE(officialemail, '')) LIKE ${searchTermForCount}
              OR LOWER(COALESCE(facultyname, '')) LIKE ${searchTermForCount}
              OR LOWER(COALESCE(departmentname, '')) LIKE ${searchTermForCount}
            )`
          : sql/* sql */`
              SELECT COUNT(*) as total
              FROM public.tbl_alumni
              WHERE ${baseWhere}
                ${verifyFilter}
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
        
        console.log("[API] /api/alumni POST - Found existing record:", {
          alumniid: existingRecord.alumniid,
          verify: existingRecord.verify,
          registrationno: existingRecord.registrationno,
          sapid: existingRecord.sapid,
          cnicpassport: existingRecord.cnicpassport,
          contactno: existingRecord.contactno,
          personalemail: existingRecord.personalemail,
          officialemail: existingRecord.officialemail,
          matchedBy: matchedBy.length > 0 ? matchedBy.join(', ') : 'unknown',
          incomingIdentifiers: {
            regNo: regNo || null,
            sapId: sapId || null,
            cnic: cnic || null,
            phone: phone || null,
            personalEmail: personalEmail || null,
            officialEmail: officialEmail || null
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
      
      console.log("[API] /api/alumni POST - Verify status check:", {
        rawVerify,
        verifyStatus,
        isTrue: verifyStatus === "true",
        willBlock: verifyStatus === "true"
      });
      
      if (verifyStatus === "true") {
        console.log("[API] /api/alumni POST - BLOCKING: Alumni is verified (verify='true'), cannot re-register");
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
      // IMPORTANT: Always set verify = 'pending' when re-registering (regardless of payload)
      // IMPORTANT: Preserve identifier fields - if incoming value is missing, keep the existing value
      console.log("[API] /api/alumni POST - ALLOWING: Alumni exists but verify is not 'true', allowing re-registration:", {
        verify: rawVerify,
        verifyStatus,
        willUpdate: true,
        willSetVerifyToPending: true
      });
      
      const alumniId = existingRecord.alumniid;
      
      // Preserve identifier fields: if incoming value is missing, keep the existing value
      // This prevents losing any identifier when re-registering with only some identifiers
      const preservedRegNo = d.registrationno ?? existingRecord.registrationno;
      const preservedSapId = d.sapid ?? existingRecord.sapid;
      const preservedCnic = d.cnicpassport ?? existingRecord.cnicpassport;
      const preservedPhone = d.contactno ?? existingRecord.contactno;
      const preservedPersonalEmail = d.personalemail ?? existingRecord.personalemail;
      const preservedOfficialEmail = d.officialemail ?? existingRecord.officialemail;
      
      console.log("[API] /api/alumni POST - Preserving identifier fields:", {
        existing: {
          regNo: existingRecord.registrationno,
          sapId: existingRecord.sapid,
          cnic: existingRecord.cnicpassport,
          phone: existingRecord.contactno,
          personalEmail: existingRecord.personalemail,
          officialEmail: existingRecord.officialemail
        },
        incoming: {
          regNo: d.registrationno,
          sapId: d.sapid,
          cnic: d.cnicpassport,
          phone: d.contactno,
          personalEmail: d.personalemail,
          officialEmail: d.officialemail
        },
        preserved: {
          regNo: preservedRegNo,
          sapId: preservedSapId,
          cnic: preservedCnic,
          phone: preservedPhone,
          personalEmail: preservedPersonalEmail,
          officialEmail: preservedOfficialEmail
        }
      });
      
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
          verify = ${'pending'}, /* Always set verify = 'pending' for re-registration (Under Approval) */
          alumnistatus = ${d.alumnistatus},
          todaydate = ${d.todaydate}
        WHERE alumniid = ${alumniId}
        RETURNING alumniid, registrationno, sapid, verify
      `;
      
      const updated = updateResult[0];
      console.log("[API] /api/alumni POST - Updated existing record:", {
        alumniid: updated.alumniid,
        verify: updated.verify,
        previousVerify: existingRecord.verify
      });

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
    console.error("[API] Registration error:", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}