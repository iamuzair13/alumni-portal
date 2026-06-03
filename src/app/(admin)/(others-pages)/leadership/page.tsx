"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import SyncedTableScroll from "@/components/tables/SyncedTableScroll";
import Pagination from "@/components/tables/Pagination";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TrashBinIcon, DownloadIcon, PlusIcon, EyeIcon, CheckCircleIcon, CheckLineIcon, CloseLineIcon, PencilIcon } from "@/icons";
import { canModify } from "@/lib/alumniProfile";
import toast from "react-hot-toast";
import { AlumniExpandableDetails } from "@/components/alumni/AlumniExpandableDetails";
import { useExcelExport } from "@/lib/excel-export";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import { SendEmailButton } from "@/components/email/SendEmailButton";
import { EMAIL_ACTION_TYPE, generateAdminActionEmail } from "@/lib/emailTemplates";
import LeadershipRoleBadge from "@/components/ui/LeadershipRoleBadge";
import { getLeadershipApplications } from "@/app/queries/leadership-applications";
import { clampObtainedMark, formatObtainedMarkDisplay, normalizeObtainedMark } from "@/lib/leadershipMarks";

type RoleCriterion = {
  id: number;
  label: string;
  description: string | null;
  is_mandatory: boolean;
  has_textbox?: boolean;
  textbox_label?: string | null;
  is_textbox_required?: boolean;
  sort_order: number;
  criterion_score?: number | null;
};

function inferRoleNameFromPosition(position: string): "president" | "vice_president" | "coordinator" {
  const s = String(position || "").toLowerCase();
  if (s.includes("vice")) return "vice_president";
  if (s.includes("coordinator")) return "coordinator";
  return "president";
}

type TabKey = "chapterMembers" | "associationMembers" | "applications";

const TABS: { key: TabKey; label: string; shortLabel: string }[] = [
  { key: "chapterMembers", label: "Chapter Leadership", shortLabel: "Chapter" },
  { key: "associationMembers", label: "Association Leadership", shortLabel: "Association" },
  { key: "applications", label: "Applications", shortLabel: "Applications" },
];

type LeadershipMember = {
  id: number;
  alumniId: number;
  sapId: string;
  registrationno?: string | null;
  name: string;
  email: string;
  faculty: string | null;
  department: string | null;
  program: string | null;
  position: string;
  createdAt: string;
  chapters?: string[];
  selectedByAdmin?: string | null;
};

type LeadershipApplication = {
  id: number;
  alumniId: number;
  sapId: string;
  registrationno?: string | null;
  name: string;
  email: string;
  faculty: string | null;
  department: string | null;
  program: string | null;
  type: "chapter" | "association";
  categoryType?: string | null;
  categoryName?: string | null; // Chapter name (national/international) or Association title
  position: string;
  status?: string;
  additionalAchievements?: string | null;
  cvFileUrl?: string | null;
  additionalFile1Url?: string | null;
  additionalFile2Url?: string | null;
  createdAt: string;
  /** Sum of admin entered obtained marks (scored criteria); null if none recorded */
  obtainedMarksTotal?: number | null;
  bonusMarks?: number | null;
};

type ApplicationStatusTab = "all" | "pending" | "assessed" | "approved" | "rejected";
type ApplicationCategoryFilter = "all" | "national" | "international" | "association";
type RoleFilter = "all" | "president" | "vice_president" | "coordinator";
type SortKey = "createdAt" | "name" | "sapId" | "type" | "position" | "status" | "bonusMarks";

type ApplicationCounts = {
  all: number;
  pending: number;
  assessed: number;
  approved: number;
  rejected: number;
};

type CategoryOptionItem = {
  id: number;
  label: string;
  count: number;
};

type CategoryOptionsResponse = {
  nationalChapters: CategoryOptionItem[];
  internationalChapters: CategoryOptionItem[];
  associations: CategoryOptionItem[];
};

type ApplicationDetailsCriterion = {
  id: number;
  label: string;
  description: string | null;
  is_mandatory: boolean;
  sort_order: number;
  criterion_score?: number | null;
  alumni_confirmed: boolean;
  admin_confirmed: boolean;
  alumni_response?: string | null;
  admin_response?: string | null;
  has_textbox?: boolean;
  textbox_label?: string | null;
  alumni_text_response?: string | null;
  obtained_marks?: number | null;
};

type ApplicationDetailsItem = LeadershipApplication & {
  registrationNo?: string | null;
  rejectionReason?: string | null;
  updatedAt?: string | null;
};

type ViewDetailsItem = ApplicationDetailsItem & {
  gender?: string | null;
  passingYear?: number | null;
  phone?: string | null;
  planStrategy?: string | null;
  optionalCriteriaProficiency?: Record<string, number | null> | null;
  roleDescription?: string | null;
  officeTermGovernanceHtml?: string | null;
  strategyAssessmentMarks?: number | null;
  achievementAssessmentMarks?: number | null;
  bonusMarks?: number | null;
  assessmentRemarks?: string | null;
  cvFileUrl?: string | null;
  additionalFile1Url?: string | null;
  additionalFile2Url?: string | null;
};

