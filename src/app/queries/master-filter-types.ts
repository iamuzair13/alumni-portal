/**
 * Shared type definitions for master filter parameters
 */

export type MasterFilters = {
  faculty?: string | string[];
  department?: string | string[];
  program?: string | string[];
  status?: string | string[];
  gender?: string | string[];
  maritalStatus?: string | string[];
  homeCountry?: string | string[];
  homeCity?: string | string[];
  province?: string | string[];
  campus?: string | string[];
  admissionYear?: string | string[];
  passingYear?: string | string[];
  occupationStatus?: string | string[];
  sector?: string | string[];
  workCity?: string | string[];
  workCountry?: string | string[];
  institutionName?: string | string[];
  programEnrolled?: string | string[];
  fundingSource?: string | string[];
  institutionCountry?: string | string[];
  institutionCity?: string | string[];
  mrNo?: string | string[];
};

/**
 * Helper function to add filter parameters to a URL
 */
export function addFilterParamsToUrl(url: URL, filters?: MasterFilters): void {
  if (!filters) return;
  
  const addFilterParam = (key: string, value: string | string[] | undefined) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach(v => url.searchParams.append(key, v));
      } else {
        url.searchParams.set(key, value);
      }
    }
  };
  
  addFilterParam("faculty", filters.faculty);
  addFilterParam("department", filters.department);
  addFilterParam("program", filters.program);
  addFilterParam("status", filters.status);
  addFilterParam("gender", filters.gender);
  addFilterParam("maritalStatus", filters.maritalStatus);
  addFilterParam("homeCountry", filters.homeCountry);
  addFilterParam("homeCity", filters.homeCity);
  addFilterParam("province", filters.province);
  addFilterParam("campus", filters.campus);
  addFilterParam("admissionYear", filters.admissionYear);
  addFilterParam("passingYear", filters.passingYear);
  addFilterParam("occupationStatus", filters.occupationStatus);
  addFilterParam("sector", filters.sector);
  addFilterParam("workCity", filters.workCity);
  addFilterParam("workCountry", filters.workCountry);
  addFilterParam("institutionName", filters.institutionName);
  addFilterParam("programEnrolled", filters.programEnrolled);
  addFilterParam("fundingSource", filters.fundingSource);
  addFilterParam("institutionCountry", filters.institutionCountry);
  addFilterParam("institutionCity", filters.institutionCity);
  addFilterParam("mrNo", filters.mrNo);
}



