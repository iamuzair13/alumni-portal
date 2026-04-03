"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAlumniFullDetails } from "@/app/queries/alumni-profile";

type ErpDataDetailsProps = {
  sapId?: string;
  registrationNo?: string | null;
  onClose: () => void;
  alumniData?: Record<string, unknown> | null;
};

// Comparison result type
type ComparisonResult = "same" | "minor" | "major" | "no_data";

// Helper function to normalize values for comparison
const normalizeValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "";
  return String(value).trim().toLowerCase();
};

// Compare two values and return comparison result
const compareValues = (alumniValue: unknown, erpValue: unknown): ComparisonResult => {
  const alumniNorm = normalizeValue(alumniValue);
  const erpNorm = normalizeValue(erpValue);
  
  // If both are empty, consider them same
  if (alumniNorm === "" && erpNorm === "") return "no_data";
  
  // If one is empty and other is not, it's a major difference
  if (alumniNorm === "" || erpNorm === "") return "major";
  
  // Exact match
  if (alumniNorm === erpNorm) return "same";
  
  // Check for minor differences (similar but not exact)
  // Remove common punctuation and spaces for comparison
  const alumniClean = alumniNorm.replace(/[^\w]/g, "");
  const erpClean = erpNorm.replace(/[^\w]/g, "");
  
  if (alumniClean === erpClean) return "minor";
  
  // Check if one contains the other (partial match)
  if (alumniClean.includes(erpClean) || erpClean.includes(alumniClean)) {
    // If the difference is small (less than 30% of longer string), consider it minor
    const longer = Math.max(alumniClean.length, erpClean.length);
    const shorter = Math.min(alumniClean.length, erpClean.length);
    const diff = longer - shorter;
    if (diff / longer < 0.3) return "minor";
  }
  
  // Major difference
  return "major";
};

// Map field labels to Alumni data field names (aligned with AlumniExpandableDetails comparison labels)
const getAlumniFieldValue = (label: string, alumniData: Record<string, unknown> | null | undefined): unknown => {
  if (!alumniData) return null;

  const fieldMap: Record<string, string> = {
    "Sap No": "sapid",
    "Registration No": "registrationno",
    "Full Name": "alumniname",
    "Father Name": "fathername",
    "CNIC/Passport": "cnicpassport",
    "Mobile": "contactno",
    "Primary Contact": "contactno",
    "Personal Email": "personalemail",
    "Faculty": "facultyname",
    "Department": "departmentname",
    "Program": "degreetitle",
    "Passing Out Year": "yearofending",
    "Home Address": "address",
    "Home Country": "country",
    "Secondary Contact": "contactno1",
    "Home Province": "province",
    "Home City": "city",
    "Date of Birth": "dateofbirth",
    "Marital Status": "maritalstatus",
    "Admission Year": "yearofstarting",
    "CGPA": "cgpa",
    "Major Subject": "majorsubject",
  };

  const alumniField = fieldMap[label];
  return alumniField ? alumniData[alumniField] : null;
};

/** ERP Doc YYYYMMDD → passing-out year for alignment with Alumni "Passing Out Year" */
function erpPassingOutYearFromDoc(doc: unknown): number | null {
  const trimmed = String(doc ?? "").trim();
  if (/^\d{8}$/.test(trimmed)) {
    const y = Number(trimmed.slice(0, 4));
    return Number.isFinite(y) ? y : null;
  }
  return null;
}

type ErpRecord = {
  DegrTitle?: string | null;
  DeptName?: string | null;
  Doc?: string | null;
  Mobile?: string | null;
  SapNo?: string | null;
  Mrno?: string | null;
  Name?: string | null;
  Fname?: string | null;
  Cnic?: string | null;
  Address?: string | null;
  Nationality?: string | null;
  Regligion?: string | null;
  __metadata?: unknown;
  torel?: unknown;
  [key: string]: unknown;
};

// Helper to format field value
const formatValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "-";

  const str = String(value);
  const trimmed = str.trim();
  if (!trimmed) return "-";

  // Format common ERP date format: YYYYMMDD
  if (/^\d{8}$/.test(trimmed)) {
    const yyyy = trimmed.slice(0, 4);
    const mm = trimmed.slice(4, 6);
    const dd = trimmed.slice(6, 8);
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(d);
    }
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[object]";
    }
  }

  return str;
};

