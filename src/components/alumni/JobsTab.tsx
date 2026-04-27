"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Table, TableHeader, TableBody, TableCell, TableRow } from "@/components/ui/table";
import Pagination from "@/components/tables/Pagination";
import { ArrowUpIcon, ArrowDownIcon, EyeIcon, TrashBinIcon, PlusIcon } from "@/icons";
import SyncedTableScroll from "@/components/tables/SyncedTableScroll";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import { useSession } from "next-auth/react";
import { canModify } from "@/lib/alumniProfile";
import toast from "react-hot-toast";
import JobForm from "@/components/forms/JobForm";
import { useExcelExport, type ColumnOption } from "@/lib/excel-export";

type JobItem = {
  id: number;
  title: string;
  category: string;
  company: string;
  companyEmail?: string;
  deadline: string | null;
  location: string;
  jobLink: string;
  createdAt: string | null;
};

type JobStatus = "Active" | "Expired";

// Helper function to format date string (YYYY-MM-DD) without timezone conversion
function formatDateString(dateStr: string | null, options: { year: "numeric" | "2-digit"; month: "short" | "long" | "numeric" | "2-digit"; day: "numeric" | "2-digit" }): string {
  if (!dateStr) return "-";
  
  // Parse YYYY-MM-DD directly to avoid timezone issues
  const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return dateStr;
  
  const [, year, month, day] = match;
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  
  return date.toLocaleDateString("en-PK", options);
}

// Helper function to determine job status based on deadline
function getJobStatus(deadline: string | null): JobStatus {
  if (!deadline) {
    // If no deadline, consider it active
    return "Active";
  }
  
  // Parse YYYY-MM-DD directly to avoid timezone issues
  const match = String(deadline).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "Active";
  
  const [, year, month, day] = match;
  const deadlineDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  const today = new Date();
  
  // Reset time to compare only dates
  today.setHours(0, 0, 0, 0);
  deadlineDate.setHours(0, 0, 0, 0);
  
  // If deadline is today or in the future, it's active
  // If deadline has passed, it's expired
  return deadlineDate >= today ? "Active" : "Expired";
}

