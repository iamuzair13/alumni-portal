"use client";

import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableHeader, TableBody, TableCell, TableRow } from "@/components/ui/table";
import Pagination from "@/components/tables/Pagination";
import Badge from "../ui/badge/Badge";
import { ArrowUpIcon, ArrowDownIcon } from "@/icons";
import SyncedTableScroll from "@/components/tables/SyncedTableScroll";
import { useAlumniFaculties } from "@/app/queries/fetch-alumni-faculties";
import { useAlumniDepartments } from "@/app/queries/fetch-alumni-departments";
import { useAlumniAssociations } from "@/app/queries/fetch-alumni-associations";
import type { MasterFilters } from "@/app/queries/master-filter-types";
import { AlumniExpandableDetails } from "@/components/alumni/AlumniExpandableDetails";
import { ErpDataDetails } from "@/components/alumni/ErpDataDetails";
import { useExcelExport } from "@/lib/excel-export";

type MembershipFilter = "all" | "members" | "non-members";

// Tab configuration
const MEMBERSHIP_TABS: { key: MembershipFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "members", label: "Members" },
  { key: "non-members", label: "Non-Members" },
];

// Per-status color classes to visually distinguish each category
const MEMBERSHIP_STATUS_CLASS_MAP: Record<
  MembershipFilter,
  {
    selectedContainer: string;
    hoverBorder: string;
    iconBg: string;
    iconColor: string;
    labelText: string;
  }
> = {
  all: {
    selectedContainer:
      "border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20",
    hoverBorder: "hover:border-blue-400",
    iconBg: "bg-blue-100 dark:bg-blue-800",
    iconColor: "text-blue-700 dark:text-blue-200",
    labelText: "text-blue-600 dark:text-blue-300",
  },
  members: {
    selectedContainer:
      "border-emerald-500 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-900/20",
    hoverBorder: "hover:border-emerald-400",
    iconBg: "bg-emerald-100 dark:bg-emerald-800",
    iconColor: "text-emerald-700 dark:text-emerald-200",
    labelText: "text-emerald-600 dark:text-emerald-300",
  },
  "non-members": {
    selectedContainer:
      "border-amber-500 bg-amber-50 dark:border-amber-500 dark:bg-amber-900/20",
    hoverBorder: "hover:border-amber-400",
    iconBg: "bg-amber-100 dark:bg-amber-800",
    iconColor: "text-amber-700 dark:text-amber-200",
    labelText: "text-amber-600 dark:text-amber-300",
  },
};

type AssociationItem = {
  sapid: string;
  registrationNo: string | null;
  name: string;
  department: string | null;
  faculty: string | null;
  program: string | null;
  email: string | null;
  associationTitle: string | null;
  associationId: number | null;
  createdAt: string | null;
};

async function getAlumniAssociationCounts(
  faculties?: string[],
  departments?: string[],
  associations?: number[],
  verified?: boolean
): Promise<{
  total: number;
  all: number;
  members: number;
  nonMembers: number;
  verified: number;
  unverified: number;
}> {
  const url = new URL("/api/alumni/association/counts", typeof window !== "undefined" ? window.location.origin : "");
  if (faculties && faculties.length > 0) {
    url.searchParams.set("faculties", faculties.join(","));
  }
  if (departments && departments.length > 0) {
    url.searchParams.set("departments", departments.join(","));
  }
  if (associations && associations.length > 0) {
    url.searchParams.set("associations", associations.join(","));
  }
  if (verified !== undefined) {
    url.searchParams.set("verified", verified ? "true" : "false");
  }
  
  const res = await fetch(url.toString(), { headers: { "accept": "application/json" } });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = (errorData as { error?: string })?.error || `Failed to fetch counts (${res.status})`;
    throw new Error(errorMessage);
  }
  const data = (await res.json()) as {
    total: number;
    all: number;
    members: number;
    nonMembers: number;
    verified: number;
    unverified: number;
  };
  return data;
}

