"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableHeader, TableBody, TableCell, TableRow } from "@/components/ui/table";
import Pagination from "@/components/tables/Pagination";
import Badge from "../ui/badge/Badge";
import { getFaculties, getDepartmentsByFaculty } from "@/data/programs-departments";
import * as XLSX from "xlsx";

type MembershipFilter = "all" | "members" | "non-members";

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

async function getAlumniAssociation(
  faculty?: string,
  department?: string,
  membershipFilter?: MembershipFilter
): Promise<AssociationItem[]> {
  const url = new URL("/api/alumni/association", typeof window !== "undefined" ? window.location.origin : "");
  // Only add parameters if they have actual values (not empty strings)
  if (faculty && faculty.trim()) {
    url.searchParams.set("faculty", faculty.trim());
  }
  if (department && department.trim()) {
    url.searchParams.set("department", department.trim());
  }
  if (membershipFilter) {
    url.searchParams.set("membershipFilter", membershipFilter);
  }
  
  console.log("[AlumniAssociationTab] Fetching with filters:", {
    faculty: faculty || "none",
    department: department || "none",
    membershipFilter: membershipFilter || "none",
    url: url.toString(),
  });
  
  const res = await fetch(url.toString(), { headers: { "accept": "application/json" } });
  if (!res.ok) {
    throw new Error("Failed to fetch alumni association");
  }
  const data = (await res.json()) as { items: AssociationItem[] };
  console.log("[AlumniAssociationTab] Received items:", data.items?.length || 0);
  return data.items ?? [];
}

export const AlumniAssociationTab: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [query, setQuery] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");
  
  // Filter states
  const [selectedFaculty, setSelectedFaculty] = useState<string>("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [membershipFilter, setMembershipFilter] = useState<MembershipFilter>("members");
  const [isExporting, setIsExporting] = useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

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

  const { data: items = [], isLoading, isError, error } = useQuery<AssociationItem[], Error>({
    queryKey: [
      "alumni-association",
      selectedFaculty,
      selectedDepartment,
      membershipFilter,
    ],
    queryFn: () => getAlumniAssociation(
      selectedFaculty && selectedFaculty.trim() ? selectedFaculty.trim() : undefined,
      selectedDepartment && selectedDepartment.trim() ? selectedDepartment.trim() : undefined,
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
      item.associationTitle?.toLowerCase().includes(q)
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
  }, [debouncedQuery, pageSize, selectedFaculty, selectedDepartment, membershipFilter]);

  const handleExportToExcel = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const url = new URL("/api/alumni/association/export", typeof window !== "undefined" ? window.location.origin : "");
      if (selectedFaculty) {
        url.searchParams.set("faculty", selectedFaculty);
      }
      if (selectedDepartment) {
        url.searchParams.set("department", selectedDepartment);
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

      // Map all fields to Excel format - comprehensive export like alumni tab
      const excelData = allItems.map((item: Record<string, unknown>) => ({
        "SAP ID": item.sapid || "",
        "Registration No": item.registrationno || "",
        "Full Name": item.alumniname || "",
        "Email": item.personalemail || item.officialemail || item.universityemail || "",
        "Personal Email": item.personalemail || "",
        "Official Email": item.officialemail || "",
        "University Email": item.universityemail || "",
        "Faculty": item.facultyname || "",
        "Department": item.departmentname || "",
        "Program": item.degreetitle || "",
        "Association Title": item.association_title || "",
        "Association ID": item.association_id || "",
        "Association Created Date": item.association_created_at || "",
        // Association Organization Data
        "Association Description": item.association_description || "",
        "Association Dean": item.association_dean || "",
        "Association Phone": item.association_phone || "",
        "Association Email": item.association_email || "",
        "Association Address": item.association_address || "",
        // Include all other fields from tbl_alumni
        "Gender": item.gender || "",
        "Father Name": item.fathername || "",
        "Date of Birth": item.dateofbirth || "",
        "CNIC/Passport": item.cnicpassport || "",
        "Contact No": item.contactno || "",
        "Address": item.address || "",
        "Province": item.province || "",
        "City": item.city || "",
        "Country": item.country || "",
        "Campus": item.campusname || "",
        "Year of Ending": item.yearofending || "",
        "Employment Status": item.employeed || "",
        "Organization": item.nameoforganization || "",
        "Designation": item.designation || "",
        "Total Experience": item.totalyearsofexpereince || "",
        "Official Phone": item.officialnumber || "",
        "Work City": item.work_city || "",
        "Work Country": item.work_country || "",
        "Verification Status": item.verify === "true" ? "Verified" : item.verify === "false" ? "Unverified" : item.verify === "pending" || item.verify === null || item.verify === "" ? "Under Approval" : item.verify || "",
        "Last Login": item.lasttimelogin || "",
        "Login Count": item.logincount || 0,
        "Email Send Count": item.emailsendcount || 0,
        "Data Source": item.datasource || "",
        "Alumni Status": item.alumnistatus || "",
        "Created Date": item.createddatetime || "",
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);
      XLSX.utils.book_append_sheet(wb, ws, "Alumni Association");

      // Generate filename with current date and filters
      const dateStr = new Date().toISOString().split("T")[0];
      const filename = `alumni_association_export_${dateStr}.xlsx`;

      // Write and download
      XLSX.writeFile(wb, filename);
      setIsExporting(false);
    } catch (error) {
      console.error("Export error:", error);
      setIsExporting(false);
      alert("Failed to export data. Please try again.");
    }
  }, [isExporting, selectedFaculty, selectedDepartment]);


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-slate-900">Alumni Association</h3>
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
              All Alumni
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
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600" htmlFor="association-search">Search:</label>
          <input
            id="association-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, SAP ID, email, association..."
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
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
      {(selectedFaculty || selectedDepartment) && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setSelectedFaculty("");
              setSelectedDepartment("");
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
                <TableCell className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Association</TableCell>
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
                    {item.associationTitle ? (
                      <Badge size="sm" color="primary">{item.associationTitle}</Badge>
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

