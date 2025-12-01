"use client";

import React, { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableHeader, TableBody, TableCell, TableRow } from "@/components/ui/table";
import Pagination from "@/components/tables/Pagination";
import Badge from "../ui/badge/Badge";

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

async function getAlumniChapters(): Promise<ChapterItem[]> {
  const res = await fetch("/api/alumni/chapters", { headers: { "accept": "application/json" } });
  if (!res.ok) {
    throw new Error("Failed to fetch alumni chapters");
  }
  const data = (await res.json()) as { items: ChapterItem[] };
  return data.items ?? [];
}

export const AlumniChaptersTab: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [query, setQuery] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: items = [], isLoading, isError, error } = useQuery<ChapterItem[], Error>({
    queryKey: ["alumni-chapters"],
    queryFn: getAlumniChapters,
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
  }, [debouncedQuery, pageSize]);

  const [isExporting, setIsExporting] = useState(false);

  const handleExportToExcel = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      // Dynamically import xlsx to avoid server-side bundling issues
      const XLSX = await import("xlsx");
      
      // Fetch all items (not just paginated ones)
      const res = await fetch("/api/alumni/chapters", { headers: { "accept": "application/json" } });
      if (!res.ok) throw new Error("Failed to fetch data");
      const data = (await res.json()) as { items: ChapterItem[] };
      const allItems = data.items ?? [];

      // Apply search filter if any
      const itemsToExport = debouncedQuery
        ? allItems.filter((item) => {
            const q = debouncedQuery.toLowerCase();
            return (
              item.sapid?.toLowerCase().includes(q) ||
              item.registrationNo?.toLowerCase().includes(q) ||
              item.name?.toLowerCase().includes(q) ||
              item.email?.toLowerCase().includes(q) ||
              item.department?.toLowerCase().includes(q) ||
              item.faculty?.toLowerCase().includes(q) ||
              item.chapters.some((ch) => ch.toLowerCase().includes(q))
            );
          })
        : allItems;

      // Map to Excel format
      const excelData = itemsToExport.map((item) => ({
        "SAP ID": item.sapid || "",
        "Registration No": item.registrationNo || "",
        "Full Name": item.name || "",
        "Email": item.email || "",
        "Faculty": item.faculty || "",
        "Department": item.department || "",
        "Program": item.program || "",
        "Chapters": item.chapters.join(", ") || "",
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      ws["!cols"] = [
        { wch: 12 }, // SAP ID
        { wch: 15 }, // Registration No
        { wch: 25 }, // Full Name
        { wch: 30 }, // Email
        { wch: 25 }, // Faculty
        { wch: 25 }, // Department
        { wch: 30 }, // Program
        { wch: 40 }, // Chapters
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Alumni Chapters");

      // Generate filename
      const dateStr = new Date().toISOString().split("T")[0];
      const searchStr = debouncedQuery ? `_search` : "";
      const filename = `alumni_chapters_export${searchStr}_${dateStr}.xlsx`;

      XLSX.writeFile(wb, filename);
      setIsExporting(false);
    } catch (error) {
      console.error("Export error:", error);
      setIsExporting(false);
      alert("Failed to export data. Please try again.");
    }
  }, [isExporting, debouncedQuery]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Alumni Chapters</h3>
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

