"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableHeader, TableBody, TableCell, TableRow } from "@/components/ui/table";
import Pagination from "@/components/tables/Pagination";
import Badge from "../ui/badge/Badge";

type TalkItem = {
  sapid: string;
  registrationNo: string | null;
  name: string;
  department: string | null;
  faculty: string | null;
  program: string | null;
  email: string | null;
  alumnitalks: string | null;
  mentorshipprogram: string | null;
  topics: string[];
  areas: string[];
  linkedin: string | null;
  mode: string | null;
  briefOutline: string | null;
  // Availability dates and timings
  date1: string | null;
  timings1: string | null;
  date2: string | null;
  timings2: string | null;
  date3: string | null;
  timings3: string | null;
  // Day variations
  day2: string | null;
  day3: string | null;
  // Week variations
  week1: string | null;
  week2: string | null;
  week3: string | null;
  // Month variations
  month1: string | null;
  month2: string | null;
  month3: string | null;
};

async function getAlumniTalks(): Promise<TalkItem[]> {
  const res = await fetch("/api/alumni/talks", { headers: { "accept": "application/json" } });
  if (!res.ok) {
    throw new Error("Failed to fetch alumni talks");
  }
  const data = (await res.json()) as { items: TalkItem[] };
  return data.items ?? [];
}