type AlumniAssociationResponse = {
  items: AssociationItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

async function getAlumniAssociation(
  faculties?: string[],
  departments?: string[],
  associations?: number[],
  verified?: boolean,
  membershipFilter?: MembershipFilter,
  page: number = 1,
  limit: number = 100
): Promise<AlumniAssociationResponse> {
  const url = new URL("/api/alumni/association", typeof window !== "undefined" ? window.location.origin : "");
  // Only add parameters if they have actual values (not empty arrays)
  if (faculties && faculties.length > 0) {
    url.searchParams.set("faculties", faculties.join(","));
  }
  if (departments && departments.length > 0) {
    url.searchParams.set("departments", departments.join(","));
  }
  if (associations && associations.length > 0) {
    url.searchParams.set("associations", associations.join(","));
  }
  if (verified !== undefined) {
    url.searchParams.set("verified", verified ? "true" : "false");
  }
  if (membershipFilter) {
    url.searchParams.set("membershipFilter", membershipFilter);
  }
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(limit));

  try {
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const res = await fetch(url.toString(), { 
      headers: { "accept": "application/json" },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const errorMessage = (errorData as { error?: string })?.error || `Failed to fetch alumni association (${res.status})`;

      throw new Error(errorMessage);
    }
    
    const data = (await res.json()) as AlumniAssociationResponse;

    return data;
  } catch (fetchError) {
    if (fetchError instanceof Error && fetchError.name === 'AbortError') {

      throw new Error("Request timed out. Please try again.");
    }

    throw fetchError;
  }
}

export const AlumniAssociationTab: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [query, setQuery] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
  // Filter states - arrays for multi-select
  const [selectedFaculties, setSelectedFaculties] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedAssociations, setSelectedAssociations] = useState<number[]>([]);
  const [membershipFilter, setMembershipFilter] = useState<MembershipFilter>("members");
  const [verifiedFilter, setVerifiedFilter] = useState<boolean | undefined>(undefined);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const { isExporting, openExportModal, ExportModal } = useExcelExport();
  
  // State for expanded filter sections
  const [expandedFilters, setExpandedFilters] = useState<{
    faculty: boolean;
    department: boolean;
    association: boolean;
  }>({
    faculty: false,
    department: false,
    association: false,
  });
  
  // Refs for click-outside detection
  const facultyFilterRef = useRef<HTMLDivElement>(null);
  const departmentFilterRef = useRef<HTMLDivElement>(null);
  const associationFilterRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Build master filters for dependent filter queries
  const masterFilters = useMemo(() => {
    const filters: MasterFilters = {};
    if (selectedFaculties.length > 0) {
      filters.faculty = selectedFaculties;
    }
    if (selectedDepartments.length > 0) {
      filters.department = selectedDepartments;
    }
    // Note: We don't include associations in masterFilters to avoid circular dependency
    return filters;
  }, [selectedFaculties, selectedDepartments]);

  // Fetch dynamic filter options with counts
  const { data: alumniFacultiesData } = useAlumniFaculties(masterFilters);
  const { data: alumniDepartmentsData } = useAlumniDepartments(masterFilters);
  const { data: alumniAssociationsData } = useAlumniAssociations(masterFilters);

  // Get filter options with counts
  const facultyOptions = useMemo(() => {
    return alumniFacultiesData?.faculties || [];
  }, [alumniFacultiesData]);

  const departmentOptions = useMemo(() => {
    return alumniDepartmentsData?.departments || [];
  }, [alumniDepartmentsData]);

  const associationsOptions = useMemo(() => {
    return alumniAssociationsData?.associations || [];
  }, [alumniAssociationsData]);

  // Reset department when faculty changes
  useEffect(() => {
    if (selectedFaculties.length === 0) {
      setSelectedDepartments([]);
    } else {
      // Remove departments that are no longer available
      const availableDeptValues = departmentOptions.map(d => d.value);
      setSelectedDepartments(prev => prev.filter(dept => availableDeptValues.includes(dept)));
    }
  }, [selectedFaculties, departmentOptions]);
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (facultyFilterRef.current && !facultyFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, faculty: false }));
      }
      if (departmentFilterRef.current && !departmentFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, department: false }));
      }
      if (associationFilterRef.current && !associationFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, association: false }));
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Handlers for checkbox toggles
  const handleFacultyToggle = (facultyName: string) => {
    setSelectedFaculties(prev => 
      prev.includes(facultyName) 
        ? prev.filter(f => f !== facultyName)
        : [...prev, facultyName]
    );
  };
  
  const handleFacultySelectAll = () => {
    const allFacultyValues = facultyOptions.map(f => f.value);
    if (selectedFaculties.length === allFacultyValues.length && allFacultyValues.length > 0) {
      setSelectedFaculties([]);
    } else {
      setSelectedFaculties(allFacultyValues);
    }
  };
  
  const handleDepartmentToggle = (deptName: string) => {
    setSelectedDepartments(prev => 
      prev.includes(deptName) 
        ? prev.filter(d => d !== deptName)
        : [...prev, deptName]
    );
  };
  
  const handleDepartmentSelectAll = () => {
    const allDepartmentValues = departmentOptions.map(d => d.value);
    if (selectedDepartments.length === allDepartmentValues.length && allDepartmentValues.length > 0) {
      setSelectedDepartments([]);
    } else {
      setSelectedDepartments(allDepartmentValues);
    }
  };
  
  const handleAssociationToggle = (associationId: number) => {
    setSelectedAssociations(prev => 
      prev.includes(associationId) 
        ? prev.filter(a => a !== associationId)
        : [...prev, associationId]
    );
  };
  
  const handleAssociationSelectAll = () => {
    const allAssociationIds = associationsOptions.map(a => Number(a.value));
    if (selectedAssociations.length === allAssociationIds.length && allAssociationIds.length > 0) {
      setSelectedAssociations([]);
    } else {
      setSelectedAssociations(allAssociationIds);
    }
  };

  const { data: paginatedData, isLoading, isError, error } = useQuery<AlumniAssociationResponse, Error>({
    queryKey: [
      "alumni-association",
      selectedFaculties,
      selectedDepartments,
      selectedAssociations,
      verifiedFilter,
      membershipFilter,
      currentPage,
      pageSize,
    ],
    queryFn: () => getAlumniAssociation(
      selectedFaculties.length > 0 ? selectedFaculties : undefined,
      selectedDepartments.length > 0 ? selectedDepartments : undefined,
      selectedAssociations.length > 0 ? selectedAssociations : undefined,
      verifiedFilter,
      membershipFilter,
      currentPage,
      pageSize
    ),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1, // Only retry once on failure
    retryDelay: 1000, // Wait 1 second before retry
  });

  // Fetch counts
  const { data: countsData, isLoading: isLoadingCounts } = useQuery({
    queryKey: [
      "alumni-association-counts",
      selectedFaculties,
      selectedDepartments,
      selectedAssociations,
      verifiedFilter,
    ],
    queryFn: () => getAlumniAssociationCounts(
      selectedFaculties.length > 0 ? selectedFaculties : undefined,
      selectedDepartments.length > 0 ? selectedDepartments : undefined,
      selectedAssociations.length > 0 ? selectedAssociations : undefined,
      verifiedFilter
    ),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const counts = useMemo(() => {
    return countsData || {
      total: 0,
      all: 0,
      members: 0,
      nonMembers: 0,
      verified: 0,
      unverified: 0,
    };
  }, [countsData]);
  
  const items = paginatedData?.items ?? [];
  const total = paginatedData?.total ?? 0;
  const totalPages = paginatedData?.totalPages ?? 1;

  // Handle sorting
  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new field with ascending direction
      setSortField(field);
      setSortDirection("asc");
    }
  }, [sortField, sortDirection]);

  // Client-side search filtering and sorting (server already handles pagination)
  const filteredItems = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    let filtered = items;
    
    // Apply search filter
    if (q) {
      filtered = items.filter((item) =>
      item.sapid?.toLowerCase().includes(q) ||
      item.registrationNo?.toLowerCase().includes(q) ||
      item.name?.toLowerCase().includes(q) ||
      item.email?.toLowerCase().includes(q) ||
      item.department?.toLowerCase().includes(q) ||
      item.faculty?.toLowerCase().includes(q) ||
      item.associationTitle?.toLowerCase().includes(q)
    );
    }
    
    // Apply sorting
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: string = "";
        let bValue: string = "";
        
        switch (sortField) {
          case "sapId":
            aValue = (a.sapid || a.registrationNo || "").trim().toLowerCase();
            bValue = (b.sapid || b.registrationNo || "").trim().toLowerCase();
            break;
          case "name":
            aValue = (a.name || "").trim().toLowerCase();
            bValue = (b.name || "").trim().toLowerCase();
            break;
          case "email":
            aValue = (a.email || "").trim().toLowerCase();
            bValue = (b.email || "").trim().toLowerCase();
            break;
          case "faculty":
            aValue = (a.faculty || "").trim().toLowerCase();
            bValue = (b.faculty || "").trim().toLowerCase();
            break;
          case "department":
            aValue = (a.department || "").trim().toLowerCase();
            bValue = (b.department || "").trim().toLowerCase();
            break;
          case "association":
            aValue = (a.associationTitle || "").trim().toLowerCase();
            bValue = (b.associationTitle || "").trim().toLowerCase();
            break;
          default:
            return 0;
        }
        
        // Use localeCompare for reliable string comparison
        const comparison = aValue.localeCompare(bValue, undefined, { 
          numeric: true, 
          sensitivity: 'base' 
        });
        
        return sortDirection === "asc" ? comparison : -comparison;
      });
    }
    
    return filtered;
  }, [items, debouncedQuery, sortField, sortDirection]);

  // Use server-side pagination, but apply client-side search
  const pageItems = filteredItems;

  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQuery, pageSize, selectedFaculties, selectedDepartments, selectedAssociations, verifiedFilter, membershipFilter, sortField, sortDirection]);

  const handleExportToExcel = useCallback(() => {
    const exportColumnKeys: string[] = [
      "SAP ID",
      "Registration No",
      "Full Name",
      "Gender",
      "Father Name",
      "Father CNIC",
      "Date of Birth",
      "Marital Status",
      "CNIC/Passport",
      "Primary Contact",
      "Secondary Contact",
      "Personal Email",
      "Official Email",
      "Official Number",
      "Home Address",
      "Home Country",
      "Home Province",
      "Home City",
      "Academic Session",
      "Program",
      "CGPA",
      "Year of Starting",
      "Year of Ending",
      "Faculty",
      "Campus",
      "Department",
      "Major Subject",
      "Industry",
      "Employment Status",
      "Employer",
      "Designation",
      "Total Years of Experience",
      "Work City",
      "Work Country",
      "Chapter 1",
      "Chapter 2",
      "Chapter 3",
      "All Chapters",
      "Chapter Remarks",
      "Association Title",
      "Association Description",
      "Association Dean",
      "Association Phone",
      "Association Email",
      "Association Address",
      "About Me",
      "Facebook",
      "Instagram",
      "YouTube",
      "LinkedIn",
      "Verification Status",
      "Last Login",
      "Login Count",
      "Email Send Count",
      "Email Send Status",
      "Alumni Status",
      "Created Date Time",
    ];

    const columns = exportColumnKeys.map((key) => ({
      key,
      label: key,
      defaultSelected: true,
    }));

    const fetchAndTransformData = async (): Promise<Record<string, unknown>[]> => {
      const url = new URL(
        "/api/alumni/association/export",
        typeof window !== "undefined" ? window.location.origin : ""
      );
      if (selectedFaculties.length > 0) {
        url.searchParams.set("faculties", selectedFaculties.join(","));
      }
      if (selectedDepartments.length > 0) {
        url.searchParams.set("departments", selectedDepartments.join(","));
      }
      if (selectedAssociations.length > 0) {
        url.searchParams.set("associations", selectedAssociations.join(","));
      }
      if (membershipFilter) {
        url.searchParams.set("membershipFilter", membershipFilter);
      }

      const res = await fetch(url.toString(), {
        headers: { accept: "application/json" },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch export data: ${res.status}`);
      }

      const data = await res.json();
      const allItems = data.items || [];

      if (!allItems || allItems.length === 0) {
        throw new Error("No data found to export with the applied filters.");
      }

      const formatChapters = (item: Record<string, unknown>) => {
        const chapters: string[] = [];
        const chapter1 = String(item.chapter1_national || item.chapter1_international || "");
        const chapter2 = String(item.chapter2_national || item.chapter2_international || "");
        const chapter3 = String(item.chapter3_national || item.chapter3_international || "");
        if (chapter1) chapters.push(chapter1);
        if (chapter2) chapters.push(chapter2);
        if (chapter3) chapters.push(chapter3);
        return chapters.filter((c) => c).join(", ") || "";
      };

      return allItems.map((item: Record<string, unknown>) => ({
        "SAP ID": item.sapid || "",
        "Registration No": item.registrationno || "",
        "Full Name": item.alumniname || "",
        "Gender": item.gender || "",
        "Father Name": item.fathername || "",
        "Father CNIC": item.father_cnic || "",
        "Date of Birth": item.dateofbirth || "",
        "Marital Status": item.maritalstatus || "",
        "CNIC/Passport": item.cnicpassport || "",
        "Primary Contact": item.contactno || "",
        "Secondary Contact": item.contactno1 || "",
        "Personal Email": item.personalemail || "",
        "Official Email": item.officialemail || "",
        "Official Number": item.officialnumber || "",
        "Home Address": item.address || "",
        "Home Country": item.country || "",
        "Home Province": item.province || "",
        "Home City": item.city || "",
        "Academic Session": item.academicsession || "",
        "Program": item.degreetitle || item.majorsubject || "",
        "CGPA": item.cgpa || "",
        "Year of Starting": item.yearofstarting || "",
        "Year of Ending": item.yearofending || "",
        "Faculty": item.facultyname || "",
        "Campus": item.campusname || "",
        "Department": item.departmentname || "",
        "Major Subject": item.majorsubject || "",
        "Industry": item.industry || "",
        "Employment Status": item.employeed || "",
        "Employer": item.nameoforganization || "",
        "Designation": item.designation || "",
        "Total Years of Experience": item.totalyearsofexpereince || "",
        "Work City": item.work_city || "",
        "Work Country": item.work_country || "",
        "Chapter 1": item.chapter1_national || item.chapter1_international || "",
        "Chapter 2": item.chapter2_national || item.chapter2_international || "",
        "Chapter 3": item.chapter3_national || item.chapter3_international || "",
        "All Chapters": formatChapters(item),
        "Chapter Remarks": item.chapter_remarks || "",
        "Association Title": item.association_title || "",
        "Association Description": item.association_description || "",
        "Association Dean": item.association_dean || "",
        "Association Phone": item.association_phone || "",
        "Association Email": item.association_email || "",
        "Association Address": item.association_address || "",
        "About Me": item.aboutme || "",
        "Facebook": item.facebook || "",
        "Instagram": item.instagram || "",
        "YouTube": item.youtube || "",
        "LinkedIn": item.linkedin || "",
        "Verification Status":
          item.verify === "true"
            ? "Verified"
            : item.verify === "false"
              ? "Unverified"
              : String(item.verify || "").trim().toLowerCase() === "underapproval"
                ? "Under Approval"
                : item.verify || "",
        "Last Login": item.lasttimelogin || "",
        "Login Count": item.logincount || 0,
        "Email Send Count": item.emailsendcount || 0,
        "Email Send Status": item.emailsendstatus || "",
        "Alumni Status": item.alumnistatus || "",
        "Created Date Time": item.createddatetime || "",
      }));
    };

    openExportModal({
      data: fetchAndTransformData,
      columns,
      filename: "alumni_association_export",
      sheetName: "Alumni Association",
    });
  }, [selectedFaculties, selectedDepartments, selectedAssociations, membershipFilter, openExportModal]);


  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Alumni Association</h3>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400" htmlFor="association-search">Search:</label>
          <input
            id="association-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, SAP ID, email, association..."
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={handleExportToExcel}
            disabled={isExporting || isLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isExporting ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export Excel
              </>
            )}
          </button>
          </div>
        </div>

        <ExportModal />

        {/* Stats Cards Section - Membership Tabs */}
        <div className="flex flex-wrap gap-4 px-0 pt-2">
          {MEMBERSHIP_TABS.map((tab, idx) => {
            const statCount = (() => {
              switch (tab.key) {
                case "all":
                  return counts.all;
                case "members":
                  return counts.members;
                case "non-members":
                  return counts.nonMembers;
                default:
                  return 0;
              }
            })();
            
            const isSelected = membershipFilter === tab.key;
            const statusStyles = MEMBERSHIP_STATUS_CLASS_MAP[tab.key];
           
            return (
              <button
                key={tab.key}
                type="button"
                className={`
                  relative group rounded-2xl p-4 text-left transition-all duration-300 ease-out w-50
                  ${isSelected 
                    ? `${statusStyles.selectedContainer} shadow-xl ring-2 ring-offset-2 ${statusStyles.iconColor.includes('blue') ? 'ring-blue-500' : statusStyles.iconColor.includes('emerald') ? 'ring-emerald-500' : statusStyles.iconColor.includes('amber') ? 'ring-amber-500' : 'ring-gray-500'} dark:ring-offset-gray-900 transform scale-[1.02]` 
                    : 'bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 hover:scale-[1.01]'
                  }
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900
                `}
                onClick={() => {

                  setMembershipFilter(tab.key);
                }}
                role="tab"
                aria-selected={isSelected}
                aria-label={`${tab.label} (${statCount.toLocaleString()})`}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight") {
                    e.preventDefault();
                    const nextIdx = (idx + 1) % MEMBERSHIP_TABS.length;
                    setMembershipFilter(MEMBERSHIP_TABS[nextIdx].key);
                  } else if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    const prevIdx = (idx - 1 + MEMBERSHIP_TABS.length) % MEMBERSHIP_TABS.length;
                    setMembershipFilter(MEMBERSHIP_TABS[prevIdx].key);
                  } else if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setMembershipFilter(tab.key);
                  }
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h6 className={`text-xs font-bold uppercase tracking-wider ${statusStyles.labelText}`}>
                    {tab.label}
                  </h6>
                  {isSelected && (
                    <div className={`w-2.5 h-2.5 rounded-full ${statusStyles.iconBg} animate-pulse`} />
                  )}
                </div>
                {isLoadingCounts && !countsData ? (
                  <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" aria-label="Loading count" />
                ) : (
                  <h3 className={`text-4xl font-extrabold tracking-tight ${statusStyles.labelText}`}>
                    {statCount.toLocaleString()}
                  </h3>
                )}
              </button>
            );
          })}
        </div>

        {/* Verified Checkbox */}
        <div className="flex items-center gap-3 px-0 py-2">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={verifiedFilter === true}
              onChange={(e) => setVerifiedFilter(e.target.checked ? true : undefined)}
              className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 border-2 border-gray-400 dark:border-gray-500 transition-all duration-200 cursor-pointer group-hover:border-blue-500 dark:group-hover:border-blue-400"
            />
            <span className={`text-base font-semibold transition-colors duration-200 ${
              verifiedFilter === true 
                ? "text-blue-700 dark:text-blue-300" 
                : "text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100"
            }`}>
              Verified Only
            </span>
            {verifiedFilter === true && (
              <span className="px-2 py-1 text-xs font-bold text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 rounded-md">
                Active
              </span>
            )}
          </label>
        </div>
      </div>

      {/* Filter Dropdowns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        {/* Faculty Filter */}
        <div className="flex-1 sm:min-w-[180px]">
          <label htmlFor="faculty-filter" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
            Faculty
          </label>
          <div className="relative" ref={facultyFilterRef}>
            <button
              type="button"
              id="faculty-filter"
              onClick={() => setExpandedFilters(prev => ({ ...prev, faculty: !prev.faculty }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-300/80 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 transition-all duration-200 appearance-none cursor-pointer text-left flex items-center justify-between"
            >
              <span>
                {selectedFaculties.length === 0 
                  ? "All Faculties" 
                  : selectedFaculties.length === facultyOptions.length && facultyOptions.length > 0
                  ? "All Faculties"
                  : `${selectedFaculties.length} Selected`}
              </span>
              <svg 
                className={`w-5 h-5 text-gray-400 dark:text-gray-500 transition-transform ${expandedFilters.faculty ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedFilters.faculty && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                <div className="p-2">
                  <label
                    className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors border-b border-gray-200 dark:border-gray-700 mb-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFacultySelectAll();
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFaculties.length === facultyOptions.length && facultyOptions.length > 0}
                      onChange={handleFacultySelectAll}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                    />
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Faculties</span>
                  </label>
                  <div className="max-h-48 overflow-y-auto">
                    {facultyOptions.map((faculty) => {
                      const isChecked = selectedFaculties.includes(faculty.value);
                      return (
                        <label
                          key={faculty.value}
                          className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                              onChange={() => handleFacultyToggle(faculty.value)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                          />
                            <span className="text-sm text-gray-700 dark:text-gray-300">{faculty.label}</span>
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{faculty.count}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Department Filter */}
        <div className="flex-1 sm:min-w-[180px]">
          <label htmlFor="department-filter" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
            Department
          </label>
          <div className="relative" ref={departmentFilterRef}>
            <button
              type="button"
              id="department-filter"
              onClick={() => setExpandedFilters(prev => ({ ...prev, department: !prev.department }))}
              disabled={selectedFaculties.length === 0}
              className="w-full px-4 py-3 rounded-xl border border-gray-300/80 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 transition-all duration-200 appearance-none cursor-pointer text-left flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>
                {selectedDepartments.length === 0 
                  ? selectedFaculties.length === 0 ? "Select Faculty First" : "All Departments" 
                  : selectedDepartments.length === departmentOptions.length && departmentOptions.length > 0
                  ? "All Departments"
                  : `${selectedDepartments.length} Selected`}
              </span>
              <svg 
                className={`w-5 h-5 text-gray-400 dark:text-gray-500 transition-transform ${expandedFilters.department ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedFilters.department && selectedFaculties.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                <div className="p-2">
                  {departmentOptions.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400 p-2">Select faculties first</p>
                  ) : (
                    <>
                      <label
                        className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors border-b border-gray-200 dark:border-gray-700 mb-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDepartmentSelectAll();
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedDepartments.length === departmentOptions.length && departmentOptions.length > 0}
                          onChange={handleDepartmentSelectAll}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                        />
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Departments</span>
                      </label>
                      <div className="max-h-48 overflow-y-auto">
                        {departmentOptions.map((dept) => {
                          const isChecked = selectedDepartments.includes(dept.value);
                          return (
                            <label
                              key={dept.value}
                              className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                  onChange={() => handleDepartmentToggle(dept.value)}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                              />
                                <span className="text-sm text-gray-700 dark:text-gray-300">{dept.label}</span>
                              </div>
                              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{dept.count}</span>
                            </label>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Association Filter */}
        <div className="flex-1 sm:min-w-[180px]">
          <label htmlFor="association-filter" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
            Association
          </label>
          <div className="relative" ref={associationFilterRef}>
            <button
              type="button"
              id="association-filter"
              onClick={() => setExpandedFilters(prev => ({ ...prev, association: !prev.association }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-300/80 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 transition-all duration-200 appearance-none cursor-pointer text-left flex items-center justify-between"
            >
              <span>
                {selectedAssociations.length === 0 
                  ? "All Associations" 
                  : selectedAssociations.length === associationsOptions.length && associationsOptions.length > 0
                  ? "All Associations"
                  : `${selectedAssociations.length} Selected`}
              </span>
              <svg 
                className={`w-5 h-5 text-gray-400 dark:text-gray-500 transition-transform ${expandedFilters.association ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedFilters.association && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                <div className="p-2">
                  <label
                    className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors border-b border-gray-200 dark:border-gray-700 mb-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAssociationSelectAll();
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedAssociations.length === associationsOptions.length && associationsOptions.length > 0}
                      onChange={handleAssociationSelectAll}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                    />
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Associations</span>
                  </label>
                  <div className="max-h-48 overflow-y-auto">
                    {associationsOptions.map((association) => {
                      const associationId = Number(association.value);
                      const isChecked = selectedAssociations.includes(associationId);
                      return (
                        <label
                          key={association.value}
                          className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                              onChange={() => handleAssociationToggle(associationId)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                          />
                            <span className="text-sm text-gray-700 dark:text-gray-300">{association.label}</span>
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{association.count}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clear Filters Button */}
      {(selectedFaculties.length > 0 || selectedDepartments.length > 0 || selectedAssociations.length > 0) && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setSelectedFaculties([]);
              setSelectedDepartments([]);
              setSelectedAssociations([]);
            }}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Clear All Filters
          </button>
        </div>
      )}

      <div className="overflow-hidden border-2 border-gray-200 rounded-lg bg-white shadow-sm">
        <SyncedTableScroll minWidth={1000} maxHeight={700}>
          <Table className="min-w-full">
            <TableHeader className="bg-gradient-to-r from-slate-50 to-slate-100 sticky top-0 z-10 border-b-2 border-gray-300">
              <TableRow>
                <TableCell 
                  className="px-6 py-4 text-left text-sm font-semibold text-slate-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSort("sapId")}
                >
                  <div className="flex items-center gap-2">
                    <span>SAP ID / Registration No</span>
                    <div className="flex flex-col">
                      <ArrowUpIcon className={`w-3 h-3 ${sortField === "sapId" && sortDirection === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                      <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortField === "sapId" && sortDirection === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                    </div>
                  </div>
                </TableCell>
                <TableCell 
                  className="px-6 py-4 text-left text-sm font-semibold text-slate-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center gap-2">
                    <span>Full Name</span>
                    <div className="flex flex-col">
                      <ArrowUpIcon className={`w-3 h-3 ${sortField === "name" && sortDirection === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                      <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortField === "name" && sortDirection === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                    </div>
                  </div>
                </TableCell>
                <TableCell 
                  className="px-6 py-4 text-left text-sm font-semibold text-slate-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSort("email")}
                >
                  <div className="flex items-center gap-2">
                    <span>Email</span>
                    <div className="flex flex-col">
                      <ArrowUpIcon className={`w-3 h-3 ${sortField === "email" && sortDirection === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                      <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortField === "email" && sortDirection === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                    </div>
                  </div>
                </TableCell>
                <TableCell 
                  className="px-6 py-4 text-left text-sm font-semibold text-slate-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSort("faculty")}
                >
                  <div className="flex items-center gap-2">
                    <span>Faculty</span>
                    <div className="flex flex-col">
                      <ArrowUpIcon className={`w-3 h-3 ${sortField === "faculty" && sortDirection === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                      <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortField === "faculty" && sortDirection === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                    </div>
                  </div>
                </TableCell>
                <TableCell 
                  className="px-6 py-4 text-left text-sm font-semibold text-slate-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSort("department")}
                >
                  <div className="flex items-center gap-2">
                    <span>Department</span>
                    <div className="flex flex-col">
                      <ArrowUpIcon className={`w-3 h-3 ${sortField === "department" && sortDirection === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                      <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortField === "department" && sortDirection === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                    </div>
                  </div>
                </TableCell>
                <TableCell 
                  className="px-6 py-4 text-left text-sm font-semibold text-slate-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSort("association")}
                >
                  <div className="flex items-center gap-2">
                    <span>Association</span>
                    <div className="flex flex-col">
                      <ArrowUpIcon className={`w-3 h-3 ${sortField === "association" && sortDirection === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                      <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortField === "association" && sortDirection === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    <TableCell className="px-6 py-4"><div className="h-5 w-24 bg-gray-200 animate-pulse rounded" /></TableCell>
                    <TableCell className="px-6 py-4"><div className="h-5 w-48 bg-gray-200 animate-pulse rounded" /></TableCell>
                    <TableCell className="px-6 py-4"><div className="h-5 w-40 bg-gray-200 animate-pulse rounded" /></TableCell>
                    <TableCell className="px-6 py-4"><div className="h-5 w-32 bg-gray-200 animate-pulse rounded" /></TableCell>
                    <TableCell className="px-6 py-4"><div className="h-5 w-36 bg-gray-200 animate-pulse rounded" /></TableCell>
                    <TableCell className="px-6 py-4"><div className="h-5 w-28 bg-gray-200 animate-pulse rounded" /></TableCell>
                  </TableRow>
                ))
              )}
              {!isLoading && isError && (
                <TableRow>
                  <TableCell colSpan={6} className="px-5 py-6 text-center text-red-600">
                    {error?.message || "Failed to load data"}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !isError && pageItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="px-5 py-8 text-center text-gray-600">
                    No alumni association members found
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !isError && pageItems.map((item, idx) => {
                const rowId = `${item.sapid || item.registrationNo || "row"}-${idx}`;
                const isExpanded = expandedRowId === rowId;
                
                return (
                  <React.Fragment key={rowId}>
                    <TableRow
                      className={`odd:bg-white even:bg-gray-50/50 hover:bg-blue-50/50 cursor-pointer ${
                        isExpanded ? "bg-blue-50/70" : ""
                      }`}
                      onClick={() => setExpandedRowId(isExpanded ? null : rowId)}
                      aria-selected={isExpanded}
                    >
                      <TableCell className="px-6 py-4 text-sm font-mono text-slate-700">
                        {item.sapid || item.registrationNo || "-"}
                        {item.sapid && item.registrationNo && item.sapid !== item.registrationNo && (
                          <span className="text-gray-500"> / {item.registrationNo}</span>
                        )}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm font-semibold text-slate-900">{item.name}</TableCell>
                      <TableCell className="px-6 py-4 text-sm">
                        <a href={item.email ? `mailto:${item.email}` : "#"} className="text-blue-600 hover:underline">
                          {item.email || "-"}
                        </a>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-slate-700">{item.faculty || "-"}</TableCell>
                      <TableCell className="px-6 py-4 text-sm text-slate-700">{item.department || "-"}</TableCell>
                      <TableCell className="px-6 py-4 text-sm">
                        {item.associationTitle ? (
                          <Badge size="sm" color="primary">{item.associationTitle}</Badge>
                        ) : "-"}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="bg-blue-50/30 dark:bg-blue-900/10">
                        <TableCell colSpan={6} className="px-0 py-4">
                          <div className="w-full overflow-x-hidden" style={{ maxWidth: "calc(100vw - 2rem)", boxSizing: "border-box" }}>
                            <div className="w-full max-w-full overflow-x-hidden grid grid-cols-1 lg:grid-cols-2 gap-4 px-4">
                              <AlumniExpandableDetails
                                sapId={item.sapid || item.registrationNo || ""}
                                onClose={() => setExpandedRowId(null)}
                              />
                              <ErpDataDetails
                                sapId={item.sapid || undefined}
                                registrationNo={item.registrationNo || undefined}
                                onClose={() => setExpandedRowId(null)}
                              />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </SyncedTableScroll>
        <div className="flex items-center justify-between p-4 border-t">
          <span className="text-sm text-gray-500">
            Showing {pageItems.length ? ((currentPage - 1) * pageSize) + 1 : 0}-{Math.min((currentPage - 1) * pageSize + pageItems.length, total)} of {total}
          </span>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-500" htmlFor="association-page-size">Items per page:</label>
            <select
              id="association-page-size"
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        </div>
      </div>
    </div>
  );
};

