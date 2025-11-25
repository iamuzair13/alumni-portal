"use client";

import React, { useMemo, useState } from "react";
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

