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

type ScholarshipItem = {
  alumniId: number;
  sapid: string;
  registrationNo: string | null;
  name: string;
  contactno: string | null;
  email: string | null;
  faculty: string | null;
  department: string | null;
  program: string | null;
  createdAt: string | null;
  kinshipFirstName: string | null;
  kinshipLastName: string | null;
  kinshipCnic: string | null;
  applyFor: string | null;
  scholarshipDegreeTitle: string | null;
  discountType: string | null;
  status: string;
  rejectionReason: string | null;
};

type ScholarshipResponse = {
  items: ScholarshipItem[];
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

type ScholarshipApplicationLetter = {
  title: string;
  dateFormatted: string;
  status: string;
  studentName: string;
  scholarshipType: string;
  applyingFor: string;
  previousDegree: string;
  cgpaLastDegree: string;
  requestedDiscount: string;
  admissionFeePercent?: number | null;
  tuitionFeePercent?: number | null;
  highAchieverPercent?: number | null;
  applyAdmissionFeeDiscount?: boolean | null;
  medal?: string | null;
  feeBreakdown?: {
    admissionFeeDiscount: number | null;
    tuitionFeeDiscount: number | null;
    highAchieverDiscount: number | null;
    admissionFeeDisplay: string;
    tuitionFeeDisplay: string;
    highAchieverDisplay: string;
    totalDisplay: string;
  } | null;
  documentsAttached: string[];
  uploadedDocuments?: Array<{ label: string; filename: string; url: string; adminVerified?: "YES" | "NO" | null }>;
  sapCode: string;
  requestedProgramDegree?: string;
  faculty?: string;
  department?: string;
  program?: string;
  campus?: string;
  passingOutYear?: string;
  admissionApplicationRef?: string | null;
  mastersAdmissionSummary?: string | null;
  kinship?: { firstName: string; lastName: string; cnic: string } | null;
  isKinship?: boolean;
  kinshipDetails?: {
    kinName?: string;
    kinFatherName?: string;
    kinCampus?: string;
    kinFaculty?: string;
    kinDepartment?: string;
    kinProgram?: string;
    kinAdmissionRefNo?: string;
    kinLastDegreeCertificate?: string;
    kinPassingOutYear?: string;
    kinCnic?: string;
  } | null;
};

async function getAlumniScholarships(
  page: number,
  limit: number,
  search?: string,
  status?: string
): Promise<ScholarshipResponse> {
  const url = new URL("/api/alumni/scholarships", typeof window !== "undefined" ? window.location.origin : "");
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
    throw new Error(text || `Failed to fetch alumni scholarships (${res.status})`);
  }
  const data = (await res.json()) as ScholarshipResponse;
  return data;
}

type SortKey = "sapid" | "name" | "faculty" | "department" | "program" | "createdAt" | "applyFor";
type SortDir = "asc" | "desc";

type StatusTabKey = "all" | "pending" | "approved" | "notApproved";

const STATUS_TABS: { key: StatusTabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "notApproved", label: "Not Approved" },
];

