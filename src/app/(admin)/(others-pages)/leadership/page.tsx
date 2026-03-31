"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import SyncedTableScroll from "@/components/tables/SyncedTableScroll";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TrashBinIcon, CheckLineIcon, CloseLineIcon, DownloadIcon, PlusIcon, EyeIcon } from "@/icons";
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
};

type ApplicationStatusTab = "all" | "pending" | "approved" | "rejected";
type RoleFilter = "all" | "president" | "vice_president" | "coordinator";
type SortKey = "createdAt" | "name" | "sapId" | "type" | "position" | "status";

type ApplicationCounts = {
  all: number;
  pending: number;
  approved: number;
  rejected: number;
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
  status?: ApplicationStatusTab;
  role?: RoleFilter;
  search?: string;
  hasAdditionalAchievements?: boolean;
}) {
  const items = await getLeadershipApplications({
    type: input.type ?? "all",
    status: input.status ?? "pending",
    role: input.role ?? "all",
    search: input.search,
    hasAdditionalAchievements: input.hasAdditionalAchievements,
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

async function fetchApplicationCounts(input: {
  type?: "all" | "chapter" | "association";
  role?: RoleFilter;
  search?: string;
  hasAdditionalAchievements?: boolean;
}) {
  const params = new URLSearchParams();
  if (input.type && input.type !== "all") params.append("type", input.type);
  if (input.role && input.role !== "all") params.append("role", input.role);
  if (input.search) params.append("search", input.search);
  if (input.hasAdditionalAchievements) params.append("hasAdditionalAchievements", "1");

  const res = await fetch(`/api/leadership/application-counts?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch application counts");
  const data = await res.json();
  return (data.counts || { all: 0, pending: 0, approved: 0, rejected: 0 }) as ApplicationCounts;
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
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { isExporting, openExportModal, ExportModal } = useExcelExport();
  const [selectedTab, setSelectedTab] = useState<TabKey>("chapterMembers");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [facultyFilter, setFacultyFilter] = useState("");
  const [chapterFilter, setChapterFilter] = useState("");
  const [applicationTypeFilter, setApplicationTypeFilter] = useState<"all" | "chapter" | "association">("all");
  const [applicationStatusTab, setApplicationStatusTab] = useState<ApplicationStatusTab>("pending");
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

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(String(searchQuery || "").trim());
      setAppPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const confirmModal = useModal();
  const achievementsModal = useModal();
  const [selectedAchievementsApp, setSelectedAchievementsApp] = useState<LeadershipApplication | null>(null);
  const viewModal = useModal();
  const [selectedViewApp, setSelectedViewApp] = useState<{ type: "chapter" | "association"; applicationId: number } | null>(null);
  const [pendingAction, setPendingAction] = useState<
    | {
        action: "approve" | "reject" | "delete";
        applicationId: number;
        type: "chapter" | "association";
        position?: string;
        alumniId?: number;
        name?: string;
        email?: string;
      }
    | null
  >(null);

  const isAdmin = session?.user ? canModify(session.user) : false;

  const handleDownloadApplicationPDF = async () => {
    if (!selectedViewApp) return;

    try {
      const url = new URL(
        "/api/leadership/application-pdf",
        typeof window !== "undefined" ? window.location.origin : ""
      );
      url.searchParams.set("type", selectedViewApp.type);
      url.searchParams.set("applicationId", String(selectedViewApp.applicationId));

      const res = await fetch(url.toString(), { headers: { accept: "application/pdf" } });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const err =
          data && typeof data === "object" && "error" in data
            ? String((data as { error?: unknown }).error || "")
            : "";
        throw new Error(err || "Failed to download PDF");
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `leadership-application-${selectedViewApp.type}-${selectedViewApp.applicationId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const { data: criteriaData, isLoading: criteriaLoading } = useQuery({
    queryKey: ["leadership-criteria", pendingAction?.type, pendingAction?.applicationId],
    queryFn: async () => {
      if (!pendingAction) return { items: [] as RoleCriterion[] };
      if (pendingAction.action !== "approve") return { items: [] as RoleCriterion[] };
      const type = pendingAction.type;
      const role = inferRoleNameFromPosition(pendingAction.position ?? "");
      const res = await fetch(`/api/leadership/criteria?type=${encodeURIComponent(type)}&role=${encodeURIComponent(role)}`, {
        headers: { accept: "application/json" },
      });
      if (!res.ok) throw new Error("Failed to load criteria");
      return (await res.json()) as { items: RoleCriterion[] };
    },
    enabled: confirmModal.isOpen && !!pendingAction && pendingAction.action === "approve" && isAdmin,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  // For the approve modal, we also need alumni textbox responses (they come from application-details, not criteria config).
  const { data: approveDetailsData, isLoading: approveDetailsLoading } = useQuery({
    queryKey: ["leadership-approve-details", pendingAction?.type, pendingAction?.applicationId],
    queryFn: async () => {
      if (!pendingAction) throw new Error("Missing application");
      if (pendingAction.action !== "approve") return { item: null, criteria: [] as ApplicationDetailsCriterion[] };
      return fetchApplicationDetails({ type: pendingAction.type, applicationId: pendingAction.applicationId });
    },
    enabled: confirmModal.isOpen && !!pendingAction && pendingAction.action === "approve" && isAdmin,
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
    if (!confirmModal.isOpen) {
      setAdminCriteriaIds(new Set());
      setAdminOptionalCriteriaProficiency({});
      setAdminCriterionObtainedMarks({});
      return;
    }
    setAdminCriteriaIds(new Set());
    setAdminOptionalCriteriaProficiency({});
    setAdminCriterionObtainedMarks({});
  }, [confirmModal.isOpen, pendingAction?.applicationId]);

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
    queryKey: ["leadership-applications", applicationTypeFilter, applicationStatusTab, applicationRoleFilter, debouncedSearch, hasAdditionalAchievementsFilter],
    queryFn: () =>
      fetchApplications({
        type: applicationTypeFilter,
        status: applicationStatusTab,
        role: applicationRoleFilter,
        search: debouncedSearch || undefined,
        ...(hasAdditionalAchievementsFilter ? { hasAdditionalAchievements: true } : {}),
      }),
    enabled: true,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const { data: applicationCountsData } = useQuery({
    queryKey: ["leadership-application-counts", applicationTypeFilter, applicationRoleFilter, debouncedSearch, hasAdditionalAchievementsFilter],
    queryFn: () =>
      fetchApplicationCounts({
        type: applicationTypeFilter,
        role: applicationRoleFilter,
        search: debouncedSearch || undefined,
        ...(hasAdditionalAchievementsFilter ? { hasAdditionalAchievements: true } : {}),
      }),
    enabled: true,
    placeholderData: (prev) => prev,
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

  const handleAction = async (action: "approve" | "reject" | "delete", applicationId: number, type: "chapter" | "association") => {
    if (!isAdmin) {
      toast.error("Only admins can perform this action");
      return;
    }

    // Use confirmation modal instead of immediate action
    const app = applicationsData?.find((x) => x.id === applicationId);
    setPendingAction({
      action,
      applicationId,
      type,
      position: app?.position,
      alumniId: app?.alumniId,
      name: app?.name,
      email: app?.email,
    });
    confirmModal.openModal();
    return;
  };

  const executePendingAction = async () => {
    if (!pendingAction) return;
    const { action, applicationId, type } = pendingAction;

    if (action === "approve" && isAdmin && criteriaLoading) {
      toast.error("Please wait for criteria to load.");
      return;
    }

    if (action === "approve" && isAdmin && mandatoryCriteriaIds.length > 0) {
      const missing = mandatoryCriteriaIds.filter((id) => !adminCriteriaIds.has(id));
      if (missing.length > 0) {
        toast.error("Please check the mandatory critaria");
        return;
      }
    }

    if (action === "approve" && isAdmin) {
      const optionalCriteriaIds = criteriaItems
        .filter((c) => !c.is_mandatory)
        .map((c) => Number(c.id))
        .filter((n) => Number.isFinite(n) && n > 0);

      if (optionalCriteriaIds.length > 0) {
        const missingRating = optionalCriteriaIds.some((id) => {
          const r = Number(adminOptionalCriteriaProficiency[id] ?? 0);
          return !Number.isFinite(r) || r < 1 || r > 5;
        });

        if (missingRating) {
          toast.error("Please select a proficiency rating (1-5) for all optional criteria.");
          return;
        }
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
          ...(action === "approve"
            ? {
                adminCriteriaIds: Array.from(adminCriteriaIds),
                optionalCriteriaProficiency: adminOptionalCriteriaProficiency,
                criterionObtainedMarks: criterionObtainedMarksPayload,
              }
            : {}),
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

      toast.success(`Application ${action}d successfully`);

      queryClient.invalidateQueries({ queryKey: ["leadership-applications"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["leadership-members"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["leadership-counts"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["leadership-application-counts"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["leadership-application-details"], exact: false });
      await refetchApplications();
      confirmModal.closeModal();
      setPendingAction(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      toast.error(msg);
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
        "Additional Achievements": item.additional_achievements || "",
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
        return "";
      })();
      const vb = ((): string => {
        if (sortKey === "createdAt") return b.createdAt || "";
        if (sortKey === "name") return b.name || "";
        if (sortKey === "sapId") return b.sapId || "";
        if (sortKey === "type") return b.type || "";
        if (sortKey === "position") return b.position || "";
        if (sortKey === "status") return String(b.status || "");
        return "";
      })();
      return va.localeCompare(vb) * dir;
    });

    return sorted;
  }, [applicationsData, sortDir, sortKey]);

  const pagedApplications = useMemo(() => {
    const start = (appPage - 1) * pageSize;
    return filteredApplications.slice(start, start + pageSize);
  }, [filteredApplications, appPage]);

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

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-gray-900/50 overflow-x-hidden">
      <div className="w-full max-w-full">
        {/* Tabs Section */}
        <div className="w-full px-4 py-4">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {TABS.map((tab) => {
                const isSelected = selectedTab === tab.key;
                const statCount = tab.key === "chapterMembers" ? chapterMembersCount : tab.key === "associationMembers" ? associationMembersCount : applicationsCount;
                const colorClass = tab.key === "chapterMembers" ? "blue" : tab.key === "associationMembers" ? "violet" : "amber";

                return (
                  <button
                    key={tab.key}
                    type="button"
                    className={`relative rounded-lg p-3 text-center transition-all ${
                      isSelected 
                        ? `bg-${colorClass}-50 border-2 border-${colorClass}-500 dark:bg-${colorClass}-900/20 shadow-sm` 
                        : 'bg-white border border-gray-200 dark:bg-gray-800/50 dark:border-gray-700 hover:border-gray-300'
                    }`}
                    onClick={() => {
                      setSelectedTab(tab.key);
                      setSearchQuery("");
                      setFacultyFilter("");
                      setChapterFilter("");
                      setApplicationTypeFilter("all");
                    }}
                  >
                    <div className={`text-xs font-bold uppercase tracking-wide mb-1 truncate ${
                      isSelected ? `text-${colorClass}-600 dark:text-${colorClass}-400` : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="sm:hidden">{tab.shortLabel}</span>
                    </div>
                    <div className={`text-2xl font-bold ${
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
        <div className="w-full px-4 py-2">
          <div className="max-w-7xl mx-auto">
            <div className="bg-white dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  {selectedTab === "applications" && (
                    <select
                      value={applicationTypeFilter}
                      onChange={(e) => setApplicationTypeFilter(e.target.value as "all" | "chapter" | "association")}
                      className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All</option>
                      <option value="chapter">Chapter</option>
                      <option value="association">Association</option>
                    </select>
                  )}
                  {uniqueFaculties.length > 0 && (
                    <select
                      value={facultyFilter}
                      onChange={(e) => setFacultyFilter(e.target.value)}
                      className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700"
                  >
                    <DownloadIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Export</span>
                  </button>
                </div>
              </div>

              {selectedTab === "applications" && isAdmin && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {([
                      { key: "all", label: "All" },
                      { key: "pending", label: "Pending" },
                      { key: "approved", label: "Approved" },
                      { key: "rejected", label: "Not Approved" },
                    ] as Array<{ key: ApplicationStatusTab; label: string }>).map((t) => {
                      const active = applicationStatusTab === t.key;
                      const counts = applicationCountsData || { all: 0, pending: 0, approved: 0, rejected: 0 };
                      const countVal = t.key === "all" ? counts.all : t.key === "pending" ? counts.pending : t.key === "approved" ? counts.approved : counts.rejected;
                      return (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => {
                            setApplicationStatusTab(t.key);
                            setAppPage(1);
                          }}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                            active
                              ? "bg-blue-600 text-white border-blue-700"
                              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-200 dark:border-gray-700"
                          }`}
                        >
                          {t.label}
                          <span className={`ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                            active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                          }`}>
                            {countVal}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={applicationRoleFilter}
                      onChange={(e) => {
                        setApplicationRoleFilter(e.target.value as RoleFilter);
                        setAppPage(1);
                      }}
                      className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Roles</option>
                      <option value="president">President</option>
                      <option value="vice_president">Vice President</option>
                      <option value="coordinator">Coordinator</option>
                    </select>

                    <label className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={hasAdditionalAchievementsFilter}
                        onChange={(e) => {
                          setHasAdditionalAchievementsFilter(e.target.checked);
                          setAppPage(1);
                        }}
                        className="h-4 w-4 text-blue-600"
                      />
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">With Additional Achievements</span>
                    </label>

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
            className="max-w-3xl"
          >
            <div className="flex max-h-[80vh] flex-col">
              <div className="p-6 overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {pendingAction.action === "approve"
                  ? "Approve Leadership Application"
                  : pendingAction.action === "reject"
                    ? "Not Approve Leadership Application"
                    : "Delete Leadership Member"}
              </h3>

              <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                {pendingAction.action === "delete" ? (
                  <>Are you sure you want to delete this record? This action cannot be undone.</>
                ) : (
                  <>
                    Are you sure you want to {pendingAction.action === "approve" ? "approve" : "mark as not approved"} the{" "}
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

              {pendingAction.action === "approve" && isAdmin && (
                <div className="mt-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Role Criteria Confirmation &amp; Marks</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Confirm mandatory items, set proficiency for optional items, and enter obtained marks (0 up to each criterion&apos;s maximum) before approving.
                      </div>
                    </div>
                    {criteriaLoading || approveDetailsLoading ? (
                      <div className="text-xs text-gray-500">Loading...</div>
                    ) : null}
                  </div>

                  {criteriaItems.length === 0 && !criteriaLoading ? (
                    <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">No criteria configured for this role.</div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {criteriaItems.map((c) => {
                        const id = Number(c.id);
                        const currentRating = Number(adminOptionalCriteriaProficiency[id] ?? 0);
                            if (c.is_mandatory) {
                              const checked = adminCriteriaIds.has(id);
                              const maxScore = Number((c as RoleCriterion).criterion_score);
                              const hasScored = Number.isFinite(maxScore) && maxScore >= 1;
                              const tb = approveTextboxByCriterionId.get(id) ?? null;
                              const tbLabel = String(tb?.textboxLabel || c.textbox_label || "Response");
                              const tbValue =
                                tb?.alumniText && String(tb.alumniText).trim()
                                  ? String(tb.alumniText)
                                  : "No response provided";
                              return (
                                <div
                                  key={id}
                                  className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 px-3 py-2"
                                >
                                  <label className="mt-1 flex cursor-pointer">
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
                                          if (on && hasScored) next[id] = maxScore;
                                          else delete next[id];
                                          return next;
                                        });
                                      }}
                                      className="h-4 w-4 text-blue-600"
                                    />
                                  </label>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.label}</span>
                                      <span className="rounded-full bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 text-[10px] font-semibold">
                                        Mandatory
                                      </span>
                                      {hasScored ? (
                                        <span className="rounded-full bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 text-[10px] font-semibold">
                                          Max marks: {maxScore}
                                        </span>
                                      ) : null}
                                      <span className="rounded-full bg-gray-100 text-gray-700 border border-gray-200 px-2 py-0.5 text-[10px] font-semibold">
                                        Has Textbox: {Boolean(c.has_textbox) ? "Yes" : "No"}
                                      </span>
                                    </div>
                                    {c.description ? <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{c.description}</div> : null}
                                    {c.has_textbox ? (
                                      <div className="mt-2">
                                        <div className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">{tbLabel}:</div>
                                        <div className="mt-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2 text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                                          {tbValue}
                                        </div>
                                      </div>
                                    ) : null}
                                    {checked && hasScored ? (
                                      <div className="mt-3">
                                        <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-200 mb-1">
                                          Obtained marks (0–{maxScore})
                                        </label>
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
                                            setAdminCriterionObtainedMarks((p) => ({
                                              ...p,
                                              [id]: clampObtainedMark(num, maxScore),
                                            }));
                                          }}
                                          className="w-full max-w-[160px] rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm"
                                        />
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            }

                            // Optional criteria: align with the alumni form (only star rating selection)
                            const maxScoreOpt = Number((c as RoleCriterion).criterion_score);
                            const hasScoredOpt = Number.isFinite(maxScoreOpt) && maxScoreOpt >= 1;
                            const tb = approveTextboxByCriterionId.get(id) ?? null;
                            const tbLabel = String(tb?.textboxLabel || c.textbox_label || "Response");
                            const tbValue =
                              tb?.alumniText && String(tb.alumniText).trim()
                                ? String(tb.alumniText)
                                : "No response provided";
                            return (
                              <div
                                key={id}
                                className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 px-3 py-2"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.label}</span>
                                    <span className="rounded-full bg-gray-100 text-gray-700 border border-gray-200 px-2 py-0.5 text-[10px] font-semibold">
                                      Optional
                                    </span>
                                    {hasScoredOpt ? (
                                      <span className="rounded-full bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 text-[10px] font-semibold">
                                        Max marks: {maxScoreOpt}
                                      </span>
                                    ) : null}
                                    <span className="rounded-full bg-gray-100 text-gray-700 border border-gray-200 px-2 py-0.5 text-[10px] font-semibold">
                                      Has Textbox: {Boolean(c.has_textbox) ? "Yes" : "No"}
                                    </span>
                                  </div>
                                  {c.description ? <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{c.description}</div> : null}
                                  {c.has_textbox ? (
                                    <div className="mt-2">
                                      <div className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">{tbLabel}:</div>
                                      <div className="mt-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2 text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                                        {tbValue}
                                      </div>
                                    </div>
                                  ) : null}

                                  <div className="mt-3">
                                    <div className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 mb-2">
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
                                              if (hasScoredOpt) {
                                                const suggested = (star / 5) * maxScoreOpt;
                                                setAdminCriterionObtainedMarks((prev) => ({
                                                  ...prev,
                                                  [id]: clampObtainedMark(suggested, maxScoreOpt),
                                                }));
                                              }
                                            }}
                                            className={`select-none rounded-md border px-2 py-1 text-xs font-semibold ${
                                              active
                                                ? "border-amber-300 bg-amber-50 text-amber-800"
                                                : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                                            }`}
                                            aria-label={`Set rating to ${star}`}
                                          >
                                            {active ? "★" : "☆"} {star}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                                      {currentRating ? `Selected: ${currentRating}` : "No rating"}
                                    </div>
                                    {Number.isFinite(currentRating) && currentRating >= 1 && hasScoredOpt ? (
                                      <div className="mt-3">
                                        <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-200 mb-1">
                                          Obtained marks (0–{maxScoreOpt})
                                        </label>
                                        <input
                                          type="number"
                                          min={0}
                                          max={maxScoreOpt}
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
                                            setAdminCriterionObtainedMarks((p) => ({
                                              ...p,
                                              [id]: clampObtainedMark(num, maxScoreOpt),
                                            }));
                                          }}
                                          className="w-full max-w-[160px] rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm"
                                        />
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            );
                      })}
                    </div>
                  )}
                </div>
              )}

              {pendingAction.action !== "delete" && (
                <div className="mt-5">
                  {(() => {
                    const alumniId = pendingAction.alumniId;
                    const recipientEmail = pendingAction.email;
                    if (!alumniId || !recipientEmail) {
                      return (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                          No recipient email found for this alumni. You can still confirm the action, but you cannot send an email.
                        </div>
                      );
                    }

                    const actionType =
                      pendingAction.type === "chapter"
                        ? pendingAction.action === "approve"
                          ? EMAIL_ACTION_TYPE.CHAPTER_LEADERSHIP_APPROVED
                          : EMAIL_ACTION_TYPE.CHAPTER_LEADERSHIP_NOT_APPROVED
                        : pendingAction.action === "approve"
                          ? EMAIL_ACTION_TYPE.ASSOCIATION_LEADERSHIP_APPROVED
                          : EMAIL_ACTION_TYPE.ASSOCIATION_LEADERSHIP_NOT_APPROVED;

                    const tpl = generateAdminActionEmail({
                      actionType,
                      alumniName: pendingAction.name || "Alumni",
                    });

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
                          initialBody={tpl.html}
                          disabled={processingIds.has(pendingAction.applicationId)}
                        />
                      </div>
                    );
                  })()}
                </div>
              )}

              </div>

              <div className="px-6 pb-6 pt-4 flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
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
                  onClick={executePendingAction}
                  disabled={processingIds.has(pendingAction.applicationId)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  Confirm
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Table Section */}
        <div className="w-full px-4 pb-8">
          <div className="max-w-7xl mx-auto">
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
                          : statusLower === "rejected"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-amber-50 text-amber-700 border-amber-200";

                      const docs = documentsFromItem(item);
                      const downloadAllDocs = () => {
                        docs.forEach((d) => {
                          const a = document.createElement("a");
                          a.href = d.url;
                          a.download = "";
                          a.rel = "noopener noreferrer";
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        });
                      };

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
                                    {statusLower === "rejected" ? "Not Approved" : statusText}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-start lg:justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleDownloadApplicationPDF}
                                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                              >
                                <DownloadIcon className="h-4 w-4" />
                                Download PDF
                              </button>
                              <button
                                type="button"
                                onClick={downloadAllDocs}
                                disabled={docs.length === 0}
                                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/20 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900/40 disabled:opacity-50"
                              >
                                <DownloadIcon className="h-4 w-4" />
                                Download Documents
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  viewModal.closeModal();
                                  setSelectedViewApp(null);
                                }}
                                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/20 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900/40"
                              >
                                Close
                              </button>
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
                            <div className="mt-3 overflow-x-auto">
                              <table className="min-w-[820px] w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/40 z-10">
                                  <tr className="border-b border-gray-200 dark:border-gray-700">
                                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Requirement</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-200 w-[100px]">Marks</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-200 w-[140px]">Obtained Marks</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-200 w-[160px]">Alumni</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-200 w-[160px]">Admin</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                  {(Array.isArray(viewDetailsData.criteria) ? viewDetailsData.criteria : []).map((c: ApplicationDetailsCriterion) => {
                                    const isMandatory = Boolean(c.is_mandatory);
                                    const alumniRespRaw = String(c.alumni_response ?? "").toUpperCase();
                                    const alumniResp = alumniRespRaw === "YES" || alumniRespRaw === "NO" ? alumniRespRaw : c.alumni_confirmed ? "YES" : "NO";
                                    const adminRespRaw = String(c.admin_response ?? "").toUpperCase();
                                    const adminResp = adminRespRaw === "YES" || adminRespRaw === "NO" ? adminRespRaw : c.admin_confirmed ? "YES" : "NO";
                                    const alumniYes = alumniResp === "YES";
                                    const adminYes = adminResp === "YES";
                                    const rating = profMap && typeof profMap === "object" ? Number(profMap[String(c.id)] ?? 0) : 0;
                                    const stars = !isMandatory && alumniYes && rating ? starsText(rating) : "";
                                    const label = !isMandatory && alumniYes && rating ? proficiencyLabel(rating) : "";

                                    const marks = Number.isFinite(Number((c as ApplicationDetailsCriterion).criterion_score))
                                      ? Number((c as ApplicationDetailsCriterion).criterion_score)
                                      : null;
                                    const storedObtained = Number.isFinite(Number((c as ApplicationDetailsCriterion).obtained_marks))
                                      ? Number((c as ApplicationDetailsCriterion).obtained_marks)
                                      : null;
                                    const showObtained = statusLower === "approved";

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
                                        <td className="px-4 py-3">
                                          <div className={`font-semibold ${adminYes ? "text-gray-900 dark:text-gray-100" : "text-gray-500"}`}>{adminYes ? "✔ YES" : "NO"}</div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/20 p-6 shadow-sm">
                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Additional Achievements</div>
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
                                    <div key={d.key} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
                                      <div className="min-w-0">
                                        <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">{d.label}</div>
                                        <div className="text-xs text-gray-600 dark:text-gray-400 break-all">{name}</div>
                                      </div>
                                      <a
                                        href={d.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="shrink-0 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline"
                                      >
                                        View
                                      </a>
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

function ApplicationsTable({
  applications,
  loading,
  isAdmin,
  onAction,
  onViewAdditionalAchievements,
  onViewApplication,
  processingIds,
  sortKey,
  sortDir,
  onSort,
 }: {
  applications: LeadershipApplication[];
  loading: boolean;
  isAdmin: boolean;
  onAction: (action: "approve" | "reject" | "delete", id: number, type: "chapter" | "association") => Promise<void>;
  onViewAdditionalAchievements: (app: LeadershipApplication) => void;
  onViewApplication: (app: LeadershipApplication) => void;
  processingIds: Set<number>;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
 }) {
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
            <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 w-[240px]">Type</TableCell>
            <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 w-[220px]">Role</TableCell>
            <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 w-[160px]">Status</TableCell>
            {isAdmin && (
              <TableCell className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 sticky right-0 bg-gray-50 dark:bg-gray-900/50 w-[120px]">
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
              <TableCell className="px-4 py-4 w-[240px]"><div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
              <TableCell className="px-4 py-4 w-[220px]"><div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
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
            <TableCell className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 sticky right-0 bg-gray-50 dark:bg-gray-900/50 w-[120px]">
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
                    : String(app.status || "").toLowerCase() === "rejected"
                      ? "bg-rose-50 text-rose-800 border-rose-200"
                      : "bg-amber-50 text-amber-800 border-amber-200"
                }`}
              >
                {String(app.status || "pending").toLowerCase() === "rejected" ? "Not Approved" : String(app.status || "pending")}
              </span>
            </TableCell>
            {isAdmin && (
              <TableCell className="px-4 py-3 text-right sticky right-0 bg-white dark:bg-gray-800 w-[120px]">
                <div className="flex flex-row flex-wrap gap-1">
                  <button
                    onClick={() => onViewApplication(app)}
                    disabled={processingIds.has(app.id)}
                    className="p-2 sm:p-1.5 min-h-9 min-w-9 sm:min-h-0 sm:min-w-0 rounded hover:bg-blue-50 text-blue-600 disabled:opacity-50"
                    title="View"
                  >
                    <EyeIcon className="h-5 w-5 sm:h-4 sm:w-4" />
                  </button>
                  <button
                    onClick={() => onAction("approve", app.id, app.type)}
                    disabled={processingIds.has(app.id)}
                    className="p-2 sm:p-1.5 min-h-9 min-w-9 sm:min-h-0 sm:min-w-0 rounded hover:bg-emerald-50 text-emerald-600 disabled:opacity-50"
                    title="Approve"
                  >
                    <CheckLineIcon className="h-5 w-5 sm:h-4 sm:w-4" />
                  </button>
                  <button
                    onClick={() => onAction("reject", app.id, app.type)}
                    disabled={processingIds.has(app.id)}
                    className="p-2 sm:p-1.5 min-h-9 min-w-9 sm:min-h-0 sm:min-w-0 rounded hover:bg-amber-50 text-amber-600 disabled:opacity-50"
                    title="Reject"
                  >
                    <CloseLineIcon className="h-5 w-5 sm:h-4 sm:w-4" />
                  </button>
                  <button
                    onClick={() => onAction("delete", app.id, app.type)}
                    disabled={processingIds.has(app.id)}
                    className="p-2 sm:p-1.5 min-h-9 min-w-9 sm:min-h-0 sm:min-w-0 rounded hover:bg-rose-50 text-rose-600 disabled:opacity-50"
                    title="Delete"
                  >
                    <TrashBinIcon className="h-5 w-5 sm:h-4 sm:w-4" />
                  </button>
                </div>
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
