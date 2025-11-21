"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ComponentCard from "@/components/common/ComponentCard";
import Badge from "../ui/badge/Badge";
import { CloseLineIcon, EyeIcon, TrashBinIcon, CheckLineIcon } from "@/icons";
import { Table, TableHeader, TableBody, TableCell, TableRow } from "@/components/ui/table";
import Pagination from "@/components/tables/Pagination";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { isAdminUser } from "@/lib/alumniProfile";
import { getAlumniList, type AlumniListItem } from "@/app/queries/fetch-alumni";

type TabKey =
  | "total"
  | "verified"
  | "unverified"
  | "underApproval"
  | "active"
  | "inactive";

const TABS: { key: TabKey; label: string }[] = [
  { key: "total", label: "Total" },
  { key: "verified", label: "Verified" },
  { key: "unverified", label: "Unverified" },
  { key: "underApproval", label: "Under Approval" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
];

// Counts are computed dynamically from fetched data

// Per-status color classes to visually distinguish each category
const STATUS_CLASS_MAP: Record<
  TabKey,
  {
    selectedContainer: string;
    hoverBorder: string;
    iconBg: string;
    iconColor: string;
    labelText: string;
  }
> = {
  total: {
    selectedContainer:
      "border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20",
    hoverBorder: "hover:border-blue-400",
    iconBg: "bg-blue-100 dark:bg-blue-800",
    iconColor: "text-blue-700 dark:text-blue-200",
    labelText: "text-blue-600 dark:text-blue-300",
  },
  verified: {
    selectedContainer:
      "border-emerald-500 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-900/20",
    hoverBorder: "hover:border-emerald-400",
    iconBg: "bg-emerald-100 dark:bg-emerald-800",
    iconColor: "text-emerald-700 dark:text-emerald-200",
    labelText: "text-emerald-600 dark:text-emerald-300",
  },
  unverified: {
    selectedContainer:
      "border-rose-500 bg-rose-50 dark:border-rose-500 dark:bg-rose-900/20",
    hoverBorder: "hover:border-rose-400",
    iconBg: "bg-rose-100 dark:bg-rose-800",
    iconColor: "text-rose-700 dark:text-rose-200",
    labelText: "text-rose-600 dark:text-rose-300",
  },
  underApproval: {
    selectedContainer:
      "border-amber-500 bg-amber-50 dark:border-amber-500 dark:bg-amber-900/20",
    hoverBorder: "hover:border-amber-400",
    iconBg: "bg-amber-100 dark:bg-amber-800",
    iconColor: "text-amber-700 dark:text-amber-200",
    labelText: "text-amber-600 dark:text-amber-300",
  },
  active: {
    selectedContainer:
      "border-indigo-500 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-900/20",
    hoverBorder: "hover:border-indigo-400",
    iconBg: "bg-indigo-100 dark:bg-indigo-800",
    iconColor: "text-indigo-700 dark:text-indigo-200",
    labelText: "text-indigo-600 dark:text-indigo-300",
  },
  inactive: {
    selectedContainer:
      "border-gray-500 bg-gray-50 dark:border-gray-500 dark:bg-gray-900/20",
    hoverBorder: "hover:border-gray-400",
    iconBg: "bg-gray-100 dark:bg-gray-800",
    iconColor: "text-gray-700 dark:text-gray-200",
    labelText: "text-gray-600 dark:text-gray-300",
  },
};


export const AlumniTabs: React.FC = () => {
  const router = useRouter();
  const [selected, setSelected] = useState<TabKey>("total");
  const { data: session } = useSession();

  // Unified item type mapped from server response
  type AlumniItem = {
    id: string; // sapId
    name: string;
    email?: string | null;
    mobile?: string | null;
    campus?: string | null;
    faculty?: string | null;
    program?: string | null;
    department?: string | null;
    passingYear?: number | null;
    workCountry?: string | null;
    workCity?: string | null;
    organization?: string | null;
    designation?: string | null;
    verified?: boolean;
    employmentStatus?: "Employed" | "Unemployed" | null;
  };

  // filtering is handled in the server-like fetcher; remove unused memo

  // Query + UI state (UI state does not duplicate cache)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [query, setQuery] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // React Query: fetch list with proper refetch strategies
  const {
    data: rawItems,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<AlumniListItem[], Error>({
    queryKey: ["alumnilist"],
    queryFn: ({ signal }) => getAlumniList(signal),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: true,
    refetchOnMount: false,
  });

  // Map server items to UI shape
  const items: AlumniItem[] = useMemo(() => {
    if (!rawItems) return [];
    return rawItems.map((r) => ({
      id: r.sapid,
      name: r.alumniname,
      email: r.personalemail ?? r.officialemail ?? null,
      mobile: r.contactno ?? null,
      campus: r.campusname,
      faculty: r.facultyname,
      program: r.degreetitle,
      department: r.departmentname,
      passingYear: r.yearofending,
      workCountry: r.country,
      workCity: r.city,
      organization: r.nameoforganization ?? null,
      designation: r.designation ?? null,
      verified: String(r.verify ?? "false").toLowerCase() === "true",
      employmentStatus:
        String(r.employeed ?? "Unemployed").toLowerCase() === "employed"
          ? "Employed"
          : "Unemployed",
    }));
  }, [rawItems]);

  // Compute tab counts
  const counts = useMemo(() => {
    const total = items.length;
    const verified = items.filter((i) => i.verified).length;
    const unverified = items.filter((i) => !i.verified).length;
    const active = items.filter((i) => i.employmentStatus === "Employed").length;
    const inactive = items.filter((i) => i.employmentStatus === "Unemployed").length;
    const underApproval = unverified;
    return { total, verified, unverified, underApproval, active, inactive };
  }, [items]);

  // Filter by tab + query
  const filteredItems = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    const base = items.filter((a) =>
      !q ||
      (a.id?.toString().toLowerCase().includes(q) ?? false) ||
      (a.name?.toLowerCase().includes(q)) ||
      (a.email?.toLowerCase().includes(q))
    );
    switch (selected) {
      case "verified":
        return base.filter((i) => i.verified);
      case "unverified":
        return base.filter((i) => !i.verified);
      case "underApproval":
        return base.filter((i) => !i.verified);
      case "active":
        return base.filter((i) => i.employmentStatus === "Employed");
      case "inactive":
        return base.filter((i) => i.employmentStatus === "Unemployed");
      case "total":
      default:
        return base;
    }
  }, [items, selected, debouncedQuery]);

  // Pagination derived values
  const total = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = useMemo(() => filteredItems.slice(start, end), [filteredItems, start, end]);

  useEffect(() => { setCurrentPage(1); setSelectedRowId(null); }, [selected, pageSize, debouncedQuery]);

  // Action hooks and handlers must live inside the component body
  const queryClient = useQueryClient();
  const [mutatingIds, setMutatingIds] = useState<Set<string>>(new Set());
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const startMut = useCallback((id: string) => {
    setMutatingIds((prev) => new Set(prev).add(id));
  }, []);

  const stopMut = useCallback((id: string) => {
    setMutatingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const updateCacheVerify = useCallback((sapid: string, verify: boolean) => {
    queryClient.setQueryData<AlumniListItem[] | undefined>(["alumnilist"], (old) => {
      if (!old) return old;
      return old.map((it) => (it.sapid === sapid ? { ...it, verify: verify ? "true" : "false" } : it));
    });
  }, [queryClient]);

  const removeFromCache = useCallback((sapid: string) => {
    queryClient.setQueryData<AlumniListItem[] | undefined>(["alumnilist"], (old) => {
      if (!old) return old;
      return old.filter((it) => it.sapid !== sapid);
    });
  }, [queryClient]);

  const handleVerify = useCallback(async (sapid: string) => {
    setActionError(null);
    startMut(sapid);
    // optimistic
    updateCacheVerify(sapid, true);
    try {
      const res = await fetch(`/api/alumni/${sapid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verify: true }),
      });
      if (!res.ok) throw new Error(`Failed to verify: ${res.status}`);
      setActionMessage("Alumni verified successfully.");
      queryClient.invalidateQueries({ queryKey: ["alumni", "profile", sapid] });
    } catch (e: unknown) {
      // revert
      updateCacheVerify(sapid, false);
      const msg = e instanceof Error ? e.message : String(e);
      setActionError(msg || "Failed to verify alumni.");
    } finally {
      stopMut(sapid);
    }
  }, [startMut, stopMut, updateCacheVerify, queryClient]);

  const handleUnverify = useCallback(async (sapid: string) => {
    setActionError(null);
    startMut(sapid);
    // optimistic
    updateCacheVerify(sapid, false);
    try {
      const res = await fetch(`/api/alumni/${sapid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verify: false }),
      });
      if (!res.ok) throw new Error(`Failed to unverify: ${res.status}`);
      setActionMessage("Alumni marked as unverified.");
      queryClient.invalidateQueries({ queryKey: ["alumni", "profile", sapid] });
    } catch (e: unknown) {
      // revert
      updateCacheVerify(sapid, true);
      const msg = e instanceof Error ? e.message : String(e);
      setActionError(msg || "Failed to update verification.");
    } finally {
      stopMut(sapid);
    }
  }, [startMut, stopMut, updateCacheVerify, queryClient]);

  const handleDelete = useCallback(async (sapid: string) => {
    setActionError(null);
    startMut(sapid);
    const prev = queryClient.getQueryData<AlumniListItem[] | undefined>(["alumnilist"]);
    // optimistic remove
    removeFromCache(sapid);
    try {
      const res = await fetch(`/api/alumni/${sapid}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed to delete: ${res.status}`);
      setActionMessage("Alumni deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["alumni", "profile", sapid] });
    } catch (e: unknown) {
      // rollback
      if (prev) queryClient.setQueryData(["alumnilist"], prev);
      const msg = e instanceof Error ? e.message : String(e);
      setActionError(msg || "Failed to delete alumni.");
    } finally {
      stopMut(sapid);
    }
  }, [removeFromCache, startMut, stopMut, queryClient]);

  const handleView = useCallback((sapid: string) => {
    const isAdmin = isAdminUser(session?.user);
    const url = isAdmin ? `/alumni-profile?sapid=${encodeURIComponent(sapid)}&modal=` : `/alumni-profile?sapid=${encodeURIComponent(sapid)}`;
    router.push(url);
  }, [router, session]);

  return (
    <ComponentCard  className=" ">
      <div className=" flex flex-col gap-4  ">
        <div className="rounded-2xl  bg-white flex justify-between   dark:bg-white/[0.03]">
         
          <div
            className="tab-list flex flex-nowrap items-center gap-3 overflow-x-auto p-1 "
            role="tablist"
            aria-label="Alumni status categories"
          >
            {TABS.map((tab, idx) => {
              const statCount = (() => {
                switch (tab.key) {
                  case "total":
                    return counts.total;
                  case "verified":
                    return counts.verified;
                  case "unverified":
                    return counts.unverified;
                  case "underApproval":
                    return counts.underApproval;
                  case "active":
                    return counts.active;
                  case "inactive":
                  default:
                    return counts.inactive;
                }
              })();
             
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={`w-[240px] last:border-0 bg-white  flex flex-col items-center  whitespace-nowrap text-center border-r border-gray-300 px-4 py-2 text-sm transition-colors transition-transform 
                  } hover:translate-y-[-1px] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900`}
                  onClick={() => setSelected(tab.key)}
                  role="tab"
                  aria-selected={selected === tab.key}
                  aria-label={`${tab.label} (${statCount.toLocaleString()})`}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight") {
                      e.preventDefault();
                      const nextIdx = (idx + 1) % TABS.length;
                      setSelected(TABS[nextIdx].key);
                    } else if (e.key === "ArrowLeft") {
                      e.preventDefault();
                      const prevIdx = (idx - 1 + TABS.length) % TABS.length;
                      setSelected(TABS[prevIdx].key);
                    } else if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(tab.key);
                    }
                  }}
                >
                  <h6 className={`text-[20px] font-bold mt-2 ${STATUS_CLASS_MAP[tab.key].labelText}`}>{tab.label}</h6>
                  <h3 className={`text-[35px] font-bold mt-6 `}>{statCount.toLocaleString()}</h3>
                </button>
              );
            })}
          </div>
        </div>

       

        {/* Search Bar: by SAP ID, email, or name */}
      <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-300" htmlFor="alumni-search">Search:</label>
          <input
            id="alumni-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="SAP ID, name, email"
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] ">
        <div className="max-w-full overflow-x-auto custom-scrollbar max-h-[700px] overflow-y-auto">
          <div className="min-w-`full` xl:min-w-full">
            <Table className="min-w-full border border-gray-200 dark:border-gray-800">
              <TableHeader className="bg-white whitespace-nowrap border-b border-gray-200 dark:border-white/[0.06]">
                <TableRow className="border-b border-gray-200 dark:border-white/[0.06]">
                  <TableCell className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">Name</TableCell>
                  <TableCell className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">SAP ID</TableCell>
                  <TableCell className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">Mobile No</TableCell>
                  <TableCell className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">Active Email</TableCell>
                  <TableCell className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">Department</TableCell>
                  <TableCell className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">Status</TableCell>
                  <TableCell className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">Organization</TableCell>
                  <TableCell className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">Designation</TableCell>
                  <TableCell className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">Work Country/City</TableCell>
                  <TableCell className="px-4 py-3 text-right text-[13px] font-medium text-slate-600 dark:text-gray-300">Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="whitespace-nowrap divide-y divide-gray-200 dark:divide-white/[0.06]">
                {(isLoading || isFetching) && (
                  Array.from({ length: Math.min(pageSize, 5) }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`} className="odd:bg-gray-50">
                      <TableCell className="px-4 py-3 border-r border-gray-200"><div className="h-5 w-48 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3 border-r border-gray-200"><div className="h-5 w-24 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3 border-r border-gray-200"><div className="h-5 w-28 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3 border-r border-gray-200"><div className="h-5 w-40 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3 border-r border-gray-200"><div className="h-5 w-32 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3 border-r border-gray-200"><div className="h-5 w-24 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3 border-r border-gray-200"><div className="h-5 w-56 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3 border-r border-gray-200"><div className="h-5 w-36 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3 border-r border-gray-200"><div className="h-5 w-40 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3"><div className="h-9 w-24 bg-gray-200 animate-pulse rounded" /></TableCell>
                    </TableRow>
                  ))
                )}
                {!isLoading && isError && (
                  <TableRow>
                    <TableCell className="px-5 py-4 text-red-600 border-r border-gray-200" colSpan={10}>
                      <div className="flex items-center justify-between gap-4">
                        <span>{error?.message ?? "Failed to load data."}</span>
                        <button
                          type="button"
                          onClick={() => refetch()}
                          className="inline-flex items-center rounded-md bg-white border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >Retry</button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && !isError && pageItems.length === 0 && (
                  <TableRow>
                    <TableCell className="px-5 py-6 text-gray-600 dark:text-gray-400 border-r border-gray-200" colSpan={10}>
                      No alumni found{debouncedQuery ? ` for "${debouncedQuery}"` : ""}. Try adjusting your search or filters.
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && !isError && pageItems.map((alum, idx) => (
                  
                   
                  <TableRow
                    key={`${alum.id}-${idx}`}
                    className={`hover:bg-gray-50 dark:hover:bg-white/[0.04] odd:bg-gray-50 ${selectedRowId === alum.id ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
                    onClick={() => setSelectedRowId(alum.id)}
                    aria-selected={selectedRowId === alum.id}
                  >
                    <TableCell className="px-4 py-3 border-r border-gray-200 text-start">
                      <div className="flex items-center gap-3 w-max">
                        <span className="block font-medium text-slate-900 text-[13px] dark:text-white/90">{alum.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 border-r border-gray-200 text-slate-900 text-[13px] text-start dark:text-gray-300">{alum.id}</TableCell>
                    <TableCell className="px-4 py-3 border-r border-gray-200 text-slate-900 text-[13px] text-start dark:text-gray-300">{alum.mobile ?? "-"}</TableCell>
                    <TableCell className="px-4 py-3 border-r border-gray-200 text-slate-900 text-[13px] text-start dark:text-gray-300">{alum.email ?? "-"}</TableCell>
                    <TableCell className="px-4 py-3 border-r border-gray-200 text-slate-900 text-[13px] text-start dark:text-gray-300">{alum.department}</TableCell>
                    <TableCell className="px-4 py-3 border-r border-gray-200 text-start">
                      <Badge size="sm" color={alum.verified ? "success" : "error"}>{alum.verified ? "Verified" : "Un-Verified"}</Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3 border-r border-gray-200 text-slate-900 text-[13px] text-start dark:text-gray-300">{alum.organization ?? "-"}</TableCell>
                    <TableCell className="px-4 py-3 border-r border-gray-200 text-slate-900 text-[13px] text-start dark:text-gray-300">{alum.designation ?? "-"}</TableCell>
                    <TableCell className="px-4 py-3 border-r border-gray-200 text-slate-900 text-[13px] text-start dark:text-gray-300">{alum.workCountry}{alum.workCity ? ` / ${alum.workCity}` : ""}</TableCell>
                    <TableCell className="px-4 py-3 text-end">
                      <div role="group" aria-label="Row actions" className="inline-flex items-center gap-2">
                        {(() => {
                          const isBusy = mutatingIds.has(alum.id);
                          const actions: Array<{ label: string; icon: React.ComponentType<{ className?: string }>; onClick: () => void; hover?: string }>
                            = alum.verified
                            ? [
                                { label: "Unverify", icon: CloseLineIcon, onClick: () => handleUnverify(alum.id), hover: "hover:text-amber-600" },
                                { label: "Delete", icon: TrashBinIcon, onClick: () => handleDelete(alum.id), hover: "hover:text-rose-600" },
                                { label: "View", icon: EyeIcon, onClick: () => handleView(alum.id), hover: "hover:text-blue-600" },
                              ]
                            : [
                                { label: "Verify", icon: CheckLineIcon, onClick: () => handleVerify(alum.id), hover: "hover:text-emerald-600" },
                                { label: "Delete", icon: TrashBinIcon, onClick: () => handleDelete(alum.id), hover: "hover:text-rose-600" },
                                { label: "View", icon: EyeIcon, onClick: () => handleView(alum.id), hover: "hover:text-blue-600" },
                              ];
                          return actions.map(({ label, icon: Icon, onClick, hover }, i) => (
                            <button
                              key={`${alum.id}-action-${i}`}
                              type="button"
                              onClick={onClick}
                              disabled={isBusy}
                              aria-disabled={isBusy}
                              className={`text-gray-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded ${hover ?? "hover:text-gray-700"} ${isBusy ? "opacity-50 cursor-not-allowed" : ""}`}
                              aria-label={label}
                              title={label}
                            >
                              <Icon className="h-5 w-5" />
                            </button>
                          ));
                        })()}
                      </div>
                    </TableCell>
                  </TableRow>

                ))}
              </TableBody>
            </Table>
          </div>
          
        </div>
        {/* Live region for action feedback */}
        <div className="px-4" aria-live="polite" aria-atomic="true">
          {actionMessage && (
            <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {actionMessage}
            </div>
          )}
          {actionError && (
            <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {actionError}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between p-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {(() => {
              const start = (currentPage - 1) * pageSize + 1;
              const end = start + pageItems.length - 1;
              return `Showing ${pageItems.length ? start : 0}-${pageItems.length ? end : 0} of ${total}`;
            })()}
          </span>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-500 dark:text-gray-400" htmlFor="page-size">Items per page:</label>
            <select
              id="page-size"
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={(p) => setCurrentPage(Math.max(1, Math.min(totalPages, p)))} />
          </div>
        </div>
      </div>
    </div>
      </div>
      <style jsx>{`
        .tab-list {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem; /* base spacing between tabs */
        }

        .tab-item {
          /* Flexbox sizing with constraints */
          flex: 1 1 180px; /* grow; shrink; base width */
          min-width: 160px;
          max-width: 320px;
          /* Smooth transitions for resizing and state */
          transition: flex-basis 300ms ease, width 300ms ease,
            background-color 200ms ease, border-color 200ms ease,
            transform 200ms ease;
          will-change: transform;
        }

        /* Desktop (≥1024px) */
        @media (min-width: 1024px) {
          .tab-list {
            gap: 1.5rem; /* more spacing on desktop */
          }
          .tab-item {
            flex-basis: 240px; /* comfortable width on desktop */
          }
        }

        /* Tablet (768px–1023px) */
        @media (min-width: 768px) and (max-width: 1023px) {
          .tab-item {
            flex-basis: 200px; /* medium width on tablets */
          }
        }

        /* Mobile (<768px) */
        @media (max-width: 767px) {
          .tab-item {
            flex-basis: 160px; /* compact width on mobile */
          }
        }
      `}</style>
    </ComponentCard>
  );
};
// (hooks moved inside component; no code should live below the component)
