"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";

type ErpDataDetailsProps = {
  sapId?: string;
  registrationNo?: string | null;
  onClose: () => void;
};

type ErpRecord = {
  sapid?: string | null;
  registrationno?: string | null;
  alumniname?: string | null;
  personalemail?: string | null;
  officialemail?: string | null;
  universityemail?: string | null;
  facultyname?: string | null;
  departmentname?: string | null;
  degreetitle?: string | null;
  yearofending?: number | null;
  yearofstarting?: number | null;
  cgpa?: number | null;
  campusname?: string | null;
  [key: string]: unknown;
};

// Helper to format field value
const formatValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

// Compact field component (read-only for ERP data)
const CompactField: React.FC<{
  label: string;
  value: string | number | null | undefined;
}> = ({ label, value }) => {
  const displayValue = formatValue(value);
  
  return (
    <div className="flex items-start gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[140px] flex-shrink-0">{label}:</span>
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
    console.warn("[ErpDataDetails] Received string data instead of object, XML parsing may have failed");
    return null;
  }
  
  // If erpData is an object with string keys that look like XML, it's likely the XML string was converted to an object incorrectly
  if (erpData && typeof erpData === "object") {
    const keys = Object.keys(erpData);
    // Check if it looks like a string was converted to an object (numeric keys)
    if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {
      console.warn("[ErpDataDetails] Data appears to be a string converted to object, XML parsing may have failed");
      return null;
    }
  }
  
  return erpData as ErpRecord;
}

export const ErpDataDetails: React.FC<ErpDataDetailsProps> = ({ sapId, registrationNo, onClose }) => {
  // Only enable query if we have a valid (non-empty) SAP ID or registration number
  const validSapId = sapId && sapId.trim() ? sapId.trim() : undefined;
  const validRegistrationNo = registrationNo && String(registrationNo).trim() ? String(registrationNo).trim() : undefined;
  
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
        

        {/* Additional ERP Fields */}
        {data && typeof data === "object" && !Array.isArray(data) && Object.keys(data).length > 0 && (
          <>
            
            {Object.entries(data)
              .filter(([key, value]) => {
                // Skip if value is a string that looks like XML (starts with < or ?xml)
                if (typeof value === "string" && (value.trim().startsWith("<") || value.trim().startsWith("<?xml"))) {
                  return false;
                }
                // Skip known fields that are already displayed
                return !["sapid", "registrationno", "alumniname", "personalemail", "officialemail", 
                  "universityemail", "facultyname", "departmentname", "degreetitle", 
                  "yearofending", "yearofstarting", "cgpa", "campusname"].includes(key.toLowerCase());
              })
              .map(([key, value]) => (
                <CompactField 
                  key={key} 
                  label={key.replace(/_/g, " ").replace(/([A-Z])/g, " $1").trim()} 
                  value={value as string | number | null | undefined} 
                />
              ))}
          </>
        )}
      </div>
    </div>
  );
};

