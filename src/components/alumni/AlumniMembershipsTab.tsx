"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Table, TableHeader, TableBody, TableCell, TableRow } from "@/components/ui/table";
import Pagination from "@/components/tables/Pagination";
import { ArrowUpIcon, ArrowDownIcon, CheckLineIcon, CloseLineIcon, EyeIcon, PlusIcon, TrashBinIcon } from "@/icons";
import SyncedTableScroll from "@/components/tables/SyncedTableScroll";
import { AlumniExpandableDetails } from "@/components/alumni/AlumniExpandableDetails";
import { ErpDataDetails } from "@/components/alumni/ErpDataDetails";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import { useSession } from "next-auth/react";
import { canModify } from "@/lib/alumniProfile";
import toast from "react-hot-toast";
import { useExcelExport } from "@/lib/excel-export";
import { SendEmailButton } from "@/components/email/SendEmailButton";
import { EMAIL_ACTION_TYPE, generateAdminActionEmail } from "@/lib/emailTemplates";

type MembershipItem = {
  id: number; // Membership record ID (for updates)
  alumniId: number; // Alumni ID (for reference)
  sapid: string;
  registrationNo: string | null;
  name: string;
  contactno: string | null;
  email: string | null;
  faculty: string | null;
  department: string | null;
  program: string | null;
  createdAt: string | null;
  gymMembershipMonth: string | null;
  swimmingPoolMembershipMonth: string | null;
  status: string;
  rejectionReason: string | null;
};

type MembershipResponse = {
  items: MembershipItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  counts: {
    pending: number;
    approved: number;
    notApproved: number;
  };
};

