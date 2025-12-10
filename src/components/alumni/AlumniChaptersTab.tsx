"use client";

import React, { useMemo, useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableHeader, TableBody, TableCell, TableRow } from "@/components/ui/table";
import Pagination from "@/components/tables/Pagination";
import Badge from "../ui/badge/Badge";
import { getFaculties, getDepartmentsByFaculty } from "@/data/programs-departments";
import { ArrowUpIcon, ArrowDownIcon } from "@/icons";

type ChapterItem = {
  sapid: string;
  registrationNo: string | null;
  name: string;
  department: string | null;
  faculty: string | null;
  program: string | null;
  email: string | null;
  chapters: string[];
};

type Chapter = {
  id: number;
  name: string;
  type: "national" | "international";
};

type MembershipFilter = "all" | "members" | "non-members";

async function getAlumniChapters(
  nationalChapters?: string[],
  internationalChapters?: string[],
  faculties?: string[],
  departments?: string[],
  verified?: boolean,
  membershipFilter?: MembershipFilter
): Promise<ChapterItem[]> {
  const url = new URL("/api/alumni/chapters", typeof window !== "undefined" ? window.location.origin : "");
  // Only add parameters if they have actual values (not empty arrays)
  if (nationalChapters && nationalChapters.length > 0) {
    url.searchParams.set("nationalChapters", nationalChapters.join(","));
  }
  if (internationalChapters && internationalChapters.length > 0) {
    url.searchParams.set("internationalChapters", internationalChapters.join(","));
  }
  if (faculties && faculties.length > 0) {
    url.searchParams.set("faculties", faculties.join(","));
  }
  if (departments && departments.length > 0) {
    url.searchParams.set("departments", departments.join(","));
  }
  if (verified !== undefined) {
    url.searchParams.set("verified", verified ? "true" : "false");
  }
  if (membershipFilter) {
    url.searchParams.set("membershipFilter", membershipFilter);
  }
  
  console.log("[AlumniChaptersTab] Fetching with filters:", {
    nationalChapters: nationalChapters && nationalChapters.length > 0 ? nationalChapters : "none",
    internationalChapters: internationalChapters && internationalChapters.length > 0 ? internationalChapters : "none",
    faculties: faculties && faculties.length > 0 ? faculties : "none",
    departments: departments && departments.length > 0 ? departments : "none",
    verified: verified !== undefined ? (verified ? "true" : "false") : "none",
    membershipFilter: membershipFilter || "none",
    url: url.toString(),
  });
  
  const res = await fetch(url.toString(), { headers: { "accept": "application/json" } });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = (errorData as { error?: string })?.error || `Failed to fetch alumni chapters (${res.status})`;
    console.error("[AlumniChaptersTab] API Error:", errorMessage, errorData);
    throw new Error(errorMessage);
  }
  const data = (await res.json()) as { items: ChapterItem[] };
  console.log("[AlumniChaptersTab] Received items:", data.items?.length || 0);
  return data.items ?? [];
}

async function getChaptersList(): Promise<Chapter[]> {
  const res = await fetch("/api/chapters/list", { headers: { "accept": "application/json" } });
  if (!res.ok) {
    throw new Error("Failed to fetch chapters list");
  }
  const data = (await res.json()) as { chapters: Chapter[] };
  return data.chapters ?? [];
}