export const AlumniScholarshipsTab: React.FC = () => {
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
    alumniId: number;
    name: string;
    reason?: string;
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [mutatingIds, setMutatingIds] = useState<Set<number>>(new Set());
  const [applicationPreview, setApplicationPreview] = useState<{
    alumniId: number;
    email: string;
    pdfUrl: string;
    application: ScholarshipApplicationLetter | null;
  } | null>(null);
  const applicationPreviewModal = useModal();
  const [isLoadingApplicationPreview, setIsLoadingApplicationPreview] = useState(false);
  const [applicationPreviewError, setApplicationPreviewError] = useState<string | null>(null);
  const [docChecklistDraft, setDocChecklistDraft] = useState<Record<string, "YES" | "NO" | null>>({});
  const [docChecklistPendingSave, setDocChecklistPendingSave] = useState(false);
  const docChecklistConfirmModal = useModal(false);
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const confirmModal = useModal();
  const isAdmin = canModify(session?.user);
  const { isExporting, openExportModal, ExportModal } = useExcelExport();

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading, error } = useQuery<ScholarshipResponse, Error>({
    queryKey: ["alumni-scholarships", debouncedQuery, currentPage, pageSize, selectedStatus],
    queryFn: () =>
      getAlumniScholarships(
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
  const itemByAlumniId = useMemo(() => {
    const m = new Map<number, ScholarshipItem>();
    for (const it of items) m.set(it.alumniId, it);
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

  const handleApprove = useCallback(async (alumniId: number): Promise<void> => {
    startMut(alumniId);
    try {
      const res = await fetch(`/api/alumni/scholarships/${alumniId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `Failed to approve: ${res.status}` }));
        throw new Error(errorData.error || `Failed to approve: ${res.status}`);
      }
      toast.success("Scholarship application approved successfully.");
      queryClient.invalidateQueries({ queryKey: ["alumni-scholarships"] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || "Failed to approve scholarship application.");
      throw e;
    } finally {
      stopMut(alumniId);
    }
  }, [startMut, stopMut, queryClient]);

  const handleViewApplication = useCallback(async (alumniId: number) => {
    setIsLoadingApplicationPreview(true);
    setApplicationPreviewError(null);
    try {
      const res = await fetch(`/api/alumni/scholarships/${alumniId}`, {
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to fetch application preview (${res.status})`);
      }
      const data = (await res.json()) as {
        email: string;
        pdfUrl: string;
        application?: ScholarshipApplicationLetter;
      };
      setApplicationPreview({
        alumniId,
        email: data.email || "-",
        pdfUrl: data.pdfUrl,
        application: data.application ?? null,
      });
      const initDraft: Record<string, "YES" | "NO" | null> = {};
      const app = data.application;
      if (app?.uploadedDocuments && Array.isArray(app.uploadedDocuments) && app.uploadedDocuments.length) {
        for (const d of app.uploadedDocuments) {
          const key = String(d.label || "").trim();
          if (!key) continue;
          initDraft[key] = (d.adminVerified ?? null) as "YES" | "NO" | null;
        }
      } else if (app?.documentsAttached && Array.isArray(app.documentsAttached)) {
        for (const line of app.documentsAttached) {
          const key = String(line || "").trim();
          if (!key) continue;
          initDraft[key] = null;
        }
      }
      setDocChecklistDraft(initDraft);
      applicationPreviewModal.openModal();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setApplicationPreviewError(msg || "Failed to fetch application preview");
      applicationPreviewModal.openModal();
    } finally {
      setIsLoadingApplicationPreview(false);
    }
  }, [applicationPreviewModal]);

  const saveDocumentChecklist = useCallback(async () => {
    if (!applicationPreview?.alumniId) return;
    const entries = Object.entries(docChecklistDraft)
      .map(([label, verified]) => {
        if (verified !== "YES" && verified !== "NO") return null;
        return { label, verified };
      })
      .filter(Boolean) as Array<{ label: string; verified: "YES" | "NO" }>;

    if (entries.length === 0) {
      toast.error("Please select Yes/No for at least one document.");
      return;
    }

    setDocChecklistPendingSave(true);
    try {
      const res = await fetch(`/api/alumni/scholarships/${applicationPreview.alumniId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentChecklist: entries }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = data && typeof data === "object" && "error" in data ? String((data as any).error || "") : "";
        throw new Error(err || `Failed to save checklist (${res.status})`);
      }
      toast.success("Document checklist saved.");
      docChecklistConfirmModal.closeModal();
      // Refresh preview to pick up saved flags
      await handleViewApplication(applicationPreview.alumniId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || "Failed to save checklist");
    } finally {
      setDocChecklistPendingSave(false);
    }
  }, [applicationPreview?.alumniId, docChecklistDraft, docChecklistConfirmModal, handleViewApplication]);

  const handleUnapprove = useCallback(async (alumniId: number, reason?: string): Promise<void> => {
    startMut(alumniId);
    try {
      const res = await fetch(`/api/alumni/scholarships/${alumniId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "not-approved", rejectionReason: reason || null }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `Failed to unapprove: ${res.status}` }));
        throw new Error(errorData.error || `Failed to unapprove: ${res.status}`);
      }
      toast.success("Scholarship application marked as not approved.");
      queryClient.invalidateQueries({ queryKey: ["alumni-scholarships"] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || "Failed to update scholarship application.");
      throw e;
    } finally {
      stopMut(alumniId);
    }
  }, [startMut, stopMut, queryClient]);

  const handleDelete = useCallback(async (alumniId: number): Promise<void> => {
    startMut(alumniId);
    try {
      const res = await fetch(`/api/alumni/scholarships/${alumniId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `Failed to delete: ${res.status}` }));
        throw new Error(errorData.error || `Failed to delete: ${res.status}`);
      }
      toast.success("Scholarship application deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["alumni-scholarships"] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || "Failed to delete scholarship application.");
      throw e;
    } finally {
      stopMut(alumniId);
    }
  }, [startMut, stopMut, queryClient]);

  const executePendingAction = useCallback(async () => {
    if (!pendingAction) return;
    const { type, alumniId } = pendingAction;
    try {
      if (type === "approve") {
        await handleApprove(alumniId);
      } else if (type === "delete") {
        await handleDelete(alumniId);
      } else {
        await handleUnapprove(alumniId, rejectionReason.trim() || undefined);
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
    if (mutatingIds.has(pendingAction.alumniId)) return;
    await executePendingAction();
  }, [pendingAction, mutatingIds, executePendingAction]);

  const handleExportToExcel = useCallback(() => {
    const exportColumnKeys: string[] = [
      "SR.No",
      "SAP ID",
      "Registration No",
      "Full Name",
      "Primary Contact",
      "Faculty",
      "Department",
      "Program",
      "Created At",
      "Kinship First Name",
      "Kinship Last Name",
      "Kinship CNIC",
      "Apply For",
      "Scholarship Degree Title",
      "Status",
      "Rejection Reason",
    ];

    const columns = exportColumnKeys.map((key) => ({
      key,
      label: key,
      defaultSelected: true,
    }));

    const fetchAndTransformData = async (): Promise<Record<string, unknown>[]> => {
      const allItems: ScholarshipItem[] = [];
      const exportLimit = 500;

      let page = 1;
      while (true) {
        const url = new URL(
          "/api/alumni/scholarships",
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

        const data = (await res.json()) as ScholarshipResponse;
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
        "SR.No": item.alumniId || "",
        "SAP ID": item.sapid || "",
        "Registration No": item.registrationNo || "",
        "Full Name": item.name || "",
        "Primary Contact": item.contactno || "",
        "Faculty": item.faculty || "",
        "Department": item.department || "",
        "Program": item.program || "",
        "Created At": item.createdAt || "",
        "Kinship First Name": item.kinshipFirstName || "",
        "Kinship Last Name": item.kinshipLastName || "",
        "Kinship CNIC": item.kinshipCnic || "",
        "Apply For": item.applyFor || "",
        "Scholarship Degree Title": item.scholarshipDegreeTitle || "",
        "Status": item.status || "",
        "Rejection Reason": item.rejectionReason || "",
      }));
    };

    openExportModal({
      data: fetchAndTransformData,
      columns,
      filename: "alumni_scholarships_export",
      sheetName: "Alumni Scholarships",
    });
  }, [debouncedQuery, selectedStatus, openExportModal]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-gray-100 dark:text-gray-100">
            Alumni Scholarships
          </h3>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-100" htmlFor="scholarship-search">
              Search:
            </label>
            <input
              id="scholarship-search"
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by SAP ID, Reg No, name, kinship name, CNIC..."
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px  -3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100"
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
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                  isSelected
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
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

      <div className="overflow-hidden rounded-lg border-2 border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <SyncedTableScroll minWidth={1200} maxHeight={700}>
          <Table className="min-w-full">
            <TableHeader className="sticky top-0 z-10 border-b-2 border-gray-300 bg-gradient-to-r from-slate-50 to-slate-100 dark:border-gray-700 dark:from-gray-800 dark:to-gray-900">
              <TableRow>
                <TableCell
                  className="px-6 py-4 text-left text-sm font-semibold text-slate-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors dark:text-gray-300"
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
                  className="px-6 py-4 text-left text-sm font-semibold text-slate-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors dark:text-gray-300"
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
                <TableCell className="px-6 py-4 text-left text-sm font-semibold text-slate-700 dark:text-gray-300">
                  Faculty 
                </TableCell>
                <TableCell className="px-6 py-4 text-left text-sm font-semibold text-slate-700 dark:text-gray-300">
                  Department 
                </TableCell>
                <TableCell className="px-6 py-4 text-left text-sm font-semibold text-slate-700 dark:text-gray-300">
                  Program 
                </TableCell>
                <TableCell
                  className="px-6 py-4 text-left text-sm font-semibold text-slate-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors dark:text-gray-300"
                  onClick={() => handleSort("applyFor")}
                >
                  <div className="flex items-center gap-2">
                    <span>Applying For</span>
                    <div className="flex flex-col">
                      <ArrowUpIcon
                        className={`w-3 h-3 ${
                          sortKey === "applyFor" && sortDir === "asc"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      />
                      <ArrowDownIcon
                        className={`w-3 h-3 -mt-1 ${
                          sortKey === "applyFor" && sortDir === "desc"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      />
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-6 py-4 text-left text-sm font-semibold text-slate-700 dark:text-gray-300">
                  Scholarship Degree Title 
                </TableCell>
                <TableCell className="px-6 py-4 text-left text-sm font-semibold text-slate-700 dark:text-gray-300">
                  Kinship Name 
                </TableCell>
                <TableCell className="px-6 py-4 text-left text-sm font-semibold text-slate-700 dark:text-gray-300">
                  Kinship CNIC 
                </TableCell>
                <TableCell
                  className="px-6 py-4 text-left text-sm font-semibold text-slate-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors dark:text-gray-300"
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
                <TableCell className="px-6 py-4 text-left text-sm font-semibold text-slate-700 dark:text-gray-300">
                  Status 
                </TableCell>
                <TableCell className="px-6 py-4 text-left text-sm font-semibold text-slate-700 sticky right-0 z-10 bg-gray-100 dark:bg-gray-800 dark:text-gray-300">
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`scholarship-skeleton-${i}`}>
                    {Array.from({ length: 12 }).map((__, j) => (
                      <TableCell key={j} className="px-6 py-4">
                        <div className="h-5 w-24 bg-gray-200 animate-pulse rounded" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
              {!isLoading && error && (
                <TableRow>
                  <TableCell colSpan={12} className="px-5 py-6 text-center text-red-600">
                    {error.message || "Failed to load scholarships"}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !error && sortedItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="px-5 py-8 text-center text-gray-600">
                    No scholarship records found
                  </TableCell>
                </TableRow>
              )}
              {!isLoading &&
                !error &&
                sortedItems.map((item) => (
                  <React.Fragment key={item.alumniId}>
                    <TableRow className="odd:bg-white even:bg-gray-50/50 hover:bg-blue-50/50 dark:odd:bg-gray-900 dark:even:bg-gray-800/70 dark:hover:bg-blue-900/20">
                      <TableCell className="px-6 py-4 text-sm font-mono text-slate-700 dark:text-gray-300">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedRowId(
                                expandedRowId === item.alumniId ? null : item.alumniId
                              )
                            }
                            className={`flex items-center justify-center w-6 h-6 rounded transition-colors ${
                              expandedRowId === item.alumniId
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
                            }`}
                            aria-label={
                              expandedRowId === item.alumniId
                                ? "Collapse details"
                                : "Expand details"
                            }
                            title={
                              expandedRowId === item.alumniId
                                ? "Collapse details"
                                : "Expand details"
                            }
                          >
                            <PlusIcon
                              className={`w-4 h-4 transition-transform ${
                                expandedRowId === item.alumniId ? "rotate-45" : ""
                              }`}
                            />
                          </button>
                          <span>
                            {item.sapid || item.registrationNo || "-"}
                            {item.sapid &&
                              item.registrationNo &&
                              item.sapid !== item.registrationNo && (
                                <span className="text-gray-500">
                                  {" "}
                                  / {item.registrationNo}
                                </span>
                              )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-gray-100">
                        {item.name}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-slate-700 min-w-[220px] dark:text-gray-300">
                        {item.faculty || "-"}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-slate-700 min-w-[220px] dark:text-gray-300">
                        {item.department || "-"}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-slate-700 min-w-[220px] dark:text-gray-300">
                        {item.program || "-"}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-slate-700 dark:text-gray-300">
                        {item.applyFor || "-"}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-slate-700 dark:text-gray-300">
                        {item.scholarshipDegreeTitle || "-"}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-slate-700 dark:text-gray-300">
                        {item.kinshipFirstName || item.kinshipLastName
                          ? `${item.kinshipFirstName ?? ""} ${item.kinshipLastName ?? ""}`.trim()
                          : "-"}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-slate-700 dark:text-gray-300">
                        {item.kinshipCnic || "-"}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-slate-700 dark:text-gray-300">
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleDateString("en-PK", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "-"}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-slate-700 dark:text-gray-300">
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
                      <TableCell className="sticky right-0 z-10 min-w-[180px] bg-gray-100 px-2 py-4 text-sm text-slate-700 dark:bg-gray-900 dark:text-gray-300">
                        {isAdmin && (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleViewApplication(item.alumniId)}
                              disabled={mutatingIds.has(item.alumniId)}
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
                                  setPendingAction({ type: "approve", alumniId: item.alumniId, name: item.name });
                                  confirmModal.openModal();
                                }}
                                disabled={mutatingIds.has(item.alumniId)}
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
                                  setPendingAction({ type: "unapprove", alumniId: item.alumniId, name: item.name });
                                  confirmModal.openModal();
                                }}
                                disabled={mutatingIds.has(item.alumniId)}
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
                                setPendingAction({ type: "delete", alumniId: item.alumniId, name: item.name });
                                confirmModal.openModal();
                              }}
                              disabled={mutatingIds.has(item.alumniId)}
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
                    {expandedRowId === item.alumniId && (
                      <TableRow className="bg-blue-50/30 dark:bg-blue-900/10 dark:text-gray-300">
                        <TableCell colSpan={12} className="px-0 py-4">
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
        <div className="flex items-center justify-between border-t p-4 dark:border-gray-700 dark:bg-gray-900">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Showing{" "}
            {sortedItems.length
              ? (currentPage - 1) * pageSize + 1
              : 0}
            -
            {Math.min((currentPage - 1) * pageSize + sortedItems.length, total)} of {total}
          </span>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-500 dark:text-gray-400" htmlFor="scholarship-page-size">
              Items per page:
            </label>
            <select
              id="scholarship-page-size"
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-100"
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
            if (!mutatingIds.has(pendingAction?.alumniId || 0)) {
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
                <CheckLineIcon className="h-6 w-6 text-emerald-600 dark:text-emerald-400 dark:text-emerald-400" />
              ) : pendingAction.type === "delete" ? (
                <TrashBinIcon className="h-6 w-6 text-red-600 dark:text-red-400 dark:text-red-400" />
              ) : (
                <CloseLineIcon className="h-6 w-6 text-rose-600 dark:text-rose-400 dark:text-rose-400" />
              )}
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                {pendingAction.type === "approve" ? "Approve Application" : pendingAction.type === "delete" ? "Delete Application" : "Not Approve Application"}
              </h3>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
              {pendingAction.type === "approve" ? (
                <>Are you sure you want to approve the scholarship application for <strong className="font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">{pendingAction.name}</strong>?</>
              ) : pendingAction.type === "delete" ? (
                <>Are you sure you want to delete the scholarship application for <strong className="font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">{pendingAction.name}</strong>? This action cannot be undone.</>
              ) : (
                <>Are you sure you want to mark the scholarship application as not approved for <strong className="font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">{pendingAction.name}</strong>?</>
              )}
            </p>
            {pendingAction.type === "unapprove" && (
              <div className="mb-6">
                <label htmlFor="rejection-reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-2">
                  Reason for Rejection <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="rejection-reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please provide a reason for rejecting this application..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 resize-none"
                  required
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-400">
                  This reason will be visible to the alumni.
                </p>
              </div>
            )}

            {pendingAction.type !== "delete" && (
              <div className="mb-6">
                {(() => {
                  const it = itemByAlumniId.get(pendingAction.alumniId);
                  const recipientEmail = it?.email || null;
                  if (!recipientEmail) {
                    return (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:text-amber-800 dark:text-amber-800">
                        No recipient email found for this alumni. You can still confirm the action, but you cannot send an email.
                      </div>
                    );
                  }

                  const actionType =
                    pendingAction.type === "approve"
                      ? EMAIL_ACTION_TYPE.ALUMNI_SCHOLARSHIP_APPROVED
                      : EMAIL_ACTION_TYPE.ALUMNI_SCHOLARSHIP_NOT_APPROVED;
                  const tpl = generateAdminActionEmail({ actionType, alumniName: pendingAction.name });

                  return (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-4">
                      <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">Preview Email</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Preview and edit before sending</div>
                      </div>
                      <SendEmailButton
                        alumniId={pendingAction.alumniId}
                        recipientEmail={recipientEmail}
                        actionType={actionType}
                        initialSubject={tpl.subject}
                        initialBody={tpl.html}
                        disabled={mutatingIds.has(pendingAction.alumniId)}
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
                  if (!mutatingIds.has(pendingAction?.alumniId || 0)) {
                    confirmModal.closeModal();
                    setPendingAction(null);
                    setRejectionReason("");
                  }
                }}
                disabled={mutatingIds.has(pendingAction.alumniId)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed dark:text-gray-700 dark:bg-gray-100 dark:hover:bg-gray-200 dark:focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClick}
                disabled={mutatingIds.has(pendingAction.alumniId) || (pendingAction.type === "unapprove" && !rejectionReason.trim())}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:text-white dark:bg-emerald-600 dark:hover:bg-emerald-700 dark:focus:ring-emerald-500 dark:bg-red-600 dark:hover:bg-red-700 dark:focus:ring-red-500 dark:bg-rose-600 dark:hover:bg-rose-700 dark:focus:ring-rose-500 ${
                  pendingAction.type === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500"
                    : pendingAction.type === "delete"
                    ? "bg-red-600 hover:bg-red-700 focus:ring-red-500"
                    : "bg-rose-600 hover:bg-rose-700 focus:ring-rose-500"
                }`}
              >
                {mutatingIds.has(pendingAction.alumniId) ? (
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
              setDocChecklistDraft({});
            }
          }}
          className="max-w-5xl"
        >
          <div className="p-6 dark:text-gray-100 dark:bg-gray-900 ">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100 dark:text-gray-100">
                Application Preview
              </h3>
              <div className="flex items-center gap-2 mr-12">
                {applicationPreview?.pdfUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      const latestLetterPdf = `/api/alumni/scholarships/${applicationPreview.alumniId}?mode=letter-pdf&download=1`;
                      const link = document.createElement("a");
                      link.href = latestLetterPdf;
                      link.download = `Scholarship_Application_Form_${applicationPreview.alumniId}.pdf`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-500 dark:text-gray-100 dark:text-gray-100"
                  >
                    Download
                  </button>
                )}
                
              </div>
            </div>

            {isLoadingApplicationPreview && (
              <div className="py-10 text-center text-sm text-gray-600 dark:text-gray-300">Loading preview...</div>
            )}

            {!isLoadingApplicationPreview && applicationPreviewError && (
              <div className="py-10 text-center text-sm text-red-600 dark:text-red-600">{applicationPreviewError}</div>
            )}

            {!isLoadingApplicationPreview && !applicationPreviewError && applicationPreview && (
              <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2 dark:text-gray-100">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-semibold dark:text-gray-100">Email:</span> {applicationPreview.email || "-"}
                </div>

                {applicationPreview.application ? (
                  <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white p-6 sm:p-8 text-gray-900 shadow-sm dark:text-gray-100 dark:bg-gray-900 dark:text-gray-100 dark:text-gray-100">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-gray-200 pb-4 mb-6 dark:border-gray-700 dark:bg-gray-900">
                      <div className="min-w-0">
                        <h4 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-gray-100 dark:text-gray-100">
                          {applicationPreview.application.title}
                        </h4>
                        <div className="mt-1 text-sm text-slate-600 dark:text-gray-100 dark:text-gray-100 dark:text-gray-100">
                          Student:{" "}
                          <span className="font-semibold text-slate-800 dark:text-gray-100 dark:text-gray-100">
                            {applicationPreview.application.studentName || "-"}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm text-slate-700 whitespace-nowrap dark:text-gray-300 dark:text-gray-100 dark:text-gray-100">
                        Date: <span className="font-semibold">{applicationPreview.application.dateFormatted}</span>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="rounded-xl border border-slate-200 overflow-hidden dark:border-gray-700 dark:bg-gray-900 ">
                        <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 dark:text-gray-100 dark:text-gray-100 dark:text-gray-100 dark:bg-gray-900">Current Application</div>
                        <div className="overflow-x-auto dark:bg-gray-900">
                          <table className="min-w-full text-sm dark:text-gray-100 dark:bg-gray-900	">
                            <tbody className="divide-y divide-slate-200 dark:divide-gray-700 dark:text-gray-100 dark:text-gray-100 dark:bg-gray-900 ">
                              {[
                                ["Discount Category", applicationPreview.application.scholarshipType],
                                ...(applicationPreview.application.feeBreakdown
                                  ? [
                                      ...(applicationPreview.application.applyAdmissionFeeDiscount === true && applicationPreview.application.feeBreakdown.admissionFeeDiscount != null && applicationPreview.application.feeBreakdown.admissionFeeDiscount > 0
                                        ? [["Admission Fee Discount (Standalone)", applicationPreview.application.feeBreakdown.admissionFeeDisplay] as [string, string]]
                                        : []),
                                      ["Tuition Fee Discount", applicationPreview.application.feeBreakdown.tuitionFeeDisplay],
                                      ...(applicationPreview.application.feeBreakdown.highAchieverDiscount != null && applicationPreview.application.feeBreakdown.highAchieverDiscount > 0
                                        ? [[`High Achiever Discount (${applicationPreview.application.medal || "Medalist"})`, applicationPreview.application.feeBreakdown.highAchieverDisplay] as [string, string]]
                                        : []),
                                      ["Total Tuition Fee Discount", applicationPreview.application.feeBreakdown.totalDisplay],
                                    ] as [string, string][]
                                  : [
                                      ["Applicable Discount", applicationPreview.application.requestedDiscount || "-"],
                                      ...(applicationPreview.application.highAchieverPercent != null && applicationPreview.application.highAchieverPercent > 0
                                        ? [[`High Achiever Discount (${applicationPreview.application.medal || "Medalist"})`, `${applicationPreview.application.highAchieverPercent}%`] as [string, string]]
                                        : []),
                                    ] as [string, string][]),
                                ["Program", applicationPreview.application.requestedProgramDegree || "-"],
                                ["Department", applicationPreview.application.department || "-"],
                                ["Faculty", applicationPreview.application.faculty || "-"],
                                ...(applicationPreview.application.isKinship
                                  ? [["Applying For", applicationPreview.application.applyingFor || "-"]]
                                  : []),
                              ].map(([k, v]) => (
                                <tr key={k} className="bg-white dark:bg-gray-900">
                                  <td className="w-[260px] px-4 py-3 font-semibold text-slate-800 bg-slate-50/60 dark:text-gray-100 dark:text-gray-100 dark:text-gray-100 dark:bg-gray-900">{k}</td>
                                  <td className="px-4 py-3 text-slate-900 dark:text-gray-100 dark:text-gray-100 dark:text-gray-100 dark:bg-gray-900">{String(v || "-")}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 overflow-hidden dark:border-gray-700 dark:bg-gray-900">
                        <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 dark:text-gray-100 dark:text-gray-100 dark:text-gray-100 dark:bg-gray-900">Previous Educational Background</div>
                        <div className="overflow-x-auto dark:bg-gray-900">
                          <table className="min-w-full text-sm dark:text-gray-100 dark:bg-gray-900">
                            <tbody className="divide-y divide-slate-200 dark:divide-gray-700 dark:text-gray-100 dark:bg-gray-900">
                              {[
                                ["Program", applicationPreview.application.previousDegree],
                                ["Department", applicationPreview.application.department || "-"],
                                ["Faculty", applicationPreview.application.faculty || "-"],
                                ["Campus", applicationPreview.application.campus || "-"],
                                ["Passing Out Year", applicationPreview.application.passingOutYear || "-"],
                                ["CGPA/Grade", applicationPreview.application.cgpaLastDegree],
                              ].map(([k, v]) => (
                                <tr key={k} className="bg-white dark:bg-gray-900">
                                  <td className="w-[260px] px-4 py-3 font-semibold text-slate-800 bg-slate-50/60 dark:text-gray-100 dark:text-gray-100 dark:bg-gray-900">{k}</td>
                                  <td className="px-4 py-3 text-slate-900 dark:text-gray-100 dark:text-gray-100 dark:bg-gray-900">{String(v || "-")}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {applicationPreview.application.isKinship && (
                        <div className="rounded-xl border border-slate-200 overflow-hidden dark:border-gray-700 dark:bg-gray-900">
                          <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 dark:text-gray-100 dark:text-gray-100 dark:bg-gray-900">
                            Kin Details - Previous Educational Record & Program Applied For
                          </div>
                          <div className="overflow-x-auto dark:bg-gray-900">
                            <table className="min-w-full text-sm dark:text-gray-100 dark:bg-gray-900">
                              <tbody className="divide-y divide-slate-200 dark:divide-gray-700 dark:text-gray-100 dark:bg-gray-900">
                                {[
                                  ["Name", applicationPreview.application.kinshipDetails?.kinName || "-"],
                                  [
                                    "Father's Name",
                                    applicationPreview.application.kinshipDetails?.kinFatherName || "-",
                                  ],
                                  ["Campus", applicationPreview.application.kinshipDetails?.kinCampus || "-"],
                                  ["Faculty", applicationPreview.application.kinshipDetails?.kinFaculty || "-"],
                                  [
                                    "Department",
                                    applicationPreview.application.kinshipDetails?.kinDepartment || "-",
                                  ],
                                  ["Program", applicationPreview.application.kinshipDetails?.kinProgram || "-"],
                                  [
                                    "Admission Ref No",
                                    applicationPreview.application.kinshipDetails?.kinAdmissionRefNo || "-",
                                  ],
                                  [
                                    "Last Degree/Certificate",
                                    applicationPreview.application.kinshipDetails?.kinLastDegreeCertificate || "-",
                                  ],
                                  [
                                    "Passing Out Year",
                                    applicationPreview.application.kinshipDetails?.kinPassingOutYear || "-",
                                  ],
                                  ["CNIC", applicationPreview.application.kinshipDetails?.kinCnic || "-"],
                                ].map(([k, v]) => (
                                  <tr key={k} className="bg-white dark:bg-gray-900">
                                    <td className="w-[260px] px-4 py-3 font-semibold text-slate-800 bg-slate-50/60 dark:text-gray-100 dark:text-gray-100 dark:bg-gray-900">{k}</td>
                                    <td className="px-4 py-3 text-slate-900 dark:text-gray-100 dark:text-gray-100 dark:bg-gray-900">{String(v || "-")}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      <div className="rounded-xl border border-slate-200 overflow-hidden dark:border-gray-700 dark:bg-gray-900">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50 px-4 py-3 dark:bg-gray-900">
                          <div className="text-sm font-semibold text-slate-900 dark:text-gray-100 dark:text-gray-100 dark:bg-gray-900">Documents Checklist</div>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => docChecklistConfirmModal.openModal()}
                              disabled={docChecklistPendingSave}
                              className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed dark:text-white dark:bg-emerald-600 dark:hover:bg-emerald-700 dark:focus:ring-emerald-500 dark:hover:bg-emerald-700 dark:focus:ring-emerald-500"
                            >
                              Save Checklist
                            </button>
                          )}
                        </div>
                        <div className="overflow-x-auto dark:bg-gray-900">
                          <table className="min-w-[780px] w-full text-sm dark:text-gray-100 dark:bg-gray-900">
                            <thead className="bg-white border-b border-slate-200 dark:bg-gray-100 dark:border-gray-700 dark:text-gray-100 dark:bg-gray-900">
                              <tr>
                                <th className="text-left px-4 py-3 font-semibold text-slate-700 dark:text-gray-100 dark:text-gray-100 dark:bg-gray-900">Document</th>
                                <th className="text-left px-4 py-3 font-semibold text-slate-700 w-[120px] dark:text-gray-100 dark:text-gray-100 dark:bg-gray-900">View</th>
                                <th className="text-left px-4 py-3 font-semibold text-slate-700 w-[140px] dark:text-gray-100 dark:text-gray-100 dark:bg-gray-900">Admin</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white dark:bg-gray-100 dark:divide-gray-700 dark:text-gray-100 dark:bg-gray-900 hover:bg-slate-50/60 dark:hover:bg-gray-100 dark:hover:bg-gray-100">
                              {!applicationPreview.application.isKinship && (
                                <tr className="bg-slate-50/50 dark:bg-gray-100 dark:bg-gray-100 dark:text-gray-100 dark:bg-gray-900 hover:bg-slate-50/60 dark:hover:bg-gray-100 dark:hover:bg-gray-100">
                                  <td className="px-4 py-3" colSpan={1}>
                                    <div className="font-semibold text-slate-900 dark:text-gray-100 dark:text-gray-100 dark:bg-gray-900 hover:bg-slate-50/60 dark:hover:bg-gray-100 dark:hover:bg-gray-100">
                                      Admission Reference No / Application ID
                                    </div>
                                    <div className="mt-1 text-sm text-slate-800 break-all dark:text-gray-100 dark:text-gray-100 dark:bg-gray-900 hover:bg-slate-50/60 dark:hover:bg-gray-100 dark:hover:bg-gray-100">
                                      {applicationPreview.application.admissionApplicationRef?.trim() || "—"}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-gray-100 dark:text-gray-100 dark:bg-gray-900 hover:bg-slate-50/60 dark:hover:bg-gray-100 dark:hover:bg-gray-100">—</td>
                                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-gray-100 dark:text-gray-100 dark:bg-gray-900 hover:bg-slate-50/60 dark:hover:bg-gray-100 dark:hover:bg-gray-100">—</td>
                                </tr>
                              )}
                              {(() => {
                                const baseChecklist = (
                                  applicationPreview.application.isKinship
                                    ? [
                                        "Copy of Admission Letter",
                                        "Academic Certificates/Transcripts (Kin)",
                                        "Alumni Card",
                                        "FRC",
                                        "CNIC Copy (Kinship)",
                                        "CNIC Copy (Alumni)",
                                      ]
                                    : [
                                        "Copy of Admission Letter (PhD – UOL)",
                                        "Academic Transcripts and Certificates",
                                        "Alumni Card",
                                        "Curriculum Vitae (CV)",
                                        "CNIC Copy",
                                      ]
                                ).map((label) => ({
                                  key: label,
                                  label,
                                  url: "",
                                  filename: "",
                                }));

                                const uploaded = (applicationPreview.application.uploadedDocuments || []).map((d) => ({
                                  key: String(d.label || "Document"),
                                  label: String(d.label || "Document"),
                                  url: d.url,
                                  filename: d.filename,
                                }));

                                const fallbackLines = (applicationPreview.application.documentsAttached || []).map((line) => ({
                                  key: String(line || "Document"),
                                  label: String(line || "Document"),
                                  url: "",
                                  filename: "",
                                }));

                                const finalRows = [...baseChecklist];
                                const normalizedExists = (label: string) =>
                                  finalRows.some((r) => r.label.trim().toLowerCase() === label.trim().toLowerCase());

                                for (const row of [...uploaded, ...fallbackLines]) {
                                  if (!normalizedExists(row.label)) continue;
                                  // Keep only the primary checklist rows; enrich them with available file data.
                                  const idx = finalRows.findIndex(
                                    (r) => r.label.trim().toLowerCase() === row.label.trim().toLowerCase()
                                  );
                                  if (idx >= 0 && row.url) {
                                    finalRows[idx] = { ...finalRows[idx], ...row };
                                  }
                                }

                                return finalRows.map((d) => {
                                const current = docChecklistDraft[d.key] ?? null;
                                return (
                                  <tr key={d.key} className="bg-white  dark:bg-gray-900 hover:bg-slate-50/60 dark:hover:bg-gray-100 dark:hover:bg-gray-900 dark:text-gray-100 dark:bg-gray-900">
                                    <td className="px-4 py-3">
                                      <div className="font-semibold text-slate-900 dark:text-gray-100 dark:text-gray-100 dark:text-gray-100 dark:bg-gray-900">{d.label}</div>
                                      {d.filename ? <div className="mt-0.5 text-xs text-slate-600 break-all dark:text-gray-100 dark:text-gray-100 dark:text-gray-100 dark:bg-gray-900">{d.filename}</div> : null}
                                    </td>
                                    <td className="px-4 py-3 ">
                                      {d.url ? (
                                        <a
                                          href={d.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:text-gray-100 dark:bg-gray-900"
                                        >
                                          Open
                                        </a>
                                      ) : (
                                        <span className="text-xs text-slate-500 dark:text-gray-100 dark:text-gray-100 dark:text-gray-100">—</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 ">
                                      {isAdmin ? (
                                        <div className="flex items-center gap-3">
                                          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-gray-100 dark:text-gray-100 dark:text-gray-100">
                                            <input
                                              type="radio"
                                              name={`doc-${d.key}`}
                                              checked={current === "YES"}
                                              onChange={() => setDocChecklistDraft((p) => ({ ...p, [d.key]: "YES" }))}
                                            />
                                            Yes
                                          </label>
                                          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-gray-100 dark:text-gray-100 dark:text-gray-100">
                                            <input
                                              type="radio"
                                              name={`doc-${d.key}`}
                                              checked={current === "NO"}
                                              onChange={() => setDocChecklistDraft((p) => ({ ...p, [d.key]: "NO" }))}
                                            />
                                            No
                                          </label>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-slate-500 dark:text-gray-100 dark:text-gray-100 dark:text-gray-100">—</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              });
                              })()}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 overflow-hidden dark:border-gray-700 dark:bg-gray-900">
                        <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 dark:text-gray-100 dark:text-gray-100 dark:text-gray-100 dark:bg-gray-900">Application Meta</div>
                        <div className="overflow-x-auto dark:bg-gray-900">
                          <table className="min-w-full text-sm dark:text-gray-100 dark:bg-gray-900">
                            <tbody className="divide-y divide-slate-200 dark:divide-gray-700 dark:text-gray-100 dark:bg-gray-900 ">
                              {[
                                ["SAP Code", applicationPreview.application.sapCode],
                              ].map(([k, v]) => (
                                <tr key={k} className="bg-white dark:bg-gray-900">
                                  <td className="w-[260px] px-4 py-3 font-semibold text-slate-800 bg-slate-50/60 dark:text-gray-100 dark:text-gray-100 dark:text-gray-100 dark:bg-gray-900 ">{k}</td>
                                  <td className="px-4 py-3 text-slate-900 dark:text-gray-100 dark:text-gray-100 dark:bg-gray-900 hover:bg-slate-50/60 dark:hover:bg-gray-100 ">{String(v || "-")}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full border border-gray-200 rounded-lg overflow-hidden bg-white dark:border-gray-700 dark:bg-gray-900">
                    <iframe
                      title={`scholarship-application-${applicationPreview.alumniId}`}
                      src={`/api/alumni/scholarships/${applicationPreview.alumniId}?mode=letter-pdf`}
                      className="w-full h-[70vh]"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Doc Checklist Save Confirmation */}
      {docChecklistConfirmModal.isOpen && (
        <Modal
          isOpen={docChecklistConfirmModal.isOpen}
          onClose={() => {
            if (!docChecklistPendingSave) docChecklistConfirmModal.closeModal();
          }}
          className="max-w-md"
        >
          <div className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-gray-100 dark:text-gray-100">Save document checklist?</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-gray-100 dark:text-gray-100">
              This will store the admin verification (Yes/No) for the selected documents and show it in the PDF download.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => docChecklistConfirmModal.closeModal()}
                disabled={docChecklistPendingSave}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed dark:text-gray-100 dark:bg-gray-100 dark:hover:bg-gray-200 dark:focus:ring-gray-500 dark:hover:bg-gray-200 dark:focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveDocumentChecklist}
                disabled={docChecklistPendingSave}
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed dark:text-white dark:bg-emerald-600 dark:hover:bg-emerald-700 dark:focus:ring-emerald-500 dark:hover:bg-emerald-700 dark:focus:ring-emerald-500"
              >
                {docChecklistPendingSave ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};


