import { NextResponse } from "next/server";
import { sql, retryDbOperation } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    // Get all values for multi-select filters
    const facultyParams = searchParams.getAll("faculty");
    const departmentParams = searchParams.getAll("department");
    const programParams = searchParams.getAll("program");
    const faculty = facultyParams.length > 0 ? facultyParams : (searchParams.get("faculty") || "");
    const department = departmentParams.length > 0 ? departmentParams : (searchParams.get("department") || "");
    const program = programParams.length > 0 ? programParams : (searchParams.get("program") || "");
    
    // Additional master filters (same as main route)
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
    
    const searchTerm = search && search.trim() ? `%${search.trim().toLowerCase()}%` : null;

    // Build access filter for admin/viewer users
    const accessFilter = await buildAccessFilterSQL(session, "");
    
    // Debug logging
    console.log("[alumni/counts] Access filter:", {
      hasFilter: accessFilter.hasFilter,
      isSuperAdmin: !accessFilter.hasFilter
    });
    
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
        const facultyConditions = faculty.map(f => sql`LOWER(TRIM(COALESCE(facultyname, ''))) = LOWER(TRIM(${f}))`);
        const combinedCondition = combineOrConditions(facultyConditions);
        facultyFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(faculty) && faculty) {
        facultyFilter = sql`AND LOWER(TRIM(COALESCE(facultyname, ''))) = LOWER(TRIM(${faculty}))`;
      }
      console.log("[alumni/counts] Filtering for faculty:", faculty);
    }
    
    let departmentFilter = sql``;
    if (department && (Array.isArray(department) ? department.length > 0 : department)) {
      if (Array.isArray(department) && department.length > 0) {
        const departmentConditions = department.map(d => sql`LOWER(TRIM(COALESCE(departmentname, ''))) = LOWER(TRIM(${d}))`);
        const combinedCondition = combineOrConditions(departmentConditions);
        departmentFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(department) && department) {
        departmentFilter = sql`AND LOWER(TRIM(COALESCE(departmentname, ''))) = LOWER(TRIM(${department}))`;
      }
      console.log("[alumni/counts] Filtering for department:", department);
    }
    
    let programFilter = sql``;
    if (program && (Array.isArray(program) ? program.length > 0 : program)) {
      if (Array.isArray(program) && program.length > 0) {
        const programConditions = program.map(p => sql`LOWER(TRIM(COALESCE(degreetitle, ''))) = LOWER(TRIM(${p}))`);
        const combinedCondition = combineOrConditions(programConditions);
        programFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(program) && program) {
        programFilter = sql`AND LOWER(TRIM(COALESCE(degreetitle, ''))) = LOWER(TRIM(${program}))`;
      }
      console.log("[alumni/counts] Filtering for program:", program);
    }
    
    // Build additional master filters (same pattern as main route)
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

    // Verify field is now VARCHAR(10) - handle as string only
    let result;
    
    if (searchTerm) {
      result = await retryDbOperation(async () => await sql/* sql */`
        SELECT 
          COUNT(*) as total,
          -- Verified: verify = 'true' (string)
          COUNT(CASE 
            WHEN LOWER(COALESCE(verify, '')) = 'true' 
            THEN 1 
          END) as verified,
          -- Unverified: verify = 'false' (string)
          COUNT(CASE 
            WHEN LOWER(COALESCE(verify, '')) = 'false' 
            THEN 1 
          END) as unverified,
          -- Under Approval: verify = 'pending' (new registrations awaiting admin approval)
          COUNT(CASE 
            WHEN verify = 'pending'
            THEN 1 
          END) as under_approval,
          -- Active: has logged in
          COUNT(CASE 
            WHEN (lasttimelogin IS NOT NULL AND lasttimelogin != '') 
            OR (logincount IS NOT NULL AND logincount > 0) 
            THEN 1 
          END) as active,
          -- Inactive: never logged in
          COUNT(CASE 
            WHEN (lasttimelogin IS NULL OR lasttimelogin = '') 
            AND (logincount IS NULL OR logincount = 0) 
            THEN 1 
          END) as inactive,
          -- Category counts
          COUNT(CASE 
            WHEN LOWER(TRIM(COALESCE(category, ''))) = 'a+' 
               OR LOWER(TRIM(COALESCE(category, ''))) LIKE 'a+%'
            THEN 1 
          END) as category_a_plus,
          COUNT(CASE 
            WHEN (LOWER(TRIM(COALESCE(category, ''))) = 'a' 
               OR (LOWER(TRIM(COALESCE(category, ''))) LIKE 'a%' 
               AND LOWER(TRIM(COALESCE(category, ''))) NOT LIKE 'a+%'))
            THEN 1 
          END) as category_a,
          COUNT(CASE 
            WHEN LOWER(TRIM(COALESCE(category, ''))) = 'b' 
               OR LOWER(TRIM(COALESCE(category, ''))) LIKE 'b%'
            THEN 1 
          END) as category_b,
          COUNT(CASE 
            WHEN LOWER(TRIM(COALESCE(category, ''))) = 'c' 
               OR LOWER(TRIM(COALESCE(category, ''))) LIKE 'c%'
            THEN 1 
          END) as category_c
        FROM public.tbl_alumni
        WHERE (sapid IS NOT NULL AND sapid != '' OR registrationno IS NOT NULL AND registrationno != '')
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
      `);
    } else {
      result = await retryDbOperation(async () => await sql/* sql */`
        SELECT 
          COUNT(*) as total,
          -- Verified: verify = 'true' (string)
          COUNT(CASE 
            WHEN LOWER(COALESCE(verify, '')) = 'true' 
            THEN 1 
          END) as verified,
          -- Unverified: verify = 'false' (string)
          COUNT(CASE 
            WHEN LOWER(COALESCE(verify, '')) = 'false' 
            THEN 1 
          END) as unverified,
          -- Under Approval: verify = 'pending' (new registrations awaiting admin approval)
          COUNT(CASE 
            WHEN verify = 'pending'
            THEN 1 
          END) as under_approval,
          -- Active: has logged in
          COUNT(CASE 
            WHEN (lasttimelogin IS NOT NULL AND lasttimelogin != '') 
            OR (logincount IS NOT NULL AND logincount > 0) 
            THEN 1 
          END) as active,
          -- Inactive: never logged in
          COUNT(CASE 
            WHEN (lasttimelogin IS NULL OR lasttimelogin = '') 
            AND (logincount IS NULL OR logincount = 0) 
            THEN 1 
          END) as inactive,
          -- Category counts
          COUNT(CASE 
            WHEN LOWER(TRIM(COALESCE(category, ''))) = 'a+' 
               OR LOWER(TRIM(COALESCE(category, ''))) LIKE 'a+%'
            THEN 1 
          END) as category_a_plus,
          COUNT(CASE 
            WHEN (LOWER(TRIM(COALESCE(category, ''))) = 'a' 
               OR (LOWER(TRIM(COALESCE(category, ''))) LIKE 'a%' 
               AND LOWER(TRIM(COALESCE(category, ''))) NOT LIKE 'a+%'))
            THEN 1 
          END) as category_a,
          COUNT(CASE 
            WHEN LOWER(TRIM(COALESCE(category, ''))) = 'b' 
               OR LOWER(TRIM(COALESCE(category, ''))) LIKE 'b%'
            THEN 1 
          END) as category_b,
          COUNT(CASE 
            WHEN LOWER(TRIM(COALESCE(category, ''))) = 'c' 
               OR LOWER(TRIM(COALESCE(category, ''))) LIKE 'c%'
            THEN 1 
          END) as category_c
        FROM public.tbl_alumni
        WHERE (sapid IS NOT NULL AND sapid != '' OR registrationno IS NOT NULL AND registrationno != '' OR verify = 'pending')
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
      `);
    }

    const row = result[0] as {
      total: number | string | bigint;
      verified: number | string | bigint;
      unverified: number | string | bigint;
      under_approval: number | string | bigint;
      active: number | string | bigint;
      inactive: number | string | bigint;
      category_a_plus?: number | string | bigint;
      category_a?: number | string | bigint;
      category_b?: number | string | bigint;
      category_c?: number | string | bigint;
    } | undefined;

    if (!row) {
      return NextResponse.json({
        total: 0,
        verified: 0,
        unverified: 0,
        underApproval: 0,
        active: 0,
        inactive: 0,
        category: { aPlus: 0, a: 0, b: 0, c: 0 },
      }, { status: 200 });
    }

    // Convert to numbers
    const response = {
      total: Number(row.total || 0),
      verified: Number(row.verified || 0),
      unverified: Number(row.unverified || 0),
      underApproval: Number(row.under_approval || 0),
      active: Number(row.active || 0),
      inactive: Number(row.inactive || 0),
      category: {
        aPlus: Number(row.category_a_plus || 0),
        a: Number(row.category_a || 0),
        b: Number(row.category_b || 0),
        c: Number(row.category_c || 0),
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error("[API] Error fetching counts:", err);
    
    // Check for connection timeout errors
    const isConnectionError = err instanceof Error && (
      err.message.includes('CONNECT_TIMEOUT') ||
      err.message.includes('ETIMEDOUT') ||
      err.message.includes('timeout') ||
      (err as Error & { code?: string }).code === 'CONNECT_TIMEOUT' ||
      (err as Error & { code?: string }).code === 'ETIMEDOUT'
    );
    
    if (isConnectionError) {
      return NextResponse.json({ 
        error: "Database connection timeout. Please try again in a moment.",
        retryable: true
      }, { status: 503 }); // Service Unavailable
    }
    
    const message = err instanceof Error ? err.message : "Failed to fetch counts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
