import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { canViewAlumni } from "@/lib/rbac";
import { buildAlumniPresenceBaseWhere } from "@/lib/master-filter-utils";

// Increase timeout for large exports (max 10 minutes for Node.js runtime)
export const maxDuration = 600;

export async function GET(req: Request) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admins, superadmins, and viewers can export (viewers have read-only access, export is a read operation)
    if (!canViewAlumni(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    
    // Get all values for multi-select filters
    const facultyParams = searchParams.getAll("faculty");
    const departmentParams = searchParams.getAll("department");
    const programParams = searchParams.getAll("program");
    const genderParams = searchParams.getAll("gender");
    const maritalStatusParams = searchParams.getAll("maritalStatus");
    const homeCountryParams = searchParams.getAll("homeCountry");
    const homeCityParams = searchParams.getAll("homeCity");
    const provinceParams = searchParams.getAll("province");
    const campusParams = searchParams.getAll("campus");
    const admissionYearParams = searchParams.getAll("admissionYear");
    const passingYearParams = searchParams.getAll("passingYear");
    const occupationStatusParams = searchParams.getAll("occupationStatus");
    const occupationTransitionTimingParams = searchParams.getAll("occupationTransitionTiming");
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
    const cnicPassportStateParams = searchParams.getAll("cnicPassportState");
    const selectedAlumniIdsParams = searchParams.getAll("selectedAlumniIds");
    const categoryParams = searchParams.getAll("category");
    
    const faculty = facultyParams.length > 0 ? facultyParams : (searchParams.get("faculty") || "");
    const department = departmentParams.length > 0 ? departmentParams : (searchParams.get("department") || "");
    const program = programParams.length > 0 ? programParams : (searchParams.get("program") || "");
    const gender = genderParams.length > 0 ? genderParams : (searchParams.get("gender") || "");
    const maritalStatus = maritalStatusParams.length > 0 ? maritalStatusParams : (searchParams.get("maritalStatus") || "");
    const homeCountry = homeCountryParams.length > 0 ? homeCountryParams : (searchParams.get("homeCountry") || "");
    const homeCity = homeCityParams.length > 0 ? homeCityParams : (searchParams.get("homeCity") || "");
    const province = provinceParams.length > 0 ? provinceParams : (searchParams.get("province") || "");
    const campus = campusParams.length > 0 ? campusParams : (searchParams.get("campus") || "");
    const admissionYear = admissionYearParams.length > 0 ? admissionYearParams : (searchParams.get("admissionYear") || "");
    const passingYear = passingYearParams.length > 0 ? passingYearParams : (searchParams.get("passingYear") || "");
    const occupationStatus = occupationStatusParams.length > 0 ? occupationStatusParams : (searchParams.get("occupationStatus") || "");
    const occupationTransitionTiming = occupationTransitionTimingParams.length > 0 ? occupationTransitionTimingParams : (searchParams.get("occupationTransitionTiming") || "");
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
    const cnicPassportState = cnicPassportStateParams.length > 0 ? cnicPassportStateParams : (searchParams.get("cnicPassportState") || "");
    const selectedAlumniIds = selectedAlumniIdsParams.length > 0 ? selectedAlumniIdsParams : (searchParams.get("selectedAlumniIds") || "");
    const category = categoryParams.length > 0 ? categoryParams : (searchParams.get("category") || "");

    // Build access filter for admin/viewer users
    const accessFilter = await buildAccessFilterSQL(session, "");
    const accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    
    // Helper function to combine OR conditions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const combineOrConditions = (conditions: any[]): any => {
      if (conditions.length === 0) return sql`1=0`;
      if (conditions.length === 1) return conditions[0];
      if (conditions.length === 2) return sql`${conditions[0]} OR ${conditions[1]}`;
      const mid = Math.ceil(conditions.length / 2);
      const left = combineOrConditions(conditions.slice(0, mid));
      const right = combineOrConditions(conditions.slice(mid));
      return sql`${left} OR ${right}`;
    };

    // Build WHERE clause for verify status filtering (including category-based tabs)
    let verifyFilter = sql``;
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
      verifyFilter = sql`AND (LOWER(TRIM(COALESCE(a.category, ''))) = 'a+' OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'a+%')`;
    } else if (status === "category:a") {
      verifyFilter = sql`AND (LOWER(TRIM(COALESCE(a.category, ''))) = 'a' OR (LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'a%' AND LOWER(TRIM(COALESCE(a.category, ''))) NOT LIKE 'a+%'))`;
    } else if (status === "category:b") {
      verifyFilter = sql`AND (LOWER(TRIM(COALESCE(a.category, ''))) = 'b' OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'b%')`;
    } else if (status === "category:c") {
      verifyFilter = sql`AND (LOWER(TRIM(COALESCE(a.category, ''))) = 'c' OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'c%')`;
    } else if (status === "category:d") {
      verifyFilter = sql`AND (LOWER(TRIM(COALESCE(a.category, ''))) = 'd' OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'd%')`;
    } else if (status === "medal:gold") {
      verifyFilter = sql`AND LOWER(TRIM(COALESCE(a.medal, ''))) = 'gold medalist'`;
    } else if (status === "medal:silver") {
      verifyFilter = sql`AND LOWER(TRIM(COALESCE(a.medal, ''))) = 'silver medalist'`;
    } else if (status === "medal:bronze") {
      verifyFilter = sql`AND LOWER(TRIM(COALESCE(a.medal, ''))) = 'bronze medalist'`;
    }

    const hasSapIdStateFilter = sapIdState && (Array.isArray(sapIdState) ? sapIdState.length > 0 : sapIdState);
    const hasRegNoStateFilter = regNoState && (Array.isArray(regNoState) ? regNoState.length > 0 : regNoState);
    const hasPersonalEmailStateFilter = personalEmailState && (Array.isArray(personalEmailState) ? personalEmailState.length > 0 : personalEmailState);
    const hasContactNoStateFilter = contactNoState && (Array.isArray(contactNoState) ? contactNoState.length > 0 : contactNoState);
    const hasCnicPassportStateFilter = cnicPassportState && (Array.isArray(cnicPassportState) ? cnicPassportState.length > 0 : cnicPassportState);
    const hasSelectedAlumniIdsFilter = selectedAlumniIds && (Array.isArray(selectedAlumniIds) ? selectedAlumniIds.length > 0 : selectedAlumniIds);
    const baseWhere = buildAlumniPresenceBaseWhere(searchParams);

    // Restrict export to selected alumni IDs (if provided)
    let selectedAlumniIdsFilter = sql``;
    if (hasSelectedAlumniIdsFilter) {
      const rawIds = Array.isArray(selectedAlumniIds) ? selectedAlumniIds : [selectedAlumniIds];
      const ids = rawIds
        .map((v) => {
          const n = Number(String(v).trim());
          return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
        })
        .filter((v): v is number => v !== null);

      if (ids.length > 0) {
        selectedAlumniIdsFilter = sql`AND a.alumniid = ANY(${ids})`;
      } else {
        selectedAlumniIdsFilter = sql`AND 1 = 0`;
      }
    }

    // Category filter (independent of status)
    // Supports both "category:aPlus"/"category:a" style and raw "a+","a","b","c","d","NULL"
    let categoryFilter = sql``;
    if (category && (Array.isArray(category) ? category.length > 0 : category)) {
      const buildSingleCategoryCondition = (raw: string): ReturnType<typeof sql> | null => {
        const value = String(raw).trim();
        const lower = value.toLowerCase();

        const isNull = lower === "null" || value === "NULL";
        const isAPlus =
          lower === "category:aplus" ||
          lower === "aplus" ||
          lower === "a+";
        const isA =
          lower === "category:a" ||
          lower === "a";
        const isB =
          lower === "category:b" ||
          lower === "b";
        const isC =
          lower === "category:c" ||
          lower === "c";
        const isD =
          lower === "category:d" ||
          lower === "d";

        if (isNull) {
          return sql`(a.category IS NULL OR TRIM(COALESCE(a.category, '')) = '')`;
        }
        if (isAPlus) {
          return sql`(LOWER(TRIM(COALESCE(a.category, ''))) = 'a+' OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'a+%')`;
        }
        if (isA) {
          return sql`(LOWER(TRIM(COALESCE(a.category, ''))) = 'a' OR (LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'a%' AND LOWER(TRIM(COALESCE(a.category, ''))) NOT LIKE 'a+%'))`;
        }
        if (isB) {
          return sql`(LOWER(TRIM(COALESCE(a.category, ''))) = 'b' OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'b%')`;
        }
        if (isC) {
          return sql`(LOWER(TRIM(COALESCE(a.category, ''))) = 'c' OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'c%')`;
        }
        if (isD) {
          return sql`(LOWER(TRIM(COALESCE(a.category, ''))) = 'd' OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'd%')`;
        }
        return null;
      };

      if (Array.isArray(category) && category.length > 0) {
        const categoryConditions: ReturnType<typeof sql>[] = [];
        category.forEach(c => {
          const cond = buildSingleCategoryCondition(c);
          if (cond) {
            categoryConditions.push(cond);
          }
        });
        if (categoryConditions.length > 0) {
          const combinedCondition = combineOrConditions(categoryConditions);
          categoryFilter = sql`AND (${combinedCondition})`;
        }
      } else if (!Array.isArray(category) && category) {
        const cond = buildSingleCategoryCondition(category);
        if (cond) {
          categoryFilter = sql`AND ${cond}`;
        }
      }
    }

    let searchCondition = sql``;
    if (search && search.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      searchCondition = sql`AND (
        LOWER(COALESCE(a.sapid, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(a.registrationno, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(a.alumniname, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(a.personalemail, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(a.officialemail, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(a.facultyname, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(a.departmentname, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(p.program_name, a.degreetitle, '')) LIKE ${searchTerm}
      )`;
    }
    
    // Build filters for faculty, department, program
    // IMPORTANT: Faculty/Department values come from /api/alumni/faculties and /api/alumni/departments
    // and are numeric IDs (or "NULL"). Programs come from /api/alumni/programs and map to a.degreetitle.
    let facultyFilter = sql``;
    if (faculty && (Array.isArray(faculty) ? faculty.length > 0 : faculty)) {
      if (Array.isArray(faculty) && faculty.length > 0) {
        const facultyConditions = faculty.map((fac) => {
          const normalized = String(fac).trim();
          if (normalized === "NULL" || normalized === "null") {
            return sql`(a.faculty IS NULL)`;
          }
          const id = Number.parseInt(normalized, 10);
          if (Number.isNaN(id)) return sql`1 = 0`;
          return sql`(a.faculty = ${id})`;
        });
        const combinedCondition = combineOrConditions(facultyConditions);
        facultyFilter = sql`AND (${combinedCondition})`;
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
        const departmentConditions = department.map((dept) => {
          const normalized = String(dept).trim();
          if (normalized === "NULL" || normalized === "null") {
            return sql`(a.department IS NULL)`;
          }
          const id = Number.parseInt(normalized, 10);
          if (Number.isNaN(id)) return sql`1 = 0`;
          return sql`(a.department = ${id})`;
        });
        const combinedCondition = combineOrConditions(departmentConditions);
        departmentFilter = sql`AND (${combinedCondition})`;
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
        const programConditions = program.map((prog) => {
          const normalized = String(prog).trim();
          if (normalized === "NULL" || normalized === "null") {
            return sql`(a.degreetitle IS NULL OR TRIM(COALESCE(a.degreetitle, '')) = '')`;
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
    
    // Gender filter
    let genderFilter = sql``;
    if (gender && (Array.isArray(gender) ? gender.length > 0 : gender)) {
      if (Array.isArray(gender) && gender.length > 0) {
        const genderConditions = gender.map(g => {
          const normalized = String(g).trim();
          if (normalized === "NULL" || normalized === "null") {
            return sql`(a.gender IS NULL OR TRIM(COALESCE(a.gender, '')) = '')`;
          }
          return sql`LOWER(TRIM(COALESCE(a.gender, ''))) = LOWER(TRIM(${g}))`;
        });
        const combinedCondition = combineOrConditions(genderConditions);
        genderFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(gender) && gender) {
        const normalized = String(gender).trim();
        if (normalized === "NULL" || normalized === "null") {
          genderFilter = sql`AND (a.gender IS NULL OR TRIM(COALESCE(a.gender, '')) = '')`;
        } else {
          genderFilter = sql`AND LOWER(TRIM(COALESCE(a.gender, ''))) = LOWER(TRIM(${gender}))`;
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
            return sql`(a.maritalstatus IS NULL OR TRIM(COALESCE(a.maritalstatus, '')) = '')`;
          }
          // Handle any other value - match exactly as stored in database (case-insensitive)
          return sql`LOWER(TRIM(COALESCE(a.maritalstatus, ''))) = LOWER(TRIM(${m}))`;
        });
        const combinedCondition = combineOrConditions(conditions);
        maritalStatusFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(maritalStatus) && maritalStatus) {
        const normalized = String(maritalStatus).trim();
        if (normalized === "NULL" || normalized === "null") {
          maritalStatusFilter = sql`AND (a.maritalstatus IS NULL OR TRIM(COALESCE(a.maritalstatus, '')) = '')`;
        } else {
          // Handle any other value - match exactly as stored in database (case-insensitive)
          maritalStatusFilter = sql`AND LOWER(TRIM(COALESCE(a.maritalstatus, ''))) = LOWER(TRIM(${maritalStatus}))`;
        }
      }
    }
    
    // Home Country filter
    let homeCountryFilter = sql``;
    if (homeCountry && (Array.isArray(homeCountry) ? homeCountry.length > 0 : homeCountry)) {
      if (Array.isArray(homeCountry) && homeCountry.length > 0) {
        const conditions = homeCountry.map(c => sql`LOWER(TRIM(COALESCE(a.country, ''))) = LOWER(TRIM(${c}))`);
        const combinedCondition = combineOrConditions(conditions);
        homeCountryFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(homeCountry) && homeCountry) {
        homeCountryFilter = sql`AND LOWER(TRIM(COALESCE(a.country, ''))) = LOWER(TRIM(${homeCountry}))`;
      }
    }
    
    // Home City filter
    let homeCityFilter = sql``;
    if (homeCity && (Array.isArray(homeCity) ? homeCity.length > 0 : homeCity)) {
      if (Array.isArray(homeCity) && homeCity.length > 0) {
        const conditions = homeCity.map(c => sql`LOWER(TRIM(COALESCE(a.city, ''))) = LOWER(TRIM(${c}))`);
        const combinedCondition = combineOrConditions(conditions);
        homeCityFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(homeCity) && homeCity) {
        homeCityFilter = sql`AND LOWER(TRIM(COALESCE(a.city, ''))) = LOWER(TRIM(${homeCity}))`;
      }
    }
    
    // Province filter
    let provinceFilter = sql``;
    if (province && (Array.isArray(province) ? province.length > 0 : province)) {
      if (Array.isArray(province) && province.length > 0) {
        const conditions = province.map(p => sql`LOWER(TRIM(COALESCE(a.province, ''))) = LOWER(TRIM(${p}))`);
        const combinedCondition = combineOrConditions(conditions);
        provinceFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(province) && province) {
        provinceFilter = sql`AND LOWER(TRIM(COALESCE(a.province, ''))) = LOWER(TRIM(${province}))`;
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
            return sql`(a.campusname IS NULL OR TRIM(COALESCE(a.campusname, '')) = '')`;
          }
          // Handle any other value - match exactly as stored in database (case-insensitive)
          return sql`LOWER(TRIM(COALESCE(a.campusname, ''))) = LOWER(TRIM(${c}))`;
        });
        const combinedCondition = combineOrConditions(conditions);
        campusFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(campus) && campus) {
        const normalized = String(campus).trim();
        if (normalized === "NULL" || normalized === "null") {
          campusFilter = sql`AND (a.campusname IS NULL OR TRIM(COALESCE(a.campusname, '')) = '')`;
        } else {
          campusFilter = sql`AND LOWER(TRIM(COALESCE(a.campusname, ''))) = LOWER(TRIM(${campus}))`;
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
          return sql`a.yearofstarting = ${year}`;
        });
        const combinedCondition = combineOrConditions(conditions);
        admissionYearFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(admissionYear) && admissionYear) {
        const year = parseInt(admissionYear, 10);
        if (!isNaN(year)) {
          admissionYearFilter = sql`AND a.yearofstarting = ${year}`;
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
          return sql`a.yearofending = ${year}`;
        });
        const combinedCondition = combineOrConditions(conditions);
        passingYearFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(passingYear) && passingYear) {
        const year = parseInt(passingYear, 10);
        if (!isNaN(year)) {
          passingYearFilter = sql`AND a.yearofending = ${year}`;
        }
      }
    }
    
    // Occupation Status filter
    let occupationStatusFilter = sql``;
    if (occupationStatus && (Array.isArray(occupationStatus) ? occupationStatus.length > 0 : occupationStatus)) {
      const statusArray = Array.isArray(occupationStatus) ? occupationStatus : [occupationStatus];
      const conditions: ReturnType<typeof sql>[] = [];
      
      statusArray.forEach(status => {
        const normalized = String(status).trim();
        // Handle NULL values (from dropdown, value is "NULL" but label is "Null")
        if (normalized === "NULL" || normalized === "null") {
          conditions.push(sql`(a.employeed IS NULL OR TRIM(COALESCE(a.employeed, '')) = '')`);
        } else {
          const lower = normalized.toLowerCase();
          if (lower === "employed" || lower === "employed/business") {
            conditions.push(sql`(LOWER(TRIM(COALESCE(a.employeed, ''))) = 'employed/business' OR LOWER(TRIM(COALESCE(a.employeed, ''))) = 'employed')`);
          } else if (lower === "self-employed/enterpreneur") {
            conditions.push(sql`(LOWER(TRIM(COALESCE(a.employeed, ''))) = 'self-employed/enterpreneur' OR LOWER(TRIM(COALESCE(a.employeed, ''))) = 'self-emplo' OR LOWER(TRIM(COALESCE(a.employeed, ''))) = 'self-employed')`);
          } else if (lower === "pursuing higher education") {
            conditions.push(sql`(LOWER(TRIM(COALESCE(a.employeed, ''))) = 'pursuing higher education' OR LOWER(TRIM(COALESCE(a.employeed, ''))) = 'highered')`);
          } else {
            conditions.push(sql`LOWER(TRIM(COALESCE(a.employeed, ''))) = LOWER(TRIM(${status}))`);
          }
        }
      });
      
      if (conditions.length > 0) {
        const combinedCondition = combineOrConditions(conditions);
        occupationStatusFilter = sql`AND (${combinedCondition})`;
      }
    }

    let occupationTransitionTimingFilter = sql``;
    if (occupationTransitionTiming && (Array.isArray(occupationTransitionTiming) ? occupationTransitionTiming.length > 0 : occupationTransitionTiming)) {
      const timingArray = Array.isArray(occupationTransitionTiming) ? occupationTransitionTiming : [occupationTransitionTiming];
      const conditions: ReturnType<typeof sql>[] = [];

      timingArray.forEach((v) => {
        const normalized = String(v).trim();
        if (normalized === "NULL" || normalized === "null") {
          conditions.push(sql`(a.occupation_transition_timing IS NULL OR TRIM(COALESCE(a.occupation_transition_timing, '')) = '')`);
        } else {
          conditions.push(sql`LOWER(TRIM(COALESCE(a.occupation_transition_timing, ''))) = LOWER(TRIM(${v}))`);
        }
      });

      if (conditions.length > 0) {
        const combinedCondition = combineOrConditions(conditions);
        occupationTransitionTimingFilter = sql`AND (${combinedCondition})`;
      }
    }
    
    // Sector filter (partial matching with LIKE for text input)
    let sectorFilter = sql``;
    if (sector && (Array.isArray(sector) ? sector.length > 0 : sector)) {
      if (Array.isArray(sector) && sector.length > 0) {
        const conditions = sector.map(s => {
          const searchTerm = `%${String(s).trim().toLowerCase()}%`;
          return sql`LOWER(TRIM(COALESCE(a.industry, ''))) LIKE ${searchTerm}`;
        });
        const combinedCondition = combineOrConditions(conditions);
        sectorFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(sector) && sector) {
        const searchTerm = `%${String(sector).trim().toLowerCase()}%`;
        sectorFilter = sql`AND LOWER(TRIM(COALESCE(a.industry, ''))) LIKE ${searchTerm}`;
      }
    }
    
    // Work City filter
    let workCityFilter = sql``;
    if (workCity && (Array.isArray(workCity) ? workCity.length > 0 : workCity)) {
      if (Array.isArray(workCity) && workCity.length > 0) {
        const conditions = workCity.map(w => sql`LOWER(TRIM(COALESCE(a.work_city, ''))) = LOWER(TRIM(${w}))`);
        const combinedCondition = combineOrConditions(conditions);
        workCityFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(workCity) && workCity) {
        workCityFilter = sql`AND LOWER(TRIM(COALESCE(a.work_city, ''))) = LOWER(TRIM(${workCity}))`;
      }
    }
    
    // Work Country filter
    let workCountryFilter = sql``;
    if (workCountry && (Array.isArray(workCountry) ? workCountry.length > 0 : workCountry)) {
      if (Array.isArray(workCountry) && workCountry.length > 0) {
        const conditions = workCountry.map(w => sql`LOWER(TRIM(COALESCE(a.work_country, ''))) = LOWER(TRIM(${w}))`);
        const combinedCondition = combineOrConditions(conditions);
        workCountryFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(workCountry) && workCountry) {
        workCountryFilter = sql`AND LOWER(TRIM(COALESCE(a.work_country, ''))) = LOWER(TRIM(${workCountry}))`;
      }
    }

    // Employer filter
    let employerFilter = sql``;
    if (employer && (Array.isArray(employer) ? employer.length > 0 : employer)) {
      if (Array.isArray(employer) && employer.length > 0) {
        const conditions = employer.map(e => {
          const normalized = String(e).trim();
          if (normalized === "NULL" || normalized === "null") {
            return sql`(a.nameoforganization IS NULL OR TRIM(COALESCE(a.nameoforganization, '')) = '')`;
          }
          return sql`LOWER(TRIM(COALESCE(a.nameoforganization, ''))) = LOWER(TRIM(${e}))`;
        });
        const combinedCondition = combineOrConditions(conditions);
        employerFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(employer) && employer) {
        const normalized = String(employer).trim();
        if (normalized === "NULL" || normalized === "null") {
          employerFilter = sql`AND (a.nameoforganization IS NULL OR TRIM(COALESCE(a.nameoforganization, '')) = '')`;
        } else {
          employerFilter = sql`AND LOWER(TRIM(COALESCE(a.nameoforganization, ''))) = LOWER(TRIM(${employer}))`;
        }
      }
    }
    
    // Institution Name filter
    let institutionNameFilter = sql``;
    if (institutionName && (Array.isArray(institutionName) ? institutionName.length > 0 : institutionName)) {
      if (Array.isArray(institutionName) && institutionName.length > 0) {
        const conditions = institutionName.map(i => sql`LOWER(TRIM(COALESCE(a.higher_education_institute_name, ''))) = LOWER(TRIM(${i}))`);
        const combinedCondition = combineOrConditions(conditions);
        institutionNameFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(institutionName) && institutionName) {
        institutionNameFilter = sql`AND LOWER(TRIM(COALESCE(a.higher_education_institute_name, ''))) = LOWER(TRIM(${institutionName}))`;
      }
    }
    
    // Program Enrolled filter
    let programEnrolledFilter = sql``;
    if (programEnrolled && (Array.isArray(programEnrolled) ? programEnrolled.length > 0 : programEnrolled)) {
      if (Array.isArray(programEnrolled) && programEnrolled.length > 0) {
        const conditions = programEnrolled.map(p => sql`LOWER(TRIM(COALESCE(a.higher_education_program, ''))) = LOWER(TRIM(${p}))`);
        const combinedCondition = combineOrConditions(conditions);
        programEnrolledFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(programEnrolled) && programEnrolled) {
        programEnrolledFilter = sql`AND LOWER(TRIM(COALESCE(a.higher_education_program, ''))) = LOWER(TRIM(${programEnrolled}))`;
      }
    }
    
    // Funding Source filter
    let fundingSourceFilter = sql``;
    if (fundingSource && (Array.isArray(fundingSource) ? fundingSource.length > 0 : fundingSource)) {
      if (Array.isArray(fundingSource) && fundingSource.length > 0) {
        const conditions = fundingSource.map(f => sql`LOWER(TRIM(COALESCE(a.is_scholarship, ''))) = LOWER(TRIM(${f}))`);
        const combinedCondition = combineOrConditions(conditions);
        fundingSourceFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(fundingSource) && fundingSource) {
        fundingSourceFilter = sql`AND LOWER(TRIM(COALESCE(a.is_scholarship, ''))) = LOWER(TRIM(${fundingSource}))`;
      }
    }
    
    // Institution Country filter
    let institutionCountryFilter = sql``;
    if (institutionCountry && (Array.isArray(institutionCountry) ? institutionCountry.length > 0 : institutionCountry)) {
      if (Array.isArray(institutionCountry) && institutionCountry.length > 0) {
        const conditions = institutionCountry.map(i => sql`LOWER(TRIM(COALESCE(a.higher_education_institute_country, ''))) = LOWER(TRIM(${i}))`);
        const combinedCondition = combineOrConditions(conditions);
        institutionCountryFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(institutionCountry) && institutionCountry) {
        institutionCountryFilter = sql`AND LOWER(TRIM(COALESCE(a.higher_education_institute_country, ''))) = LOWER(TRIM(${institutionCountry}))`;
      }
    }
    
    // Institution City filter
    let institutionCityFilter = sql``;
    if (institutionCity && (Array.isArray(institutionCity) ? institutionCity.length > 0 : institutionCity)) {
      if (Array.isArray(institutionCity) && institutionCity.length > 0) {
        const conditions = institutionCity.map(i => sql`LOWER(TRIM(COALESCE(a.higher_education_institute_city, ''))) = LOWER(TRIM(${i}))`);
        const combinedCondition = combineOrConditions(conditions);
        institutionCityFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(institutionCity) && institutionCity) {
        institutionCityFilter = sql`AND LOWER(TRIM(COALESCE(a.higher_education_institute_city, ''))) = LOWER(TRIM(${institutionCity}))`;
      }
    }
    
    // Photo Consent filter
    let photoConsentFilter = sql``;
    if (photoConsent && (Array.isArray(photoConsent) ? photoConsent.length > 0 : photoConsent)) {
      if (Array.isArray(photoConsent) && photoConsent.length > 0) {
        const conditions = photoConsent.map(c => {
          const normalized = String(c).trim();
          if (normalized === "NULL" || normalized === "null") {
            return sql`(a.alumni_consent_pic IS NULL)`;
          } else if (normalized === "Allowed" || normalized === "allowed") {
            return sql`a.alumni_consent_pic = true`;
          } else if (normalized === "Not Allowed" || normalized === "not allowed" || normalized === "NotAllowed") {
            return sql`a.alumni_consent_pic = false`;
          }
          return sql`(a.alumni_consent_pic IS NULL)`;
        });
        const combinedCondition = combineOrConditions(conditions);
        photoConsentFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(photoConsent) && photoConsent) {
        const normalized = String(photoConsent).trim();
        if (normalized === "NULL" || normalized === "null") {
          photoConsentFilter = sql`AND (a.alumni_consent_pic IS NULL)`;
        } else if (normalized === "Allowed" || normalized === "allowed") {
          photoConsentFilter = sql`AND a.alumni_consent_pic = true`;
        } else if (normalized === "Not Allowed" || normalized === "not allowed" || normalized === "NotAllowed") {
          photoConsentFilter = sql`AND a.alumni_consent_pic = false`;
        } else {
          photoConsentFilter = sql`AND (a.alumni_consent_pic IS NULL)`;
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
            return sql`(a.registrationno IS NULL OR TRIM(COALESCE(a.registrationno, '')) = '')`;
          }
          return sql`LOWER(TRIM(COALESCE(a.registrationno, ''))) = LOWER(TRIM(${m}))`;
        });
        const combinedCondition = combineOrConditions(conditions);
        mrNoFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(mrNo) && mrNo) {
        const normalized = String(mrNo).trim();
        if (normalized === "NULL" || normalized === "null") {
          mrNoFilter = sql`AND (a.registrationno IS NULL OR TRIM(COALESCE(a.registrationno, '')) = '')`;
        } else {
          mrNoFilter = sql`AND LOWER(TRIM(COALESCE(a.registrationno, ''))) = LOWER(TRIM(${mrNo}))`;
        }
      }
    }

    // SAP ID state filter (NULL/EXISTS)
    let sapIdStateFilter = sql``;
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
        } else if (normalized === "DUPLICATE") {
          return sql`(
            a.sapid IS NOT NULL
            AND TRIM(COALESCE(a.sapid, '')) != ''
            AND LOWER(TRIM(COALESCE(a.sapid, ''))) != 'null'
            AND EXISTS (
              SELECT 1
              FROM public.tbl_alumni a2
              WHERE a2.alumniid != a.alumniid
                AND LOWER(TRIM(COALESCE(a2.sapid, ''))) = LOWER(TRIM(COALESCE(a.sapid, '')))
                AND TRIM(COALESCE(a2.sapid, '')) != ''
                AND LOWER(TRIM(COALESCE(a2.sapid, ''))) != 'null'
            )
          )`;
        }
        return sql`1 = 0`;
      });
      const combinedCondition = combineOrConditions(conditions);
      sapIdStateFilter = sql`AND (${combinedCondition})`;
    }

    // Registration No state filter (NULL/EXISTS)
    let regNoStateFilter = sql``;
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
        } else if (normalized === "DUPLICATE") {
          return sql`(
            a.registrationno IS NOT NULL
            AND TRIM(COALESCE(a.registrationno, '')) != ''
            AND LOWER(TRIM(COALESCE(a.registrationno, ''))) != 'null'
            AND EXISTS (
              SELECT 1
              FROM public.tbl_alumni a2
              WHERE a2.alumniid != a.alumniid
                AND LOWER(TRIM(COALESCE(a2.registrationno, ''))) = LOWER(TRIM(COALESCE(a.registrationno, '')))
                AND TRIM(COALESCE(a2.registrationno, '')) != ''
                AND LOWER(TRIM(COALESCE(a2.registrationno, ''))) != 'null'
            )
          )`;
        }
        return sql`1 = 0`;
      });
      const combinedCondition = combineOrConditions(conditions);
      regNoStateFilter = sql`AND (${combinedCondition})`;
    }

    // Personal Email state filter (NULL/EXISTS)
    let personalEmailStateFilter = sql``;
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
        } else if (normalized === "DUPLICATE") {
          return sql`(
            a.personalemail IS NOT NULL
            AND TRIM(COALESCE(a.personalemail, '')) != ''
            AND LOWER(TRIM(COALESCE(a.personalemail, ''))) != 'null'
            AND EXISTS (
              SELECT 1
              FROM public.tbl_alumni a2
              WHERE a2.alumniid != a.alumniid
                AND LOWER(TRIM(COALESCE(a2.personalemail, ''))) = LOWER(TRIM(COALESCE(a.personalemail, '')))
                AND TRIM(COALESCE(a2.personalemail, '')) != ''
                AND LOWER(TRIM(COALESCE(a2.personalemail, ''))) != 'null'
            )
          )`;
        }
        return sql`1 = 0`;
      });
      const combinedCondition = combineOrConditions(conditions);
      personalEmailStateFilter = sql`AND (${combinedCondition})`;
    }

    // Contact No state filter (NULL/EXISTS)
    let contactNoStateFilter = sql``;
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
        } else if (normalized === "DUPLICATE") {
          return sql`(
            a.contactno IS NOT NULL
            AND TRIM(COALESCE(a.contactno, '')) != ''
            AND LOWER(TRIM(COALESCE(a.contactno, ''))) != 'null'
            AND EXISTS (
              SELECT 1
              FROM public.tbl_alumni a2
              WHERE a2.alumniid != a.alumniid
                AND LOWER(TRIM(COALESCE(a2.contactno, ''))) = LOWER(TRIM(COALESCE(a.contactno, '')))
                AND TRIM(COALESCE(a2.contactno, '')) != ''
                AND LOWER(TRIM(COALESCE(a2.contactno, ''))) != 'null'
            )
          )`;
        }
        return sql`1 = 0`;
      });
      const combinedCondition = combineOrConditions(conditions);
      contactNoStateFilter = sql`AND (${combinedCondition})`;
    }

    // CNIC/Passport state filter (NULL/EXISTS/DUPLICATE)
    let cnicPassportStateFilter = sql``;
    if (hasCnicPassportStateFilter) {
      const states = Array.isArray(cnicPassportState) ? cnicPassportState : [cnicPassportState];
      const conditions = states.map(s => {
        const normalized = String(s).trim().toUpperCase();
        if (normalized === "NULL") {
          return sql`(
            (
              a.cnicpassport IS NULL
              OR TRIM(COALESCE(a.cnicpassport, '')) = ''
              OR LOWER(TRIM(COALESCE(a.cnicpassport, ''))) = 'null'
            )
          )`;
        } else if (normalized === "EXISTS") {
          return sql`(
            a.cnicpassport IS NOT NULL
            AND TRIM(COALESCE(a.cnicpassport, '')) != ''
            AND LOWER(TRIM(COALESCE(a.cnicpassport, ''))) != 'null'
          )`;
        } else if (normalized === "DUPLICATE") {
          return sql`(
            a.cnicpassport IS NOT NULL
            AND TRIM(COALESCE(a.cnicpassport, '')) != ''
            AND LOWER(TRIM(COALESCE(a.cnicpassport, ''))) != 'null'
            AND EXISTS (
              SELECT 1
              FROM public.tbl_alumni a2
              WHERE a2.alumniid != a.alumniid
                AND LOWER(TRIM(COALESCE(a2.cnicpassport, ''))) = LOWER(TRIM(COALESCE(a.cnicpassport, '')))
                AND TRIM(COALESCE(a2.cnicpassport, '')) != ''
                AND LOWER(TRIM(COALESCE(a2.cnicpassport, ''))) != 'null'
            )
          )`;
        }
        return sql`1 = 0`;
      });
      const combinedCondition = combineOrConditions(conditions);
      cnicPassportStateFilter = sql`AND (${combinedCondition})`;
    }

    // Fetch ALL fields from tbl_alumni with related data
    const query = sql/* sql */`
      SELECT 
        a.*,
        -- Prefer ID-based names when available, fall back to legacy text columns
        COALESCE(f.faculty_name, a.facultyname) AS facultyname,
        COALESCE(d.department_name, a.departmentname) AS departmentname,
        COALESCE(p.program_name, a.degreetitle) AS degreetitle,
        p.program_name,
        -- Chapter data
        ac.chapter1 as chapter1_id,
        ac.chapter2 as chapter2_id,
        ac.chapter3 as chapter3_id,
        ac.remarks as chapter_remarks,
        c1.national_chapter as chapter1_national,
        c1.international_chapter as chapter1_international,
        c2.national_chapter as chapter2_national,
        c2.international_chapter as chapter2_international,
        c3.national_chapter as chapter3_national,
        c3.international_chapter as chapter3_international,
        -- Association data
        assoc.id as association_id_value,
        assoc.faculty_name as association_title,
        NULL::text as association_description,
        NULL::text as association_dean,
        NULL::text as association_phone,
        NULL::text as association_email,
        NULL::text as association_address,
        -- Chapter Leadership data
        cl.id as chapter_leadership_id,
        cl.post as chapter_leadership_post,
        cl.status as chapter_leadership_status,
        cl.rejection_reason as chapter_leadership_rejection_reason,
        cl.created_at as chapter_leadership_created_at,
        cl.updated_at as chapter_leadership_updated_at,
        -- Membership data
        am.gym_membership_month,
        am.swimmingpool_membership_month,
        am.created_at as membership_created_at,
        -- Scholarship data
        asch.kinship_firstname,
        asch.kinship_lastname,
        asch.kinship_cnic,
        asch.apply_for,
        asch.degree_title as scholarship_degree_title,
        asch.created_at as scholarship_created_at
      FROM public.tbl_alumni a
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      LEFT JOIN public.tbl_departments d ON d.id = a.department
      LEFT JOIN public.tbl_programs p ON p.id = a.program
      LEFT JOIN public.alumni_chapter ac ON ac.id = a.alumniid
      LEFT JOIN public.tblchapters c1 ON c1.id = ac.chapter1
      LEFT JOIN public.tblchapters c2 ON c2.id = ac.chapter2
      LEFT JOIN public.tblchapters c3 ON c3.id = ac.chapter3
      LEFT JOIN public.tbl_faculties assoc ON assoc.id = a.association_id
      LEFT JOIN public.chapter_leadership cl ON cl.id = a.chapter_leadership
      LEFT JOIN public.alumni_memberships am ON am.alumniid = a.alumniid
      LEFT JOIN public.alumni_scholarships asch ON asch.id = a.alumniid
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
        ${occupationTransitionTimingFilter}
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
        ${cnicPassportStateFilter}
        ${selectedAlumniIdsFilter}
        ${accessFilterCondition}
        ${searchCondition}
      ORDER BY a.alumniid DESC
    `;

    const startTime = Date.now();
    
    // Execute the main query
    const rows = await query;
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Log large exports for monitoring but return all data
    if (rows.length > 50000) {

    }
    
    // Return response with headers to help with long-running requests
    return NextResponse.json(
      { items: rows }, 
      { 
        status: 200,
        headers: {
          'Connection': 'keep-alive',
          'Keep-Alive': 'timeout=600',
          'X-Content-Type-Options': 'nosniff',
        }
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to export alumni data";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