type JobsResponse = {
  items: JobItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

async function getJobs(
  page: number,
  limit: number,
  search?: string
): Promise<JobsResponse> {
  const url = new URL("/api/jobs", typeof window !== "undefined" ? window.location.origin : "");
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(limit));
  if (search && search.trim()) {
    url.searchParams.set("search", search.trim());
  }

  const res = await fetch(url.toString(), { headers: { accept: "application/json" } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to fetch jobs (${res.status})`);
  }
  const data = (await res.json()) as JobsResponse;
  return data;
}

type SortKey = "title" | "company" | "category" | "location" | "deadline" | "status" | "createdAt";
type SortDir = "asc" | "desc";

export const JobsTab: React.FC = () => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [viewJobId, setViewJobId] = useState<number | null>(null);
  const [mutatingIds, setMutatingIds] = useState<Set<number>>(new Set());
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const formModal = useModal();
  const viewModal = useModal();
  const deleteModal = useModal();
  const isAdmin = canModify(session?.user);
  const { openExportModal, ExportModal } = useExcelExport();

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading, error } = useQuery<JobsResponse, Error>({
    queryKey: ["jobs", debouncedQuery, currentPage, pageSize],
    queryFn: () => getJobs(currentPage, pageSize, debouncedQuery),
    staleTime: 2 * 60 * 1000,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const sortedItems = useMemo(() => {
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
    const toComparable = (val: unknown): string | number => {
      if (val == null) return "";
      if (typeof val === "number") return val;
      return String(val).toLowerCase();
    };
    const list = [...items];
    list.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      
      // Handle status sorting specially
      if (sortKey === "status") {
        aVal = getJobStatus(a.deadline);
        bVal = getJobStatus(b.deadline);
      } else {
        aVal = toComparable(a[sortKey]);
        bVal = toComparable(b[sortKey]);
      }
      
      let cmp = 0;
      if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal;
      } else {
        cmp = collator.compare(String(aVal), String(bVal));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [items, sortKey, sortDir]);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey]
  );

  const startMut = useCallback((jobId: number) => {
    setMutatingIds((prev) => new Set(prev).add(jobId));
  }, []);

  const stopMut = useCallback((jobId: number) => {
    setMutatingIds((prev) => {
      const next = new Set(prev);
      next.delete(jobId);
      return next;
    });
  }, []);

  const handleDelete = useCallback(async (jobId: number): Promise<void> => {
    startMut(jobId);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `Failed to delete: ${res.status}` }));
        throw new Error(errorData.error || `Failed to delete: ${res.status}`);
      }
      toast.success("Job deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      deleteModal.closeModal();
      setSelectedJobId(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || "Failed to delete job.");
      throw e;
    } finally {
      stopMut(jobId);
    }
  }, [startMut, stopMut, queryClient, deleteModal]);

  const handleView = useCallback((jobId: number) => {
    setViewJobId(jobId);
    viewModal.openModal();
  }, [viewModal]);

  const handleEdit = useCallback((jobId: number) => {
    setSelectedJobId(jobId);
    formModal.openModal();
  }, [formModal]);

  const handleCreate = useCallback(() => {
    setSelectedJobId(null);
    formModal.openModal();
  }, [formModal]);

  const handleFormSuccess = useCallback(() => {
    formModal.closeModal();
    setSelectedJobId(null);
    queryClient.invalidateQueries({ queryKey: ["jobs"] });
  }, [formModal, queryClient]);

  const handleFormCancel = useCallback(() => {
    formModal.closeModal();
    setSelectedJobId(null);
  }, [formModal]);

  const handleConfirmDelete = useCallback(() => {
    if (selectedJobId) {
      handleDelete(selectedJobId);
    }
  }, [selectedJobId, handleDelete]);

  const selectedJob = useMemo(() => {
    if (!viewJobId) return null;
    return items.find((job) => job.id === viewJobId);
  }, [viewJobId, items]);

  const applicantName = useMemo(() => {
    const first = (session?.user as any)?.firstName ? String((session?.user as any).firstName).trim() : "";
    const last = (session?.user as any)?.lastName ? String((session?.user as any).lastName).trim() : "";
    const combined = [first, last].filter(Boolean).join(" ").trim();
    const fallback = (session?.user as any)?.name ? String((session?.user as any).name).trim() : "";
    return combined || fallback || "Applicant";
  }, [session?.user]);

  const buildMailtoHref = useCallback((job: JobItem): string => {
    const recipient = String(job.companyEmail || "").trim();
    if (!recipient) return "";

    const title = job.title || "Job";
    const subject = `Application for ${title}`;
    const body = `Dear Hiring Team,\n\nI am interested in applying for the position of ${title}.\n\nPlease find my details attached.\n\nRegards,\n${applicantName}`;

    return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [applicantName]);

  const exportColumns = useMemo<ColumnOption[]>(() => {
    return [
      { key: "title", label: "Title" },
      { key: "company", label: "Company" },
      { key: "companyEmail", label: "Company Email" },
      { key: "category", label: "Category" },
      { key: "location", label: "Location" },
      { key: "deadline", label: "Deadline" },
      { key: "jobLink", label: "Job Link" },
      { key: "createdAt", label: "Created At" },
    ];
  }, []);

  const fetchJobsForExport = useCallback(async (): Promise<Record<string, unknown>[]> => {
    const limit = 100;
    const out: Record<string, unknown>[] = [];

    let page = 1;
    // Pull all pages under current search query
    while (true) {
      const res = await getJobs(page, limit, debouncedQuery);
      const batch = res.items.map((j) => ({
        title: j.title || "",
        company: j.company || "",
        companyEmail: j.companyEmail || "",
        category: j.category || "",
        location: j.location || "",
        deadline: j.deadline || "",
        jobLink: j.jobLink || "",
        createdAt: j.createdAt || "",
      }));
      out.push(...batch);

      if (page >= res.totalPages) break;
      page += 1;
    }

    return out;
  }, [debouncedQuery]);

  const handleExport = useCallback(() => {
    openExportModal({
      data: fetchJobsForExport,
      columns: exportColumns,
      filename: "jobs",
      sheetName: "Jobs",
    });
  }, [openExportModal, fetchJobsForExport, exportColumns]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Jobs
          </h3>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={handleCreate}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Job
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors"
                >
                  Export
                </button>
              </>
            )}
            <label className="text-sm text-gray-600 dark:text-gray-400" htmlFor="job-search">
              Search:
            </label>
            <input
              id="job-search"
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by title, company, category, location..."
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100"
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border-2 border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <SyncedTableScroll minWidth={1200} maxHeight={700}>
          <Table className="min-w-full">
            <TableHeader className="sticky top-0 z-10 border-b-2 border-gray-300 bg-gradient-to-r from-slate-50 to-slate-100 dark:border-gray-700 dark:from-gray-800 dark:to-gray-900">
              <TableRow>
                <TableCell
                  className="px-6 py-4 text-left text-sm font-semibold text-slate-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSort("title")}
                >
                  <div className="flex items-center gap-2">
                    <span>Title</span>
                    <div className="flex flex-col">
                      <ArrowUpIcon
                        className={`w-3 h-3 ${
                          sortKey === "title" && sortDir === "asc"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      />
                      <ArrowDownIcon
                        className={`w-3 h-3 -mt-1 ${
                          sortKey === "title" && sortDir === "desc"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      />
                    </div>
                  </div>
                </TableCell>
                <TableCell
                  className="px-6 py-4 text-left text-sm font-semibold text-slate-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSort("company")}
                >
                  <div className="flex items-center gap-2">
                    <span>Company</span>
                    <div className="flex flex-col">
                      <ArrowUpIcon
                        className={`w-3 h-3 ${
                          sortKey === "company" && sortDir === "asc"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      />
                      <ArrowDownIcon
                        className={`w-3 h-3 -mt-1 ${
                          sortKey === "company" && sortDir === "desc"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      />
                    </div>
                  </div>
                </TableCell>
                <TableCell
                  className="px-6 py-4 text-left text-sm font-semibold text-slate-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSort("category")}
                >
                  <div className="flex items-center gap-2">
                    <span>Category</span>
                    <div className="flex flex-col">
                      <ArrowUpIcon
                        className={`w-3 h-3 ${
                          sortKey === "category" && sortDir === "asc"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      />
                      <ArrowDownIcon
                        className={`w-3 h-3 -mt-1 ${
                          sortKey === "category" && sortDir === "desc"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      />
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                  Location
                </TableCell>
                <TableCell
                  className="px-6 py-4 text-left text-sm font-semibold text-slate-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSort("deadline")}
                >
                  <div className="flex items-center gap-2">
                    <span>Deadline</span>
                    <div className="flex flex-col">
                      <ArrowUpIcon
                        className={`w-3 h-3 ${
                          sortKey === "deadline" && sortDir === "asc"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      />
                      <ArrowDownIcon
                        className={`w-3 h-3 -mt-1 ${
                          sortKey === "deadline" && sortDir === "desc"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      />
                    </div>
                  </div>
                </TableCell>
                <TableCell
                  className="px-6 py-4 text-left text-sm font-semibold text-slate-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center gap-2">
                    <span>Status</span>
                    <div className="flex flex-col">
                      <ArrowUpIcon
                        className={`w-3 h-3 ${
                          sortKey === "status" && sortDir === "asc"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      />
                      <ArrowDownIcon
                        className={`w-3 h-3 -mt-1 ${
                          sortKey === "status" && sortDir === "desc"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      />
                    </div>
                  </div>
                </TableCell>
                <TableCell
                  className="px-6 py-4 text-left text-sm font-semibold text-slate-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSort("createdAt")}
                >
                  <div className="flex items-center gap-2">
                    <span>Created At</span>
                    <div className="flex flex-col">
                      <ArrowUpIcon
                        className={`w-3 h-3 ${
                          sortKey === "createdAt" && sortDir === "asc"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      />
                      <ArrowDownIcon
                        className={`w-3 h-3 -mt-1 ${
                          sortKey === "createdAt" && sortDir === "desc"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      />
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`job-skeleton-${i}`}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <TableCell key={j} className="px-6 py-4">
                        <div className="h-5 w-24 bg-gray-200 animate-pulse rounded" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
              {!isLoading && error && (
                <TableRow>
                  <TableCell colSpan={8} className="px-5 py-6 text-center text-red-600">
                    {error.message || "Failed to load jobs"}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !error && sortedItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="px-5 py-8 text-center text-gray-600">
                    No jobs found
                  </TableCell>
                </TableRow>
              )}
              {!isLoading &&
                !error &&
                sortedItems.map((item) => (
                  <TableRow key={item.id} className="odd:bg-white even:bg-gray-50/50 hover:bg-blue-50/50 dark:odd:bg-gray-900 dark:even:bg-gray-800/70 dark:hover:bg-blue-900/20">
                    <TableCell className="px-6 py-4 text-sm font-semibold text-slate-900">
                      {item.title || "-"}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm text-slate-700">
                      {item.company || "-"}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm text-slate-700">
                      {item.category || "-"}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm text-slate-700">
                      {item.location || "-"}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm text-slate-700">
                      {formatDateString(item.deadline, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm text-slate-700">
                      {(() => {
                        const status = getJobStatus(item.deadline);
                        return (
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                              status === "Active"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                            }`}
                          >
                            {status}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm text-slate-700">
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleDateString("en-PK", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "-"}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm text-slate-700">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleView(item.id)}
                          className="p-1.5 sm:p-2 rounded-lg text-gray-500 dark:text-gray-400 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                          aria-label="View"
                          title="View"
                        >
                          <EyeIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleEdit(item.id)}
                              className="p-1.5 sm:p-2 rounded-lg text-gray-500 dark:text-gray-400 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                              aria-label="Edit"
                              title="Edit"
                            >
                              <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedJobId(item.id);
                                deleteModal.openModal();
                              }}
                              disabled={mutatingIds.has(item.id)}
                              className="p-1.5 sm:p-2 rounded-lg text-gray-500 dark:text-gray-400 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 hover:text-rose-600 hover:bg-gray-100 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
                              aria-label="Delete"
                              title="Delete"
                            >
                              <TrashBinIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                            </button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </SyncedTableScroll>
        <div className="flex items-center justify-between border-t p-4 dark:border-gray-700 dark:bg-gray-900">
          <span className="text-sm text-gray-500">
            Showing{" "}
            {sortedItems.length
              ? (currentPage - 1) * pageSize + 1
              : 0}
            -
            {Math.min((currentPage - 1) * pageSize + sortedItems.length, total)} of {total}
          </span>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-500" htmlFor="job-page-size">
              Items per page:
            </label>
            <select
              id="job-page-size"
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        </div>
      </div>

      {/* Form Modal */}
      {formModal.isOpen && (
        <Modal
          isOpen={formModal.isOpen}
          onClose={handleFormCancel}
          className="max-w-2xl"
        >
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {selectedJobId ? "Edit Job" : "Create New Job"}
            </h3>
            <JobForm
              jobId={selectedJobId}
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
            />
          </div>
        </Modal>
      )}

      {/* View Modal */}
      {viewModal.isOpen && selectedJob && (
        <Modal
          isOpen={viewModal.isOpen}
          onClose={() => {
            viewModal.closeModal();
            setViewJobId(null);
          }}
          className="max-w-2xl"
        >
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Job Details
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title
                </label>
                <p className="text-sm text-gray-900 dark:text-gray-100">{selectedJob.title || "-"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Company
                </label>
                <p className="text-sm text-gray-900 dark:text-gray-100">{selectedJob.company || "-"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <p className="text-sm text-gray-900 dark:text-gray-100">{selectedJob.category || "-"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Location
                </label>
                <p className="text-sm text-gray-900 dark:text-gray-100">{selectedJob.location || "-"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Deadline
                </label>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {formatDateString(selectedJob.deadline, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                {(() => {
                  const status = getJobStatus(selectedJob.deadline);
                  return (
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                        status === "Active"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                    >
                      {status}
                    </span>
                  );
                })()}
              </div>
              {selectedJob.jobLink && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Job Link
                  </label>
                  <a
                    href={selectedJob.jobLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    {selectedJob.jobLink}
                  </a>
                </div>
              )}
              {selectedJob.companyEmail && String(selectedJob.companyEmail).trim() && (
                <div>
                  <a
                    href={buildMailtoHref(selectedJob)}
                    className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    Apply via Email
                  </a>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Created At
                </label>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {selectedJob.createdAt
                    ? new Date(selectedJob.createdAt).toLocaleDateString("en-PK", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "-"}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  viewModal.closeModal();
                  setViewJobId(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && selectedJobId && (
        <Modal
          isOpen={deleteModal.isOpen}
          onClose={() => {
            if (!mutatingIds.has(selectedJobId)) {
              deleteModal.closeModal();
              setSelectedJobId(null);
            }
          }}
          className="max-w-md"
        >
          <div className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <TrashBinIcon className="h-6 w-6 text-rose-600 dark:text-rose-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Delete Job
              </h3>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
              Are you sure you want to delete this job? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!mutatingIds.has(selectedJobId)) {
                    deleteModal.closeModal();
                    setSelectedJobId(null);
                  }
                }}
                disabled={mutatingIds.has(selectedJobId)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={mutatingIds.has(selectedJobId)}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mutatingIds.has(selectedJobId) ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </span>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <ExportModal />
    </div>
  );
};