export const AlumniChaptersTab: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [query, setQuery] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
  // Filter states - arrays for multi-select
  const [selectedNationalChapters, setSelectedNationalChapters] = useState<string[]>([]);
  const [selectedInternationalChapters, setSelectedInternationalChapters] = useState<string[]>([]);
  const [selectedFaculties, setSelectedFaculties] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [verifiedFilter, setVerifiedFilter] = useState<boolean | undefined>(undefined);
  const [membershipFilter, setMembershipFilter] = useState<MembershipFilter>("members");
  
  // State for expanded filter sections
  const [expandedFilters, setExpandedFilters] = useState<{
    nationalChapter: boolean;
    internationalChapter: boolean;
    faculty: boolean;
    department: boolean;
  }>({
    nationalChapter: false,
    internationalChapter: false,
    faculty: false,
    department: false,
  });
  
  // Refs for filter dropdowns (click outside to close)
  const nationalChapterFilterRef = React.useRef<HTMLDivElement>(null);
  const internationalChapterFilterRef = React.useRef<HTMLDivElement>(null);
  const facultyFilterRef = React.useRef<HTMLDivElement>(null);
  const departmentFilterRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Fetch chapters list for dropdowns
  const { data: chaptersList = [] } = useQuery<Chapter[]>({
    queryKey: ["chapters-list"],
    queryFn: getChaptersList,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Get national and international chapters separately
  const nationalChapters = useMemo(() => {
    const filtered = chaptersList.filter(ch => ch.type === "national").sort((a, b) => a.name.localeCompare(b.name));
    console.log("[AlumniChaptersTab] National chapters:", filtered.length, filtered.map(ch => ch.name));
    return filtered;
  }, [chaptersList]);

  const internationalChapters = useMemo(() => {
    const filtered = chaptersList.filter(ch => ch.type === "international").sort((a, b) => a.name.localeCompare(b.name));
    console.log("[AlumniChaptersTab] International chapters:", filtered.length, filtered.map(ch => ch.name));
    return filtered;
  }, [chaptersList]);

  // Get faculties and departments
  const faculties = useMemo(() => getFaculties(), []);
  const availableDepartments = useMemo(() => {
    if (selectedFaculties.length === 0) return [];
    // Get all departments from selected faculties
    const deptSet = new Set<string>();
    selectedFaculties.forEach(faculty => {
      const depts = getDepartmentsByFaculty(faculty);
      depts.forEach(dept => deptSet.add(dept));
    });
    return Array.from(deptSet).sort();
  }, [selectedFaculties]);

  // Reset departments when faculties change
  useEffect(() => {
    if (selectedFaculties.length === 0) {
      setSelectedDepartments([]);
    } else {
      // Remove departments that are no longer available
      const availableDeptNames = availableDepartments;
      setSelectedDepartments(prev => prev.filter(dept => availableDeptNames.includes(dept)));
    }
  }, [selectedFaculties, availableDepartments]);
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (nationalChapterFilterRef.current && !nationalChapterFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, nationalChapter: false }));
      }
      if (internationalChapterFilterRef.current && !internationalChapterFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, internationalChapter: false }));
      }
      if (facultyFilterRef.current && !facultyFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, faculty: false }));
      }
      if (departmentFilterRef.current && !departmentFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, department: false }));
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Handlers for checkbox toggles
  const handleNationalChapterToggle = (chapterName: string) => {
    setSelectedNationalChapters(prev => 
      prev.includes(chapterName) 
        ? prev.filter(ch => ch !== chapterName)
        : [...prev, chapterName]
    );
  };
  
  const handleNationalChapterSelectAll = () => {
    if (selectedNationalChapters.length === nationalChapters.length) {
      setSelectedNationalChapters([]);
    } else {
      setSelectedNationalChapters(nationalChapters.map(ch => ch.name));
    }
  };
  
  const handleInternationalChapterToggle = (chapterName: string) => {
    setSelectedInternationalChapters(prev => 
      prev.includes(chapterName) 
        ? prev.filter(ch => ch !== chapterName)
        : [...prev, chapterName]
    );
  };
  
  const handleInternationalChapterSelectAll = () => {
    if (selectedInternationalChapters.length === internationalChapters.length) {
      setSelectedInternationalChapters([]);
    } else {
      setSelectedInternationalChapters(internationalChapters.map(ch => ch.name));
    }
  };
  
  const handleFacultyToggle = (facultyName: string) => {
    setSelectedFaculties(prev => 
      prev.includes(facultyName) 
        ? prev.filter(f => f !== facultyName)
        : [...prev, facultyName]
    );
  };
  
  const handleFacultySelectAll = () => {
    if (selectedFaculties.length === faculties.length) {
      setSelectedFaculties([]);
    } else {
      setSelectedFaculties(faculties);
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
    if (selectedDepartments.length === availableDepartments.length) {
      setSelectedDepartments([]);
    } else {
      setSelectedDepartments(availableDepartments);
    }
  };

  // Fetch alumni chapters with filters
  const { data: items = [], isLoading, isError, error } = useQuery<ChapterItem[], Error>({
    queryKey: [
      "alumni-chapters",
      selectedNationalChapters,
      selectedInternationalChapters,
      selectedFaculties,
      selectedDepartments,
      verifiedFilter,
      membershipFilter,
    ],
    queryFn: () => getAlumniChapters(
      selectedNationalChapters.length > 0 ? selectedNationalChapters : undefined,
      selectedInternationalChapters.length > 0 ? selectedInternationalChapters : undefined,
      selectedFaculties.length > 0 ? selectedFaculties : undefined,
      selectedDepartments.length > 0 ? selectedDepartments : undefined,
      verifiedFilter,
      membershipFilter
    ),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

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
        item.chapters.some(ch => ch.toLowerCase().includes(q))
      );
    }
    
    // Apply sorting
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: string | number | null | undefined = "";
        let bValue: string | number | null | undefined = "";
        
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
          case "chapters":
            aValue = (a.chapters.join(", ") || "").trim().toLowerCase();
            bValue = (b.chapters.join(", ") || "").trim().toLowerCase();
            break;
          default:
            return 0;
        }
        
        // Handle null/undefined values
        const aStr = String(aValue || "");
        const bStr = String(bValue || "");
        
        if (aStr < bStr) return sortDirection === "asc" ? -1 : 1;
        if (aStr > bStr) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }
    
    return filtered;
  }, [items, debouncedQuery, sortField, sortDirection]);

  const total = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = filteredItems.slice(start, end);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQuery, pageSize, selectedNationalChapters, selectedInternationalChapters, selectedFaculties, selectedDepartments, verifiedFilter, membershipFilter, sortField, sortDirection]);

  const [isExporting, setIsExporting] = useState(false);

  // Export to Excel function - comprehensive export with ALL fields
  const handleExportToExcel = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      // Dynamically import xlsx to avoid server-side bundling issues
      const XLSX = await import("xlsx");
      
      // Fetch comprehensive data from export endpoint
      const url = new URL("/api/alumni/chapters/export", typeof window !== "undefined" ? window.location.origin : "");
      if (debouncedQuery) {
        url.searchParams.set("search", debouncedQuery);
      }
      if (selectedNationalChapters.length > 0) {
        url.searchParams.set("nationalChapters", selectedNationalChapters.join(","));
      }
      if (selectedInternationalChapters.length > 0) {
        url.searchParams.set("internationalChapters", selectedInternationalChapters.join(","));
      }
      if (selectedFaculties.length > 0) {
        url.searchParams.set("faculties", selectedFaculties.join(","));
      }
      if (selectedDepartments.length > 0) {
        url.searchParams.set("departments", selectedDepartments.join(","));
      }
      if (verifiedFilter !== undefined) {
        url.searchParams.set("verified", verifiedFilter ? "true" : "false");
      }
      if (membershipFilter) {
        url.searchParams.set("membershipFilter", membershipFilter);
      }
      
      const res = await fetch(url.toString(), {
        headers: { "accept": "application/json" }
      });
      
      if (!res.ok) {
        throw new Error(`Failed to fetch export data: ${res.status}`);
      }
      
      const data = await res.json();
      const allItems = data.items || [];

      // Helper function to format chapter names
      const formatChapters = (item: Record<string, unknown>) => {
        const chapters: string[] = [];
        const chapter1 = String(item.chapter1_national || item.chapter1_international || "");
        const chapter2 = String(item.chapter2_national || item.chapter2_international || "");
        const chapter3 = String(item.chapter3_national || item.chapter3_international || "");
        if (chapter1) chapters.push(chapter1);
        if (chapter2) chapters.push(chapter2);
        if (chapter3) chapters.push(chapter3);
        return chapters.filter(c => c).join(", ") || "";
      };

      // Map ALL fields to Excel format
      const excelData = allItems.map((item: Record<string, unknown>) => ({
        // Basic Information
        "Alumni ID": item.alumniid || "",
        "SAP ID": item.sapid || "",
        "Registration No": item.registrationno || "",
        "Alumni Email": item.alumniemail || "",
        "Full Name": item.alumniname || "",
        "Gender": item.gender || "",
        "Father Name": item.fathername || "",
        "Father CNIC": item.father_cnic || "",
        "Date of Birth": item.dateofbirth || "",
        "Marital Status": item.maritalstatus || "",
        "CNIC/Passport": item.cnicpassport || "",
        
        // Contact Information
        "Contact No": item.contactno || "",
        "Contact No 1": item.contactno1 || "",
        "Contact No 1 Show": item.contactno1show || "",
        "Personal Email": item.personalemail || "",
        "Personal Email Show": item.personalemailshow || "",
        "University Email": item.universityemail || "",
        "Official Email": item.officialemail || "",
        "Official Number": item.officialnumber || "",
        "Address": item.address || "",
        "Country": item.country || "",
        "Province": item.province || "",
        "City": item.city || "",
        
        // Academic Information
        "Academic Session": item.academicsession || "",
        "Degree Title": item.degreetitle || "",
        "CGPA": item.cgpa || "",
        "Year of Starting": item.yearofstarting || "",
        "Year of Ending": item.yearofending || "",
        "Faculty": item.facultyname || "",
        "Campus": item.campusname || "",
        "Department": item.departmentname || "",
        "Major Subject": item.majorsubject || "",
        
        // Professional Information
        "Industry": item.industry || "",
        "Employment Status": item.employeed || "",
        "Organization": item.nameoforganization || "",
        "Designation": item.designation || "",
        "Total Years of Experience": item.totalyearsofexpereince || "",
        "Work City": item.work_city || "",
        "Work Country": item.work_country || "",
        "Organization Address": item.organization_address || "",
        "Supervisor Designation": item.supervisordesignation || "",
        "Supervisor Number": item.supervisornumber || "",
        
        // Chapters
        "Chapter 1 ID": item.chapter1_id || "",
        "Chapter 1": item.chapter1_national || item.chapter1_international || "",
        "Chapter 2 ID": item.chapter2_id || "",
        "Chapter 2": item.chapter2_national || item.chapter2_international || "",
        "Chapter 3 ID": item.chapter3_id || "",
        "Chapter 3": item.chapter3_national || item.chapter3_international || "",
        "All Chapters": formatChapters(item),
        "Chapter Remarks": item.chapter_remarks || "",
        
        // Association
        "Association ID": item.association_id_value || "",
        "Association Title": item.association_title || "",
        "Association Description": item.association_description || "",
        "Association Dean": item.association_dean || "",
        "Association Phone": item.association_phone || "",
        "Association Email": item.association_email || "",
        "Association Address": item.association_address || "",
        
        // Additional Information
        "About Me": item.aboutme || "",
        "Image 1": item.image1 || "",
        "Image 2": item.image2 || "",
        "CV": item.cv || "",
        
        // Social Links
        "Facebook": item.facebook || "",
        "Instagram": item.instagram || "",
        "YouTube": item.youtube || "",
        "LinkedIn": item.linkedin || "",
        
        // System Information
        "Verification Status": item.verify === "true" ? "Verified" : item.verify === "false" ? "Unverified" : item.verify === "pending" || item.verify === null || item.verify === "" ? "Under Approval" : item.verify || "",
        "Last Login": item.lasttimelogin || "",
        "Login Count": item.logincount || 0,
        "Email Send Count": item.emailsendcount || 0,
        "Email Send Status": item.emailsendstatus || "",
        "Data Source": item.datasource || "",
        "Alumni Status": item.alumnistatus || "",
        "Created Date Time": item.createddatetime || "",
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths for all columns (auto-width for comprehensive export)
      const colWidths = Object.keys(excelData[0] || {}).map(() => ({ wch: 20 }));
      ws["!cols"] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Alumni Chapters");

      // Generate filename with current date and filters
      const dateStr = new Date().toISOString().split("T")[0];
      const searchStr = debouncedQuery ? `_search` : "";
      const filename = `alumni_chapters_export${searchStr}_${dateStr}.xlsx`;

      // Write and download
      XLSX.writeFile(wb, filename);
      setIsExporting(false);
    } catch (error) {
      console.error("Export error:", error);
      setIsExporting(false);
      alert("Failed to export data. Please try again.");
    }
  }, [isExporting, debouncedQuery, selectedNationalChapters, selectedInternationalChapters, selectedFaculties, selectedDepartments, verifiedFilter, membershipFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-slate-900">Alumni Chapters</h3>
          {/* Membership Tabs */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMembershipFilter("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                membershipFilter === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Total Alumni
            </button>
            <button
              type="button"
              onClick={() => setMembershipFilter("members")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                membershipFilter === "members"
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Members
            </button>
            <button
              type="button"
              onClick={() => setMembershipFilter("non-members")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                membershipFilter === "non-members"
                  ? "bg-amber-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Non-Members
            </button>
          </div>
          {/* Verified Tab */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setVerifiedFilter(verifiedFilter === true ? undefined : true)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                verifiedFilter === true
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Verified
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600" htmlFor="chapters-search">Search:</label>
          <input
            id="chapters-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, SAP ID, email, chapter..."
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      {/* Filter Dropdowns - Checkbox-based multi-select */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end p-4 bg-gray-50 rounded-lg border border-gray-200">
        {/* National Chapter Filter */}
        <div className="flex-1 sm:min-w-[200px]">
          <label htmlFor="national-chapter-filter" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
            National Chapter
          </label>
          <div className="relative" ref={nationalChapterFilterRef}>
            <button
              type="button"
            id="national-chapter-filter"
              onClick={() => setExpandedFilters(prev => ({ ...prev, nationalChapter: !prev.nationalChapter }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-300/80 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 transition-all duration-200 appearance-none cursor-pointer text-left flex items-center justify-between"
            >
              <span>
                {selectedNationalChapters.length === 0 
                  ? "All National Chapters" 
                  : selectedNationalChapters.length === nationalChapters.length
                  ? "All National Chapters"
                  : `${selectedNationalChapters.length} Selected`}
              </span>
              <svg 
                className={`w-5 h-5 text-gray-400 dark:text-gray-500 transition-transform ${expandedFilters.nationalChapter ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedFilters.nationalChapter && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                <div className="p-2">
                  <label
                    className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors border-b border-gray-200 dark:border-gray-700 mb-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNationalChapterSelectAll();
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedNationalChapters.length === nationalChapters.length}
                      onChange={handleNationalChapterSelectAll}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                    />
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All National Chapters</span>
                  </label>
                  <div className="max-h-48 overflow-y-auto">
                    {nationalChapters.map((chapter) => {
                      const isChecked = selectedNationalChapters.includes(chapter.name);
                      return (
                        <label
                          key={chapter.id}
                          className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleNationalChapterToggle(chapter.name)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{chapter.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* International Chapter Filter */}
        <div className="flex-1 sm:min-w-[200px]">
          <label htmlFor="international-chapter-filter" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
            International Chapter
          </label>
          <div className="relative" ref={internationalChapterFilterRef}>
            <button
              type="button"
            id="international-chapter-filter"
              onClick={() => setExpandedFilters(prev => ({ ...prev, internationalChapter: !prev.internationalChapter }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-300/80 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 transition-all duration-200 appearance-none cursor-pointer text-left flex items-center justify-between"
            >
              <span>
                {selectedInternationalChapters.length === 0 
                  ? "All International Chapters" 
                  : selectedInternationalChapters.length === internationalChapters.length
                  ? "All International Chapters"
                  : `${selectedInternationalChapters.length} Selected`}
              </span>
              <svg 
                className={`w-5 h-5 text-gray-400 dark:text-gray-500 transition-transform ${expandedFilters.internationalChapter ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedFilters.internationalChapter && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                <div className="p-2">
                  <label
                    className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors border-b border-gray-200 dark:border-gray-700 mb-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleInternationalChapterSelectAll();
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedInternationalChapters.length === internationalChapters.length}
                      onChange={handleInternationalChapterSelectAll}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                    />
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All International Chapters</span>
                  </label>
                  <div className="max-h-48 overflow-y-auto">
                    {internationalChapters.map((chapter) => {
                      const isChecked = selectedInternationalChapters.includes(chapter.name);
                      return (
                        <label
                          key={chapter.id}
                          className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleInternationalChapterToggle(chapter.name)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{chapter.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

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
                  : selectedFaculties.length === faculties.length
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
                      checked={selectedFaculties.length === faculties.length}
                      onChange={handleFacultySelectAll}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                    />
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Faculties</span>
                  </label>
                  <div className="max-h-48 overflow-y-auto">
                    {faculties.map((faculty) => {
                      const isChecked = selectedFaculties.includes(faculty);
                      return (
                        <label
                          key={faculty}
                          className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleFacultyToggle(faculty)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{faculty}</span>
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
                  : selectedDepartments.length === availableDepartments.length
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
                  {availableDepartments.length === 0 ? (
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
                          checked={selectedDepartments.length === availableDepartments.length}
                          onChange={handleDepartmentSelectAll}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                        />
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Departments</span>
                      </label>
                      <div className="max-h-48 overflow-y-auto">
                        {availableDepartments.map((dept) => {
                          const isChecked = selectedDepartments.includes(dept);
                          return (
                            <label
                              key={dept}
                              className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleDepartmentToggle(dept)}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">{dept}</span>
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
      </div>

      {/* Clear Filters Button */}
      {(selectedNationalChapters.length > 0 || selectedInternationalChapters.length > 0 || selectedFaculties.length > 0 || selectedDepartments.length > 0 || verifiedFilter !== undefined) && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setSelectedNationalChapters([]);
              setSelectedInternationalChapters([]);
              setSelectedFaculties([]);
              setSelectedDepartments([]);
              setVerifiedFilter(undefined);
            }}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Clear All Filters
          </button>
        </div>
      )}

      <div className="overflow-hidden border-2 border-gray-200 rounded-lg bg-white shadow-sm">
        <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
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
                  onClick={() => handleSort("chapters")}
                >
                  <div className="flex items-center gap-2">
                    <span>Chapters</span>
                    <div className="flex flex-col">
                      <ArrowUpIcon className={`w-3 h-3 ${sortField === "chapters" && sortDirection === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                      <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortField === "chapters" && sortDirection === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
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
                    <TableCell className="px-6 py-4"><div className="h-5 w-40 bg-gray-200 animate-pulse rounded" /></TableCell>
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
                    No alumni chapters found
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !isError && pageItems.map((item, idx) => (
                <TableRow key={`${item.sapid}-${idx}`} className="odd:bg-white even:bg-gray-50/50 hover:bg-blue-50/50">
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
                    {item.chapters.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {item.chapters.map((chapter, i) => (
                          <Badge key={i} size="sm" color="success">{chapter}</Badge>
                        ))}
                      </div>
                    ) : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between p-4 border-t">
          <span className="text-sm text-gray-500">
            Showing {pageItems.length ? start + 1 : 0}-{pageItems.length ? start + pageItems.length : 0} of {total}
          </span>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-500" htmlFor="chapters-page-size">Items per page:</label>
            <select
              id="chapters-page-size"
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