export const AlumniTalksTab: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [query, setQuery] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: items = [], isLoading, isError, error } = useQuery<TalkItem[], Error>({
    queryKey: ["alumni-talks"],
    queryFn: getAlumniTalks,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const filteredItems = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      item.sapid?.toLowerCase().includes(q) ||
      item.name?.toLowerCase().includes(q) ||
      item.email?.toLowerCase().includes(q) ||
      item.department?.toLowerCase().includes(q) ||
      item.faculty?.toLowerCase().includes(q)
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
        <h3 className="text-lg font-semibold text-slate-900">Alumni Talks</h3>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600" htmlFor="talks-search">Search:</label>
          <input
            id="talks-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, SAP ID, email..."
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="overflow-hidden border-2 border-gray-200 rounded-lg bg-white shadow-sm">
        <div className="max-h-[700px] overflow-y-auto">
          <Table className="min-w-full">
            <TableHeader className="bg-gradient-to-r from-slate-50 to-slate-100 sticky top-0 z-10 border-b-2 border-gray-300">
              <TableRow>
                <TableCell isHeader className="px-4 py-3 text-left text-xs font-semibold text-slate-700 w-12">{null}</TableCell>
                <TableCell className="px-4 py-3 text-left text-xs font-semibold text-slate-700">SAP ID / Reg No</TableCell>
                <TableCell className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Full Name</TableCell>
                <TableCell className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Email</TableCell>
                <TableCell className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Faculty</TableCell>
                <TableCell className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Department</TableCell>
                <TableCell className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Topic</TableCell>
                <TableCell className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Mode</TableCell>
                <TableCell className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Availability</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    <TableCell className="px-2 py-3"><div className="h-4 w-4 bg-gray-200 animate-pulse rounded" /></TableCell>
                    <TableCell className="px-4 py-3"><div className="h-4 w-24 bg-gray-200 animate-pulse rounded" /></TableCell>
                    <TableCell className="px-4 py-3"><div className="h-4 w-32 bg-gray-200 animate-pulse rounded" /></TableCell>
                    <TableCell className="px-4 py-3"><div className="h-4 w-40 bg-gray-200 animate-pulse rounded" /></TableCell>
                    <TableCell className="px-4 py-3"><div className="h-4 w-28 bg-gray-200 animate-pulse rounded" /></TableCell>
                    <TableCell className="px-4 py-3"><div className="h-4 w-32 bg-gray-200 animate-pulse rounded" /></TableCell>
                    <TableCell className="px-4 py-3"><div className="h-4 w-40 bg-gray-200 animate-pulse rounded" /></TableCell>
                    <TableCell className="px-4 py-3"><div className="h-4 w-20 bg-gray-200 animate-pulse rounded" /></TableCell>
                    <TableCell className="px-4 py-3"><div className="h-4 w-32 bg-gray-200 animate-pulse rounded" /></TableCell>
                  </TableRow>
                ))
              )}
              {!isLoading && isError && (
                <TableRow>
                  <TableCell colSpan={9} className="px-5 py-6 text-center text-red-600">
                    {error?.message || "Failed to load data"}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !isError && pageItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="px-5 py-8 text-center text-gray-600">
                    No alumni talks found
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !isError && pageItems.map((item, idx) => {
                const rowId = `${item.sapid}-${idx}`;
                const isExpanded = expandedRows.has(rowId);
                
                // Build availability options
                const availabilityOptions = [];
                if (item.date1 && item.timings1) {
                  availabilityOptions.push({ date: item.date1, timings: item.timings1, label: "Option 1" });
                }
                if (item.date2 && item.timings2) {
                  availabilityOptions.push({ date: item.date2, timings: item.timings2, label: "Option 2" });
                }
                if (item.date3 && item.timings3) {
                  availabilityOptions.push({ date: item.date3, timings: item.timings3, label: "Option 3" });
                }
                
                // Build day variations
                const dayOptions = [];
                if (item.day2) dayOptions.push({ value: item.day2, label: "Day 2" });
                if (item.day3) dayOptions.push({ value: item.day3, label: "Day 3" });
                
                // Build week variations
                const weekOptions = [];
                if (item.week1) weekOptions.push({ value: item.week1, label: "Week 1" });
                if (item.week2) weekOptions.push({ value: item.week2, label: "Week 2" });
                if (item.week3) weekOptions.push({ value: item.week3, label: "Week 3" });
                
                // Build month variations
                const monthOptions = [];
                if (item.month1) monthOptions.push({ value: item.month1, label: "Month 1" });
                if (item.month2) monthOptions.push({ value: item.month2, label: "Month 2" });
                if (item.month3) monthOptions.push({ value: item.month3, label: "Month 3" });
                
                return (
                  <React.Fragment key={rowId}>
                    <TableRow className="odd:bg-white even:bg-gray-50/50 hover:bg-blue-50/50">
                      <TableCell className="px-2 py-3">
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedRows(prev => {
                              const next = new Set(prev);
                              if (next.has(rowId)) {
                                next.delete(rowId);
                              } else {
                                next.add(rowId);
                              }
                              return next;
                            });
                          }}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                          aria-label={isExpanded ? "Collapse" : "Expand"}
                        >
                          <svg
                            className={`w-4 h-4 text-gray-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs font-mono text-slate-700">
                        {item.sapid || item.registrationNo || "-"}
                        {item.sapid && item.registrationNo && (
                          <span className="block text-xs text-gray-500">{item.registrationNo}</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs font-semibold text-slate-900">{item.name}</TableCell>
                      <TableCell className="px-4 py-3 text-xs">
                        <a href={item.email ? `mailto:${item.email}` : "#"} className="text-blue-600 hover:underline truncate block max-w-[200px]">
                          {item.email || "-"}
                        </a>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs text-slate-700">{item.faculty || "-"}</TableCell>
                      <TableCell className="px-4 py-3 text-xs text-slate-700">{item.department || "-"}</TableCell>
                      <TableCell className="px-4 py-3 text-xs">
                        {item.topics.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {item.topics.slice(0, 2).map((topic, i) => (
                              <Badge key={i} size="sm" color="info">{topic}</Badge>
                            ))}
                            {item.topics.length > 2 && <span className="text-xs text-gray-500">+{item.topics.length - 2}</span>}
                          </div>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs text-slate-700">{item.mode || "-"}</TableCell>
                      <TableCell className="px-4 py-3 text-xs">
                        {availabilityOptions.length > 0 ? (
                          <select className="text-xs border border-gray-300 rounded px-2 py-1 bg-white">
                            {availabilityOptions.map((opt, i) => (
                              <option key={i} value={i}>
                                {opt.date} ({opt.timings})
                              </option>
                            ))}
                          </select>
                        ) : "-"}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="bg-blue-50/30">
                        <TableCell colSpan={9} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                            {/* Basic Info */}
                            <div className="space-y-2">
                              <h4 className="font-semibold text-slate-700 mb-2">Basic Information</h4>
                              <div><span className="font-medium">Alumni Talks:</span> {item.alumnitalks || "-"}</div>
                              <div><span className="font-medium">Mentorship Program:</span> {item.mentorshipprogram || "-"}</div>
                              <div><span className="font-medium">LinkedIn:</span> {item.linkedin ? (
                                <a href={item.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                  View Profile
                                </a>
                              ) : "-"}</div>
                              {item.briefOutline && (
                                <div className="mt-2">
                                  <span className="font-medium">Brief Outline:</span>
                                  <p className="mt-1 text-gray-600 whitespace-pre-wrap">{item.briefOutline}</p>
                                </div>
                              )}
                            </div>
                            
                            {/* Availability Dates */}
                            <div className="space-y-2">
                              <h4 className="font-semibold text-slate-700 mb-2">Availability Dates</h4>
                              {availabilityOptions.length > 0 ? (
                                availabilityOptions.map((opt, i) => (
                                  <div key={i} className="p-2 bg-white rounded border border-gray-200">
                                    <div className="font-medium">{opt.label}:</div>
                                    <div>Date: {opt.date || "-"}</div>
                                    <div>Timings: {opt.timings || "-"}</div>
                                  </div>
                                ))
                              ) : (
                                <div className="text-gray-500">No availability dates</div>
                              )}
                            </div>
                            
                            {/* Variations */}
                            <div className="space-y-2">
                              <h4 className="font-semibold text-slate-700 mb-2">Time Variations</h4>
                              {dayOptions.length > 0 && (
                                <div className="mb-2">
                                  <label className="block font-medium mb-1">Day Variations:</label>
                                  <select className="w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white">
                                    <option value="">Select Day</option>
                                    {dayOptions.map((opt, i) => (
                                      <option key={i} value={opt.value}>{opt.label}: {opt.value}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                              {weekOptions.length > 0 && (
                                <div className="mb-2">
                                  <label className="block font-medium mb-1">Week Variations:</label>
                                  <select className="w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white">
                                    <option value="">Select Week</option>
                                    {weekOptions.map((opt, i) => (
                                      <option key={i} value={opt.value}>{opt.label}: {opt.value}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                              {monthOptions.length > 0 && (
                                <div className="mb-2">
                                  <label className="block font-medium mb-1">Month Variations:</label>
                                  <select className="w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white">
                                    <option value="">Select Month</option>
                                    {monthOptions.map((opt, i) => (
                                      <option key={i} value={opt.value}>{opt.label}: {opt.value}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                              {dayOptions.length === 0 && weekOptions.length === 0 && monthOptions.length === 0 && (
                                <div className="text-gray-500">No time variations</div>
                              )}
                            </div>
                            
                            {/* Areas */}
                            {item.areas.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-slate-700 mb-2">Areas</h4>
                                <div className="flex flex-wrap gap-1">
                                  {item.areas.map((area, i) => (
                                    <Badge key={i} size="sm" color="success">{area}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between p-4 border-t">
          <span className="text-sm text-gray-500">
            Showing {pageItems.length ? start + 1 : 0}-{pageItems.length ? start + pageItems.length : 0} of {total}
          </span>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-500" htmlFor="talks-page-size">Items per page:</label>
            <select
              id="talks-page-size"
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

