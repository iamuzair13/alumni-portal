"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import SyncedTableScroll from "@/components/tables/SyncedTableScroll";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TrashBinIcon, CheckLineIcon, CloseLineIcon, DownloadIcon, PlusIcon } from "@/icons";
import { canModify } from "@/lib/alumniProfile";
import toast from "react-hot-toast";
import { AlumniExpandableDetails } from "@/components/alumni/AlumniExpandableDetails";
import { useExcelExport } from "@/lib/excel-export";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import { SendEmailButton } from "@/components/email/SendEmailButton";
import { EMAIL_ACTION_TYPE, generateAdminActionEmail } from "@/lib/emailTemplates";

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
  name: string;
  email: string;
  faculty: string | null;
  department: string | null;
  program: string | null;
  type: "chapter" | "association";
  position: string;
  createdAt: string;
};

type LeadershipSettings = {
  chapter_leadership: boolean;
  association_leadership: boolean;
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

async function fetchApplications(type?: string) {
  const params = new URLSearchParams();
  if (type && type !== "all") params.append("type", type);
  
  const res = await fetch(`/api/leadership/applications?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch applications");
  const data = await res.json();
  return data.items as LeadershipApplication[];
}

async function fetchSettings(): Promise<LeadershipSettings> {
  const res = await fetch("/api/leadership/settings");
  if (!res.ok) {
    return { chapter_leadership: true, association_leadership: true };
  }
  return res.json();
}

async function updateSetting(formType: "chapter_leadership" | "association_leadership", isEnabled: boolean) {
  const res = await fetch("/api/leadership/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ formType, isEnabled }),
  });
  if (!res.ok) throw new Error("Failed to update setting");
  return res.json();
}

export default function LeadershipPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { isExporting, openExportModal, ExportModal } = useExcelExport();
  const [selectedTab, setSelectedTab] = useState<TabKey>("chapterMembers");
  const [searchQuery, setSearchQuery] = useState("");
  const [facultyFilter, setFacultyFilter] = useState("");
  const [chapterFilter, setChapterFilter] = useState("");
  const [applicationTypeFilter, setApplicationTypeFilter] = useState<"all" | "chapter" | "association">("all");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());
  const [expandedMemberId, setExpandedMemberId] = useState<number | null>(null);

  const confirmModal = useModal();
  const [pendingAction, setPendingAction] = useState<
    | {
        action: "approve" | "reject" | "delete";
        applicationId: number;
        type: "chapter" | "association";
        alumniId?: number;
        name?: string;
        email?: string;
      }
    | null
  >(null);

  const isAdmin = session?.user ? canModify(session.user) : false;

  // Fetch settings
  const { data: settings, refetch: refetchSettings } = useQuery({
    queryKey: ["leadership-settings"],
    queryFn: fetchSettings,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Fetch chapter members
  const { data: chapterMembersData, isLoading: chapterMembersLoading, refetch: refetchChapterMembers } = useQuery({
    queryKey: ["leadership-members", "chapter", searchQuery, facultyFilter, chapterFilter],
    queryFn: () => fetchMembers("chapter", searchQuery || undefined, facultyFilter || undefined, chapterFilter || undefined),
    enabled: selectedTab === "chapterMembers",
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Fetch association members
  const { data: associationMembersData, isLoading: associationMembersLoading, refetch: refetchAssociationMembers } = useQuery({
    queryKey: ["leadership-members", "association", searchQuery, facultyFilter, chapterFilter],
    queryFn: () => fetchMembers("association", searchQuery || undefined, facultyFilter || undefined, chapterFilter || undefined),
    enabled: selectedTab === "associationMembers",
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
    queryKey: ["leadership-applications", applicationTypeFilter],
    queryFn: () => fetchApplications(applicationTypeFilter === "all" ? undefined : applicationTypeFilter),
    enabled: selectedTab === "applications",
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
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

    setProcessingIds((prev) => new Set(prev).add(applicationId));
    setActionMessage(null);
    setActionError(null);

    try {
      const res = await fetch("/api/leadership/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, applicationId, type }),
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
      await refetchApplications();
      await refetchMembers();

      confirmModal.closeModal();
      setPendingAction(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to perform action";
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

  const handleToggleSetting = async (formType: "chapter_leadership" | "association_leadership", currentValue: boolean) => {
    if (!isAdmin) {
      toast.error("Only admins can update settings");
      return;
    }

    try {
      await updateSetting(formType, !currentValue);
      toast.success(`${formType === "chapter_leadership" ? "Chapter Leadership" : "Association Leadership"} form ${!currentValue ? "enabled" : "disabled"}`);
      await refetchSettings();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to update setting";
      toast.error(msg);
    }
  };

  // Export to Excel function
  const handleExport = () => {
    const exportColumnKeys: string[] = [
      "Leadership Type",
      "Leadership Status",
      "Position",
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
      exportType = "all";
      status = "pending";
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
        "Position": item.post || "",
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
        "Created At": item.created_at || item.createddatetime || "",
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
    return applicationsData || [];
  }, [applicationsData]);

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
  const applicationsCount = applicationsData?.length || 0;

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-gray-900/50 overflow-x-hidden">
      <div className="w-full max-w-full">
        {/* Admin Settings Section */}
        {isAdmin && (
          <div className="w-full px-4 pt-6 pb-4">
            <div className="max-w-7xl mx-auto">
              <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/50 p-4 shadow-sm">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Form Settings</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex-1 min-w-0">
                      <label className="text-sm font-medium text-gray-900 dark:text-gray-100 block truncate">Chapter Leadership</label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Enable/disable form</p>
                    </div>
                    <button
                      onClick={() => handleToggleSetting("chapter_leadership", settings?.chapter_leadership ?? true)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                        settings?.chapter_leadership ?? true ? "bg-blue-600" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings?.chapter_leadership ?? true ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex-1 min-w-0">
                      <label className="text-sm font-medium text-gray-900 dark:text-gray-100 block truncate">Association Leadership</label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Enable/disable form</p>
                    </div>
                    <button
                      onClick={() => handleToggleSetting("association_leadership", settings?.association_leadership ?? true)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                        settings?.association_leadership ?? true ? "bg-blue-600" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings?.association_leadership ?? true ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

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
                          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Send Email</div>
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
                  <ApplicationsTable
                    applications={filteredApplications}
                    loading={applicationsLoading}
                    isAdmin={isAdmin}
                    onAction={handleAction}
                    processingIds={processingIds}
                  />
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
  processingIds,
}: {
  applications: LeadershipApplication[];
  loading: boolean;
  isAdmin: boolean;
  onAction: (action: "approve" | "reject" | "delete", id: number, type: "chapter" | "association") => Promise<void>;
  processingIds: Set<number>;
}) {
  if (loading) {
    return (
      <Table className="min-w-full">
        <TableHeader className="bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10">
          <TableRow className="border-b border-gray-200 dark:border-gray-700">
            <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">SAP ID</TableCell>
            <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">Name</TableCell>
            <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 hidden lg:table-cell">Email</TableCell>
            <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">Type</TableCell>
            <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">Position</TableCell>
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
          <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">SAP ID</TableCell>
          <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">Name</TableCell>
          <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 hidden lg:table-cell">Email</TableCell>
          <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">Type</TableCell>
          <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">Position</TableCell>
          {isAdmin && (
            <TableCell className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 sticky right-0 bg-gray-50 dark:bg-gray-900/50">Actions</TableCell>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {applications.map((app) => (
          <TableRow key={`${app.type}-${app.id}`} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
            <TableCell className="px-4 py-3 text-sm">
              <span className="font-mono text-xs">{app.sapId}</span>
            </TableCell>
            <TableCell className="px-4 py-3 text-sm">
              <span className="font-medium">{app.name || "-"}</span>
              <a href={app.email ? `mailto:${app.email}` : "#"} className="lg:hidden block text-xs text-blue-600 truncate">{app.email || ""}</a>
            </TableCell>
            <TableCell className="px-4 py-3 text-sm hidden lg:table-cell">
              <a href={app.email ? `mailto:${app.email}` : "#"} className="text-blue-600 hover:underline truncate block">{app.email || "-"}</a>
            </TableCell>
            <TableCell className="px-4 py-3 text-sm">{app.type === "chapter" ? "Chapter" : "Association"}</TableCell>
            <TableCell className="px-4 py-3 text-sm truncate">{app.position}</TableCell>
            {isAdmin && (
              <TableCell className="px-4 py-3 text-right sticky right-0 bg-white dark:bg-gray-800">
                <div className="inline-flex gap-1">
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
            <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">SAP ID</TableCell>
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
          <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">SAP ID</TableCell>
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
                <span className="font-mono text-xs">{member.sapId}</span>
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
                    <AlumniExpandableDetails sapId={member.sapId} onClose={() => onExpand(null)} />
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
