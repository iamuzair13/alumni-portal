/**
 * Utility functions for building dynamic filter SQL conditions for master filters
 * These filters are used to dynamically update filter counts based on other selected filters
 */

import { sql } from "@/lib/dbconnect";

// Helper function to combine SQL conditions with OR
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const combineOrConditions = (conditions: any[]): any => {
  if (conditions.length === 0) return sql``;
  if (conditions.length === 1) return conditions[0];
  if (conditions.length === 2) return sql`${conditions[0]} OR ${conditions[1]}`;
  const mid = Math.ceil(conditions.length / 2);
  const left = combineOrConditions(conditions.slice(0, mid));
  const right = combineOrConditions(conditions.slice(mid));
  return sql`${left} OR ${right}`;
};

/**
 * Build all master filter SQL conditions from search params
 * Excludes the field being queried (excludeField) to avoid circular filtering
 */
export function buildMasterFilterConditions(
  searchParams: URLSearchParams,
  excludeField?: string
): ReturnType<typeof sql> {
  const filterConditions: ReturnType<typeof sql>[] = [];

  // Helper to get array or single value from search params
  const getFilterValue = (key: string): string[] | string | null => {
    const params = searchParams.getAll(key);
    return params.length > 0 ? params : (searchParams.get(key) || null);
  };

  // Status filter (verify status - verified, unverified, underApproval, active, inactive, category:aPlus, category:a, category:b, category:c)
  const status = getFilterValue("status");
  if (status && (Array.isArray(status) ? status.length > 0 : status)) {
    const statuses = Array.isArray(status) ? status : [status];
    const statusConditions: ReturnType<typeof sql>[] = [];
    
    statuses.forEach(s => {
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
      }
    });
    
    if (statusConditions.length > 0) {
      filterConditions.push(sql`(${combineOrConditions(statusConditions)})`);
    }
  }

  // Faculty filter (exclude if querying faculties)
  if (excludeField !== "faculty") {
    const faculty = getFilterValue("faculty");
    if (faculty && (Array.isArray(faculty) ? faculty.length > 0 : faculty)) {
      if (Array.isArray(faculty) && faculty.length > 0) {
        const conditions = faculty.map((f) => {
          const normalized = String(f).trim();
          if (normalized === "NULL" || normalized === "null") {
            return sql`(faculty IS NULL)`;
          }
          const id = Number.parseInt(normalized, 10);
          if (Number.isNaN(id)) return sql`1 = 0`;
          return sql`(faculty = ${id})`;
        });
        filterConditions.push(sql`(${combineOrConditions(conditions)})`);
      } else if (!Array.isArray(faculty) && faculty) {
        const normalized = String(faculty).trim();
        if (normalized === "NULL" || normalized === "null") {
          filterConditions.push(sql`(faculty IS NULL)`);
        } else {
          const id = Number.parseInt(normalized, 10);
          if (!Number.isNaN(id)) {
            filterConditions.push(sql`(faculty = ${id})`);
          } else {
            filterConditions.push(sql`1 = 0`);
          }
        }
      }
    }
  }

  // Department filter (exclude if querying departments)
  if (excludeField !== "department") {
    const department = getFilterValue("department");
    if (department && (Array.isArray(department) ? department.length > 0 : department)) {
      if (Array.isArray(department) && department.length > 0) {
        const conditions = department.map((d) => {
          const normalized = String(d).trim();
          if (normalized === "NULL" || normalized === "null") {
            return sql`(department IS NULL)`;
          }
          const id = Number.parseInt(normalized, 10);
          if (Number.isNaN(id)) return sql`1 = 0`;
          return sql`(department = ${id})`;
        });
        filterConditions.push(sql`(${combineOrConditions(conditions)})`);
      } else if (!Array.isArray(department) && department) {
        const normalized = String(department).trim();
        if (normalized === "NULL" || normalized === "null") {
          filterConditions.push(sql`(department IS NULL)`);
        } else {
          const id = Number.parseInt(normalized, 10);
          if (!Number.isNaN(id)) {
            filterConditions.push(sql`(department = ${id})`);
          } else {
            filterConditions.push(sql`1 = 0`);
          }
        }
      }
    }
  }

  // Program filter (exclude if querying programs)
  if (excludeField !== "program") {
    const program = getFilterValue("program");
    if (program && (Array.isArray(program) ? program.length > 0 : program)) {
      if (Array.isArray(program) && program.length > 0) {
        const conditions = program.map(p => sql`LOWER(TRIM(COALESCE(degreetitle, ''))) = LOWER(TRIM(${p}))`);
        filterConditions.push(sql`(${combineOrConditions(conditions)})`);
      } else if (!Array.isArray(program) && program) {
        filterConditions.push(sql`LOWER(TRIM(COALESCE(degreetitle, ''))) = LOWER(TRIM(${program}))`);
      }
    }
  }

  // Gender filter (exclude if querying genders)
  if (excludeField !== "gender") {
    const gender = getFilterValue("gender");
    if (gender && (Array.isArray(gender) ? gender.length > 0 : gender)) {
      const genders = Array.isArray(gender) ? gender : [gender];
      const conditions = genders.map(g => {
        const normalized = String(g).trim();
        if (normalized === "NULL" || normalized === "null") {
          return sql`(gender IS NULL OR TRIM(COALESCE(gender, '')) = '')`;
        }
        return sql`LOWER(TRIM(COALESCE(gender, ''))) = LOWER(TRIM(${g}))`;
      });
      if (conditions.length > 0) {
        filterConditions.push(sql`(${combineOrConditions(conditions)})`);
      }
    }
  }

  // Marital Status filter (exclude if querying marital statuses)
  if (excludeField !== "maritalStatus") {
    const maritalStatus = getFilterValue("maritalStatus");
    if (maritalStatus && (Array.isArray(maritalStatus) ? maritalStatus.length > 0 : maritalStatus)) {
      const statuses = Array.isArray(maritalStatus) ? maritalStatus : [maritalStatus];
      const conditions = statuses.map(m => {
        const normalized = String(m).trim();
        if (normalized === "NULL" || normalized === "null") {
          return sql`(maritalstatus IS NULL OR TRIM(COALESCE(maritalstatus, '')) = '')`;
        }
        return sql`LOWER(TRIM(COALESCE(maritalstatus, ''))) = LOWER(TRIM(${m}))`;
      });
      if (conditions.length > 0) {
        filterConditions.push(sql`(${combineOrConditions(conditions)})`);
      }
    }
  }

  // Home Country filter (exclude if querying home countries)
  if (excludeField !== "homeCountry") {
    const homeCountry = getFilterValue("homeCountry");
    if (homeCountry && (Array.isArray(homeCountry) ? homeCountry.length > 0 : homeCountry)) {
      const countries = Array.isArray(homeCountry) ? homeCountry : [homeCountry];
      const conditions = countries.map(c => {
        const normalized = String(c).trim();
        if (normalized === "NULL" || normalized === "null") {
          return sql`(country IS NULL OR TRIM(COALESCE(country, '')) = '')`;
        }
        return sql`LOWER(TRIM(COALESCE(country, ''))) = LOWER(TRIM(${c}))`;
      });
      if (conditions.length > 0) {
        filterConditions.push(sql`(${combineOrConditions(conditions)})`);
      }
    }
  }

  // Home City filter (exclude if querying home cities)
  if (excludeField !== "homeCity") {
    const homeCity = getFilterValue("homeCity");
    if (homeCity && (Array.isArray(homeCity) ? homeCity.length > 0 : homeCity)) {
      const cities = Array.isArray(homeCity) ? homeCity : [homeCity];
      const conditions = cities.map(c => {
        const normalized = String(c).trim();
        if (normalized === "NULL" || normalized === "null") {
          return sql`(city IS NULL OR TRIM(COALESCE(city, '')) = '')`;
        }
        return sql`LOWER(TRIM(COALESCE(city, ''))) = LOWER(TRIM(${c}))`;
      });
      if (conditions.length > 0) {
        filterConditions.push(sql`(${combineOrConditions(conditions)})`);
      }
    }
  }

  // Province filter (exclude if querying provinces)
  if (excludeField !== "province") {
    const province = getFilterValue("province");
    if (province && (Array.isArray(province) ? province.length > 0 : province)) {
      const provinces = Array.isArray(province) ? province : [province];
      const conditions = provinces.map(p => {
        const normalized = String(p).trim();
        if (normalized === "NULL" || normalized === "null") {
          return sql`(province IS NULL OR TRIM(COALESCE(province, '')) = '')`;
        }
        return sql`LOWER(TRIM(COALESCE(province, ''))) = LOWER(TRIM(${p}))`;
      });
      if (conditions.length > 0) {
        filterConditions.push(sql`(${combineOrConditions(conditions)})`);
      }
    }
  }

  // Campus filter (exclude if querying campuses)
  if (excludeField !== "campus") {
    const campus = getFilterValue("campus");
    if (campus && (Array.isArray(campus) ? campus.length > 0 : campus)) {
      const campuses = Array.isArray(campus) ? campus : [campus];
      const conditions = campuses.map(c => {
        const normalized = String(c).trim();
        if (normalized === "NULL" || normalized === "null") {
          return sql`(campusname IS NULL OR TRIM(COALESCE(campusname, '')) = '')`;
        }
        return sql`LOWER(TRIM(COALESCE(campusname, ''))) = LOWER(TRIM(${c}))`;
      });
      if (conditions.length > 0) {
        filterConditions.push(sql`(${combineOrConditions(conditions)})`);
      }
    }
  }

  // Admission Year filter (exclude if querying admission years)
  if (excludeField !== "admissionYear") {
    const admissionYear = getFilterValue("admissionYear");
    if (admissionYear && (Array.isArray(admissionYear) ? admissionYear.length > 0 : admissionYear)) {
      const years = Array.isArray(admissionYear) ? admissionYear : [admissionYear];
      const conditions = years.map(y => {
        const normalized = String(y).trim();
        if (normalized === "NULL" || normalized === "null") {
          return sql`(yearofstarting IS NULL)`;
        }
        const year = parseInt(y, 10);
        if (isNaN(year)) return sql`1=0`;
        return sql`yearofstarting = ${year}`;
      });
      if (conditions.length > 0) {
        filterConditions.push(sql`(${combineOrConditions(conditions)})`);
      }
    }
  }

  // Passing Year filter (exclude if querying passing years)
  if (excludeField !== "passingYear") {
    const passingYear = getFilterValue("passingYear");
    if (passingYear && (Array.isArray(passingYear) ? passingYear.length > 0 : passingYear)) {
      const years = Array.isArray(passingYear) ? passingYear : [passingYear];
      const conditions = years.map(y => {
        const normalized = String(y).trim();
        if (normalized === "NULL" || normalized === "null") {
          return sql`(yearofending IS NULL)`;
        }
        const year = parseInt(y, 10);
        if (isNaN(year)) return sql`1=0`;
        return sql`yearofending = ${year}`;
      });
      if (conditions.length > 0) {
        filterConditions.push(sql`(${combineOrConditions(conditions)})`);
      }
    }
  }

  // Occupation Status filter (exclude if querying occupation statuses)
  if (excludeField !== "occupationStatus") {
    const occupationStatus = getFilterValue("occupationStatus");
    if (occupationStatus && (Array.isArray(occupationStatus) ? occupationStatus.length > 0 : occupationStatus)) {
      const statuses = Array.isArray(occupationStatus) ? occupationStatus : [occupationStatus];
      const conditions = statuses.map(s => {
        const normalized = String(s).trim();
        if (normalized === "NULL" || normalized === "null") {
          return sql`(employeed IS NULL OR TRIM(COALESCE(employeed, '')) = '')`;
        }
        return sql`LOWER(TRIM(COALESCE(employeed, ''))) = LOWER(TRIM(${s}))`;
      });
      if (conditions.length > 0) {
        filterConditions.push(sql`(${combineOrConditions(conditions)})`);
      }
    }
  }

  // Sector filter (exclude if querying sectors)
  if (excludeField !== "sector") {
    const sector = getFilterValue("sector");
    if (sector && (Array.isArray(sector) ? sector.length > 0 : sector)) {
      const sectors = Array.isArray(sector) ? sector : [sector];
      const conditions = sectors.map(s => {
        const normalized = String(s).trim();
        if (normalized === "NULL" || normalized === "null") {
          return sql`(industry IS NULL OR TRIM(COALESCE(industry, '')) = '')`;
        }
        const searchTerm = `%${normalized.toLowerCase()}%`;
        return sql`LOWER(TRIM(COALESCE(industry, ''))) LIKE ${searchTerm}`;
      });
      if (conditions.length > 0) {
        filterConditions.push(sql`(${combineOrConditions(conditions)})`);
      }
    }
  }

  // Work City filter (exclude if querying work cities)
  if (excludeField !== "workCity") {
    const workCity = getFilterValue("workCity");
    if (workCity && (Array.isArray(workCity) ? workCity.length > 0 : workCity)) {
      const cities = Array.isArray(workCity) ? workCity : [workCity];
      const conditions = cities.map(w => {
        const normalized = String(w).trim();
        if (normalized === "NULL" || normalized === "null") {
          return sql`(work_city IS NULL OR TRIM(COALESCE(work_city, '')) = '')`;
        }
        return sql`LOWER(TRIM(COALESCE(work_city, ''))) = LOWER(TRIM(${w}))`;
      });
      if (conditions.length > 0) {
        filterConditions.push(sql`(${combineOrConditions(conditions)})`);
      }
    }
  }

  // Work Country filter (exclude if querying work countries)
  if (excludeField !== "workCountry") {
    const workCountry = getFilterValue("workCountry");
    if (workCountry && (Array.isArray(workCountry) ? workCountry.length > 0 : workCountry)) {
      const countries = Array.isArray(workCountry) ? workCountry : [workCountry];
      const conditions = countries.map(w => {
        const normalized = String(w).trim();
        if (normalized === "NULL" || normalized === "null") {
          return sql`(work_country IS NULL OR TRIM(COALESCE(work_country, '')) = '')`;
        }
        return sql`LOWER(TRIM(COALESCE(work_country, ''))) = LOWER(TRIM(${w}))`;
      });
      if (conditions.length > 0) {
        filterConditions.push(sql`(${combineOrConditions(conditions)})`);
      }
    }
  }

  // Employer filter (exclude if querying employers)
  if (excludeField !== "employer") {
    const employer = getFilterValue("employer");
    if (employer && (Array.isArray(employer) ? employer.length > 0 : employer)) {
      const employers = Array.isArray(employer) ? employer : [employer];
      const conditions = employers.map(e => {
        const normalized = String(e).trim();
        if (normalized === "NULL" || normalized === "null") {
          return sql`(nameoforganization IS NULL OR TRIM(COALESCE(nameoforganization, '')) = '')`;
        }
        return sql`LOWER(TRIM(COALESCE(nameoforganization, ''))) = LOWER(TRIM(${e}))`;
      });
      if (conditions.length > 0) {
        filterConditions.push(sql`(${combineOrConditions(conditions)})`);
      }
    }
  }

  // Institution Name filter (exclude if querying institution names)
  if (excludeField !== "institutionName") {
    const institutionName = getFilterValue("institutionName");
    if (institutionName && (Array.isArray(institutionName) ? institutionName.length > 0 : institutionName)) {
      const names = Array.isArray(institutionName) ? institutionName : [institutionName];
      const conditions = names.map(i => {
        const normalized = String(i).trim();
        if (normalized === "NULL" || normalized === "null") {
          return sql`(higher_education_institute_name IS NULL OR TRIM(COALESCE(higher_education_institute_name, '')) = '')`;
        }
        return sql`LOWER(TRIM(COALESCE(higher_education_institute_name, ''))) = LOWER(TRIM(${i}))`;
      });
      if (conditions.length > 0) {
        filterConditions.push(sql`(${combineOrConditions(conditions)})`);
      }
    }
  }

  // Program Enrolled filter (exclude if querying programs enrolled)
  if (excludeField !== "programEnrolled") {
    const programEnrolled = getFilterValue("programEnrolled");
    if (programEnrolled && (Array.isArray(programEnrolled) ? programEnrolled.length > 0 : programEnrolled)) {
      const programs = Array.isArray(programEnrolled) ? programEnrolled : [programEnrolled];
      const conditions = programs.map(p => {
        const normalized = String(p).trim();
        if (normalized === "NULL" || normalized === "null") {
          return sql`(higher_education_program IS NULL OR TRIM(COALESCE(higher_education_program, '')) = '')`;
        }
        return sql`LOWER(TRIM(COALESCE(higher_education_program, ''))) = LOWER(TRIM(${p}))`;
      });
      if (conditions.length > 0) {
        filterConditions.push(sql`(${combineOrConditions(conditions)})`);
      }
    }
  }

  // Funding Source filter (exclude if querying funding sources)
  if (excludeField !== "fundingSource") {
    const fundingSource = getFilterValue("fundingSource");
    if (fundingSource && (Array.isArray(fundingSource) ? fundingSource.length > 0 : fundingSource)) {
      const sources = Array.isArray(fundingSource) ? fundingSource : [fundingSource];
      const conditions = sources.map(f => {
        const normalized = String(f).trim();
        if (normalized === "NULL" || normalized === "null") {
          return sql`(is_scholarship IS NULL OR TRIM(COALESCE(is_scholarship, '')) = '')`;
        }
        return sql`LOWER(TRIM(COALESCE(is_scholarship, ''))) = LOWER(TRIM(${f}))`;
      });
      if (conditions.length > 0) {
        filterConditions.push(sql`(${combineOrConditions(conditions)})`);
      }
    }
  }

  // Institution Country filter (exclude if querying institution countries)
  if (excludeField !== "institutionCountry") {
    const institutionCountry = getFilterValue("institutionCountry");
    if (institutionCountry && (Array.isArray(institutionCountry) ? institutionCountry.length > 0 : institutionCountry)) {
      const countries = Array.isArray(institutionCountry) ? institutionCountry : [institutionCountry];
      const conditions = countries.map(i => {
        const normalized = String(i).trim();
        if (normalized === "NULL" || normalized === "null") {
          return sql`(higher_education_institute_country IS NULL OR TRIM(COALESCE(higher_education_institute_country, '')) = '')`;
        }
        return sql`LOWER(TRIM(COALESCE(higher_education_institute_country, ''))) = LOWER(TRIM(${i}))`;
      });
      if (conditions.length > 0) {
        filterConditions.push(sql`(${combineOrConditions(conditions)})`);
      }
    }
  }

  // Institution City filter (exclude if querying institution cities)
  if (excludeField !== "institutionCity") {
    const institutionCity = getFilterValue("institutionCity");
    if (institutionCity && (Array.isArray(institutionCity) ? institutionCity.length > 0 : institutionCity)) {
      const cities = Array.isArray(institutionCity) ? institutionCity : [institutionCity];
      const conditions = cities.map(i => {
        const normalized = String(i).trim();
        if (normalized === "NULL" || normalized === "null") {
          return sql`(higher_education_institute_city IS NULL OR TRIM(COALESCE(higher_education_institute_city, '')) = '')`;
        }
        return sql`LOWER(TRIM(COALESCE(higher_education_institute_city, ''))) = LOWER(TRIM(${i}))`;
      });
      if (conditions.length > 0) {
        filterConditions.push(sql`(${combineOrConditions(conditions)})`);
      }
    }
  }

  // Photo Consent filter (exclude if querying photo consent)
  if (excludeField !== "photoConsent") {
    const photoConsent = getFilterValue("photoConsent");
    if (photoConsent && (Array.isArray(photoConsent) ? photoConsent.length > 0 : photoConsent)) {
      const consents = Array.isArray(photoConsent) ? photoConsent : [photoConsent];
      const conditions = consents.map(c => {
        const normalized = String(c).trim();
        if (normalized === "NULL" || normalized === "null") {
          return sql`(alumni_consent_pic IS NULL)`;
        } else if (normalized === "Allowed" || normalized === "allowed") {
          return sql`alumni_consent_pic = true`;
        } else if (normalized === "Not Allowed" || normalized === "not allowed" || normalized === "NotAllowed") {
          return sql`alumni_consent_pic = false`;
        }
        // Default to null if unrecognized
        return sql`(alumni_consent_pic IS NULL)`;
      });
      if (conditions.length > 0) {
        filterConditions.push(sql`(${combineOrConditions(conditions)})`);
      }
    }
  }

  // MR No filter (maps to registrationno column - exclude if querying mrNo - though mrNo doesn't have a counter endpoint)
  if (excludeField !== "mrNo") {
    const mrNo = getFilterValue("mrNo");
    if (mrNo && (Array.isArray(mrNo) ? mrNo.length > 0 : mrNo)) {
      const mrNos = Array.isArray(mrNo) ? mrNo : [mrNo];
      const conditions = mrNos.map(m => {
        const normalized = String(m).trim();
        if (normalized === "NULL" || normalized === "null") {
          return sql`(registrationno IS NULL OR TRIM(COALESCE(registrationno, '')) = '')`;
        }
        return sql`LOWER(TRIM(COALESCE(registrationno, ''))) = LOWER(TRIM(${m}))`;
      });
      if (conditions.length > 0) {
        filterConditions.push(sql`(${combineOrConditions(conditions)})`);
      }
    }
  }

  // SAP ID state filter (NULL only)
  if (excludeField !== "sapIdState") {
    const sapIdState = getFilterValue("sapIdState");
    if (sapIdState && (Array.isArray(sapIdState) ? sapIdState.length > 0 : sapIdState)) {
      const states = Array.isArray(sapIdState) ? sapIdState : [sapIdState];
      const conditions = states.map(s => {
        const normalized = String(s).trim().toUpperCase();
        if (normalized === "NULL") {
          return sql`(
            sapid IS NULL
            OR TRIM(COALESCE(sapid, '')) = ''
            OR LOWER(TRIM(COALESCE(sapid, ''))) = 'null'
          )`;
        } else if (normalized === "EXISTS") {
          return sql`(
            sapid IS NOT NULL
            AND TRIM(COALESCE(sapid, '')) != ''
            AND LOWER(TRIM(COALESCE(sapid, ''))) != 'null'
          )`;
        }
        // Unknown value – do not match anything
        return sql`1 = 0`;
      });
      if (conditions.length > 0) {
        filterConditions.push(sql`(${combineOrConditions(conditions)})`);
      }
    }
  }

  // Registration No state filter (NULL only)
  if (excludeField !== "regNoState") {
    const regNoState = getFilterValue("regNoState");
    if (regNoState && (Array.isArray(regNoState) ? regNoState.length > 0 : regNoState)) {
      const states = Array.isArray(regNoState) ? regNoState : [regNoState];
      const conditions = states.map(s => {
        const normalized = String(s).trim().toUpperCase();
        if (normalized === "NULL") {
          return sql`(
            registrationno IS NULL
            OR TRIM(COALESCE(registrationno, '')) = ''
            OR LOWER(TRIM(COALESCE(registrationno, ''))) = 'null'
          )`;
        } else if (normalized === "EXISTS") {
          return sql`(
            registrationno IS NOT NULL
            AND TRIM(COALESCE(registrationno, '')) != ''
            AND LOWER(TRIM(COALESCE(registrationno, ''))) != 'null'
          )`;
        }
        return sql`1 = 0`;
      });
      if (conditions.length > 0) {
        filterConditions.push(sql`(${combineOrConditions(conditions)})`);
      }
    }
  }

  // Personal Email state filter (NULL only)
  if (excludeField !== "personalEmailState") {
    const personalEmailState = getFilterValue("personalEmailState");
    if (personalEmailState && (Array.isArray(personalEmailState) ? personalEmailState.length > 0 : personalEmailState)) {
      const states = Array.isArray(personalEmailState) ? personalEmailState : [personalEmailState];
      const conditions = states.map(s => {
        const normalized = String(s).trim().toUpperCase();
        if (normalized === "NULL") {
          return sql`(
            personalemail IS NULL
            OR TRIM(COALESCE(personalemail, '')) = ''
            OR LOWER(TRIM(COALESCE(personalemail, ''))) = 'null'
          )`;
        } else if (normalized === "EXISTS") {
          return sql`(
            personalemail IS NOT NULL
            AND TRIM(COALESCE(personalemail, '')) != ''
            AND LOWER(TRIM(COALESCE(personalemail, ''))) != 'null'
          )`;
        }
        return sql`1 = 0`;
      });
      if (conditions.length > 0) {
        filterConditions.push(sql`(${combineOrConditions(conditions)})`);
      }
    }
  }

  // Contact No state filter (NULL only)
  if (excludeField !== "contactNoState") {
    const contactNoState = getFilterValue("contactNoState");
    if (contactNoState && (Array.isArray(contactNoState) ? contactNoState.length > 0 : contactNoState)) {
      const states = Array.isArray(contactNoState) ? contactNoState : [contactNoState];
      const conditions = states.map(s => {
        const normalized = String(s).trim().toUpperCase();
        if (normalized === "NULL") {
          return sql`(
            (
              contactno IS NULL
              OR TRIM(COALESCE(contactno, '')) = ''
              OR LOWER(TRIM(COALESCE(contactno, ''))) = 'null'
            )
          )`;
        } else if (normalized === "EXISTS") {
          return sql`(
            contactno IS NOT NULL
            AND TRIM(COALESCE(contactno, '')) != ''
            AND LOWER(TRIM(COALESCE(contactno, ''))) != 'null'
          )`;
        }
        return sql`1 = 0`;
      });
      if (conditions.length > 0) {
        filterConditions.push(sql`(${combineOrConditions(conditions)})`);
      }
    }
  }

  // Combine all filter conditions with AND
  if (filterConditions.length === 0) {
    return sql``;
  }
  if (filterConditions.length === 1) {
    return sql`AND ${filterConditions[0]}`;
  }
  // Combine multiple conditions with AND
  let combined = filterConditions[0];
  for (let i = 1; i < filterConditions.length; i++) {
    combined = sql`${combined} AND ${filterConditions[i]}`;
  }
  return sql`AND ${combined}`;
}