async function fetchMembers(type: string, search?: string, faculty?: string, chapter?: string) {
  const params = new URLSearchParams({ type });
  if (search) params.append("search", search);
  if (faculty) params.append("faculty", faculty);
  if (chapter) params.append("chapter", chapter);

  const res = await fetch(`/api/leadership/members?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch members");
  const data = await res.json();
  return data.items as LeadershipMember[];
}

async function fetchApplications(input: {
  type?: "all" | "chapter" | "association";
  category?: ApplicationCategoryFilter;
  status?: ApplicationStatusTab;
  role?: RoleFilter;
  search?: string;
  hasAdditionalAchievements?: boolean;
  nationalChapterId?: number;
  internationalChapterId?: number;
  associationId?: number;
}) {
  const items = await getLeadershipApplications({
    type: input.type ?? "all",
    category: input.category ?? "all",
    status: input.status ?? "all",
    role: input.role ?? "all",
    search: input.search,
    hasAdditionalAchievements: input.hasAdditionalAchievements,
    nationalChapterId: input.nationalChapterId,
    internationalChapterId: input.internationalChapterId,
    associationId: input.associationId,
  });
  return items as LeadershipApplication[];
}

function identifierText(app: { sapId?: string | null; registrationno?: string | null }): string {
  const sap = String(app.sapId || "").trim();
  const reg = String(app.registrationno || "").trim();
  if (sap && reg && sap !== reg) return `${sap} / ${reg}`;
  return sap || reg || "-";
}

function proficiencyLabel(value: number | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return "";
  const m = Math.min(5, Math.max(1, Math.round(n)));
  if (m === 1) return "Beginner";
  if (m === 2) return "Basic";
  if (m === 3) return "Intermediate";
  if (m === 4) return "Advanced";
  return "Expert";
}

function starsText(value: number | null | undefined): string {
  const n = Math.min(5, Math.max(0, Math.round(Number(value) || 0)));
  if (!n) return "";
  return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
}

function documentsFromItem(item: unknown) {
  const obj = (item ?? {}) as Record<string, unknown>;
  const docs: Array<{ key: string; label: string; url: string }> = [];
  const cv = String(obj.cvFileUrl || "").trim();
  const f1 = String(obj.additionalFile1Url || "").trim();
  const f2 = String(obj.additionalFile2Url || "").trim();
  if (cv) docs.push({ key: "cv", label: "CV", url: cv });
  if (f1) docs.push({ key: "file1", label: "Additional Document 1", url: f1 });
  if (f2) docs.push({ key: "file2", label: "Additional Document 2", url: f2 });
  return docs;
}

function fileNameFromUrl(url: string): string {
  try {
    const u = String(url || "").trim();
    if (!u) return "";
    const path = u.split("?")[0].split("#")[0];
    const parts = path.split("/").filter(Boolean);
    const last = parts[parts.length - 1] || "";
    return last ? decodeURIComponent(last) : "";
  } catch {
    return "";
  }
}

function downloadDocumentUrl(url: string, filenameHint?: string) {
  const name = (filenameHint && String(filenameHint).trim()) || fileNameFromUrl(url) || "document";
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function fetchApplicationCounts(input: {
  type?: "all" | "chapter" | "association";
  category?: ApplicationCategoryFilter;
  role?: RoleFilter;
  search?: string;
  hasAdditionalAchievements?: boolean;
  nationalChapterId?: number;
  internationalChapterId?: number;
  associationId?: number;
}) {
  const params = new URLSearchParams();
  if (input.type && input.type !== "all") params.append("type", input.type);
  if (input.category && input.category !== "all") params.append("category", input.category);
  if (input.role && input.role !== "all") params.append("role", input.role);
  if (input.search) params.append("search", input.search);
  if (input.hasAdditionalAchievements) params.append("hasAdditionalAchievements", "1");
  if (input.nationalChapterId && Number.isFinite(input.nationalChapterId) && input.nationalChapterId > 0) {
    params.append("nationalChapterId", String(input.nationalChapterId));
  }
  if (input.internationalChapterId && Number.isFinite(input.internationalChapterId) && input.internationalChapterId > 0) {
    params.append("internationalChapterId", String(input.internationalChapterId));
  }
  if (input.associationId && Number.isFinite(input.associationId) && input.associationId > 0) {
    params.append("associationId", String(input.associationId));
  }

  const res = await fetch(`/api/leadership/application-counts?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch application counts");
  const data = await res.json();
  return (data.counts || { all: 0, pending: 0, assessed: 0, approved: 0, rejected: 0 }) as ApplicationCounts;
}

async function fetchCategoryOptions(input: {
  role?: RoleFilter;
  status?: ApplicationStatusTab;
  search?: string;
  hasAdditionalAchievements?: boolean;
}) {
  const params = new URLSearchParams();
  if (input.role && input.role !== "all") params.append("role", input.role);
  if (input.status && input.status !== "all") params.append("status", input.status);
  if (input.search) params.append("search", input.search);
  if (input.hasAdditionalAchievements) params.append("hasAdditionalAchievements", "1");
  const res = await fetch(`/api/leadership/pending-filter-options?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch category options");
  const data = (await res.json()) as CategoryOptionsResponse;
  return {
    nationalChapters: Array.isArray(data.nationalChapters) ? data.nationalChapters : [],
    internationalChapters: Array.isArray(data.internationalChapters) ? data.internationalChapters : [],
    associations: Array.isArray(data.associations) ? data.associations : [],
  } as CategoryOptionsResponse;
}

async function fetchApplicationDetails(input: { type: "chapter" | "association"; applicationId: number }) {
  const params = new URLSearchParams();
  params.set("type", input.type);
  params.set("applicationId", String(input.applicationId));

  const res = await fetch(`/api/leadership/application-details?${params.toString()}`, {
    headers: { accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err =
      data && typeof data === "object" && "error" in data
        ? String((data as { error?: unknown }).error || "")
        : "";
    throw new Error(err || "Failed to fetch application details");
  }
  return data as { item: ApplicationDetailsItem; criteria: ApplicationDetailsCriterion[] };
}

export default function LeadershipPage() {
  const router = useRouter();
  const pathname = usePathname() || "/leadership";
  const searchParams = useSearchParams();
  const safeSearchParams = searchParams ?? new URLSearchParams();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { isExporting, openExportModal, ExportModal } = useExcelExport();
  const [selectedTab, setSelectedTab] = useState<TabKey>("chapterMembers");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [facultyFilter, setFacultyFilter] = useState("");
  const [chapterFilter, setChapterFilter] = useState("");
  const [applicationTypeFilter, setApplicationTypeFilter] = useState<"all" | "chapter" | "association">("all");
  const [applicationCategoryFilter, setApplicationCategoryFilter] = useState<ApplicationCategoryFilter>("all");
  const [applicationCategoryItemId, setApplicationCategoryItemId] = useState<number | null>(null);
  const [applicationStatusTab, setApplicationStatusTab] = useState<ApplicationStatusTab>("all");
  const [applicationRoleFilter, setApplicationRoleFilter] = useState<RoleFilter>("all");
  const [hasAdditionalAchievementsFilter, setHasAdditionalAchievementsFilter] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [appPage, setAppPage] = useState(1);
  const pageSize = 10;
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());
  const [expandedMemberId, setExpandedMemberId] = useState<number | null>(null);
  const [adminCriteriaIds, setAdminCriteriaIds] = useState<Set<number>>(new Set());
  const [adminOptionalCriteriaProficiency, setAdminOptionalCriteriaProficiency] = useState<Record<number, number>>({});
  const [adminCriterionObtainedMarks, setAdminCriterionObtainedMarks] = useState<Record<number, number>>({});
  const [assessmentRemarks, setAssessmentRemarks] = useState<string>("");
  const [unapprovalRemarks, setUnapprovalRemarks] = useState<string>("");
  const [strategyAssessmentMarks, setStrategyAssessmentMarks] = useState<string>("");
  const [achievementAssessmentMarks, setAchievementAssessmentMarks] = useState<string>("");

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(String(searchQuery || "").trim());
      setAppPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    setAppPage(1);
  }, [
    applicationTypeFilter,
    applicationCategoryFilter,
    applicationCategoryItemId,
    applicationStatusTab,
    applicationRoleFilter,
    hasAdditionalAchievementsFilter,
  ]);

  useEffect(() => {
    const tab = safeSearchParams.get("tab");
    if (tab === "chapterMembers" || tab === "associationMembers" || tab === "applications") {
      setSelectedTab(tab);
    }
    const type = safeSearchParams.get("type");
    if (type === "all" || type === "chapter" || type === "association") {
      setApplicationTypeFilter(type);
    }
    const status = safeSearchParams.get("status");
    if (status === "all" || status === "pending" || status === "assessed" || status === "approved" || status === "rejected") {
      setApplicationStatusTab(status);
    }
    const category = safeSearchParams.get("category");
    if (category === "all" || category === "national" || category === "international" || category === "association") {
      setApplicationCategoryFilter(category);
    }
    const role = safeSearchParams.get("role");
    if (role === "all" || role === "president" || role === "vice_president" || role === "coordinator") {
      setApplicationRoleFilter(role);
    }
    const search = safeSearchParams.get("search") || "";
    setSearchQuery(search);
    setDebouncedSearch(search.trim());
    setHasAdditionalAchievementsFilter(safeSearchParams.get("hasAdditionalAchievements") === "1");
    const pageValue = Number(safeSearchParams.get("page") || "1");
    setAppPage(Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1);
    const itemValue = Number(safeSearchParams.get("categoryItemId") || "");
    setApplicationCategoryItemId(Number.isFinite(itemValue) && itemValue > 0 ? itemValue : null);
  }, [safeSearchParams]);

  useEffect(() => {
    const params = new URLSearchParams(safeSearchParams.toString());
    if (selectedTab === "chapterMembers") params.delete("tab");
    else params.set("tab", selectedTab);
    if (applicationTypeFilter === "all") params.delete("type");
    else params.set("type", applicationTypeFilter);
    if (applicationStatusTab === "all") params.delete("status");
    else params.set("status", applicationStatusTab);
    if (applicationCategoryFilter === "all") params.delete("category");
    else params.set("category", applicationCategoryFilter);
    if (!applicationCategoryItemId) params.delete("categoryItemId");
    else params.set("categoryItemId", String(applicationCategoryItemId));
    if (applicationRoleFilter === "all") params.delete("role");
    else params.set("role", applicationRoleFilter);
    if (!debouncedSearch) params.delete("search");
    else params.set("search", debouncedSearch);
    if (!hasAdditionalAchievementsFilter) params.delete("hasAdditionalAchievements");
    else params.set("hasAdditionalAchievements", "1");
    if (appPage <= 1) params.delete("page");
    else params.set("page", String(appPage));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [
    appPage,
    applicationCategoryFilter,
    applicationCategoryItemId,
    applicationRoleFilter,
    applicationStatusTab,
    applicationTypeFilter,
    debouncedSearch,
    hasAdditionalAchievementsFilter,
    pathname,
    router,
    safeSearchParams,
    selectedTab,
  ]);

  const confirmModal = useModal();
  const secondaryConfirmModal = useModal();
  const assessmentFormInitKeyRef = useRef<string | null>(null);
  const achievementsModal = useModal();
  const [selectedAchievementsApp, setSelectedAchievementsApp] = useState<LeadershipApplication | null>(null);
  const viewModal = useModal();
  const [selectedViewApp, setSelectedViewApp] = useState<{ type: "chapter" | "association"; applicationId: number } | null>(null);
  const [pendingAction, setPendingAction] = useState<
    | {
        action: "assessment" | "approve" | "unapprove" | "delete";
        applicationId: number;
        type: "chapter" | "association";
        position?: string;
        alumniId?: number;
        name?: string;
        email?: string;
        categoryName?: string | null;
        status?: string;
      }
    | null
  >(null);

  const isAdmin = session?.user ? canModify(session.user) : false;

  const downloadLeadershipPdf = async (
    endpoint: "application-pdf" | "application-scorecard",
    type: "chapter" | "association",
    applicationId: number,
    filenamePrefix: string
  ) => {
    const url = new URL(
      `/api/leadership/${endpoint}`,
      typeof window !== "undefined" ? window.location.origin : ""
    );
    url.searchParams.set("type", type);
    url.searchParams.set("applicationId", String(applicationId));

    const res = await fetch(url.toString(), {
      headers: { accept: "application/pdf" },
      credentials: "include",
    });
    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err =
        data && typeof data === "object" && "error" in data
          ? String((data as { error?: unknown }).error || "")
          : "";
      throw new Error(err || "Failed to download PDF");
    }
    if (!contentType.includes("application/pdf")) {
      throw new Error("Server did not return a PDF file. Please try again.");
    }

    const blob = await res.blob();
    if (blob.size > 8 * 1024 * 1024) {
      throw new Error(
        `Downloaded file is too large (${(blob.size / (1024 * 1024)).toFixed(1)} MB). The application PDF may contain oversized content.`
      );
    }
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `${filenamePrefix}-${type}-${applicationId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
  };

  const handleDownloadApplicationPDF = async () => {
    if (!selectedViewApp) return;
    try {
      await downloadLeadershipPdf(
        "application-pdf",
        selectedViewApp.type,
        selectedViewApp.applicationId,
        "leadership-application"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const handleDownloadScorecard = async (type: "chapter" | "association", applicationId: number) => {
    try {
      await downloadLeadershipPdf("application-scorecard", type, applicationId, "leadership-scorecard");
      toast.success("Scorecard downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to download scorecard");
    }
  };

  const handleDownloadApplicationFromRow = async (type: "chapter" | "association", applicationId: number) => {
    try {
      await downloadLeadershipPdf("application-pdf", type, applicationId, "leadership-application");
      toast.success("Application PDF downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to download application PDF");
    }
  };

  const { data: criteriaData, isLoading: criteriaLoading } = useQuery({
    queryKey: ["leadership-criteria", pendingAction?.type, pendingAction?.applicationId],
    queryFn: async () => {
      if (!pendingAction) return { items: [] as RoleCriterion[] };
      if (pendingAction.action !== "approve" && pendingAction.action !== "assessment") return { items: [] as RoleCriterion[] };
      const type = pendingAction.type;
      const role = inferRoleNameFromPosition(pendingAction.position ?? "");
      const res = await fetch(`/api/leadership/criteria?type=${encodeURIComponent(type)}&role=${encodeURIComponent(role)}`, {
        headers: { accept: "application/json" },
      });
      if (!res.ok) throw new Error("Failed to load criteria");
      return (await res.json()) as { items: RoleCriterion[] };
    },
    enabled:
      (confirmModal.isOpen || secondaryConfirmModal.isOpen) &&
      !!pendingAction &&
      (pendingAction.action === "approve" || pendingAction.action === "assessment") &&
      isAdmin,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  // For the approve modal, we also need alumni textbox responses (they come from application-details, not criteria config).
  const { data: approveDetailsData, isLoading: approveDetailsLoading } = useQuery({
    queryKey: ["leadership-approve-details", pendingAction?.type, pendingAction?.applicationId],
    queryFn: async () => {
      if (!pendingAction) throw new Error("Missing application");
      if (pendingAction.action !== "approve" && pendingAction.action !== "assessment") return { item: null, criteria: [] as ApplicationDetailsCriterion[] };
      return fetchApplicationDetails({ type: pendingAction.type, applicationId: pendingAction.applicationId });
    },
    enabled:
      (confirmModal.isOpen || secondaryConfirmModal.isOpen) &&
      !!pendingAction &&
      (pendingAction.action === "approve" || pendingAction.action === "assessment") &&
      isAdmin,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const approveTextboxByCriterionId = useMemo(() => {
    const items = Array.isArray(approveDetailsData?.criteria) ? approveDetailsData?.criteria : [];
    const m = new Map<number, { textboxLabel?: string | null; alumniText?: string | null }>();
    (items || []).forEach((c) => {
      const id = Number((c as any)?.id);
      if (!Number.isFinite(id) || id <= 0) return;
      m.set(id, {
        textboxLabel: (c as any)?.textbox_label ? String((c as any).textbox_label) : null,
        alumniText: (c as any)?.alumni_text_response ? String((c as any).alumni_text_response) : null,
      });
    });
    return m;
  }, [approveDetailsData]);

  const criteriaItems = useMemo(() => {
    const items = criteriaData?.items ?? [];
    return Array.isArray(items) ? items : [];
  }, [criteriaData]);

  const mandatoryCriteriaIds = useMemo(() => {
    return criteriaItems
      .filter((c) => c.is_mandatory)
      .map((c) => Number(c.id))
      .filter((n) => Number.isFinite(n) && n > 0);
  }, [criteriaItems]);

  useEffect(() => {
    const assessmentFlowOpen =
      (confirmModal.isOpen || secondaryConfirmModal.isOpen) &&
      pendingAction &&
      (pendingAction.action === "assessment" || pendingAction.action === "approve");

    if (!assessmentFlowOpen) {
      assessmentFormInitKeyRef.current = null;
      setAdminCriteriaIds(new Set());
      setAdminOptionalCriteriaProficiency({});
      setAdminCriterionObtainedMarks({});
      setAssessmentRemarks("");
      setUnapprovalRemarks("");
      setStrategyAssessmentMarks("");
      setAchievementAssessmentMarks("");
      return;
    }

    if (!pendingAction) return;
    const formKey = `${pendingAction.action}-${pendingAction.type}-${pendingAction.applicationId}`;
    if (assessmentFormInitKeyRef.current === formKey) return;
    if (approveDetailsLoading) return;

    const item = approveDetailsData?.item as ViewDetailsItem | undefined;
    const detailCriteria = Array.isArray(approveDetailsData?.criteria) ? approveDetailsData.criteria : [];

    const nextAdminIds = new Set<number>();
    const nextMarks: Record<number, number> = {};
    const nextProf: Record<number, number> = {};

    for (const c of detailCriteria) {
      const id = Number(c.id);
      if (!Number.isFinite(id) || id <= 0) continue;
      if (c.is_mandatory && c.admin_confirmed) nextAdminIds.add(id);
      const om = Number(c.obtained_marks);
      if (Number.isFinite(om)) nextMarks[id] = normalizeObtainedMark(om);
    }

    const profRaw = item?.optionalCriteriaProficiency;
    if (profRaw && typeof profRaw === "object") {
      for (const [k, v] of Object.entries(profRaw)) {
        const id = Number(k);
        const rating = Number(v);
        if (Number.isFinite(id) && id > 0 && Number.isFinite(rating) && rating >= 1 && rating <= 5) {
          nextProf[id] = Math.min(5, Math.max(1, Math.round(rating)));
        }
      }
    }

    setAdminCriteriaIds(nextAdminIds);
    setAdminCriterionObtainedMarks(nextMarks);
    setAdminOptionalCriteriaProficiency(nextProf);
    setAssessmentRemarks(item?.assessmentRemarks ? String(item.assessmentRemarks) : "");
    setUnapprovalRemarks("");
    const strategy = Number(item?.strategyAssessmentMarks ?? 0);
    const achievement = Number(item?.achievementAssessmentMarks ?? 0);
    setStrategyAssessmentMarks(Number.isFinite(strategy) ? String(strategy) : "0");
    setAchievementAssessmentMarks(Number.isFinite(achievement) ? String(achievement) : "0");

    assessmentFormInitKeyRef.current = formKey;
  }, [
    confirmModal.isOpen,
    secondaryConfirmModal.isOpen,
    pendingAction,
    approveDetailsLoading,
    approveDetailsData,
  ]);

  // Fetch chapter members
  const { data: chapterMembersData, isLoading: chapterMembersLoading } = useQuery({
    queryKey: ["leadership-members", "chapter", searchQuery, facultyFilter, chapterFilter],
    queryFn: () => fetchMembers("chapter", searchQuery || undefined, facultyFilter || undefined, chapterFilter || undefined),
    enabled: true,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Fetch association members
  const { data: associationMembersData, isLoading: associationMembersLoading } = useQuery({
    queryKey: ["leadership-members", "association", searchQuery, facultyFilter, chapterFilter],
    queryFn: () => fetchMembers("association", searchQuery || undefined, facultyFilter || undefined, chapterFilter || undefined),
    enabled: true,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const membersData = selectedTab === "chapterMembers" ? chapterMembersData : associationMembersData;
  const membersLoading = selectedTab === "chapterMembers" ? chapterMembersLoading : associationMembersLoading;

  // Fetch applications
  const { data: applicationsData, isLoading: applicationsLoading, refetch: refetchApplications } = useQuery({
    queryKey: [
      "leadership-applications",
      applicationTypeFilter,
      applicationCategoryFilter,
      applicationCategoryItemId,
      applicationStatusTab,
      applicationRoleFilter,
      debouncedSearch,
      hasAdditionalAchievementsFilter,
    ],
    queryFn: () =>
      fetchApplications({
        type: applicationTypeFilter,
        category: applicationCategoryFilter,
        status: applicationStatusTab,
        role: applicationRoleFilter,
        search: debouncedSearch || undefined,
        ...(hasAdditionalAchievementsFilter ? { hasAdditionalAchievements: true } : {}),
        ...(applicationCategoryFilter === "national" && applicationCategoryItemId ? { nationalChapterId: applicationCategoryItemId } : {}),
        ...(applicationCategoryFilter === "international" && applicationCategoryItemId ? { internationalChapterId: applicationCategoryItemId } : {}),
        ...(applicationCategoryFilter === "association" && applicationCategoryItemId ? { associationId: applicationCategoryItemId } : {}),
      }),
    enabled: true,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const { data: applicationCountsData } = useQuery({
    queryKey: [
      "leadership-application-counts",
      applicationTypeFilter,
      applicationCategoryFilter,
      applicationCategoryItemId,
      applicationRoleFilter,
      debouncedSearch,
      hasAdditionalAchievementsFilter,
    ],
    queryFn: () =>
      fetchApplicationCounts({
        type: applicationTypeFilter,
        category: applicationCategoryFilter,
        role: applicationRoleFilter,
        search: debouncedSearch || undefined,
        ...(hasAdditionalAchievementsFilter ? { hasAdditionalAchievements: true } : {}),
        ...(applicationCategoryFilter === "national" && applicationCategoryItemId ? { nationalChapterId: applicationCategoryItemId } : {}),
        ...(applicationCategoryFilter === "international" && applicationCategoryItemId ? { internationalChapterId: applicationCategoryItemId } : {}),
        ...(applicationCategoryFilter === "association" && applicationCategoryItemId ? { associationId: applicationCategoryItemId } : {}),
      }),
    enabled: true,
    placeholderData: (prev) => prev,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const { data: categoryOptionsData, isLoading: categoryOptionsLoading } = useQuery({
    queryKey: [
      "leadership-category-options",
      applicationRoleFilter,
      applicationStatusTab,
      debouncedSearch,
      hasAdditionalAchievementsFilter,
    ],
    queryFn: () =>
      fetchCategoryOptions({
        role: applicationRoleFilter,
        status: applicationStatusTab,
        search: debouncedSearch || undefined,
        ...(hasAdditionalAchievementsFilter ? { hasAdditionalAchievements: true } : {}),
      }),
    enabled: selectedTab === "applications" && isAdmin,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const { data: viewDetailsData, isLoading: viewDetailsLoading } = useQuery({
    queryKey: ["leadership-application-details", selectedViewApp?.type, selectedViewApp?.applicationId],
    queryFn: async () => {
      if (!selectedViewApp) throw new Error("Missing application");
      return fetchApplicationDetails(selectedViewApp);
    },
    enabled: viewModal.isOpen && !!selectedViewApp,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  
  // Refetch data when tab changes
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["leadership-members"] });
    queryClient.invalidateQueries({ queryKey: ["leadership-applications"] });
  }, [selectedTab, queryClient]);

  const handleMemberDelete = async (memberId: number, type: "chapter" | "association") => {
    if (!isAdmin) {
      toast.error("Only admins can perform this action");
      return;
    }

    setPendingAction({ action: "delete", applicationId: memberId, type });
    confirmModal.openModal();
  };

  const handleAction = async (
    action: "assessment" | "approve" | "unapprove" | "delete",
    applicationId: number,
    type: "chapter" | "association"
  ) => {
    if (!isAdmin) {
      toast.error("Only admins can perform this action");
      return;
    }

    // Use confirmation modal instead of immediate action
    const app = applicationsData?.find((x) => x.id === applicationId && x.type === type);
    setPendingAction({
      action,
      applicationId,
      type,
      position: app?.position,
      alumniId: app?.alumniId,
      name: app?.name,
      email: app?.email,
      categoryName: app?.categoryName,
      status: app?.status,
    });
    confirmModal.openModal();
    return;
  };

  const executePendingAction = async () => {
    if (!pendingAction) return;
    const { action, applicationId, type } = pendingAction;

    if (action === "assessment" && isAdmin && criteriaLoading) {
      toast.error("Please wait for criteria to load.");
      return;
    }

    if (action === "assessment" && isAdmin && !criteriaLoading && criteriaItems.length === 0) {
      toast.error("No criteria configured for this role.");
      return;
    }

    if (action === "assessment" && isAdmin && mandatoryCriteriaIds.length > 0) {
      const missing = mandatoryCriteriaIds.filter((id) => !adminCriteriaIds.has(id));
      if (missing.length > 0) {
        toast.error("Please check the mandatory critaria");
        return;
      }
    }

    if (action === "assessment" && isAdmin) {
      const strategyNum = Number(strategyAssessmentMarks);
      const achievementNum = Number(achievementAssessmentMarks);
      if (!Number.isFinite(strategyNum) || strategyNum < 0 || strategyNum > 15) {
        toast.error("Strategy & Planning marks must be between 0 and 15.");
        return;
      }
      if (!Number.isFinite(achievementNum) || achievementNum < 0 || achievementNum > 10) {
        toast.error("Additional Achievements marks must be between 0 and 10.");
        return;
      }
      if (strategyNum + achievementNum > 25) {
        toast.error("Bonus marks total cannot exceed 25.");
        return;
      }
      const optionalRatedIds = criteriaItems
        .filter((c) => !c.is_mandatory)
        .map((c) => Number(c.id))
        .filter((id) => {
          const r = Number(adminOptionalCriteriaProficiency[id] ?? 0);
          return Number.isFinite(r) && r >= 1 && r <= 5;
        });
      const adminIdsToConfirm = new Set([...adminCriteriaIds, ...optionalRatedIds]);

      for (const id of adminIdsToConfirm) {
        const c = criteriaItems.find((x) => Number(x.id) === id);
        const maxScore = Number((c as RoleCriterion | undefined)?.criterion_score);
        if (Number.isFinite(maxScore) && maxScore >= 1) {
          const om = adminCriterionObtainedMarks[id];
          if (!Number.isFinite(om)) {
            toast.error("Enter obtained marks (0 up to the criterion maximum) for each scored criterion.");
            return;
          }
          const v = normalizeObtainedMark(om);
          if (v < 0 || v > maxScore) {
            toast.error(`Obtained marks must be between 0 and ${maxScore} for each criterion.`);
            return;
          }
        }
      }
    }

    setProcessingIds((prev) => new Set(prev).add(applicationId));

    try {
      const optionalRatedForPayload = criteriaItems
        .filter((c) => !c.is_mandatory)
        .map((c) => Number(c.id))
        .filter((id) => {
          const r = Number(adminOptionalCriteriaProficiency[id] ?? 0);
          return Number.isFinite(r) && r >= 1 && r <= 5;
        });
      const adminIdsForPayload = new Set([...adminCriteriaIds, ...optionalRatedForPayload]);
      const criterionObtainedMarksPayload: Record<string, number> = {};
      for (const id of adminIdsForPayload) {
        const c = criteriaItems.find((x) => Number(x.id) === id);
        const maxScore = Number((c as RoleCriterion | undefined)?.criterion_score);
        if (!Number.isFinite(maxScore) || maxScore < 1) continue;
        const om = adminCriterionObtainedMarks[id];
        if (Number.isFinite(om)) criterionObtainedMarksPayload[String(id)] = normalizeObtainedMark(om);
      }

      const res = await fetch("/api/leadership/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          applicationId,
          type,
          ...(action === "assessment"
            ? {
                adminCriteriaIds: Array.from(adminCriteriaIds),
                optionalCriteriaProficiency: adminOptionalCriteriaProficiency,
                criterionObtainedMarks: criterionObtainedMarksPayload,
                assessmentRemarks,
                strategyAssessmentMarks: Number(strategyAssessmentMarks),
                achievementAssessmentMarks: Number(achievementAssessmentMarks),
              }
            : {}),
          ...(action === "unapprove" ? { unapprovalRemarks } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err =
          data && typeof data === "object" && "error" in data
            ? String((data as { error?: unknown }).error || "")
            : "";
        throw new Error(err || "Failed to perform action");
      }

      const successText =
        action === "assessment"
          ? "assessed"
          : action === "approve"
            ? "approved"
            : action === "unapprove"
              ? "marked as not approved"
              : action === "delete"
                ? "deleted"
                : `${action}d`;
      toast.success(`Application ${successText} successfully`);

      queryClient.invalidateQueries({ queryKey: ["leadership-applications"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["leadership-members"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["leadership-counts"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["leadership-application-counts"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["leadership-application-details"], exact: false });
      await refetchApplications();
      confirmModal.closeModal();
      secondaryConfirmModal.closeModal();
      setPendingAction(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      toast.error(msg);
      secondaryConfirmModal.closeModal();
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(applicationId);
        return next;
      });
    }
  };

  const handleExport = () => {
    const exportColumnKeys: string[] = [
      "Leadership Type",
      "Leadership Status",
      "Position",
      "Additional Achievements",
      "Alumni Confirmed Criteria",
      "Admin Confirmed Criteria",
      "SAP ID",
      "Registration No",
      "Full Name",
      "Personal Email",
      "University Email",
      "Contact No",
      "Faculty",
      "Department",
      "Degree Title",
      "All Chapters",
      "Association Title",
      "Created At",
    ];

    const columns = exportColumnKeys.map((key) => ({
      key,
      label: key,
      defaultSelected: true,
    }));

    let exportType = "all";
    let status = "all";
    let filename = "leadership_export";
    let sheetName = "Leadership";

    if (selectedTab === "chapterMembers") {
      exportType = "chapter";
      status = "approved";
      filename = "chapter_leadership_members";
      sheetName = "Chapter Leadership";
    } else if (selectedTab === "associationMembers") {
      exportType = "association";
      status = "approved";
      filename = "association_leadership_members";
      sheetName = "Association Leadership";
    } else if (selectedTab === "applications") {
      exportType = applicationTypeFilter;
      status = applicationStatusTab;
      filename = "leadership_applications";
      sheetName = "Applications";
    }

    const formatChapters = (item: Record<string, unknown>) => {
      const chapters: string[] = [];
      const chapter1 = String(item.chapter1_national || item.chapter1_international || "");
      const chapter2 = String(item.chapter2_national || item.chapter2_international || "");
      const chapter3 = String(item.chapter3_national || item.chapter3_international || "");
      if (chapter1) chapters.push(chapter1);
      if (chapter2) chapters.push(chapter2);
      if (chapter3) chapters.push(chapter3);
      return chapters.filter((c) => c).join(", ") || "";
    };

    const fetchAndTransformData = async (): Promise<Record<string, unknown>[]> => {
      const url = new URL(
        "/api/leadership/export",
        typeof window !== "undefined" ? window.location.origin : ""
      );
      url.searchParams.set("type", exportType);
      url.searchParams.set("status", status);
      if (selectedTab === "applications") {
        if (applicationCategoryFilter && applicationCategoryFilter !== "all") url.searchParams.set("category", applicationCategoryFilter);
        if (applicationCategoryFilter === "national" && applicationCategoryItemId) url.searchParams.set("nationalChapterId", String(applicationCategoryItemId));
        if (applicationCategoryFilter === "international" && applicationCategoryItemId) url.searchParams.set("internationalChapterId", String(applicationCategoryItemId));
        if (applicationCategoryFilter === "association" && applicationCategoryItemId) url.searchParams.set("associationId", String(applicationCategoryItemId));
        if (applicationRoleFilter && applicationRoleFilter !== "all") url.searchParams.set("role", applicationRoleFilter);
        if (debouncedSearch) url.searchParams.set("search", debouncedSearch);
        if (hasAdditionalAchievementsFilter) url.searchParams.set("hasAdditionalAchievements", "1");
      } else {
        if (searchQuery) url.searchParams.set("search", searchQuery);
        if (facultyFilter) url.searchParams.set("faculty", facultyFilter);
        if (chapterFilter) url.searchParams.set("chapter", chapterFilter);
      }

      const res = await fetch(url.toString(), {
        headers: { accept: "application/json" },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch export data: ${res.status}`);
      }

      const data = await res.json();
      const allItems = data.items || [];
      if (!allItems || allItems.length === 0) {
        throw new Error("No data found to export with the applied filters.");
      }

      return allItems.map((item: Record<string, unknown>) => ({
        "Leadership Type": item.leadership_type || "",
        "Leadership Status": item.status || "",
        "Position": item.position || "",
        "Bonus Marks": `${formatObtainedMarkDisplay(Number(item.bonus_marks || 0))} / 25`,
        "Additional Achievements": item.additional_achievements || "",
        "Strategy & Planning": item.plan_strategy || "",
        "Strategy Assessment Marks": item.strategy_assessment_marks ?? 0,
        "Achievements Assessment Marks": item.achievement_assessment_marks ?? 0,
        "Alumni Confirmed Criteria": item.alumni_confirmed_criteria || "",
        "Admin Confirmed Criteria": item.admin_confirmed_criteria || "",
        "SAP ID": item.sapid || "",
        "Registration No": item.registrationno || "",
        "Full Name": item.alumniname || "",
        "Personal Email": item.personalemail || "",
        "University Email": item.universityemail || "",
        "Contact No": item.contactno || "",
        "Faculty": item.facultyname || "",
        "Department": item.departmentname || "",
        "Degree Title": item.degreetitle || "",
        "All Chapters": formatChapters(item),
        "Association Title": item.association_title || "",
        "Created At": item.created_at || "",
      }));
    };

    openExportModal({
      data: fetchAndTransformData,
      columns,
      filename,
      sheetName,
    });
  };

  const filteredMembers = useMemo(() => {
    return membersData || [];
  }, [membersData]);

  const filteredApplications = useMemo(() => {
    const items = applicationsData || [];
    const sorted = [...items].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const va = ((): string => {
        if (sortKey === "createdAt") return a.createdAt || "";
        if (sortKey === "name") return a.name || "";
        if (sortKey === "sapId") return a.sapId || "";
        if (sortKey === "type") return a.type || "";
        if (sortKey === "position") return a.position || "";
        if (sortKey === "status") return String(a.status || "");
        if (sortKey === "bonusMarks") return String(Number(a.bonusMarks ?? 0));
        return "";
      })();
      const vb = ((): string => {
        if (sortKey === "createdAt") return b.createdAt || "";
        if (sortKey === "name") return b.name || "";
        if (sortKey === "sapId") return b.sapId || "";
        if (sortKey === "type") return b.type || "";
        if (sortKey === "position") return b.position || "";
        if (sortKey === "status") return String(b.status || "");
        if (sortKey === "bonusMarks") return String(Number(b.bonusMarks ?? 0));
        return "";
      })();
      return va.localeCompare(vb) * dir;
    });

    return sorted;
  }, [applicationsData, sortDir, sortKey]);

  const applicationsTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredApplications.length / pageSize)),
    [filteredApplications.length, pageSize]
  );
  const appPageSafe = Math.min(appPage, applicationsTotalPages);

  const pagedApplications = useMemo(() => {
    const start = (appPageSafe - 1) * pageSize;
    return filteredApplications.slice(start, start + pageSize);
  }, [filteredApplications, appPageSafe, pageSize]);

  const uniqueFaculties = useMemo(() => {
    const allData = selectedTab === "applications" ? applicationsData : membersData;
    if (!allData) return [];
    const faculties = new Set<string>();
    allData.forEach(item => {
      if (item.faculty) faculties.add(item.faculty);
    });
    return Array.from(faculties).sort();
  }, [selectedTab, membersData, applicationsData]);

  const chapterMembersCount = chapterMembersData?.length || 0;
  const associationMembersCount = associationMembersData?.length || 0;
  const applicationsCount = Number(applicationCountsData?.all ?? applicationsData?.length ?? 0);
  const handleClearFilters = () => {
    setApplicationStatusTab("all");
    setApplicationTypeFilter("all");
    setApplicationCategoryFilter("all");
    setApplicationCategoryItemId(null);
    setApplicationRoleFilter("all");
    setHasAdditionalAchievementsFilter(false);
    setSearchQuery("");
    setDebouncedSearch("");
    setAppPage(1);
    queryClient.invalidateQueries({ queryKey: ["leadership-applications"] });
    queryClient.invalidateQueries({ queryKey: ["leadership-application-counts"] });
  };

  return (
    <div className="min-h-screen w-full bg-slate-200 dark:bg-gray-900/50 overflow-x-hidden dark:text-gray-300 dark:bg-gray-900">
      {/* add appropria title and description here */}
      <div className="w-full max-w-[1300px] border-b border-gray-200 dark:border-gray-700 bg-white rounded-t-lg mt-4 mx-auto flex flex-col justify-start dark:text-gray-300 dark:bg-gray-900">
        <div className="px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-300 dark:bg-gray-900">Leadership Applications</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-300 dark:bg-gray-900">Manage leadership applications for chapters and associations.</p>
        </div>
      </div>
      <div className="w-full max-w-[1300px] bg-white rounded-b-lg  mx-auto flex flex-col justify-start dark:text-gray-300 dark:bg-gray-900">
        {/* Tabs Section */}
        <div className="w-full px-4 py-4 ">
          <div className=" mx-auto dark:text-gray-300 dark:bg-gray-900">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {TABS.map((tab) => {
                const isSelected = selectedTab === tab.key;
                const statCount = tab.key === "chapterMembers" ? chapterMembersCount : tab.key === "associationMembers" ? associationMembersCount : applicationsCount;
                const colorClass = tab.key === "chapterMembers" ? "blue" : tab.key === "associationMembers" ? "violet" : "amber";

                return (
                  <button
                    key={tab.key}
                    type="button"
                    className={`relative rounded-lg p-3 text-center transition-all dark:text-gray-300 dark:bg-gray-900 ${
                      isSelected 
                        ? `bg-${colorClass}-50 border-2 border-${colorClass}-500 dark:bg-${colorClass}-900/20 shadow-sm` 
                        : 'bg-white border border-gray-200 dark:bg-gray-800/50 dark:border-gray-700 hover:border-gray-300'
                    }`}
                    onClick={() => {
                      setSelectedTab(tab.key);
                      setSearchQuery("");
                      setDebouncedSearch("");
                      setFacultyFilter("");
                      setChapterFilter("");
                      setApplicationTypeFilter("all");
                      setApplicationCategoryFilter("all");
                      setApplicationCategoryItemId(null);
                      setApplicationStatusTab("all");
                      setApplicationRoleFilter("all");
                      setHasAdditionalAchievementsFilter(false);
                      setAppPage(1);
                    }}
                  >
                    <div className={`text-xs font-bold uppercase tracking-wide mb-1 truncate dark:text-gray-300 dark:bg-gray-900 ${
                      isSelected ? `text-${colorClass}-600 dark:text-${colorClass}-400` : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="sm:hidden">{tab.shortLabel}</span>
                    </div>
                    <div className={`text-2xl font-bold dark:text-gray-300 dark:bg-gray-900 ${
                      isSelected ? `text-${colorClass}-700 dark:text-${colorClass}-300` : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {statCount}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="w-full px-4 py-3 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 shadow-sm backdrop-blur-sm">
  <div className="mx-auto max-w-7xl">
    <div className="bg-gray-50/80 dark:bg-gray-900/50 rounded-xl border border-gray-200/60 dark:border-gray-800/60 p-4 space-y-4 backdrop-blur-sm">
      
      {/* Primary Controls Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search applications..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 shadow-sm"
          />
        </div>
        
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          {selectedTab === "applications" && (
            <select
              value={applicationTypeFilter}
              onChange={(e) => setApplicationTypeFilter(e.target.value as "all" | "chapter" | "association")}
              className="px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 shadow-sm cursor-pointer hover:border-gray-400 dark:hover:border-gray-600"
            >
              <option value="all">All Types</option>
              <option value="chapter">Chapter</option>
              <option value="association">Association</option>
            </select>
          )}
          
          {uniqueFaculties.length > 0 && (
            <select
              value={facultyFilter}
              onChange={(e) => setFacultyFilter(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 shadow-sm cursor-pointer hover:border-gray-400 dark:hover:border-gray-600"
            >
              <option value="">All Faculties</option>
              {uniqueFaculties.map(faculty => (
                <option key={faculty} value={faculty}>{faculty}</option>
              ))}
            </select>
          )}
          
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
          >
            <DownloadIcon className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
            <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export'}</span>
          </button>
        </div>
      </div>

      {selectedTab === "applications" && isAdmin && (
  <div className="space-y-5 pt-4 border-t border-gray-200/50 dark:border-gray-800/50 animate-in fade-in slide-in-from-bottom-2 duration-500">
    
    {/* ─── Primary Command Bar ─── */}
    <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
      
      {/* Status Dropdown */}
      <div className="relative group min-w-[220px] max-w-xs">
        {(() => {
          const counts = applicationCountsData || { all: 0, pending: 0, assessed: 0, approved: 0, rejected: 0 };
          return (
        <select
          value={applicationStatusTab}
          onChange={(e) => {
            setApplicationStatusTab(e.target.value as ApplicationStatusTab);
            setAppPage(1);
          }}
          className="appearance-none w-full pl-3.5 pr-9 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm text-sm text-gray-700 dark:text-gray-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400/50 transition-all duration-200 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 cursor-pointer"
        >
          <option value="all">{`All (${counts.all})`}</option>
          <option value="pending">{`Pending (${counts.pending})`}</option>
          <option value="assessed">{`Assessed (${counts.assessed})`}</option>
          <option value="approved">{`Approved (${counts.approved})`}</option>
          <option value="rejected">{`Not Approved (${counts.rejected})`}</option>
        </select>
          );
        })()}
        <svg
          className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none transition-transform duration-200 group-hover:translate-y-[-45%]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* ─── Secondary Filter Arsenal ─── */}
      <div className="flex flex-wrap items-center gap-3 w-full">
        {/* Role Filter */}
        <div className="relative group flex-1 min-w-[160px] max-w-xs">
          <select
            value={applicationRoleFilter}
            onChange={(e) => {
              setApplicationRoleFilter(e.target.value as RoleFilter);
              setAppPage(1);
            }}
            className="appearance-none w-full pl-3.5 pr-9 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm text-sm text-gray-700 dark:text-gray-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400/50 transition-all duration-200 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 cursor-pointer"
          >
            <option value="all">All Roles</option>
            <option value="president">President</option>
            <option value="vice_president">Vice President</option>
            <option value="coordinator">Coordinator</option>
          </select>
          <svg
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none transition-transform duration-200 group-hover:translate-y-[-45%]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Achievement Toggle */}
        <label className="flex items-center gap-2.5 flex-1 min-w-[180px] max-w-xs rounded-xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm px-4 py-2.5 cursor-pointer hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-md transition-all duration-200 shadow-sm group">
          <div className="relative flex items-center">
            <input
              type="checkbox"
              checked={hasAdditionalAchievementsFilter}
              onChange={(e) => {
                setHasAdditionalAchievementsFilter(e.target.checked);
                setAppPage(1);
              }}
              className="peer sr-only"
            />
            <div className="h-[18px] w-[18px] rounded-[5px] border-2 border-gray-300 dark:border-gray-600 peer-checked:bg-blue-600 peer-checked:border-blue-600 peer-checked:dark:bg-blue-500 peer-checked:dark:border-blue-500 transition-all duration-200 flex items-center justify-center shadow-sm">
              <svg className="h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 select-none group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
            With Achievements
          </span>
        </label>

        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-[340px] pl-3 border-l border-gray-200 dark:border-gray-800 animate-in fade-in slide-in-from-left-2 duration-300">
          <div className="relative group flex-1 min-w-[180px] max-w-xs">
            <select
              value={applicationCategoryFilter}
              onChange={(e) => {
                const next = e.target.value as ApplicationCategoryFilter;
                setApplicationCategoryFilter(next);
                setApplicationCategoryItemId(null);
                if (next === "association") setApplicationTypeFilter("association");
                if (next === "national" || next === "international") setApplicationTypeFilter("chapter");
                setAppPage(1);
              }}
              className="appearance-none w-full pl-3.5 pr-9 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm text-sm text-gray-700 dark:text-gray-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400/50 transition-all duration-200 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="national">National Chapters</option>
              <option value="international">International Chapters</option>
              <option value="association">Associations</option>
            </select>
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none transition-transform duration-200 group-hover:translate-y-[-45%]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          {applicationCategoryFilter !== "all" && (
            <div className="relative group flex-1 min-w-[220px] max-w-sm">
              <select
                value={applicationCategoryItemId ? String(applicationCategoryItemId) : ""}
                onChange={(e) => {
                  const next = e.target.value ? Number(e.target.value) : null;
                  setApplicationCategoryItemId(next && Number.isFinite(next) && next > 0 ? next : null);
                  setAppPage(1);
                }}
                className="appearance-none w-full pl-3.5 pr-9 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm text-sm text-gray-700 dark:text-gray-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400/50 transition-all duration-200 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 cursor-pointer"
              >
                <option value="">
                  {applicationCategoryFilter === "national"
                    ? "Select National Chapter"
                    : applicationCategoryFilter === "international"
                      ? "Select International Chapter"
                      : "Select Association"}
                  {categoryOptionsLoading ? "..." : ""}
                </option>
                {(applicationCategoryFilter === "national"
                  ? categoryOptionsData?.nationalChapters || []
                  : applicationCategoryFilter === "international"
                    ? categoryOptionsData?.internationalChapters || []
                    : categoryOptionsData?.associations || []
                ).map((item) => (
                  <option key={`${applicationCategoryFilter}-${item.id}`} value={item.id}>
                    {item.label} ({item.count})
                  </option>
                ))}
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none transition-transform duration-200 group-hover:translate-y-[-45%]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          )}
          <button
            type="button"
            onClick={handleClearFilters}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900 transition-all duration-200 shadow-sm"
          >
            Clear Filters
          </button>
        </div>
      </div>

    </div>
  </div>
)}
    </div>
  </div>
</div>

        <ExportModal />

        {confirmModal.isOpen && pendingAction && (
          <Modal
            isOpen={confirmModal.isOpen}
            onClose={() => {
              const id = pendingAction.applicationId;
              if (!processingIds.has(id)) {
                confirmModal.closeModal();
                setPendingAction(null);
              }
            }}
            showCloseButton={true}
            className="max-w-[1400px] w-[95vw] max-h-[90vh] overflow-y-auto p-6 lg:p-8 dark:text-gray-300 dark:bg-gray-900"
          >
            <div className="flex max-h-[80vh] flex-col ">
              <div className="p-6 overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-300 dark:bg-gray-900">
                {pendingAction.action === "assessment"
                  ? "Assess Leadership Application"
                  : pendingAction.action === "approve"
                    ? "Approve Leadership Application"
                    : pendingAction.action === "unapprove"
                      ? "Unapprove Leadership Application"
                      : "Delete Leadership Member"}
              </h3>

              <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 dark:text-gray-300 dark:bg-gray-900">
                {pendingAction.action === "delete" ? (
                  <>Are you sure you want to delete this record? This action cannot be undone.</>
                ) : (
                  <>
                    Are you sure you want to{" "}
                    {pendingAction.action === "assessment"
                      ? "assess"
                      : pendingAction.action === "approve"
                        ? "approve"
                        : "mark as not approved"}{" "}
                    the{" "}
                    <strong>{pendingAction.type === "chapter" ? "chapter" : "association"}</strong> leadership application
                    {pendingAction.name ? (
                      <>
                        {" "}for <strong>{pendingAction.name}</strong>?
                      </>
                    ) : (
                      "?"
                    )}
                  </>
                )}
              </p>

              {pendingAction.action === "assessment" && isAdmin && (
                <div className="mt-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-4 dark:text-gray-300 dark:bg-gray-900">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-300 dark:bg-gray-900">Role Criteria Confirmation &amp; Marks</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Confirm mandatory criteria, select proficiency for optional criteria, and assign obtained marks (0 up to each criterion&apos;s maximum).
                      </div>
                    </div>
                    {criteriaLoading || approveDetailsLoading ? (
                      <div className="text-xs text-gray-500 dark:text-gray-300 dark:bg-gray-900">Loading...</div>
                    ) : null}
                  </div>

                  {criteriaItems.length === 0 && !criteriaLoading ? (
                    <div className="mt-3 text-sm text-gray-600 dark:text-gray-400 dark:text-gray-300 dark:bg-gray-900">No criteria configured for this role.</div>
                  ) : (
                    <div className="mt-3 overflow-x-auto [transform:rotateX(180deg)] dark:text-gray-300 dark:bg-gray-900">
                      {(() => {
                        const items = criteriaItems || [];
                        const profMap =
                          approveDetailsData?.item && typeof (approveDetailsData.item as unknown as ViewDetailsItem).optionalCriteriaProficiency === "object"
                            ? (((approveDetailsData.item as unknown as ViewDetailsItem).optionalCriteriaProficiency ??
                                null) as Record<string, number | null> | null)
                            : null;

                        const optionalRatedIds = items
                          .filter((c) => !c.is_mandatory)
                          .map((c) => Number(c.id))
                          .filter((id) => {
                            const r = Number(adminOptionalCriteriaProficiency[id] ?? 0);
                            return Number.isFinite(r) && r >= 1 && r <= 5;
                          });
                        const adminIdsToConfirm = new Set<number>([...adminCriteriaIds, ...optionalRatedIds]);

                        const totalMarks = items.reduce((sum, c) => {
                          const id = Number(c.id);
                          if (!adminIdsToConfirm.has(id)) return sum;
                          const m = Number((c as RoleCriterion).criterion_score);
                          return Number.isFinite(m) && m > 0 ? sum + m : sum;
                        }, 0);
                        const totalObtained = items.reduce((sum, c) => {
                          const id = Number(c.id);
                          if (!adminIdsToConfirm.has(id)) return sum;
                          const m = Number((c as RoleCriterion).criterion_score);
                          if (!Number.isFinite(m) || m <= 0) return sum;
                          const om = Number(adminCriterionObtainedMarks[id]);
                          return Number.isFinite(om) ? sum + om : sum;
                        }, 0);

                        return (
                          <div className="[transform:rotateX(180deg)]">
                          <table className="min-w-[920px] w-[1150px]  text-sm border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900/10">
                            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/40 z-10 dark:text-gray-300 dark:bg-gray-900">
                              <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-300 dark:bg-gray-900">Requirement</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-300 dark:bg-gray-900 w-[110px]">Marks</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-300 dark:bg-gray-900 w-[160px]">Obtained Marks</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-200 w-[210px] dark:text-gray-300 dark:bg-gray-900">Alumni</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 dark:text-gray-300 dark:bg-gray-900">
                              {items.map((c) => {
                                const id = Number(c.id);
                                const isMandatory = Boolean(c.is_mandatory);
                                const maxScore = Number((c as RoleCriterion).criterion_score);
                                const hasScored = Number.isFinite(maxScore) && maxScore > 0;

                                const checked = isMandatory ? adminCriteriaIds.has(id) : false;
                                const currentRating = !isMandatory ? Number(adminOptionalCriteriaProficiency[id] ?? 0) : 0;
                                const isSelected = isMandatory ? checked : Number.isFinite(currentRating) && currentRating >= 1 && currentRating <= 5;

                                const tb = approveTextboxByCriterionId.get(id) ?? null;
                                const tbLabel = String(tb?.textboxLabel || c.textbox_label || "Response");
                                const tbValue =
                                  tb?.alumniText && String(tb.alumniText).trim()
                                    ? String(tb.alumniText)
                                    : "No response provided";

                                const alumniRespRaw =
                                  approveDetailsData?.criteria?.find((x) => Number((x as any).id) === id) ?? null;
                                const alumniYes = (() => {
                                  if (!alumniRespRaw) return false;
                                  const resp = String((alumniRespRaw as any).alumni_response ?? "").toUpperCase();
                                  const normalized = resp === "YES" || resp === "NO" ? resp : (alumniRespRaw as any).alumni_confirmed ? "YES" : "NO";
                                  return normalized === "YES";
                                })();

                                const alumniRating = !isMandatory && profMap ? Number(profMap[String(id)] ?? 0) : 0;
                                const alumniStars = !isMandatory && Number.isFinite(alumniRating) && alumniRating >= 1 ? starsText(alumniRating) : "";
                                const alumniLabel = !isMandatory && Number.isFinite(alumniRating) && alumniRating >= 1 ? proficiencyLabel(alumniRating) : "";

                                return (
                                  <tr key={id} className="bg-white dark:bg-transparent dark:text-gray-300 dark:bg-gray-900">
                                    <td className="px-4 py-3 align-top">
                                      <div className="flex items-start gap-2 dark:text-gray-300 dark:bg-gray-900">
                                        {isMandatory ? (
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={(e) => {
                                              const on = e.target.checked;
                                              setAdminCriteriaIds((prev) => {
                                                const next = new Set(prev);
                                                if (on) next.add(id);
                                                else next.delete(id);
                                                return next;
                                              });
                                              setAdminCriterionObtainedMarks((prev) => {
                                                const next = { ...prev };
                                                if (!hasScored) return next;
                                                if (on) next[id] = maxScore;
                                                else delete next[id];
                                                return next;
                                              });
                                            }}
                                            className="mt-1 h-4 w-4 text-blue-600 dark:text-gray-300 dark:bg-gray-900"
                                            aria-label="Confirm mandatory criterion"
                                          />
                                        ) : null}

                                        <div className="min-w-0">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <div className="font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-300 dark:bg-gray-900 break-words">{c.label}</div>
                                            
                                          </div>
                                          {c.description ? <div className="mt-0.5 text-xs text-gray-600 dark:text-gray-400 dark:text-gray-300 dark:bg-gray-900 break-words">{c.description}</div> : null}
                                          {c.has_textbox ? (
                                            <div className="mt-2">
                                              <div className="text-[12px] font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-300 dark:bg-gray-900">{tbLabel}:</div>
                                              <div className="mt-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                                                {tbValue}
                                              </div>
                                            </div>
                                          ) : null}

                                          {!isMandatory ? (
                                            <div className="mt-3">
                                              <div className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 mb-2 dark:text-gray-300 dark:bg-gray-900">
                                                Admin proficiency (1-5)
                                              </div>
                                              <div className="flex flex-wrap items-center gap-2">
                                                {[1, 2, 3, 4, 5].map((star) => {
                                                  const active = star <= currentRating;
                                                  return (
                                                    <button
                                                      key={star}
                                                      type="button"
                                                      onClick={() => {
                                                        setAdminOptionalCriteriaProficiency((prev) => ({ ...prev, [id]: star }));
                                                        if (hasScored) {
                                                          const suggested = (star / 5) * maxScore;
                                                          setAdminCriterionObtainedMarks((prev) => ({ ...prev, [id]: clampObtainedMark(suggested, maxScore) }));
                                                        }
                                                      }}
                                                      className={`select-none rounded-md border px-2 py-1 text-xs font-semibold dark:text-gray-300 dark:bg-gray-900 ${
                                                        active
                                                          ? "border-amber-300 bg-amber-50 text-amber-800 dark:text-gray-300 dark:bg-gray-900"
                                                          : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:text-gray-300 dark:bg-gray-900"
                                                      }`}
                                                      aria-label={`Set rating to ${star}`}
                                                    >
                                                      {active ? "★" : "☆"} {star}
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                              <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-300 dark:bg-gray-900">
                                                {currentRating ? `Selected: ${currentRating}` : "No rating"}
                                              </div>
                                            </div>
                                          ) : null}
                                        </div>
                                      </div>
                                    </td>

                                    <td className="px-4 py-3 align-top font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-300 dark:bg-gray-900">
                                      {hasScored ? formatObtainedMarkDisplay(maxScore) : "N/A"}
                                    </td>

                                    <td className="px-4 py-3 align-top">
                                      {!isSelected || !hasScored ? (
                                        <div className="font-semibold text-gray-500 dark:text-gray-300 dark:bg-gray-900">—</div>
                                      ) : (
                                        <input
                                          type="number"
                                          min={0}
                                          max={maxScore}
                                          step="any"
                                          value={adminCriterionObtainedMarks[id] ?? ""}
                                          onChange={(ev) => {
                                            const v = ev.target.value;
                                            if (v === "") {
                                              setAdminCriterionObtainedMarks((p) => {
                                                const n = { ...p };
                                                delete n[id];
                                                return n;
                                              });
                                              return;
                                            }
                                            const num = Number(v);
                                            if (!Number.isFinite(num)) return;
                                            setAdminCriterionObtainedMarks((p) => ({ ...p, [id]: clampObtainedMark(num, maxScore) }));
                                          }}
                                          className="w-full max-w-[160px] rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm dark:text-gray-300 dark:bg-gray-900"
                                        />
                                      )}
                                    </td>

                                    <td className="px-4 py-3 align-top">
                                      {alumniYes ? (
                                        <div className="text-gray-900 dark:text-gray-100 dark:text-gray-300 dark:bg-gray-900">
                                          <div className="font-semibold">✔ YES</div>
                                          {!isMandatory ? (
                                            <div className="mt-1 text-xs text-gray-700 dark:text-gray-300 dark:text-gray-300 dark:bg-gray-900">
                                              {alumniStars ? (
                                                <span>
                                                  <span className="font-semibold text-amber-700">{alumniStars}</span>
                                                  {alumniLabel ? ` (${alumniLabel} - ${alumniRating})` : ""}
                                                </span>
                                              ) : (
                                                <span className="text-gray-500 dark:text-gray-300 dark:bg-gray-900">No rating</span>
                                              )}
                                            </div>
                                          ) : null}
                                        </div>
                                      ) : (
                                        <div className="text-gray-900 dark:text-gray-100 dark:text-gray-300 dark:bg-gray-900">
                                          <div className="font-semibold text-gray-500 dark:text-gray-300 dark:bg-gray-900">NO</div>
                                          {!isMandatory ? (
                                            <div className="mt-1 text-xs text-gray-700 dark:text-gray-300 dark:text-gray-300 dark:bg-gray-900">
                                              {alumniStars ? (
                                                <span>
                                                  <span className="font-semibold text-amber-700">{alumniStars}</span>
                                                  {alumniLabel ? ` (${alumniLabel} - ${alumniRating})` : ""}
                                                </span>
                                              ) : (
                                                <span className="text-gray-500 dark:text-gray-300 dark:bg-gray-900">No rating</span>
                                              )}
                                            </div>
                                          ) : null}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}

                              <tr className="bg-gray-50 dark:bg-gray-900/30 border-t border-gray-200 dark:border-gray-700">
                                <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-300 dark:bg-gray-900">Result</td>
                                <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-300 dark:bg-gray-900">
                                  {totalMarks > 0 ? formatObtainedMarkDisplay(totalMarks) : "-"}
                                </td>
                                <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-300 dark:bg-gray-900">
                                  {totalMarks > 0 ? formatObtainedMarkDisplay(totalObtained) : "-"}
                                </td>
                                <td className="px-4 py-3 dark:text-gray-300 dark:bg-gray-900" />
                              </tr>
                            </tbody>
                          </table>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {pendingAction.action === "assessment" && isAdmin && (
                <div className="mt-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-4 dark:text-gray-300 dark:bg-gray-900">
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Bonus Assessment</div>
                  <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/20 p-3">
                      <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">Strategy &amp; Planning</div>
                      <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                        Please share an outline of your plan or strategy for fulfilling the responsibilities assigned for this role.
                      </div>
                      <div className="mt-2 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-2 py-2 text-xs whitespace-pre-wrap break-words">
                        {String((approveDetailsData?.item as ViewDetailsItem | undefined)?.planStrategy || "").trim() || "No response provided"}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={15}
                          step="any"
                          value={strategyAssessmentMarks}
                          onChange={(e) => setStrategyAssessmentMarks(e.target.value)}
                          className="w-28 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
                        />
                        <span className="text-xs text-gray-600 dark:text-gray-400">/ 15</span>
                      </div>
                    </div>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/20 p-3">
                      <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">Additional Achievements</div>
                      <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                        Describe any additional achievements, leadership experience, awards, or qualifications relevant to this role.
                      </div>
                      <div className="mt-2 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-2 py-2 text-xs whitespace-pre-wrap break-words">
                        {String((approveDetailsData?.item as ViewDetailsItem | undefined)?.additionalAchievements || "").trim() || "No response provided"}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={10}
                          step="any"
                          value={achievementAssessmentMarks}
                          onChange={(e) => setAchievementAssessmentMarks(e.target.value)}
                          className="w-28 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
                        />
                        <span className="text-xs text-gray-600 dark:text-gray-400">/ 10</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Bonus Marks Total: {formatObtainedMarkDisplay(Number(strategyAssessmentMarks || 0) + Number(achievementAssessmentMarks || 0))} / 25
                  </div>

                  <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Assessment Remarks (optional)</div>
                  <div className="mt-2">
                    <textarea
                      value={assessmentRemarks}
                      onChange={(e) => setAssessmentRemarks(e.target.value)}
                      placeholder="Add any remarks for the assessment (optional)."
                      className="w-full min-h-[110px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-300 dark:bg-gray-900"
                    />
                  </div>
                </div>
              )}

              {pendingAction.action === "unapprove" && (
                <div className="mt-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-4 dark:text-gray-300 dark:bg-gray-900">
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-300 dark:bg-gray-900">Unapproval Remarks (optional)</div>
                  <div className="mt-2">
                    <textarea
                      value={unapprovalRemarks}
                      onChange={(e) => setUnapprovalRemarks(e.target.value)}
                      placeholder="Add any remarks for unapproval (optional)."
                      className="w-full min-h-[110px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-300 dark:bg-gray-900"
                    />
                  </div>
                </div>
              )}

              {pendingAction.action === "approve" && (
                <div className="mt-5 dark:text-gray-300 dark:bg-gray-900">
                  {(() => {
                    const alumniId = pendingAction.alumniId;
                    const recipientEmail = pendingAction.email;
                    if (!alumniId || !recipientEmail) {
                      return (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:text-gray-300 dark:bg-gray-900">
                          No recipient email found for this alumni. You can still confirm the action, but you cannot send an email.
                        </div>
                      );
                    }

                    const actionType =
                      pendingAction.type === "chapter" ? EMAIL_ACTION_TYPE.CHAPTER_LEADERSHIP_APPROVED : EMAIL_ACTION_TYPE.ASSOCIATION_LEADERSHIP_APPROVED;

                    const tpl = generateAdminActionEmail({
                      actionType,
                      alumniName: pendingAction.name || "Alumni",
                    });

                    const roleName = String(pendingAction.position || "{ROLE}");
                    const orgName = (() => {
                      const details = approveDetailsData?.item as ViewDetailsItem | undefined;
                      const cat = details?.categoryName || pendingAction.categoryName || "";
                      if (pendingAction.type === "chapter") {
                        return cat ? cat : "your selected chapter";
                      }
                      return cat ? cat : "the Alumni Association";
                    })();

                    const emailBody = tpl.html
                      .replaceAll("{ROLE}", roleName)
                      .replaceAll("{ORG}", orgName);

                    return (
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-4">
                        <div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Preview Email</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">Preview and edit before sending</div>
                        </div>
                        <SendEmailButton
                          alumniId={alumniId}
                          recipientEmail={recipientEmail}
                          actionType={actionType}
                          initialSubject={tpl.subject}
                          initialBody={emailBody}
                          disabled={processingIds.has(pendingAction.applicationId)}
                        />
                      </div>
                    );
                  })()}
                </div>
              )}

              </div>

              <div className="px-6 pb-6 pt-4 flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                {pendingAction.action === "assessment" &&
                  (() => {
                    const s = String(pendingAction.status || approveDetailsData?.item?.status || "").toLowerCase();
                    if (s !== "assessed" && s !== "approved" && s !== "rejected") return null;
                    return (
                      <button
                        type="button"
                        onClick={() =>
                          void handleDownloadScorecard(pendingAction.type, pendingAction.applicationId)
                        }
                        disabled={processingIds.has(pendingAction.applicationId)}
                        className="mr-auto inline-flex items-center gap-2 rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30 disabled:opacity-50"
                      >
                        <DownloadIcon className="h-4 w-4" />
                        Download Scorecard
                      </button>
                    );
                  })()}
                <button
                  type="button"
                  onClick={() => {
                    if (!processingIds.has(pendingAction.applicationId)) {
                      confirmModal.closeModal();
                      setPendingAction(null);
                    }
                  }}
                  disabled={processingIds.has(pendingAction.applicationId)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (processingIds.has(pendingAction.applicationId)) return;
                    confirmModal.closeModal();
                    secondaryConfirmModal.openModal();
                  }}
                  disabled={
                    processingIds.has(pendingAction.applicationId) ||
                    (pendingAction.action === "assessment" && (criteriaLoading || approveDetailsLoading))
                  }
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  Confirm
                </button>
              </div>
            </div>
          </Modal>
        )}

        {secondaryConfirmModal.isOpen && pendingAction && (
          <Modal
            isOpen={secondaryConfirmModal.isOpen}
            onClose={() => {
              secondaryConfirmModal.closeModal();
              if (pendingAction.action === "assessment" || pendingAction.action === "approve") {
                confirmModal.openModal();
              }
            }}
            showCloseButton={true}
            className="max-w-xl !z-[100001]"
          >
            <div className="p-6">
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Confirm {pendingAction.action === "assessment" ? "Assessment" : pendingAction.action === "approve" ? "Approval" : pendingAction.action === "unapprove" ? "Unapproval" : "Deletion"}
              </div>
              <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                This will update the application status accordingly. You can close this dialog to review your input.
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    secondaryConfirmModal.closeModal();
                    if (pendingAction.action === "assessment" || pendingAction.action === "approve") {
                      confirmModal.openModal();
                    }
                  }}
                  disabled={processingIds.has(pendingAction.applicationId)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (processingIds.has(pendingAction.applicationId)) return;
                    void executePendingAction();
                  }}
                  disabled={
                    processingIds.has(pendingAction.applicationId) ||
                    (pendingAction.action === "assessment" && (criteriaLoading || approveDetailsLoading))
                  }
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {processingIds.has(pendingAction.applicationId) ? "Submitting…" : "Proceed"}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Table Section */}
        <div className="w-full px-4 pb-8">
          <div className="mx-auto">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-800/50">
              <SyncedTableScroll minWidth={800} maxHeight={750}>
                {selectedTab === "applications" ? (
                  applicationsLoading ? (
                    <ApplicationsTable
                      applications={pagedApplications}
                      loading={applicationsLoading}
                      isAdmin={isAdmin}
                      onAction={handleAction}
                      onViewAdditionalAchievements={(app: LeadershipApplication) => {
                        setSelectedAchievementsApp(app);
                        achievementsModal.openModal();
                      }}
                      onViewApplication={(app: LeadershipApplication) => {
                        setSelectedViewApp({ type: app.type, applicationId: app.id });
                        viewModal.openModal();
                      }}
                      onDownloadScorecard={(type, applicationId) => void handleDownloadScorecard(type, applicationId)}
                      onDownloadApplication={(type, applicationId) => void handleDownloadApplicationFromRow(type, applicationId)}
                      processingIds={processingIds}
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={(k) => {
                        if (k === sortKey) {
                          setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        } else {
                          setSortKey(k);
                          setSortDir("asc");
                        }
                      }}
                    />
                  ) : filteredApplications.length === 0 ? (
                    <div className="w-full p-8">
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-6 py-8 text-center text-sm text-gray-700">
                        No leadership applications submitted yet.
                      </div>
                    </div>
                  ) : (
                    <ApplicationsTable
                      applications={pagedApplications}
                      loading={applicationsLoading}
                      isAdmin={isAdmin}
                      onAction={handleAction}
                      onViewAdditionalAchievements={(app) => {
                        setSelectedAchievementsApp(app);
                        achievementsModal.openModal();
                      }}
                      onViewApplication={(app) => {
                        setSelectedViewApp({ type: app.type, applicationId: app.id });
                        viewModal.openModal();
                      }}
                      onDownloadScorecard={(type, applicationId) => void handleDownloadScorecard(type, applicationId)}
                      onDownloadApplication={(type, applicationId) => void handleDownloadApplicationFromRow(type, applicationId)}
                      processingIds={processingIds}
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={(k) => {
                        if (k === sortKey) {
                          setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        } else {
                          setSortKey(k);
                          setSortDir("asc");
                        }
                      }}
                    />
                  )
                ) : (
                  <MembersTable
                    members={filteredMembers}
                    loading={membersLoading}
                    type={selectedTab === "chapterMembers" ? "chapter" : "association"}
                    isAdmin={isAdmin}
                    expandedMemberId={expandedMemberId}
                    onExpand={setExpandedMemberId}
                    onDelete={handleMemberDelete}
                    onViewApplication={(app) => {
                      setSelectedViewApp({ type: app.type, applicationId: app.id });
                      viewModal.openModal();
                    }}
                    processingIds={processingIds}
                  />
                )}
              </SyncedTableScroll>
              {selectedTab === "applications" && !applicationsLoading && filteredApplications.length > 0 && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-4 py-4 bg-gray-50/80 dark:bg-gray-900/40 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {(() => {
                      const start = (appPageSafe - 1) * pageSize + 1;
                      const end = Math.min(appPageSafe * pageSize, filteredApplications.length);
                      return `Showing ${start.toLocaleString()}–${end.toLocaleString()} of ${filteredApplications.length.toLocaleString()}`;
                    })()}
                  </span>
                  {applicationsTotalPages > 1 && (
                    <Pagination
                      currentPage={appPageSafe}
                      totalPages={applicationsTotalPages}
                      onPageChange={(p) => {
                        const next = Math.max(1, Math.min(p, applicationsTotalPages));
                        setAppPage(next);
                        const scrollEl = document.querySelector(".max-w-7xl .custom-scrollbar");
                        if (scrollEl) scrollEl.scrollTop = 0;
                      }}
                    />
                  )}
                </div>
              )}
            </div>

            {achievementsModal.isOpen && selectedAchievementsApp && (
              <Modal
                isOpen={achievementsModal.isOpen}
                onClose={() => {
                  achievementsModal.closeModal();
                  setSelectedAchievementsApp(null);
                }}
                showCloseButton={true}
                className="max-w-2xl"
              >
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Additional Achievements</h3>
                  <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {selectedAchievementsApp.name || "Alumni"} ({identifierText(selectedAchievementsApp)})
                  </div>

                  <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-4">
                    <div className="whitespace-pre-wrap break-words text-sm text-gray-800 dark:text-gray-200 leading-relaxed max-h-[50vh] overflow-auto">
                      {String(selectedAchievementsApp.additionalAchievements || "").trim() || "No additional achievements provided."}
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        achievementsModal.closeModal();
                        setSelectedAchievementsApp(null);
                      }}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </Modal>
            )}

            {viewModal.isOpen && selectedViewApp && (
              <Modal
                isOpen={viewModal.isOpen}
                onClose={() => {
                  viewModal.closeModal();
                  setSelectedViewApp(null);
                }}
                showCloseButton={true}
                className="max-w-5xl"
              >
                <div className="p-6">
                  {viewDetailsLoading ? (
                    <div className="text-sm text-gray-600 dark:text-gray-400">Loading...</div>
                  ) : !viewDetailsData?.item ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      Unable to load application details.
                    </div>
                  ) : (
                    (() => {
                      const item = viewDetailsData.item as ViewDetailsItem;
                      const statusText = String(item.status || "pending");
                      const statusLower = statusText.toLowerCase();
                      const statusBadge =
                        statusLower === "approved"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : statusLower === "assessed"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                          : statusLower === "rejected"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-amber-50 text-amber-700 border-amber-200";

                      const docs = documentsFromItem(item);

                      const profMap =
                        item?.optionalCriteriaProficiency && typeof item.optionalCriteriaProficiency === "object"
                          ? item.optionalCriteriaProficiency
                          : null;

                      return (
                        <div className="space-y-4">
                          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Leadership Application Details</div>
                              <div className="mt-1 h-px bg-gray-200 dark:bg-gray-800" />
                              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <div className="truncate">
                                  <span className="font-medium">Application Type:</span>{" "}
                                  {item.type === "chapter" ? "Chapter" : "Association"}
                                </div>
                                <div className="truncate">
                                  <span className="font-medium">Chapter/Association Name:</span>{" "}
                                  {String(item.categoryName || "-")}
                                </div>
                                <div className="truncate"><span className="font-medium">Role Applied For:</span> {item.position || "-"}</div>
                                <div className="truncate"><span className="font-medium">Application Date:</span> {item.createdAt ? String(item.createdAt) : "-"}</div>
                                <div>
                                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadge}`}>
                                    {statusLower === "rejected"
                                      ? "Not Approved"
                                      : statusLower === "assessed"
                                        ? "Assessed"
                                        : statusLower === "approved"
                                          ? "Approved"
                                          : "Pending"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap mr-12 items-center justify-start lg:justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleDownloadApplicationPDF}
                                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                              >
                                <DownloadIcon className="h-4 w-4" />
                                Download PDF
                              </button>
                              {isAdmin &&
                                (statusLower === "assessed" ||
                                  statusLower === "approved" ||
                                  statusLower === "rejected") && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleDownloadScorecard(
                                        selectedViewApp.type,
                                        selectedViewApp.applicationId
                                      )
                                    }
                                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-600 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:bg-gray-900 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                                  >
                                    <DownloadIcon className="h-4 w-4" />
                                    Download Scorecard
                                  </button>
                                )}
                            </div>
                          </div>

                          <div className="max-h-[75vh] overflow-y-auto pr-1 space-y-4">
                            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/20 p-6 shadow-sm">
                              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Personal Information</div>
                              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm text-gray-700 dark:text-gray-300">
                                <div><span className="font-medium">Full Name:</span> {item.name || "-"}</div>
                                <div><span className="font-medium">SAP ID:</span> {item.sapId || "-"}</div>
                                <div><span className="font-medium">Gender:</span> {item.gender || "-"}</div>
                                <div><span className="font-medium">Faculty:</span> {item.faculty || "-"}</div>
                                <div><span className="font-medium">Department:</span> {item.department || "-"}</div>
                                <div><span className="font-medium">Program:</span> {item.program || "-"}</div>
                                <div><span className="font-medium">Passing Year:</span> {item.passingYear ?? "-"}</div>
                                <div><span className="font-medium">Email:</span> {item.email || "-"}</div>
                                <div><span className="font-medium">Phone:</span> {item.phone || "-"}</div>
                              </div>
                            </div>

                            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/20 p-6 shadow-sm">
                              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Role Description</div>
                              <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-3 text-sm text-gray-800 dark:text-gray-200 max-h-[250px] overflow-y-auto whitespace-pre-wrap">
                                {String(item.roleDescription || "").trim() || "-"}
                              </div>
                            </div>

                          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/20 p-6 shadow-sm">
                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Criteria</div>
                            <div className="mt-3 overflow-x-auto [transform:rotateX(180deg)]">
                              <div className="[transform:rotateX(180deg)]">
                              <table className="min-w-[820px] w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/40 z-10">
                                  <tr className="border-b border-gray-200 dark:border-gray-700">
                                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Requirement</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-200 w-[100px]">Marks</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-200 w-[140px]">Obtained Marks</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-200 w-[160px]">Alumni</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                  {(() => {
                                    const items = Array.isArray(viewDetailsData.criteria) ? viewDetailsData.criteria : [];
                                    const showObtained = statusLower === "approved" || statusLower === "assessed";
                                    const totalMarks = items.reduce((sum, c) => {
                                      const m = Number((c as ApplicationDetailsCriterion).criterion_score);
                                      return Number.isFinite(m) && m > 0 ? sum + m : sum;
                                    }, 0);
                                    const totalObtained = showObtained
                                      ? items.reduce((sum, c) => {
                                          const om = Number((c as ApplicationDetailsCriterion).obtained_marks);
                                          return Number.isFinite(om) && om >= 0 ? sum + om : sum;
                                        }, 0)
                                      : 0;

                                    return (
                                      <>
                                        {items.map((c: ApplicationDetailsCriterion) => {
                                    const isMandatory = Boolean(c.is_mandatory);
                                    const alumniRespRaw = String(c.alumni_response ?? "").toUpperCase();
                                    const alumniResp = alumniRespRaw === "YES" || alumniRespRaw === "NO" ? alumniRespRaw : c.alumni_confirmed ? "YES" : "NO";
                                    const alumniYes = alumniResp === "YES";
                                    const rating = profMap && typeof profMap === "object" ? Number(profMap[String(c.id)] ?? 0) : 0;
                                    const stars = !isMandatory && alumniYes && rating ? starsText(rating) : "";
                                    const label = !isMandatory && alumniYes && rating ? proficiencyLabel(rating) : "";

                                    const marks = Number.isFinite(Number((c as ApplicationDetailsCriterion).criterion_score))
                                      ? Number((c as ApplicationDetailsCriterion).criterion_score)
                                      : null;
                                    const storedObtained = Number.isFinite(Number((c as ApplicationDetailsCriterion).obtained_marks))
                                      ? Number((c as ApplicationDetailsCriterion).obtained_marks)
                                      : null;

                                    return (
                                      <tr key={c.id} className="bg-white dark:bg-transparent">
                                        <td className="px-4 py-3">
                                          <div className="flex items-start gap-2">
                                           
                                            <div className="min-w-0">
                                              <div className="font-semibold text-gray-900 dark:text-gray-100 break-words">{c.label}</div>
                                              {c.description ? <div className="mt-0.5 text-xs text-gray-600 dark:text-gray-400 break-words">{c.description}</div> : null}
                                              {c.has_textbox ? (
                                                <div className="mt-2">
                                                  <div className="text-[12px] font-semibold text-gray-700 dark:text-gray-200">
                                                    {String(c.textbox_label || "Response")}:{" "}
                                                  </div>
                                                  <div className="mt-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                                                    {c.alumni_text_response && String(c.alumni_text_response).trim()
                                                      ? String(c.alumni_text_response)
                                                      : "No response provided"}
                                                  </div>
                                                </div>
                                              ) : null}
                                            </div>
                                          </div>
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="font-semibold text-gray-900 dark:text-gray-100">{marks === null ? "N/A" : String(marks)}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                          {!showObtained ? (
                                            <div className="font-semibold text-gray-500">—</div>
                                          ) : marks === null ? (
                                            <div className="font-semibold text-gray-500">N/A</div>
                                          ) : storedObtained === null ? (
                                            <div className="font-semibold text-gray-500">—</div>
                                          ) : (
                                            <div className="font-semibold text-gray-900 dark:text-gray-100">
                                              {formatObtainedMarkDisplay(storedObtained)}
                                            </div>
                                          )}
                                        </td>
                                        <td className="px-4 py-3">
                                          {alumniYes ? (
                                            <div className="text-gray-900 dark:text-gray-100">
                                              <div className="font-semibold">✔ YES</div>
                                              {!isMandatory ? (
                                                <div className="mt-1 text-xs text-gray-700 dark:text-gray-300">
                                                  {stars ? (
                                                    <span>
                                                      <span className="font-semibold text-amber-700">{stars}</span>
                                                      {label ? ` (${label})` : ""}
                                                    </span>
                                                  ) : (
                                                    <span className="text-gray-500">No rating</span>
                                                  )}
                                                </div>
                                              ) : null}
                                            </div>
                                          ) : (
                                            <div className="font-semibold text-gray-500">NO</div>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                        })}

                                        <tr className="bg-gray-50 dark:bg-gray-900/30 border-t border-gray-200 dark:border-gray-700">
                                          <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">Result</td>
                                          <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                                            {totalMarks > 0 ? formatObtainedMarkDisplay(totalMarks) : "-"}
                                          </td>
                                          <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                                            {showObtained && totalMarks > 0 ? formatObtainedMarkDisplay(totalObtained) : "—"}
                                          </td>
                                          <td className="px-4 py-3" />
                                        </tr>
                                      </>
                                    );
                                  })()}
                                </tbody>
                              </table>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/20 p-6 shadow-sm">
                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Describe any additional achievements, leadership experience, awards, or qualifications relevant to this role.
                            </div>
                            <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-3 text-sm text-gray-800 dark:text-gray-200 max-h-[250px] overflow-y-auto whitespace-pre-wrap">
                              {String(item.additionalAchievements || "").trim() || "No additional achievements provided."}
                            </div>
                          </div>

                          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/20 p-6 shadow-sm">
                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Please share an outline of your plan or strategy for fulfilling the responsibilities assigned for this role</div>
                            <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-3 text-sm text-gray-800 dark:text-gray-200 max-h-[250px] overflow-y-auto whitespace-pre-wrap">
                              {String(item.planStrategy || "").trim() || "No plan/strategy provided."}
                            </div>
                          </div>

                          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/20 p-6 shadow-sm">
                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Uploaded Documents</div>
                            <div className="mt-3 space-y-2">
                              {docs.length === 0 ? (
                                <div className="text-sm text-gray-600 dark:text-gray-400">-</div>
                              ) : (
                                docs.map((d) => {
                                  const name = fileNameFromUrl(d.url) || "-";
                                  return (
                                    <div key={d.key} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
                                      <div className="min-w-0">
                                        <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">{d.label}</div>
                                        <div className="text-xs text-gray-600 dark:text-gray-400 break-all">{name}</div>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                                        <a
                                          href={d.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
                                        >
                                          View
                                        </a>
                                        <button
                                          type="button"
                                          onClick={() => downloadDocumentUrl(d.url, name !== "-" ? name : undefined)}
                                          className="inline-flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
                                        >
                                          Download
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              </Modal>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

const APPLICATION_ACTIONS_MENU_WIDTH = 256;
const APPLICATION_ACTIONS_MENU_MAX_HEIGHT = 360;

function ApplicationActionsDropdown({
  app,
  isOpen,
  onToggle,
  onClose,
  processingIds,
  canAssess,
  canFinalize,
  canDownloadScorecard,
  status,
  onViewApplication,
  onAction,
  onDownloadScorecard,
  onDownloadApplication,
}: {
  app: LeadershipApplication;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  processingIds: Set<number>;
  canAssess: boolean;
  canFinalize: boolean;
  canDownloadScorecard: boolean;
  status: string;
  onViewApplication: (app: LeadershipApplication) => void;
  onAction: (action: "assessment" | "approve" | "unapprove" | "delete", id: number, type: "chapter" | "association") => Promise<void>;
  onDownloadScorecard: (type: "chapter" | "association", applicationId: number) => void;
  onDownloadApplication: (type: "chapter" | "association", applicationId: number) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; maxHeight: number } | null>(null);

  const updateMenuPosition = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 8;
    const top = rect.bottom + gap;
    let left = rect.right - APPLICATION_ACTIONS_MENU_WIDTH;
    if (left < 8) left = 8;
    if (left + APPLICATION_ACTIONS_MENU_WIDTH > window.innerWidth - 8) {
      left = window.innerWidth - APPLICATION_ACTIONS_MENU_WIDTH - 8;
    }
    const spaceBelow = window.innerHeight - top - 8;
    const maxHeight = Math.max(160, Math.min(APPLICATION_ACTIONS_MENU_MAX_HEIGHT, spaceBelow));
    setMenuPosition({ top, left, maxHeight });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();
    const handleReposition = () => updateMenuPosition();
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isOpen, updateMenuPosition]);

  const isProcessing = processingIds.has(app.id);

  const menu =
    isOpen && menuPosition && typeof document !== "undefined"
      ? createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" aria-hidden="true" onClick={onClose} />
            <div
              role="menu"
              className="fixed z-[9999] w-64 origin-top-right overflow-y-auto rounded-xl border border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-900 shadow-2xl shadow-black/10 dark:shadow-black/30 ring-1 ring-black/5 dark:ring-white/5 py-1.5"
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
                maxHeight: menuPosition.maxHeight,
              }}
            >
              <div className="px-3 pt-2 pb-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Application</p>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onViewApplication(app);
                  onClose();
                }}
                className="group w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
              >
                <EyeIcon className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                View Details
              </button>

              {canAssess && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    void onAction("assessment", app.id, app.type);
                    onClose();
                  }}
                  className="group w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  {status === "assessed" ? (
                    <PencilIcon className="h-4 w-4 shrink-0 text-blue-500/80 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                  ) : (
                    <CheckCircleIcon className="h-4 w-4 shrink-0 text-blue-500/80 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                  )}
                  <span className="group-hover:text-blue-700 dark:group-hover:text-blue-300">
                    {status === "assessed" ? "Re-assess" : "Assessment"}
                  </span>
                </button>
              )}

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onDownloadApplication(app.type, app.id);
                  onClose();
                }}
                className="group w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <DownloadIcon className="h-4 w-4 text-blue-600" />
                Download Application
              </button>

              {canDownloadScorecard && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onDownloadScorecard(app.type, app.id);
                    onClose();
                  }}
                  className="group w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                >
                  <DownloadIcon className="h-4 w-4 text-emerald-600" />
                  Download Scorecard
                </button>
              )}

              {canFinalize && (
                <>
                  <div className="my-1.5 mx-3 border-t border-gray-100 dark:border-gray-800" />
                  <div className="px-3 py-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Decision</p>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      void onAction("approve", app.id, app.type);
                      onClose();
                    }}
                    className="group w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                  >
                    <CheckLineIcon className="h-4 w-4 shrink-0 text-emerald-500/80 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" />
                    <span className="group-hover:text-emerald-700 dark:group-hover:text-emerald-300">Approve</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      void onAction("unapprove", app.id, app.type);
                      onClose();
                    }}
                    className="group w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                  >
                    <CloseLineIcon className="h-4 w-4 shrink-0 text-amber-500/80 group-hover:text-amber-600 dark:group-hover:text-amber-400" />
                    <span className="group-hover:text-amber-700 dark:group-hover:text-amber-300">Not Approve</span>
                  </button>
                </>
              )}

              <div className="my-1.5 mx-3 border-t border-gray-100 dark:border-gray-800" />
              <div className="px-3 py-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Danger</p>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  void onAction("delete", app.id, app.type);
                  onClose();
                }}
                className="group w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <TrashBinIcon className="h-4 w-4" />
                Delete
              </button>
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <div className="relative ml-auto shrink-0">
      <button
        ref={buttonRef}
        type="button"
        disabled={isProcessing}
        onClick={() => {
          if (!isOpen) updateMenuPosition();
          onToggle();
        }}
        className={`dropdown-toggle inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 min-w-[140px] ${
          isProcessing
            ? "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-400 cursor-not-allowed"
            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 hover:shadow-md"
        }`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {isProcessing ? (
          <>
            <svg className="h-4 w-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Processing…</span>
          </>
        ) : (
          <>
            <span>Actions</span>
            <svg
              className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>
      {menu}
    </div>
  );
}

function ApplicationsTable({
  applications,
  loading,
  isAdmin,
  onAction,
  onViewAdditionalAchievements,
  onViewApplication,
  onDownloadScorecard,
  onDownloadApplication,
  processingIds,
  sortKey,
  sortDir,
  onSort,
 }: {
  applications: LeadershipApplication[];
  loading: boolean;
  isAdmin: boolean;
  onAction: (action: "assessment" | "approve" | "unapprove" | "delete", id: number, type: "chapter" | "association") => Promise<void>;
  onViewAdditionalAchievements: (app: LeadershipApplication) => void;
  onViewApplication: (app: LeadershipApplication) => void;
  onDownloadScorecard: (type: "chapter" | "association", applicationId: number) => void;
  onDownloadApplication: (type: "chapter" | "association", applicationId: number) => void;
  processingIds: Set<number>;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
 }) {
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  const sortIndicator = (k: SortKey) => {
    if (sortKey !== k) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  if (loading) {
    return (
      <Table className="min-w-full w-full table-fixed">
        <TableHeader className="bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10">
          <TableRow className="border-b border-gray-200 dark:border-gray-700">
            <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 w-[170px]">SAP / Reg No</TableCell>
            <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 w-[360px]">Name</TableCell>
            <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 hidden lg:table-cell w-[220px]">Email</TableCell>
            <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 w-[110px]">Obtained marks</TableCell>
            <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 w-[240px]">Type</TableCell>
            <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 w-[220px]">Role</TableCell>
            <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 w-[120px]">Bonus Marks</TableCell>
            <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 w-[160px]">Status</TableCell>
            {isAdmin && (
              <TableCell className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 sticky right-0 bg-gray-50 dark:bg-gray-900/50 w-[180px]">
                <span className="hidden sm:inline">Actions</span>
                <span className="sm:hidden">Action</span>
              </TableCell>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={`skeleton-${i}`}>
              <TableCell className="px-4 py-4 w-[170px]"><div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
              <TableCell className="px-4 py-4 w-[360px]"><div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
              <TableCell className="px-4 py-4 hidden lg:table-cell w-[220px]"><div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
              <TableCell className="px-4 py-4 w-[110px]"><div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
              <TableCell className="px-4 py-4 w-[240px]"><div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
              <TableCell className="px-4 py-4 w-[220px]"><div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
              <TableCell className="px-4 py-4 w-[120px]"><div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
              <TableCell className="px-4 py-4 w-[160px]"><div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
              {isAdmin && (
                <TableCell className="px-4 py-4 sticky right-0 bg-white dark:bg-gray-800 w-[120px]"><div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded ml-auto" /></TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="py-16 text-center text-gray-500">
        <p className="text-base font-semibold">No applications found</p>
        <p className="text-sm mt-1">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <Table className="min-w-full w-full table-fixed">
      <TableHeader className="bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10">
        <TableRow className="border-b border-gray-200 dark:border-gray-700">
          <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 w-[170px]">
            <button type="button" onClick={() => onSort("sapId")} className="hover:underline">
              SAP / Reg No{sortIndicator("sapId")}
            </button>
          </TableCell>
          <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 w-[360px]">
            <button type="button" onClick={() => onSort("name")} className="hover:underline">
              Name{sortIndicator("name")}
            </button>
          </TableCell>
          <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 hidden lg:table-cell w-[220px]">Email</TableCell>
          <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 w-[110px]">Obtained marks</TableCell>
          <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 w-[120px]">
            <button type="button" onClick={() => onSort("bonusMarks")} className="hover:underline">
              Bonus Marks{sortIndicator("bonusMarks")}
            </button>
          </TableCell>
          <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 w-[240px]">
            <button type="button" onClick={() => onSort("type")} className="hover:underline">
              Type{sortIndicator("type")}
            </button>
          </TableCell>
          <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 w-[220px]">
            <button type="button" onClick={() => onSort("position")} className="hover:underline">
              Role{sortIndicator("position")}
            </button>
          </TableCell>
          
          <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 w-[160px]">
            <button type="button" onClick={() => onSort("status")} className="hover:underline">
              Status{sortIndicator("status")}
            </button>
          </TableCell>
          {isAdmin && (
            <TableCell className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 sticky right-0 bg-gray-50 dark:bg-gray-900/50 w-[180px]">
              <span className="hidden sm:inline">Actions</span>
              <span className="sm:hidden">Action</span>
            </TableCell>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {applications.map((app) => (
          <TableRow key={`${app.type}-${app.id}`} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
            <TableCell className="px-4 py-3 text-sm w-[170px]">
              <span className="font-mono text-xs truncate block min-w-0 max-w-full">{identifierText(app)}</span>
            </TableCell>
            <TableCell className="px-4 py-3 text-sm w-[360px]">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="font-medium truncate block min-w-0 max-w-full">{app.name || "-"}</span>
                  {String(app.additionalAchievements || "").trim() ? (
                    <button
                      type="button"
                      onClick={() => onViewAdditionalAchievements(app)}
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-100"
                      title="View additional achievements"
                    >
                      <EyeIcon className="h-3.5 w-3.5" />
                      Has Additional Achievements
                    </button>
                  ) : null}
                </div>
                {(() => {
                  const docs = documentsFromItem(app);
                  if (!docs.length) return null;
                  return (
                    <div className="mt-1 space-y-0.5">
                      {docs.map((d) => {
                        const name = fileNameFromUrl(d.url) || d.label;
                        return (
                          <div key={d.key} className="flex items-center gap-2 min-w-0">
                            <span className="shrink-0 text-[11px] text-gray-600 dark:text-gray-400 font-semibold">{d.label}:</span>
                            <span className="min-w-0 truncate text-[11px] text-gray-600 dark:text-gray-400 block">{name}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                <a
                  href={app.email ? `mailto:${app.email}` : "#"}
                  className="lg:hidden block text-xs text-blue-600 truncate min-w-0 max-w-full"
                >
                  {app.email || ""}
                </a>
                {app.obtainedMarksTotal != null && Number.isFinite(app.obtainedMarksTotal) ? (
                  <div className="lg:hidden mt-1 text-xs text-gray-700 dark:text-gray-300">
                    <span className="font-semibold text-gray-600 dark:text-gray-400">Obtained marks:</span>{" "}
                    {formatObtainedMarkDisplay(app.obtainedMarksTotal)}
                  </div>
                ) : null}
              </div>
            </TableCell>
            <TableCell className="px-4 py-3 text-sm hidden lg:table-cell w-[220px]">
              <a
                href={app.email ? `mailto:${app.email}` : "#"}
                className="text-blue-600 hover:underline truncate block min-w-0 max-w-full"
              >
                {app.email || "-"}
              </a>
            </TableCell>
            <TableCell className="px-4 py-3 text-sm w-[110px] tabular-nums">
              {app.obtainedMarksTotal != null && Number.isFinite(app.obtainedMarksTotal) ? (
                <span className="font-medium text-gray-900 dark:text-gray-100">{formatObtainedMarkDisplay(app.obtainedMarksTotal)}</span>
              ) : (
                <span className="text-gray-400 dark:text-gray-500">—</span>
              )}
            </TableCell>
            <TableCell className="px-4 py-3 text-sm w-[120px]">
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatObtainedMarkDisplay(Number(app.bonusMarks ?? 0))}
              </span>
            </TableCell>
            <TableCell className="px-4 py-3 text-sm w-[240px]">
              <div className="truncate min-w-0">
                {app.type === "chapter" ? "Chapter" : "Association"} - {String(app.categoryName || "-")}
              </div>
            </TableCell>
            <TableCell className="px-4 py-3 text-sm w-[220px]">
              <LeadershipRoleBadge type={app.type} position={app.position} />
            </TableCell>
           
            <TableCell className="px-4 py-3 text-sm w-[160px]">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  String(app.status || "").toLowerCase() === "approved"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : String(app.status || "").toLowerCase() === "assessed"
                      ? "bg-blue-50 text-blue-800 border-blue-200"
                      : String(app.status || "").toLowerCase() === "rejected"
                        ? "bg-rose-50 text-rose-800 border-rose-200"
                        : "bg-amber-50 text-amber-800 border-amber-200"
                }`}
              >
                {(() => {
                  const s = String(app.status || "pending").toLowerCase();
                  if (s === "rejected") return "Not Approved";
                  if (s === "assessed") return "Assessed";
                  if (s === "approved") return "Approved";
                  return "Pending";
                })()}
              </span>
            </TableCell>
            {isAdmin && (
              <TableCell className="px-4 py-3 text-right sticky right-0 z-20 bg-white dark:bg-gray-800 w-[180px] overflow-visible">
                {(() => {
                  const status = String(app.status || "pending").toLowerCase();
                  const rowKey = `${app.type}-${app.id}`;
                  const canAssess = status !== "approved" && status !== "rejected";
                  const canFinalize = status === "assessed";
                  const canDownloadScorecard =
                    status === "assessed" || status === "approved" || status === "rejected";
                  return (
                    <ApplicationActionsDropdown
                      app={app}
                      isOpen={openActionMenuId === rowKey}
                      onToggle={() => setOpenActionMenuId(openActionMenuId === rowKey ? null : rowKey)}
                      onClose={() => setOpenActionMenuId(null)}
                      processingIds={processingIds}
                      canAssess={canAssess}
                      canFinalize={canFinalize}
                      canDownloadScorecard={canDownloadScorecard}
                      status={status}
                      onViewApplication={onViewApplication}
                      onAction={onAction}
                      onDownloadScorecard={onDownloadScorecard}
                      onDownloadApplication={onDownloadApplication}
                    />
                  );
                })()}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function MembersTable({
  members,
  loading,
  type,
  isAdmin,
  expandedMemberId,
  onExpand,
  onDelete,
  onViewApplication,
  processingIds,
}: {
  members: LeadershipMember[];
  loading: boolean;
  type: "chapter" | "association";
  isAdmin: boolean;
  expandedMemberId: number | null;
  onExpand: (id: number | null) => void;
  onDelete: (id: number, type: "chapter" | "association") => Promise<void>;
  onViewApplication: (app: { type: "chapter" | "association"; id: number }) => void;
  processingIds: Set<number>;
}) {
  if (loading) {
    return (
      <Table className="min-w-full">
        <TableHeader className="bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10">
          <TableRow className="border-b border-gray-200 dark:border-gray-700">
            {isAdmin && <TableCell className="px-4 py-3 w-12"> </TableCell>}
            <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">SAP / Reg No</TableCell>
            <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">Name</TableCell>
            <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 hidden lg:table-cell">Email</TableCell>
            <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">Position</TableCell>
            <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 hidden xl:table-cell">Selected by Admin</TableCell>
            {isAdmin && (
              <TableCell className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 sticky right-0 bg-gray-50 dark:bg-gray-900/50">Actions</TableCell>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={`skeleton-${i}`}>
              {isAdmin && <TableCell className="px-4 py-4"><div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>}
              <TableCell className="px-4 py-4"><div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
              <TableCell className="px-4 py-4"><div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
              <TableCell className="px-4 py-4 hidden lg:table-cell"><div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
              <TableCell className="px-4 py-4"><div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
              <TableCell className="px-4 py-4 hidden xl:table-cell"><div className="h-4 w-44 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
              {isAdmin && (
                <TableCell className="px-4 py-4 sticky right-0 bg-white dark:bg-gray-800"><div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 animate-pulse rounded ml-auto" /></TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (members.length === 0) {
    return (
      <div className="py-16 text-center text-gray-500">
        <p className="text-base font-semibold">No members found</p>
        <p className="text-sm mt-1">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <Table className="min-w-full">
      <TableHeader className="bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10">
        <TableRow className="border-b border-gray-200 dark:border-gray-700">
          {isAdmin && <TableCell className="px-4 py-3 w-12"> </TableCell>}
          <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">SAP / Reg No</TableCell>
          <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">Name</TableCell>
          <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 hidden lg:table-cell">Email</TableCell>
          <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">Position</TableCell>
          <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 hidden xl:table-cell">Selected by Admin</TableCell>
          {isAdmin && (
            <TableCell className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 sticky right-0 bg-gray-50 dark:bg-gray-900/50">Actions</TableCell>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <React.Fragment key={member.id}>
            <TableRow className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
              {isAdmin && (
                <TableCell className="px-4 py-3">
                  <button
                    onClick={() => onExpand(expandedMemberId === member.id ? null : member.id)}
                    className={`w-6 h-6 rounded flex items-center justify-center ${
                      expandedMemberId === member.id ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <PlusIcon className={`w-4 h-4 transition-transform ${expandedMemberId === member.id ? "rotate-45" : ""}`} />
                  </button>
                </TableCell>
              )}
              <TableCell className="px-4 py-3 text-sm">
                <span className="font-mono text-xs">{identifierText(member)}</span>
              </TableCell>
              <TableCell className="px-4 py-3 text-sm">
                <span className="font-medium">{member.name || "-"}</span>
                <a href={member.email ? `mailto:${member.email}` : "#"} className="lg:hidden block text-xs text-blue-600 truncate">{member.email || ""}</a>
              </TableCell>
              <TableCell className="px-4 py-3 text-sm hidden lg:table-cell">
                <a href={member.email ? `mailto:${member.email}` : "#"} className="text-blue-600 hover:underline truncate block">{member.email || "-"}</a>
              </TableCell>
              <TableCell className="px-4 py-3 text-sm truncate">{member.position}</TableCell>
              <TableCell className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300 hidden xl:table-cell">
                <span className="line-clamp-2">
                  {String(member.selectedByAdmin || "").trim() || "-"}
                </span>
              </TableCell>
              {isAdmin && (
                <TableCell className="px-4 py-3 text-right sticky right-0 bg-white dark:bg-gray-800">
                  <div className="flex flex-row flex-wrap justify-end gap-1">
                    <button
                      onClick={() => onViewApplication({ type, id: member.id })}
                      disabled={processingIds.has(member.id)}
                      className="p-1.5 rounded hover:bg-blue-50 text-blue-600 disabled:opacity-50"
                      title="View"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete(member.id, type)}
                      disabled={processingIds.has(member.id)}
                      className="p-1.5 rounded hover:bg-rose-50 text-rose-600 disabled:opacity-50"
                      title="Delete"
                    >
                      <TrashBinIcon className="h-4 w-4" />
                    </button>
                  </div>
                </TableCell>
              )}
            </TableRow>
            {expandedMemberId === member.id && (
              <TableRow className="bg-blue-50/30 dark:bg-blue-900/10">
                <TableCell colSpan={isAdmin ? 7 : 6} className="px-4 py-4">
                  <div className="w-full overflow-hidden">
                    <AlumniExpandableDetails sapId={member.sapId || member.registrationno || ""} onClose={() => onExpand(null)} />
                  </div>
                </TableCell>
              </TableRow>
            )}
          </React.Fragment>
        ))}
      </TableBody>
    </Table>
  );
}