// Helper to format field label (convert camelCase/PascalCase to readable format)
const formatLabel = (key: string): string => {
  // Handle common abbreviations and special cases
  const labelMap: Record<string, string> = {
    "Campus": "Campus",
    "Gbdat": "Date of Birth",
    "AdmAyear": "Admission Year",
    "DegrTitle": "Degree Title",
    "DeptName": "Department Name",
    "Gesch": "Gender",
    "SapNo": "SAP Number",
    "Mrno": "MR Number",
    "Fname": "Father Name",
    "Cnic": "CNIC",
    "Regligion": "Religion",
    "Doc": "Date of Completion",
    "Mobile": "Mobile Number",
    "Name": "Name",
    "Address": "Address",
    "Nationality": "Nationality",
  };
  
  if (labelMap[key]) {
    return labelMap[key];
  }
  
  // Convert camelCase/PascalCase to Title Case
  return key
    .replace(/([A-Z])/g, " $1") // Add space before capital letters
    .replace(/_/g, " ") // Replace underscores with spaces
    .trim()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

// Compact field component (read-only for ERP data)
const CompactField: React.FC<{
  label: string;
  value: unknown;
  comparisonStatus?: ComparisonResult;
}> = ({ label, value, comparisonStatus }) => {
  const displayValue = formatValue(value);
  
  // Get indicator dot based on comparison status
  const getIndicator = () => {
    if (!comparisonStatus || comparisonStatus === "same" || comparisonStatus === "no_data") return null;
    
    if (comparisonStatus === "major") {
      return (
        <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="Major difference with Alumni data" />
      );
    }
    
    if (comparisonStatus === "minor") {
      return (
        <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" title="Minor difference with Alumni data" />
      );
    }
    
    return null;
  };
  
  return (
    <div className="flex items-start gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[140px] flex-shrink-0 flex items-center gap-1.5">
        {label}:
        {getIndicator()}
      </span>
      <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 break-words">{displayValue}</span>
    </div>
  );
};

/**
 * Fetch ERP data for a given SAP ID or Registration Number
 */
async function fetchErpData(sapId?: string, registrationNo?: string | null): Promise<ErpRecord | null> {
  // Only use sapId if it's a non-empty string after trimming
  const validSapId = sapId && sapId.trim() && sapId.trim().length > 0 ? sapId.trim() : undefined;
  // Only use registrationNo if it's a non-empty string after trimming
  const validRegistrationNo = registrationNo && String(registrationNo).trim() && String(registrationNo).trim().length > 0 
    ? String(registrationNo).trim() 
    : undefined;
  
  if (!validSapId && !validRegistrationNo) {
    throw new Error("Either SAP ID or Registration Number is required");
  }

  const params = new URLSearchParams();
  if (validSapId) params.append("sapid", validSapId);
  if (validRegistrationNo) params.append("registrationno", validRegistrationNo);

  const res = await fetch(`/api/erp/fetch?${params.toString()}`);
  const data = await res.json();

  // Handle "NOT_FOUND" case - record doesn't exist in ERP (can be 200 or 500 status)
  if (data.success === false && data.error === "NOT_FOUND") {
    return "NOT_FOUND" as unknown as ErpRecord; // Special marker for "not found"
  }

  if (!res.ok) {
    // Check if the error is actually a NOT_FOUND
    if (data.error === "NOT_FOUND" || (data.error && data.error.includes("NOT_FOUND"))) {
      return "NOT_FOUND" as unknown as ErpRecord;
    }
    throw new Error(data.error || "Failed to fetch ERP data");
  }

  if (!data.success || !data.data) {
    return null;
  }

  // Handle OData response format
  const erpData = Array.isArray(data.data) ? data.data[0] : data.data;
  
  // If erpData is a string (XML that wasn't parsed), return null
  if (typeof erpData === "string") {

    return null;
  }
  
  // If erpData is an object with string keys that look like XML, it's likely the XML string was converted to an object incorrectly
  if (erpData && typeof erpData === "object") {
    const keys = Object.keys(erpData);
    // Check if it looks like a string was converted to an object (numeric keys)
    if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {

      return null;
    }
  }
  
  return erpData as ErpRecord;
}

export const ErpDataDetails: React.FC<ErpDataDetailsProps> = ({ sapId, registrationNo, onClose, alumniData: propAlumniData }) => {
  // Only enable query if we have a valid (non-empty) SAP ID or registration number
  const validSapId = sapId && sapId.trim() ? sapId.trim() : undefined;
  const validRegistrationNo = registrationNo && String(registrationNo).trim() ? String(registrationNo).trim() : undefined;
  
  // Fetch alumni data for comparison if not provided
  const { data: alumniDataFromQuery } = useAlumniFullDetails(validSapId || "");
  const alumniData = propAlumniData || alumniDataFromQuery;
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["erp-data", validSapId, validRegistrationNo],
    queryFn: () => fetchErpData(validSapId, validRegistrationNo),
    enabled: !!validSapId || !!validRegistrationNo,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });

  // Helper function to get comparison status for a field
  const getComparisonStatus = (label: string, erpValue: unknown): ComparisonResult => {
    if (!alumniData || !data) return "no_data";
    const alumniValue = getAlumniFieldValue(label, alumniData);
    return compareValues(alumniValue, erpValue);
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800/50 rounded border border-gray-200 dark:border-gray-700 p-3 overflow-x-hidden max-w-xl w-full">
        <div className="flex items-center justify-center py-4">
          <div className="h-6 w-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="ml-2 text-xs text-gray-600 dark:text-gray-400">Loading Sap data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800/50 rounded border border-gray-200 dark:border-gray-700 p-3 overflow-x-hidden max-w-xl w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
          <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100">Sap Data</h3>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
          >
            Close
          </button>
        </div>
        <div className="rounded border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800/50 px-3 py-2">
          <p className="text-xs text-red-800 dark:text-red-200">
            {error instanceof Error ? error.message : "Failed to load ERP data"}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-2 text-xs text-red-700 dark:text-red-300 hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Handle "NOT_FOUND" case - record doesn't exist in ERP
  if ((data as unknown) === "NOT_FOUND" || (data && typeof data === "object" && (data as { _notFound?: boolean })._notFound)) {
    return (
      <div className="bg-white dark:bg-gray-800/50 rounded border border-gray-200 dark:border-gray-700 p-3 overflow-x-hidden max-w-xl w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
          <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100">Sap Data</h3>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
          >
            Close
          </button>
        </div>
        <div className="rounded border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800/50 px-3 py-2">
          <p className="text-xs text-amber-800 dark:text-amber-200 font-medium">No Record found</p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">The record does not exist in the ERP system for the provided SAP ID or Registration Number.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white dark:bg-gray-800/50 rounded border border-gray-200 dark:border-gray-700 p-3 overflow-x-hidden max-w-xl w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
          <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100">Sap Data</h3>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
          >
            Close
          </button>
        </div>
        <div className="rounded border border-gray-200 bg-gray-50 dark:bg-gray-800/30 dark:border-gray-700 px-3 py-2">
          <p className="text-xs text-gray-600 dark:text-gray-400">No data found in ERP system</p>
        </div>
      </div>
    );
  }

  const shownKeys = new Set<string>([
    "SapNo",
    "Name",
    "Fname",
    "Cnic",
    "Mobile",
    "DeptName",
    "DegrTitle",
    "Campus",
    "AdmAyear",
    "Gbdat",
    "Gesch",
    "Mrno",
    "Address",
    "Nationality",
    "Regligion",
  ]);

  const topLevelEntries = Object.entries(data as Record<string, unknown>);
  const displayableEntries = topLevelEntries
    .filter(([key]) => !key.startsWith("__"))
    .filter(([key]) => key !== "torel")
    .filter(([key]) => key !== "__metadata")
    .filter(([key]) => !shownKeys.has(key));

  return (
    <div className="bg-white dark:bg-gray-800/50 rounded border border-gray-200 dark:border-gray-700 p-3 overflow-x-hidden max-w-xl w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
        <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100">Sap Data</h3>
        <button
          type="button"
          onClick={onClose}
          className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
        >
          Close
        </button>
      </div>

      <div className="space-y-1 text-xs">
        {/* Order and section headers match AlumniExpandableDetails one-to-one */}
        <div className="pt-1 pb-1 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Mandatory</h4>
            <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700 rounded-full px-2 py-0.5">
              From ERP
            </span>
          </div>
        </div>

        <CompactField label="Sap No" value={data?.SapNo || null} comparisonStatus={getComparisonStatus("Sap No", data?.SapNo)} />
        <CompactField label="Full Name" value={data?.Name || null} comparisonStatus={getComparisonStatus("Full Name", data?.Name)} />
        <CompactField label="Father Name" value={data?.Fname || null} comparisonStatus={getComparisonStatus("Father Name", data?.Fname)} />
        <CompactField label="CNIC/Passport" value={data?.Cnic || null} comparisonStatus={getComparisonStatus("CNIC/Passport", data?.Cnic)} />
        <CompactField label="Primary Contact" value={data?.Mobile || null} comparisonStatus={getComparisonStatus("Mobile", data?.Mobile)} />
        <CompactField label="Personal Email" value={null} comparisonStatus={getComparisonStatus("Personal Email", null)} />
        <CompactField label="Faculty" value={null} comparisonStatus={getComparisonStatus("Faculty", null)} />
        <CompactField label="Department" value={data?.DeptName || null} comparisonStatus={getComparisonStatus("Department", data?.DeptName)} />
        <CompactField label="Program" value={data?.DegrTitle || null} comparisonStatus={getComparisonStatus("Program", data?.DegrTitle)} />
        <CompactField label="Campus" value={(data as Record<string, unknown>)?.Campus as string | null} />
        <CompactField
          label="Passing Out Year"
          value={erpPassingOutYearFromDoc(data?.Doc)}
          comparisonStatus={getComparisonStatus("Passing Out Year", erpPassingOutYearFromDoc(data?.Doc))}
        />

        <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Additional</h4>
            <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700 rounded-full px-2 py-0.5">
              All other fields
            </span>
          </div>
        </div>

        <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Personal</h4>
        </div>
        <CompactField label="Registration No" value={data?.Mrno || null} comparisonStatus={getComparisonStatus("Registration No", data?.Mrno)} />
        <CompactField label="Gender" value={(data as Record<string, unknown>)?.Gesch as string | null} />
        <CompactField label="Date of Birth" value={(data as Record<string, unknown>)?.Gbdat as string | null} comparisonStatus={getComparisonStatus("Date of Birth", (data as Record<string, unknown>)?.Gbdat)} />
        <CompactField label="Marital Status" value={null} />

        <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Contact</h4>
        </div>
        <CompactField label="Secondary Contact" value={null} />
        <CompactField label="Home Address" value={data?.Address || null} comparisonStatus={getComparisonStatus("Home Address", data?.Address)} />
        <CompactField label="Home Country" value={data?.Nationality || null} comparisonStatus={getComparisonStatus("Home Country", data?.Nationality)} />
        <CompactField label="Home Province" value={null} />
        <CompactField label="Home City" value={null} />

        <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Academic (Additional)</h4>
        </div>
        <CompactField label="Admission Year" value={(data as Record<string, unknown>)?.AdmAyear as string | null} comparisonStatus={getComparisonStatus("Admission Year", (data as Record<string, unknown>)?.AdmAyear)} />
        <CompactField label="CGPA" value={null} />
        <CompactField label="Major Subject" value={null} />

        <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Occupation</h4>
        </div>
        <CompactField label="Occupation Status" value={null} />
        <CompactField label="Current Organization" value={null} />
        <CompactField label="Current Designation" value={null} />
        <CompactField label="Sector" value={null} />
        <CompactField label="Work Address" value={null} />
        <CompactField label="Work City" value={null} />
        <CompactField label="Work Country" value={null} />
        <CompactField label="Work Phone" value={null} />
        <CompactField label="Work Email" value={null} />

        <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Higher Education</h4>
        </div>
        <CompactField label="Institution Name" value={null} />
        <CompactField label="Program Enrolled" value={null} />
        <CompactField label="Funding Source" value={null} />
        <CompactField label="Institution Country" value={null} />
        <CompactField label="Institution City" value={null} />

        <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Chapter & Association</h4>
        </div>
        <CompactField label="Chapter 1" value={null} />
        <CompactField label="Chapter 2" value={null} />
        <CompactField label="Chapter 3" value={null} />
        <CompactField label="Association" value={null} />

        <CompactField label="About Me" value={null} />

        <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Social Links</h4>
        </div>
        <CompactField label="Facebook" value={null} />
        <CompactField label="Instagram" value={null} />
        <CompactField label="YouTube" value={null} />
        <CompactField label="LinkedIn" value={null} />

        <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">System</h4>
        </div>
        <div className="flex items-center gap-2 py-2 border-b border-gray-100 dark:border-gray-700/50">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[140px] flex-shrink-0">Credentials:</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
        </div>
        <CompactField label="Alumni Password" value={null} />
        <CompactField label="Last Login" value={null} />
        <CompactField label="Login Count" value={null} />
        <CompactField label="Alumni Status" value={null} />
        <CompactField label="Alumni Category" value={null} />
        <CompactField label="Allowed to use information Officially" value={null} />
        <CompactField label="Last Updated" value={null} />
        <CompactField label="Created Date" value={null} />
        <CompactField label="Photo Usage Consent" value={null} />

        {displayableEntries.length > 0 && (
          <>
            <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">All ERP Fields</h4>
            </div>
            {displayableEntries
              .slice()
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, value]) => {
                const label = formatLabel(key) || key;
                return <CompactField key={key} label={label} value={value} />;
              })}
          </>
        )}

        {(data as ErpRecord)?.__metadata !== undefined && (
          <>
            <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Metadata</h4>
            </div>
            <CompactField label="__metadata" value={(data as ErpRecord).__metadata} />
          </>
        )}

        {(data as ErpRecord)?.torel !== undefined && (
          <>
            <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Deferred Links</h4>
            </div>
            <CompactField label="torel" value={(data as ErpRecord).torel} />
          </>
        )}
      </div>
    </div>
  );
};