async function getAlumniMemberships(
  page: number,
  limit: number,
  search?: string,
  status?: string
): Promise<MembershipResponse> {
  const url = new URL("/api/alumni/memberships", typeof window !== "undefined" ? window.location.origin : "");
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(limit));
  if (search && search.trim()) {
    url.searchParams.set("search", search.trim());
  }
  if (status && status !== "all") {
    url.searchParams.set("status", status);
  }

  const res = await fetch(url.toString(), { headers: { accept: "application/json" } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to fetch alumni memberships (${res.status})`);
  }
  const data = (await res.json()) as MembershipResponse;
  return data;
}

type SortKey = "sapid" | "name" | "faculty" | "department" | "program" | "createdAt";
type SortDir = "asc" | "desc";

type StatusTabKey = "all" | "pending" | "approved" | "notApproved";

const STATUS_TABS: { key: StatusTabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "notApproved", label: "Not Approved" },
];

export const AlumniMembershipsTab: React.FC = () => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<StatusTabKey>("all");
  const [pendingAction, setPendingAction] = useState<{
    type: "approve" | "unapprove" | "delete";
    membershipId: number; // Membership record ID
    alumniId: number; // Alumni ID (for reference)
    name: string;
    reason?: string;
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [mutatingIds, setMutatingIds] = useState<Set<number>>(new Set());
  const [applicationPreview, setApplicationPreview] = useState<{
    membershipId: number;
    email: string;
    pdfUrl: string;
  } | null>(null);
  const applicationPreviewModal = useModal();
  const [isLoadingApplicationPreview, setIsLoadingApplicationPreview] = useState(false);
  const [applicationPreviewError, setApplicationPreviewError] = useState<string | null>(null);
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const confirmModal = useModal();
  const isAdmin = canModify(session?.user);
  const { isExporting, openExportModal, ExportModal } = useExcelExport();

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading, error } = useQuery<MembershipResponse, Error>({
    queryKey: ["alumni-memberships", debouncedQuery, currentPage, pageSize, selectedStatus],
    queryFn: () =>
      getAlumniMemberships(
        currentPage,
        pageSize,
        debouncedQuery,
        selectedStatus === "all"
          ? undefined
          : selectedStatus === "notApproved"
          ? "not-approved"
          : selectedStatus
      ),
    staleTime: 2 * 60 * 1000,
  });

  const items = data?.items ?? [];
  const itemByMembershipId = useMemo(() => {
    const m = new Map<number, MembershipItem>();
    for (const it of items) m.set(it.id, it);
    return m;
  }, [items]);
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const statusCounts = useMemo(() => {
    const pending = data?.counts?.pending ?? 0;
    const approved = data?.counts?.approved ?? 0;
    const notApproved = data?.counts?.notApproved ?? 0;
    const all = pending + approved + notApproved;
    return { all, pending, approved, notApproved };
  }, [data]);

  const sortedItems = useMemo(() => {
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
    const toComparable = (val: unknown): string | number => {
      if (val == null) return "";
      if (typeof val === "number") return val;
      return String(val).toLowerCase();
    };
    const list = [...items];
    list.sort((a, b) => {
      const aVal = toComparable(a[sortKey]);
      const bVal = toComparable(b[sortKey]);
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

  const startMut = useCallback((alumniId: number) => {
    setMutatingIds((prev) => new Set(prev).add(alumniId));
  }, []);

  const stopMut = useCallback((alumniId: number) => {
    setMutatingIds((prev) => {
      const next = new Set(prev);
      next.delete(alumniId);
      return next;
    });
  }, []);

  const handleApprove = useCallback(async (membershipId: number): Promise<void> => {
    startMut(membershipId);
    try {
      const res = await fetch(`/api/alumni/memberships/${membershipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `Failed to approve: ${res.status}` }));
        throw new Error(errorData.error || `Failed to approve: ${res.status}`);
      }
      toast.success("Membership application approved successfully.");
      queryClient.invalidateQueries({ queryKey: ["alumni-memberships"] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || "Failed to approve membership application.");
      throw e;
    } finally {
      stopMut(membershipId);
    }
  }, [startMut, stopMut, queryClient]);

  const handleViewApplication = useCallback(async (membershipId: number) => {
    setIsLoadingApplicationPreview(true);
    setApplicationPreviewError(null);
    try {
      const res = await fetch(`/api/alumni/memberships/${membershipId}`, {
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to fetch application preview (${res.status})`);
      }
      const data = (await res.json()) as { email: string; pdfUrl: string };
      setApplicationPreview({ membershipId, email: data.email || "-", pdfUrl: data.pdfUrl });
      applicationPreviewModal.openModal();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setApplicationPreviewError(msg || "Failed to fetch application preview");
      applicationPreviewModal.openModal();
    } finally {
      setIsLoadingApplicationPreview(false);
    }
  }, [applicationPreviewModal]);

  const handleUnapprove = useCallback(async (membershipId: number, reason?: string): Promise<void> => {
    startMut(membershipId);
    try {
      const res = await fetch(`/api/alumni/memberships/${membershipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "not-approved", rejectionReason: reason || null }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `Failed to unapprove: ${res.status}` }));
        throw new Error(errorData.error || `Failed to unapprove: ${res.status}`);
      }
      toast.success("Membership application marked as not approved.");
      queryClient.invalidateQueries({ queryKey: ["alumni-memberships"] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || "Failed to update membership application.");
      throw e;
    } finally {
      stopMut(membershipId);
    }
  }, [startMut, stopMut, queryClient]);

  const handleDelete = useCallback(async (membershipId: number): Promise<void> => {
    startMut(membershipId);
    try {
      const res = await fetch(`/api/alumni/memberships/${membershipId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `Failed to delete: ${res.status}` }));
        throw new Error(errorData.error || `Failed to delete: ${res.status}`);
      }
      toast.success("Membership application deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["alumni-memberships"] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || "Failed to delete membership application.");
      throw e;
    } finally {
      stopMut(membershipId);
    }
  }, [startMut, stopMut, queryClient]);

  const executePendingAction = useCallback(async () => {
    if (!pendingAction) return;
    const { type, membershipId } = pendingAction;
    try {
      if (type === "approve") {
        await handleApprove(membershipId);
      } else if (type === "delete") {
        await handleDelete(membershipId);
      } else {
        await handleUnapprove(membershipId, rejectionReason.trim() || undefined);
      }
      setPendingAction(null);
      setRejectionReason("");
      confirmModal.closeModal();
    } catch (e) {
      // Error already handled in handleApprove/handleUnapprove/handleDelete
    }
  }, [pendingAction, rejectionReason, confirmModal, handleApprove, handleUnapprove, handleDelete]);

  const handleConfirmClick = useCallback(async () => {
    if (!pendingAction) return;
    if (mutatingIds.has(pendingAction.membershipId)) return;
    await executePendingAction();
  }, [pendingAction, mutatingIds, executePendingAction]);

  const handleExportToExcel = useCallback(() => {
    const exportColumnKeys: string[] = [
      "SAP ID",
      "Registration No",
      "Full Name",
      "Primary Contact",
      "Faculty",
      "Department",
      "Program",
      "Created At",
      "Gym Membership Month",
      "Swimming Pool Membership Month",
      "Status",
      "Rejection Reason",
    ];

    const columns = exportColumnKeys.map((key) => ({
      key,
      label: key,
      defaultSelected: true,
    }));

    const fetchAndTransformData = async (): Promise<Record<string, unknown>[]> => {
      const allItems: MembershipItem[] = [];
      const exportLimit = 500;

      let page = 1;
      while (true) {
        const url = new URL(
          "/api/alumni/memberships",
          typeof window !== "undefined" ? window.location.origin : ""
        );
        url.searchParams.set("page", String(page));
        url.searchParams.set("limit", String(exportLimit));
        if (debouncedQuery && debouncedQuery.trim()) {
          url.searchParams.set("search", debouncedQuery.trim());
        }
        if (selectedStatus && selectedStatus !== "all") {
          url.searchParams.set(
            "status",
            selectedStatus === "notApproved" ? "not-approved" : selectedStatus
          );
        }

        const res = await fetch(url.toString(), {
          headers: { accept: "application/json" },
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Failed to fetch export data: ${res.status}`);
        }

        const data = (await res.json()) as MembershipResponse;
        const pageItems = data.items || [];
        allItems.push(...pageItems);

        const totalPagesForQuery = data.totalPages || 1;
        if (page >= totalPagesForQuery) break;
        page += 1;
      }

      if (!allItems.length) {
        throw new Error("No data found to export with the applied filters.");
      }

      return allItems.map((item) => ({
        "SAP ID": item.sapid || "",
        "Registration No": item.registrationNo || "",
        "Full Name": item.name || "",
        "Primary Contact": item.contactno || "",
        "Faculty": item.faculty || "",
        "Department": item.department || "",
        "Program": item.program || "",
        "Created At": item.createdAt || "",
        "Gym Membership Month": item.gymMembershipMonth || "",
        "Swimming Pool Membership Month": item.swimmingPoolMembershipMonth || "",
        "Status": item.status || "",
        "Rejection Reason": item.rejectionReason || "",
      }));
    };

    openExportModal({
      data: fetchAndTransformData,
      columns,
      filename: "alumni_memberships_export",
      sheetName: "Alumni Memberships",
    });
  }, [debouncedQuery, selectedStatus, openExportModal]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Alumni Memberships
          </h3>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400" htmlFor="membership-search">
              Search:
            </label>
            <input
              id="membership-search"
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by SAP ID, Reg No, name..."
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100"
            />

            <button
              type="button"
              onClick={handleExportToExcel}
              disabled={isExporting || isLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isExporting ? "Exporting..." : "Export Excel"}
            </button>
          </div>
        </div>

        <ExportModal />

        {/* Status Tabs */}
        <div className="flex flex-wrap gap-3 pt-1">
          {STATUS_TABS.map((tab) => {
            const count =
              tab.key === "all"
                ? statusCounts.all
                : tab.key === "pending"
                ? statusCounts.pending
                : tab.key === "approved"
                ? statusCounts.approved
                : statusCounts.notApproved;
            const isSelected = selectedStatus === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setSelectedStatus(tab.key);
                  setCurrentPage(1);
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold border transition-all ${
                  isSelected
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    isSelected ? "bg-white/20" : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {count.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-hidden border-2 border-gray-200 rounded-lg bg-white shadow-sm">
        <SyncedTableScroll minWidth={1200} maxHeight={700}>
          <Table className="min-w-full">
            <TableHeader className="bg-gradient-to-r from-slate-50 to-slate-100 sticky top-0 z-10 border-b-2 border-gray-300">
              <TableRow>
                <TableCell
                  className="px-6 py-4 text-left text-sm font-semibold text-slate-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSort("sapid")}
                >
                  <div className="flex items-center gap-2">
                    <span>SAP ID / Registration No</span>
                    <div className="flex flex-col">
                      <ArrowUpIcon
                        className={`w-3 h-3 ${
                          sortKey === "sapid" && sortDir === "asc"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      />
                      <ArrowDownIcon
                        className={`w-3 h-3 -mt-1 ${
                          sortKey === "sapid" && sortDir === "desc"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      />
                    </div>
                  </div>
                </TableCell>
                <TableCell
                  className="px-6 py-4 text-left text-sm font-semibold text-slate-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center gap-2">
                    <span>Alumni Name</span>
                    <div className="flex flex-col">
                      <ArrowUpIcon
                        className={`w-3 h-3 ${
                          sortKey === "name" && sortDir === "asc"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      />
                      <ArrowDownIcon
                        className={`w-3 h-3 -mt-1 ${
                          sortKey === "name" && sortDir === "desc"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      />
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                  Faculty
                </TableCell>
                <TableCell className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                  Department
                </TableCell>
                <TableCell className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                  Program
                </TableCell>
                <TableCell className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                  Gym Membership Month
                </TableCell>
                <TableCell className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                  Swimming Pool Membership Month
                </TableCell>
                <TableCell
                  className="px-6 py-4 text-left text-sm font-semibold text-slate-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSort("createdAt")}
                >
                  <div className="flex items-center gap-2">
                    <span>Application Date</span>
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
                  Status
                </TableCell>
                <TableCell className="px-6 py-4 text-left text-sm font-semibold text-slate-700 sticky right-0 z-10 bg-gray-100 dark:bg-gray-800">
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`membership-skeleton-${i}`}>
                    {Array.from({ length: 10 }).map((__, j) => (
                      <TableCell key={j} className="px-6 py-4">
                        <div className="h-5 w-24 bg-gray-200 animate-pulse rounded" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
              {!isLoading && error && (
                <TableRow>
                  <TableCell colSpan={10} className="px-5 py-6 text-center text-red-600">
                    {error.message || "Failed to load memberships"}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !error && sortedItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="px-5 py-8 text-center text-gray-600">
                    No membership records found
                  </TableCell>
                </TableRow>
              )}
              {!isLoading &&
                !error &&
                sortedItems.map((item) => (
                  <React.Fragment key={item.id}>
                    <TableRow className="odd:bg-white even:bg-gray-50/50 hover:bg-blue-50/50">
                      <TableCell className="px-6 py-4 text-sm font-mono text-slate-700">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedRowId(expandedRowId === item.id ? null : item.id)
                            }
                            className={`flex items-center justify-center w-6 h-6 rounded transition-colors ${
                              expandedRowId === item.id
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
                            }`}
                            aria-label={expandedRowId === item.id ? "Collapse details" : "Expand details"}
                            title={expandedRowId === item.id ? "Collapse details" : "Expand details"}
                          >
                            <PlusIcon
                              className={`w-4 h-4 transition-transform ${
                                expandedRowId === item.id ? "rotate-45" : ""
                              }`}
                            />
                          </button>
                          <span>
                            {item.sapid || item.registrationNo || "-"}
                            {item.sapid && item.registrationNo && item.sapid !== item.registrationNo && (
                              <span className="text-gray-500"> / {item.registrationNo}</span>
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm font-semibold text-slate-900">
                        {item.name}
                      </TableCell>
                      <TableCell className="px-6 py-4 min-w-[220px] text-sm text-slate-700">
                        {item.faculty || "-"}
                      </TableCell>
                      <TableCell className="px-6 py-4 min-w-[220px] text-sm text-slate-700">
                        {item.department || "-"}
                      </TableCell>
                      <TableCell className="px-6 py-4 min-w-[220px] text-sm text-slate-700">
                        {item.program || "-"}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-slate-700">
                        {item.gymMembershipMonth || "-"}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-slate-700">
                        {item.swimmingPoolMembershipMonth || "-"}
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
                        <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                              item.status === "approved"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                : item.status === "not-approved"
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                            }`}
                          >
                            {item.status === "approved"
                              ? "Approved"
                              : item.status === "not-approved"
                              ? "Not Approved"
                              : "Pending"}
                          </span>
                          {item.status === "not-approved" && item.rejectionReason && (
                            <div className="mt-1 text-xs text-gray-600 dark:text-gray-400 max-w-xs">
                              <span className="font-medium">Reason: </span>
                              <span className="italic">{item.rejectionReason}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-4 min-w-[180px] sticky right-0 z-10 bg-gray-100 dark:bg-gray-800 text-sm text-slate-700">
                        {isAdmin && (
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleViewApplication(item.id)}
                              disabled={mutatingIds.has(item.id)}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-gray-600 dark:text-gray-300 bg-white/0 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
                              aria-label="View Application"
                              title="View Application"
                            >
                              <EyeIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                            </button>
                            {item.status !== "approved" && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPendingAction({ type: "approve", membershipId: item.id, alumniId: item.alumniId, name: item.name });
                                  confirmModal.openModal();
                                }}
                                disabled={mutatingIds.has(item.id)}
                                className="p-1.5 sm:p-2 rounded-lg text-gray-500 dark:text-gray-400 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 hover:text-emerald-600 hover:bg-gray-100 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label="Approve"
                                title="Approve"
                              >
                                <CheckLineIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                              </button>
                            )}
                            {item.status !== "not-approved" && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectionReason("");
                                  setPendingAction({ type: "unapprove", membershipId: item.id, alumniId: item.alumniId, name: item.name });
                                  confirmModal.openModal();
                                }}
                                disabled={mutatingIds.has(item.id)}
                                className="p-1.5 sm:p-2 rounded-lg text-gray-500 dark:text-gray-400 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 hover:text-rose-600 hover:bg-gray-100 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label="Not Approve"
                                title="Not Approve"
                              >
                                <CloseLineIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setPendingAction({ type: "delete", membershipId: item.id, alumniId: item.alumniId, name: item.name });
                                confirmModal.openModal();
                              }}
                              disabled={mutatingIds.has(item.id)}
                              className="p-1.5 sm:p-2 rounded-lg text-gray-500 dark:text-gray-400 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
                              aria-label="Delete"
                              title="Delete"
                            >
                              <TrashBinIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                            </button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                    {expandedRowId === item.id && (
                      <TableRow className="bg-blue-50/30 dark:bg-blue-900/10">
                        <TableCell colSpan={10} className="px-0 py-4">
                          <div
                            className="w-full overflow-x-hidden"
                            style={{ maxWidth: "calc(100vw - 2rem)", boxSizing: "border-box" }}
                          >
                            <div className="w-full max-w-full overflow-x-hidden flex flex-row justify-start">
                              <AlumniExpandableDetails
                                sapId={item.sapid || item.registrationNo || String(item.alumniId)}
                                onClose={() => setExpandedRowId(null)}
                                readOnly={true}
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
                ))}
            </TableBody>
          </Table>
        </SyncedTableScroll>
        <div className="flex items-center justify-between p-4 border-t">
          <span className="text-sm text-gray-500">
            Showing{" "}
            {sortedItems.length
              ? (currentPage - 1) * pageSize + 1
              : 0}
            -
            {Math.min((currentPage - 1) * pageSize + sortedItems.length, total)} of {total}
          </span>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-500" htmlFor="membership-page-size">
              Items per page:
            </label>
            <select
              id="membership-page-size"
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm"
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

      {/* Confirmation Modal */}
      {confirmModal.isOpen && pendingAction && (
        <Modal
          isOpen={confirmModal.isOpen}
          onClose={() => {
            if (!mutatingIds.has(pendingAction?.membershipId || 0)) {
              confirmModal.closeModal();
              setPendingAction(null);
              setRejectionReason("");
            }
          }}
          className="max-w-md"
        >
          <div className="p-6">
            <div className="flex items-center gap-4 mb-4">
              {pendingAction.type === "approve" ? (
                <CheckLineIcon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              ) : pendingAction.type === "delete" ? (
                <TrashBinIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
              ) : (
                <CloseLineIcon className="h-6 w-6 text-rose-600 dark:text-rose-400" />
              )}
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {pendingAction.type === "approve" ? "Approve Application" : pendingAction.type === "delete" ? "Delete Application" : "Not Approve Application"}
              </h3>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
              {pendingAction.type === "approve" ? (
                <>Are you sure you want to approve the membership application for <strong className="font-semibold text-gray-900 dark:text-gray-100">{pendingAction.name}</strong>?</>
              ) : pendingAction.type === "delete" ? (
                <>Are you sure you want to delete the membership application for <strong className="font-semibold text-gray-900 dark:text-gray-100">{pendingAction.name}</strong>? This action cannot be undone.</>
              ) : (
                <>Are you sure you want to mark the membership application as not approved for <strong className="font-semibold text-gray-900 dark:text-gray-100">{pendingAction.name}</strong>?</>
              )}
            </p>
            {pendingAction.type === "unapprove" && (
              <div className="mb-6">
                <label htmlFor="rejection-reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reason for Rejection <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="rejection-reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please provide a reason for rejecting this application..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 resize-none"
                  required
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  This reason will be visible to the alumni.
                </p>
              </div>
            )}

            {pendingAction.type !== "delete" && (
              <div className="mb-6">
                {(() => {
                  const it = itemByMembershipId.get(pendingAction.membershipId);
                  const recipientEmail = it?.email || null;
                  if (!recipientEmail) {
                    return (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        No recipient email found for this alumni. You can still confirm the action, but you cannot send an email.
                      </div>
                    );
                  }

                  const isGym = Boolean(it?.gymMembershipMonth);
                  const isPool = Boolean(it?.swimmingPoolMembershipMonth);

                  const actionType =
                    pendingAction.type === "approve"
                      ? isGym
                        ? EMAIL_ACTION_TYPE.UOL_GYM_MEMBERSHIP_APPROVED
                        : isPool
                          ? EMAIL_ACTION_TYPE.SWIMMING_POOL_MEMBERSHIP_APPROVED
                          : EMAIL_ACTION_TYPE.ALUMNI_MEMBERSHIP_APPROVED
                      : isGym
                        ? EMAIL_ACTION_TYPE.UOL_GYM_MEMBERSHIP_NOT_APPROVED
                        : isPool
                          ? EMAIL_ACTION_TYPE.SWIMMING_POOL_MEMBERSHIP_NOT_APPROVED
                          : EMAIL_ACTION_TYPE.ALUMNI_MEMBERSHIP_NOT_APPROVED;
                  const tpl = generateAdminActionEmail({ actionType, alumniName: pendingAction.name });

                  return (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-4">
                      <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Send Email</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Preview and edit before sending</div>
                      </div>
                      <SendEmailButton
                        alumniId={pendingAction.alumniId}
                        recipientEmail={recipientEmail}
                        actionType={actionType}
                        initialSubject={tpl.subject}
                        initialBody={tpl.html}
                        disabled={mutatingIds.has(pendingAction.membershipId)}
                      />
                    </div>
                  );
                })()}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!mutatingIds.has(pendingAction?.membershipId || 0)) {
                    confirmModal.closeModal();
                    setPendingAction(null);
                    setRejectionReason("");
                  }
                }}
                disabled={mutatingIds.has(pendingAction.membershipId)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClick}
                disabled={mutatingIds.has(pendingAction.membershipId) || (pendingAction.type === "unapprove" && !rejectionReason.trim())}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  pendingAction.type === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500"
                    : pendingAction.type === "delete"
                    ? "bg-red-600 hover:bg-red-700 focus:ring-red-500"
                    : "bg-rose-600 hover:bg-rose-700 focus:ring-rose-500"
                }`}
              >
                {mutatingIds.has(pendingAction.membershipId) ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : (
                  pendingAction.type === "approve" ? "Approve" : pendingAction.type === "delete" ? "Delete" : "Not Approve"
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Application Preview Modal */}
      {applicationPreviewModal.isOpen && (
        <Modal
          isOpen={applicationPreviewModal.isOpen}
          onClose={() => {
            if (!isLoadingApplicationPreview) {
              applicationPreviewModal.closeModal();
              setApplicationPreview(null);
              setApplicationPreviewError(null);
            }
          }}
          className="max-w-5xl"
        >
          <div className="p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Application Preview
              </h3>
              <div className="flex items-center gap-2">
                {applicationPreview?.pdfUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      window.open(applicationPreview.pdfUrl, "_blank", "noopener,noreferrer");
                    }}
                    className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Print / Download
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (!isLoadingApplicationPreview) {
                      applicationPreviewModal.closeModal();
                      setApplicationPreview(null);
                      setApplicationPreviewError(null);
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Close
                </button>
              </div>
            </div>

            {isLoadingApplicationPreview && (
              <div className="py-10 text-center text-sm text-gray-600 dark:text-gray-300">Loading preview...</div>
            )}

            {!isLoadingApplicationPreview && applicationPreviewError && (
              <div className="py-10 text-center text-sm text-red-600">{applicationPreviewError}</div>
            )}

            {!isLoadingApplicationPreview && !applicationPreviewError && applicationPreview && (
              <div className="space-y-4">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">Email:</span> {applicationPreview.email || "-"}
                </div>
                <div className="w-full border border-gray-200 rounded-lg overflow-hidden bg-white">
                  <iframe
                    title={`membership-application-${applicationPreview.membershipId}`}
                    src={applicationPreview.pdfUrl}
                    className="w-full h-[70vh]"
                  />
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

