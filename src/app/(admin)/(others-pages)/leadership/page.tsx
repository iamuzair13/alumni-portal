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
import Pagination from "@/components/tables/Pagination";
import LeadershipRoleBadge from "@/components/ui/LeadershipRoleBadge";
import { getLeadershipApplications } from "@/app/queries/leadership-applications";

type RoleCriterion = {
  id: number;
  label: string;
  description: string | null;
  is_mandatory: boolean;
  sort_order: number;
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
  position: string;
  status?: string;
  additionalAchievements?: string | null;
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
  alumni_confirmed: boolean;
  admin_confirmed: boolean;
};

type ApplicationDetailsItem = LeadershipApplication & {
  registrationNo?: string | null;
  rejectionReason?: string | null;
  updatedAt?: string | null;
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

async function fetchApplications(input: { type?: string; status?: string; role?: string; search?: string; hasAdditionalAchievements?: boolean }) {
  const items = await getLeadershipApplications({
    type: (input.type as any) ?? "all",
    status: (input.status as any) ?? "pending",
    role: (input.role as any) ?? "all",
    search: input.search,
    hasAdditionalAchievements: input.hasAdditionalAchievements,
  });
  return items as unknown as LeadershipApplication[];
}

function identifierText(app: { sapId?: string | null; registrationno?: string | null }): string {
  const sap = String(app.sapId || "").trim();
  const reg = String(app.registrationno || "").trim();
  if (sap && reg && sap !== reg) return `${sap} / ${reg}`;
  return sap || reg || "-";
}

async function fetchApplicationCounts(input: { type?: string; role?: string; search?: string; hasAdditionalAchievements?: boolean }) {
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

  const res = await fetch(`/api/leadership/application-details?${params.toString()}` , {
    headers: { accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || "Failed to fetch application details");
  return data as { item: ApplicationDetailsItem; criteria: ApplicationDetailsCriterion[] };
}

async function fetchCriteria(type: "chapter" | "association", role: "president" | "vice_president" | "coordinator") {
  const res = await fetch(`/api/leadership/criteria?type=${encodeURIComponent(type)}&role=${encodeURIComponent(role)}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error("Failed to fetch criteria");
  return (await res.json()) as { items: RoleCriterion[] };
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
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());
  const [expandedMemberId, setExpandedMemberId] = useState<number | null>(null);
  const [adminCriteriaIds, setAdminCriteriaIds] = useState<Set<number>>(new Set());

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
        throw new Error((data as any).error || "Failed to download PDF");
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
      return;
    }
    setAdminCriteriaIds(new Set());
  }, [confirmModal.isOpen, pendingAction?.applicationId]);

  // Fetch chapter members
  const { data: chapterMembersData, isLoading: chapterMembersLoading, refetch: refetchChapterMembers } = useQuery({
    queryKey: ["leadership-members", "chapter", searchQuery, facultyFilter, chapterFilter],
    queryFn: () => fetchMembers("chapter", searchQuery || undefined, facultyFilter || undefined, chapterFilter || undefined),
    enabled: true,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Fetch association members
  const { data: associationMembersData, isLoading: associationMembersLoading, refetch: refetchAssociationMembers } = useQuery({
    queryKey: ["leadership-members", "association", searchQuery, facultyFilter, chapterFilter],
    queryFn: () => fetchMembers("association", searchQuery || undefined, facultyFilter || undefined, chapterFilter || undefined),
    enabled: true,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const membersData = selectedTab === "chapterMembers" ? chapterMembersData : associationMembersData;
  const membersLoading = selectedTab === "chapterMembers" ? chapterMembersLoading : associationMembersLoading;
  
  const refetchMembers = async () => {
    if (selectedTab === "chapterMembers") {
      await refetchChapterMembers();
    } else if (selectedTab === "associationMembers") {
      await refetchAssociationMembers();
    }
  };

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

    if (action === "approve" && isAdmin && mandatoryCriteriaIds.length > 0) {
      const missing = mandatoryCriteriaIds.filter((id) => !adminCriteriaIds.has(id));
      if (missing.length > 0) {
        setActionError("Please confirm all mandatory criteria before approving.");
        return;
      }
    }

    setProcessingIds((prev) => new Set(prev).add(applicationId));
    setActionMessage(null);
    setActionError(null);

    try {
      const res = await fetch("/api/leadership/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          applicationId,
          type,
          ...(action === "approve" ? { adminCriteriaIds: Array.from(adminCriteriaIds) } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as any).error || "Failed to perform action");
      }

      setActionMessage(
        `${action === "approve" ? "Approved" : action === "reject" ? "Rejected" : "Deleted"} successfully`
      );
      toast.success(`Application ${action}d successfully`);

      queryClient.invalidateQueries({ queryKey: ["leadership-applications"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["leadership-members"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["leadership-counts"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["leadership-application-counts"], exact: false });
      await refetchApplications();
      confirmModal.closeModal();
      setPendingAction(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      setActionError(msg);
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

  const totalAppPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredApplications.length / pageSize));
  }, [filteredApplications.length]);

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
            className="max-w-xl"
          >
            <div className="p-6">
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
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Role Criteria Confirmation</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Mandatory criteria must be confirmed to approve.</div>
                    </div>
                    {criteriaLoading ? (
                      <div className="text-xs text-gray-500">Loading...</div>
                    ) : null}
                  </div>

                  {criteriaItems.length === 0 && !criteriaLoading ? (
                    <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">No criteria configured for this role.</div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {criteriaItems.map((c) => {
                        const id = Number(c.id);
                        const checked = adminCriteriaIds.has(id);
                        return (
                          <label key={id} className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 px-3 py-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setAdminCriteriaIds((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(id);
                                  else next.delete(id);
                                  return next;
                                });
                              }}
                              className="mt-1 h-4 w-4 text-blue-600"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.label}</span>
                                {c.is_mandatory ? (
                                  <span className="rounded-full bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 text-[10px] font-semibold">Mandatory</span>
                                ) : (
                                  <span className="rounded-full bg-gray-100 text-gray-700 border border-gray-200 px-2 py-0.5 text-[10px] font-semibold">Optional</span>
                                )}
                              </div>
                              {c.description ? (
                                <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{c.description}</div>
                              ) : null}
                            </div>
                          </label>
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

              <div className="mt-6 flex items-center justify-end gap-3">
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
                className="max-w-3xl"
              >
                <div className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">View Application</h3>
                      <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {selectedViewApp.type === "chapter" ? "Chapter" : "Association"} • ID {selectedViewApp.applicationId}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadApplicationPDF}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      <DownloadIcon className="h-4 w-4" />
                      Download PDF
                    </button>
                  </div>

                  {viewDetailsLoading ? (
                    <div className="mt-6 text-sm text-gray-600 dark:text-gray-400">Loading...</div>
                  ) : !viewDetailsData?.item ? (
                    <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      Unable to load application details.
                    </div>
                  ) : (
                    <div className="mt-6 space-y-4">
                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/20 p-4">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Applicant</div>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <div><span className="font-medium">Name:</span> {viewDetailsData.item.name || "-"}</div>
                          <div><span className="font-medium">SAP ID:</span> {viewDetailsData.item.sapId || "-"}</div>
                          <div><span className="font-medium">Email:</span> {viewDetailsData.item.email || "-"}</div>
                          <div><span className="font-medium">Registration No:</span> {viewDetailsData.item.registrationNo || "-"}</div>
                          <div><span className="font-medium">Faculty:</span> {viewDetailsData.item.faculty || "-"}</div>
                          <div><span className="font-medium">Department:</span> {viewDetailsData.item.department || "-"}</div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/20 p-4">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Application</div>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <div><span className="font-medium">Type:</span> {viewDetailsData.item.type === "chapter" ? "Chapter" : "Association"}</div>
                          <div><span className="font-medium">Role:</span> {viewDetailsData.item.position || "-"}</div>
                          <div><span className="font-medium">Status:</span> {String(viewDetailsData.item.status || "pending")}</div>
                          <div><span className="font-medium">Created:</span> {viewDetailsData.item.createdAt ? String(viewDetailsData.item.createdAt) : "-"}</div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/20 p-4">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Criteria</div>
                        {Array.isArray(viewDetailsData.criteria) && viewDetailsData.criteria.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            {viewDetailsData.criteria.map((c) => (
                              <div key={c.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{c.label}</div>
                                    {c.description ? (
                                      <div className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">{c.description}</div>
                                    ) : null}
                                  </div>
                                  <div className="flex flex-col items-end gap-1 text-[11px] font-semibold">
                                    <span className={`rounded-full border px-2 py-0.5 ${c.is_mandatory ? "bg-rose-50 text-rose-800 border-rose-200" : "bg-gray-100 text-gray-700 border-gray-200"}`}>
                                      {c.is_mandatory ? "Mandatory" : "Optional"}
                                    </span>
                                    <span className={`rounded-full border px-2 py-0.5 ${c.alumni_confirmed ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-gray-100 text-gray-700 border-gray-200"}`}>
                                      Alumni: {c.alumni_confirmed ? "Yes" : "No"}
                                    </span>
                                    <span className={`rounded-full border px-2 py-0.5 ${c.admin_confirmed ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-gray-100 text-gray-700 border-gray-200"}`}>
                                      Admin: {c.admin_confirmed ? "Yes" : "No"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">No criteria found.</div>
                        )}
                      </div>

                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/20 p-4">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Additional Achievements</div>
                        <div className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-700 dark:text-gray-300 max-h-[30vh] overflow-auto">
                          {String(viewDetailsData.item.additionalAchievements || "").trim() || "No additional achievements provided."}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        viewModal.closeModal();
                        setSelectedViewApp(null);
                      }}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </Modal>
            )}

            {selectedTab === "applications" && totalAppPages > 1 ? (
              <div className="flex justify-end pt-4">
                <Pagination
                  currentPage={appPage}
                  totalPages={totalAppPages}
                  onPageChange={(p) => {
                    const next = Math.max(1, Math.min(totalAppPages, p));
                    setAppPage(next);
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Action Messages */}
      {actionMessage && (
        <div className="px-6 pt-2">
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">
            {actionMessage}
          </div>
        </div>
      )}

      {actionError && (
        <div className="w-full px-4 py-2">
          <div className="max-w-7xl mx-auto">
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-700 text-sm">
              {actionError}
            </div>
          </div>
        </div>
      )}

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
      <Table className="min-w-full">
        <TableHeader className="bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10">
          <TableRow className="border-b border-gray-200 dark:border-gray-700">
            <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">SAP / Reg No</TableCell>
            <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">Name</TableCell>
            <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 hidden lg:table-cell">Email</TableCell>
            <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">Type</TableCell>
            <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">Role</TableCell>
            <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">Status</TableCell>
            {isAdmin && (
              <TableCell className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 sticky right-0 bg-gray-50 dark:bg-gray-900/50">Actions</TableCell>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={`skeleton-${i}`}>
              <TableCell className="px-4 py-4"><div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
              <TableCell className="px-4 py-4"><div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
              <TableCell className="px-4 py-4 hidden lg:table-cell"><div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
              <TableCell className="px-4 py-4"><div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
              <TableCell className="px-4 py-4"><div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
              {isAdmin && (
                <TableCell className="px-4 py-4 sticky right-0 bg-white dark:bg-gray-800"><div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded ml-auto" /></TableCell>
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
    <Table className="min-w-full">
      <TableHeader className="bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10">
        <TableRow className="border-b border-gray-200 dark:border-gray-700">
          <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">
            <button type="button" onClick={() => onSort("sapId")} className="hover:underline">
              SAP / Reg No{sortIndicator("sapId")}
            </button>
          </TableCell>
          <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">
            <button type="button" onClick={() => onSort("name")} className="hover:underline">
              Name{sortIndicator("name")}
            </button>
          </TableCell>
          <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 hidden lg:table-cell">Email</TableCell>
          <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">
            <button type="button" onClick={() => onSort("type")} className="hover:underline">
              Type{sortIndicator("type")}
            </button>
          </TableCell>
          <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">
            <button type="button" onClick={() => onSort("position")} className="hover:underline">
              Role{sortIndicator("position")}
            </button>
          </TableCell>
          <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">
            <button type="button" onClick={() => onSort("status")} className="hover:underline">
              Status{sortIndicator("status")}
            </button>
          </TableCell>
          {isAdmin && (
            <TableCell className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 sticky right-0 bg-gray-50 dark:bg-gray-900/50">Actions</TableCell>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {applications.map((app) => (
          <TableRow key={`${app.type}-${app.id}`} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
            <TableCell className="px-4 py-3 text-sm">
              <span className="font-mono text-xs">{identifierText(app)}</span>
            </TableCell>
            <TableCell className="px-4 py-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{app.name || "-"}</span>
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
              <a href={app.email ? `mailto:${app.email}` : "#"} className="lg:hidden block text-xs text-blue-600 truncate">{app.email || ""}</a>
            </TableCell>
            <TableCell className="px-4 py-3 text-sm hidden lg:table-cell">
              <a href={app.email ? `mailto:${app.email}` : "#"} className="text-blue-600 hover:underline truncate block">{app.email || "-"}</a>
            </TableCell>
            <TableCell className="px-4 py-3 text-sm">{app.type === "chapter" ? "Chapter" : "Association"}</TableCell>
            <TableCell className="px-4 py-3 text-sm">
              <LeadershipRoleBadge type={app.type} position={app.position} />
            </TableCell>
            <TableCell className="px-4 py-3 text-sm">
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
              <TableCell className="px-4 py-3 text-right sticky right-0 bg-white dark:bg-gray-800">
                <div className="inline-flex gap-1">
                  <button
                    onClick={() => onViewApplication(app)}
                    disabled={processingIds.has(app.id)}
                    className="p-1.5 rounded hover:bg-blue-50 text-blue-600 disabled:opacity-50"
                    title="View"
                  >
                    <EyeIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onAction("approve", app.id, app.type)}
                    disabled={processingIds.has(app.id)}
                    className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600 disabled:opacity-50"
                    title="Approve"
                  >
                    <CheckLineIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onAction("reject", app.id, app.type)}
                    disabled={processingIds.has(app.id)}
                    className="p-1.5 rounded hover:bg-amber-50 text-amber-600 disabled:opacity-50"
                    title="Reject"
                  >
                    <CloseLineIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onAction("delete", app.id, app.type)}
                    disabled={processingIds.has(app.id)}
                    className="p-1.5 rounded hover:bg-rose-50 text-rose-600 disabled:opacity-50"
                    title="Delete"
                  >
                    <TrashBinIcon className="h-4 w-4" />
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
  processingIds,
}: {
  members: LeadershipMember[];
  loading: boolean;
  type: "chapter" | "association";
  isAdmin: boolean;
  expandedMemberId: number | null;
  onExpand: (id: number | null) => void;
  onDelete: (id: number, type: "chapter" | "association") => Promise<void>;
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
              {isAdmin && (
                <TableCell className="px-4 py-3 text-right sticky right-0 bg-white dark:bg-gray-800">
                  <button
                    onClick={() => onDelete(member.id, type)}
                    disabled={processingIds.has(member.id)}
                    className="p-1.5 rounded hover:bg-rose-50 text-rose-600 disabled:opacity-50"
                    title="Delete"
                  >
                    <TrashBinIcon className="h-4 w-4" />
                  </button>
                </TableCell>
              )}
            </TableRow>
            {expandedMemberId === member.id && (
              <TableRow className="bg-blue-50/30 dark:bg-blue-900/10">
                <TableCell colSpan={isAdmin ? 6 : 5} className="px-4 py-4">
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
