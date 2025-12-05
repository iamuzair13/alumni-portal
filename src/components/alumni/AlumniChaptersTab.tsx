"use client";

import React, { useMemo, useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableHeader, TableBody, TableCell, TableRow } from "@/components/ui/table";
import Pagination from "@/components/tables/Pagination";
import Badge from "../ui/badge/Badge";
import { getFaculties, getDepartmentsByFaculty } from "@/data/programs-departments";

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
  nationalChapter?: string,
  internationalChapter?: string,
  faculty?: string,
  department?: string,
  verified?: boolean,
  membershipFilter?: MembershipFilter
): Promise<ChapterItem[]> {
  const url = new URL("/api/alumni/chapters", typeof window !== "undefined" ? window.location.origin : "");
  // Only add parameters if they have actual values (not empty strings)
  if (nationalChapter && nationalChapter.trim()) {
    url.searchParams.set("nationalChapter", nationalChapter.trim());
  }
  if (internationalChapter && internationalChapter.trim()) {
    url.searchParams.set("internationalChapter", internationalChapter.trim());
  }
  if (faculty && faculty.trim()) {
    url.searchParams.set("faculty", faculty.trim());
  }
  if (department && department.trim()) {
    url.searchParams.set("department", department.trim());
  }
  if (verified !== undefined) {
    url.searchParams.set("verified", verified ? "true" : "false");
  }
  if (membershipFilter) {
    url.searchParams.set("membershipFilter", membershipFilter);
  }
  
  console.log("[AlumniChaptersTab] Fetching with filters:", {
    nationalChapter: nationalChapter || "none",
    internationalChapter: internationalChapter || "none",
    faculty: faculty || "none",
    department: department || "none",
    verified: verified !== undefined ? (verified ? "true" : "false") : "none",
    membershipFilter: membershipFilter || "none",
    url: url.toString(),
  });
  
  const res = await fetch(url.toString(), { headers: { "accept": "application/json" } });
  if (!res.ok) {
    throw new Error("Failed to fetch alumni chapters");
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
  
  // Filter states
  const [selectedNationalChapter, setSelectedNationalChapter] = useState<string>("");
  const [selectedInternationalChapter, setSelectedInternationalChapter] = useState<string>("");
  const [selectedFaculty, setSelectedFaculty] = useState<string>("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [verifiedFilter, setVerifiedFilter] = useState<boolean | undefined>(undefined);
  const [membershipFilter, setMembershipFilter] = useState<MembershipFilter>("members");

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
    if (!selectedFaculty) return [];
    return getDepartmentsByFaculty(selectedFaculty);
  }, [selectedFaculty]);

  // Reset department when faculty changes
  useEffect(() => {
    setSelectedDepartment("");
  }, [selectedFaculty]);

  // Fetch alumni chapters with filters
  const { data: items = [], isLoading, isError, error } = useQuery<ChapterItem[], Error>({
    queryKey: [
      "alumni-chapters",
      selectedNationalChapter,
      selectedInternationalChapter,
      selectedFaculty,
      selectedDepartment,
      verifiedFilter,
      membershipFilter,
    ],
    queryFn: () => getAlumniChapters(
      selectedNationalChapter && selectedNationalChapter.trim() ? selectedNationalChapter.trim() : undefined,
      selectedInternationalChapter && selectedInternationalChapter.trim() ? selectedInternationalChapter.trim() : undefined,
      selectedFaculty && selectedFaculty.trim() ? selectedFaculty.trim() : undefined,
      selectedDepartment && selectedDepartment.trim() ? selectedDepartment.trim() : undefined,
      verifiedFilter,
      membershipFilter
    ),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const filteredItems = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      item.sapid?.toLowerCase().includes(q) ||
      item.registrationNo?.toLowerCase().includes(q) ||
      item.name?.toLowerCase().includes(q) ||
      item.email?.toLowerCase().includes(q) ||
      item.department?.toLowerCase().includes(q) ||
      item.faculty?.toLowerCase().includes(q) ||
      item.chapters.some(ch => ch.toLowerCase().includes(q))
    );
  }, [items, debouncedQuery]);

  const total = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = filteredItems.slice(start, end);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQuery, pageSize, selectedNationalChapter, selectedInternationalChapter, selectedFaculty, selectedDepartment, verifiedFilter, membershipFilter]);

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
      if (selectedNationalChapter) {
        url.searchParams.set("nationalChapter", selectedNationalChapter);
      }
      if (selectedInternationalChapter) {
        url.searchParams.set("internationalChapter", selectedInternationalChapter);
      }
      if (selectedFaculty) {
        url.searchParams.set("faculty", selectedFaculty);
      }
      if (selectedDepartment) {
        url.searchParams.set("department", selectedDepartment);
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
  }, [isExporting, debouncedQuery, selectedNationalChapter, selectedInternationalChapter, selectedFaculty, selectedDepartment, verifiedFilter, membershipFilter]);

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

      {/* Filter Dropdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        {/* National Chapter Filter */}
        <div>
          <label htmlFor="national-chapter-filter" className="block text-sm font-medium text-gray-700 mb-1">
            National Chapter
          </label>
          <select
            id="national-chapter-filter"
            value={selectedNationalChapter}
            onChange={(e) => setSelectedNationalChapter(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All National Chapters</option>
            {nationalChapters.map((chapter) => (
              <option key={chapter.id} value={chapter.name}>
                {chapter.name}
              </option>
            ))}
          </select>
        </div>

        {/* International Chapter Filter */}
        <div>
          <label htmlFor="international-chapter-filter" className="block text-sm font-medium text-gray-700 mb-1">
            International Chapter
          </label>
          <select
            id="international-chapter-filter"
            value={selectedInternationalChapter}
            onChange={(e) => setSelectedInternationalChapter(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All International Chapters ({internationalChapters.length})</option>
            {internationalChapters.map((chapter) => (
              <option key={chapter.id} value={chapter.name}>
                {chapter.name}
              </option>
            ))}
          </select>
        </div>

        {/* Faculty Filter */}
        <div>
          <label htmlFor="faculty-filter" className="block text-sm font-medium text-gray-700 mb-1">
            Faculty
          </label>
          <select
            id="faculty-filter"
            value={selectedFaculty}
            onChange={(e) => setSelectedFaculty(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Faculties ({faculties.length})</option>
            {faculties.map((faculty) => (
              <option key={faculty} value={faculty}>
                {faculty}
              </option>
            ))}
          </select>
        </div>

        {/* Department Filter */}
        <div>
          <label htmlFor="department-filter" className="block text-sm font-medium text-gray-700 mb-1">
            Department
          </label>
          <select
            id="department-filter"
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            disabled={!selectedFaculty}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">
              {selectedFaculty ? `All Departments (${availableDepartments.length})` : "Select Faculty First"}
            </option>
            {availableDepartments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Clear Filters Button */}
      {(selectedNationalChapter || selectedInternationalChapter || selectedFaculty || selectedDepartment || verifiedFilter !== undefined) && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setSelectedNationalChapter("");
              setSelectedInternationalChapter("");
              setSelectedFaculty("");
              setSelectedDepartment("");
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
                <TableCell className="px-6 py-4 text-left text-sm font-semibold text-slate-700">SAP ID</TableCell>
                <TableCell className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Full Name</TableCell>
                <TableCell className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Email</TableCell>
                <TableCell className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Faculty</TableCell>
                <TableCell className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Department</TableCell>
                <TableCell className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Chapters</TableCell>
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
                  <TableCell className="px-6 py-4 text-sm font-mono text-slate-700">{item.sapid}</TableCell>
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

