"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import ComponentCard from "@/components/common/ComponentCard";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TrashBinIcon, CheckLineIcon, CloseLineIcon, DownloadIcon, PlusIcon } from "@/icons";
import { canModify } from "@/lib/alumniProfile";
import toast from "react-hot-toast";
import { AlumniExpandableDetails } from "@/components/alumni/AlumniExpandableDetails";

type TabKey = "chapterMembers" | "associationMembers" | "applications";

const TABS: { key: TabKey; label: string }[] = [
  { key: "chapterMembers", label: "Chapter Leadership Members" },
  { key: "associationMembers", label: "Association Leadership Members" },
  { key: "applications", label: "Leadership Applications" },
];

// Per-tab color classes matching Alumni Tabs styling
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
  chapterMembers: {
    selectedContainer:
      "border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20",
    hoverBorder: "hover:border-blue-400",
    iconBg: "bg-blue-100 dark:bg-blue-800",
    iconColor: "text-blue-700 dark:text-blue-200",
    labelText: "text-blue-600 dark:text-blue-300",
  },
  associationMembers: {
    selectedContainer:
      "border-violet-500 bg-violet-50 dark:border-violet-500 dark:bg-violet-900/20",
    hoverBorder: "hover:border-violet-400",
    iconBg: "bg-violet-100 dark:bg-violet-800",
    iconColor: "text-violet-700 dark:text-violet-200",
    labelText: "text-violet-600 dark:text-violet-300",
  },
  applications: {
    selectedContainer:
      "border-amber-500 bg-amber-50 dark:border-amber-500 dark:bg-amber-900/20",
    hoverBorder: "hover:border-amber-400",
    iconBg: "bg-amber-100 dark:bg-amber-800",
    iconColor: "text-amber-700 dark:text-amber-200",
    labelText: "text-amber-600 dark:text-amber-300",
  },
};

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
    // Return defaults if API fails
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

function exportToCSV(data: Array<Record<string, unknown>>, filename: string) {
  if (data.length === 0) {
    toast.error("No data to export");
    return;
  }

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(","),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return "";
        const stringValue = String(value);
        if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(",")
    ),
  ];

  const csvContent = csvRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function LeadershipPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState<TabKey>("chapterMembers");
  const [searchQuery, setSearchQuery] = useState("");
  const [facultyFilter, setFacultyFilter] = useState("");
  const [chapterFilter, setChapterFilter] = useState("");
  const [applicationTypeFilter, setApplicationTypeFilter] = useState<"all" | "chapter" | "association">("all");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());
  const [expandedMemberId, setExpandedMemberId] = useState<number | null>(null);

  const isAdmin = session?.user ? canModify(session.user) : false;

  // Fetch settings
  const { data: settings, refetch: refetchSettings } = useQuery({
    queryKey: ["leadership-settings"],
    queryFn: fetchSettings,
    staleTime: 0, // Always refetch
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Fetch chapter members
  const { data: chapterMembersData, isLoading: chapterMembersLoading, refetch: refetchChapterMembers } = useQuery({
    queryKey: ["leadership-members", "chapter", searchQuery, facultyFilter, chapterFilter],
    queryFn: () => fetchMembers("chapter", searchQuery || undefined, facultyFilter || undefined, chapterFilter || undefined),
    enabled: selectedTab === "chapterMembers",
    staleTime: 0, // Always refetch
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Fetch association members
  const { data: associationMembersData, isLoading: associationMembersLoading, refetch: refetchAssociationMembers } = useQuery({
    queryKey: ["leadership-members", "association", searchQuery, facultyFilter, chapterFilter],
    queryFn: () => fetchMembers("association", searchQuery || undefined, facultyFilter || undefined, chapterFilter || undefined),
    enabled: selectedTab === "associationMembers",
    staleTime: 0, // Always refetch
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
    staleTime: 0, // Always refetch
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

    if (!confirm("Are you sure you want to delete this leadership member? This action cannot be undone.")) {
      return;
    }

    setProcessingIds(prev => new Set(prev).add(memberId));
    setActionMessage(null);
    setActionError(null);

    try {
      const res = await fetch("/api/leadership/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", applicationId: memberId, type }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete member");
      }

      setActionMessage("Member deleted successfully");
      toast.success("Member deleted successfully");
      
      // Close expanded details if this member was expanded
      if (expandedMemberId === memberId) {
        setExpandedMemberId(null);
      }
      
      // Invalidate and refetch all related queries
      queryClient.invalidateQueries({ queryKey: ["leadership-members"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["leadership-applications"], exact: false });
      await refetchMembers();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to delete member";
      setActionError(msg);
      toast.error(msg);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      });
    }
  };

  const handleAction = async (action: "approve" | "reject" | "delete", applicationId: number, type: "chapter" | "association") => {
    if (!isAdmin) {
      toast.error("Only admins can perform this action");
      return;
    }

    setProcessingIds(prev => new Set(prev).add(applicationId));
    setActionMessage(null);
    setActionError(null);

    try {
      const res = await fetch("/api/leadership/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, applicationId, type }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to perform action");
      }

      setActionMessage(`${action === "approve" ? "Approved" : action === "reject" ? "Rejected" : "Deleted"} successfully`);
      toast.success(`Application ${action}d successfully`);
      
      // Invalidate and refetch all related queries
      queryClient.invalidateQueries({ queryKey: ["leadership-applications"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["leadership-members"], exact: false });
      await refetchApplications();
      await refetchMembers();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to perform action";
      setActionError(msg);
      toast.error(msg);
    } finally {
      setProcessingIds(prev => {
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

  const handleExport = () => {
    let dataToExport: Array<Record<string, unknown>> = [];
    let filename = "";

    if (selectedTab === "chapterMembers" || selectedTab === "associationMembers") {
      dataToExport = (membersData || []).map(m => ({
        "SAP ID": m.sapId,
        "Name": m.name,
        "Email": m.email,
        "Faculty": m.faculty || "",
        "Department": m.department || "",
        "Program": m.program || "",
        "Position": m.position,
        "Chapters": m.chapters?.join("; ") || "",
        "Created At": new Date(m.createdAt).toLocaleDateString(),
      }));
      filename = `${selectedTab === "chapterMembers" ? "chapter" : "association"}_leadership_members_${new Date().toISOString().split("T")[0]}.csv`;
    } else if (selectedTab === "applications") {
      dataToExport = (applicationsData || []).map(a => ({
        "SAP ID": a.sapId,
        "Name": a.name,
        "Email": a.email,
        "Faculty": a.faculty || "",
        "Department": a.department || "",
        "Program": a.program || "",
        "Type": a.type === "chapter" ? "Chapter Leadership" : "Association Leadership",
        "Position": a.position,
        "Applied At": new Date(a.createdAt).toLocaleDateString(),
      }));
      filename = `leadership_applications_${new Date().toISOString().split("T")[0]}.csv`;
    }

    exportToCSV(dataToExport, filename);
  };

  const filteredMembers = useMemo(() => {
    return membersData || [];
  }, [membersData]);

  const filteredApplications = useMemo(() => {
    return applicationsData || [];
  }, [applicationsData]);

  // Get unique faculties for filter
  const uniqueFaculties = useMemo(() => {
    const allData = selectedTab === "applications" ? applicationsData : membersData;
    if (!allData) return [];
    const faculties = new Set<string>();
    allData.forEach(item => {
      if (item.faculty) faculties.add(item.faculty);
    });
    return Array.from(faculties).sort();
  }, [selectedTab, membersData, applicationsData]);

  // Get counts for tabs
  const chapterMembersCount = chapterMembersData?.length || 0;
  const associationMembersCount = associationMembersData?.length || 0;
  const applicationsCount = applicationsData?.length || 0;

  return (
    <ComponentCard className="p-0">
      <div className="flex flex-col gap-8">
        {/* Admin Settings Section */}
        {isAdmin && (
          <div className="px-6 pt-6">
            <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/50 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Form Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <div>
                    <label className="text-sm font-medium text-gray-900 dark:text-gray-100">Chapter Leadership Form</label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Enable/disable chapter leadership applications</p>
                  </div>
                  <button
                    onClick={() => handleToggleSetting("chapter_leadership", settings?.chapter_leadership ?? true)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
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
                <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <div>
                    <label className="text-sm font-medium text-gray-900 dark:text-gray-100">Association Leadership Form</label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Enable/disable association leadership applications</p>
                  </div>
                  <button
                    onClick={() => handleToggleSetting("association_leadership", settings?.association_leadership ?? true)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
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
        )}

        {/* Tabs Section - Matching Alumni Tabs styling */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-6 pt-2">
          {TABS.map((tab, idx) => {
            const isSelected = selectedTab === tab.key;
            const statusStyles = STATUS_CLASS_MAP[tab.key];
            
            const statCount = (() => {
              switch (tab.key) {
                case "chapterMembers":
                  return chapterMembersCount;
                case "associationMembers":
                  return associationMembersCount;
                case "applications":
                  return applicationsCount;
                default:
                  return 0;
              }
            })();

            return (
              <button
                key={tab.key}
                type="button"
                className={`
                  relative group rounded-2xl p-6 text-left transition-all duration-300 ease-out
                  ${isSelected 
                    ? `${statusStyles.selectedContainer} shadow-xl ring-2 ring-offset-2 ${statusStyles.iconColor.includes('blue') ? 'ring-blue-500' : statusStyles.iconColor.includes('violet') ? 'ring-violet-500' : 'ring-amber-500'} dark:ring-offset-gray-900 transform scale-[1.02]` 
                    : 'bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 hover:scale-[1.01]'
                  }
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900
                `}
                onClick={() => {
                  setSelectedTab(tab.key);
                  setSearchQuery("");
                  setFacultyFilter("");
                  setChapterFilter("");
                  setApplicationTypeFilter("all");
                }}
                role="tab"
                aria-selected={isSelected}
                aria-label={`${tab.label} (${statCount.toLocaleString()})`}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight") {
                    e.preventDefault();
                    const nextIdx = (idx + 1) % TABS.length;
                    setSelectedTab(TABS[nextIdx].key);
                  } else if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    const prevIdx = (idx - 1 + TABS.length) % TABS.length;
                    setSelectedTab(TABS[prevIdx].key);
                  } else if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedTab(tab.key);
                  }
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h6 className={`text-xs font-bold uppercase tracking-wider ${statusStyles.labelText}`}>
                    {tab.label}
                  </h6>
                  {isSelected && (
                    <div className={`w-2.5 h-2.5 rounded-full ${statusStyles.iconBg} animate-pulse`} />
                  )}
                </div>
                <h3 className={`text-4xl font-extrabold tracking-tight ${statusStyles.labelText}`}>
                  {statCount.toLocaleString()}
                </h3>
              </button>
            );
          })}
        </div>

        {/* Search and Filters Section - Matching Alumni Tabs styling */}
        <div className="px-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-800/50 dark:to-gray-800/30 rounded-2xl p-5 border border-gray-200/50 dark:border-gray-700/50 shadow-sm">
            <div className="flex-1 w-full sm:max-w-lg">
              <label htmlFor="leadership-search" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2.5 uppercase tracking-wider">
                Search
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <svg 
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    id="leadership-search"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, SAP ID, or registration number..."
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300/80 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:text-gray-100 transition-all duration-200"
                  />
                </div>
                {selectedTab === "applications" && (
                  <div className="relative">
                    <select
                      value={applicationTypeFilter}
                      onChange={(e) => setApplicationTypeFilter(e.target.value as "all" | "chapter" | "association")}
                      className="h-full px-4 py-3 rounded-xl border border-gray-300/80 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 transition-all duration-200 appearance-none cursor-pointer min-w-[180px]"
                    >
                      <option value="all">All Applications</option>
                      <option value="chapter">Chapter Leadership</option>
                      <option value="association">Association Leadership</option>
                    </select>
                    <svg 
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 pointer-events-none" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                )}
                {uniqueFaculties.length > 0 && (
                  <div className="relative">
                    <select
                      value={facultyFilter}
                      onChange={(e) => setFacultyFilter(e.target.value)}
                      className="h-full px-4 py-3 rounded-xl border border-gray-300/80 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 transition-all duration-200 appearance-none cursor-pointer min-w-[140px]"
                    >
                      <option value="">All Faculties</option>
                      {uniqueFaculties.map(faculty => (
                        <option key={faculty} value={faculty}>{faculty}</option>
                      ))}
                    </select>
                    <svg 
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 pointer-events-none" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                )}
                {selectedTab === "chapterMembers" && (
                  <div className="relative">
                    <input
                      type="text"
                      value={chapterFilter}
                      onChange={(e) => setChapterFilter(e.target.value)}
                      placeholder="Filter by chapter..."
                      className="h-full px-4 py-3 rounded-xl border border-gray-300/80 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 placeholder-gray-400 dark:placeholder-gray-500 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 transition-all duration-200 min-w-[150px]"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-green-600 text-white text-xs sm:text-sm font-semibold hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200 shadow-sm hover:shadow-md"
                aria-label="Export to CSV"
              >
                <DownloadIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Export CSV</span>
                <span className="sm:hidden">Export</span>
              </button>
            </div>
          </div>
        </div>

        {/* Action Messages */}
        {actionMessage && (
          <div className="px-6">
            <div className="rounded-xl border border-green-300 bg-green-50 p-3 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
              {actionMessage}
            </div>
          </div>
        )}
        {actionError && (
          <div className="px-6">
            <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
              {actionError}
            </div>
          </div>
        )}

        {/* Table Section - Matching Alumni Tabs styling */}
        <div className="px-3 sm:px-1 pb-8">
          <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-lg dark:border-gray-700/80 dark:bg-gray-800/50">
            <div className="w-full overflow-x-auto custom-scrollbar max-h-[750px] overflow-y-auto">
              <div className="w-full">
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </ComponentCard>
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
      <div className="p-8 text-center text-gray-500">
        <div className="inline-block h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4">Loading applications...</p>
      </div>
    );
  }

  if (applications.length === 0) {
    return <div className="p-8 text-center text-gray-500">No applications found</div>;
  }

  return (
    <Table className="w-full table-auto">
      <TableHeader className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-900/80 dark:to-gray-900/50 sticky top-0 z-10 backdrop-blur-sm">
        <TableRow className="border-b-2 border-gray-200 dark:border-gray-700">
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            SAP ID
          </TableCell>
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Name
          </TableCell>
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Email
          </TableCell>
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Faculty
          </TableCell>
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Department
          </TableCell>
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Type
          </TableCell>
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Position
          </TableCell>
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Applied At
          </TableCell>
          {isAdmin && (
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Actions
            </TableCell>
          )}
        </TableRow>
      </TableHeader>
      <TableBody className="divide-y divide-gray-200 dark:divide-white/[0.06]">
        {applications.map((app) => (
          <TableRow key={`${app.type}-${app.id}`} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
            <TableCell className="px-3 sm:px-6 py-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">{app.sapId}</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-gray-700 dark:text-gray-300">{app.name}</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-gray-700 dark:text-gray-300 break-words">{app.email}</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-gray-700 dark:text-gray-300">{app.faculty || "-"}</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-gray-700 dark:text-gray-300">{app.department || "-"}</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">
              {app.type === "chapter" ? "Chapter Leadership" : "Association Leadership"}
            </TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-gray-700 dark:text-gray-300">{app.position}</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">
              {new Date(app.createdAt).toLocaleDateString()}
            </TableCell>
            {isAdmin && (
              <TableCell className="px-3 sm:px-6 py-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onAction("approve", app.id, app.type)}
                    disabled={processingIds.has(app.id)}
                    className="rounded-lg bg-green-500 p-1.5 text-white hover:bg-green-600 disabled:opacity-50 transition-colors"
                    title="Approve"
                  >
                    <CheckLineIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onAction("reject", app.id, app.type)}
                    disabled={processingIds.has(app.id)}
                    className="rounded-lg bg-yellow-500 p-1.5 text-white hover:bg-yellow-600 disabled:opacity-50 transition-colors"
                    title="Reject"
                  >
                    <CloseLineIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onAction("delete", app.id, app.type)}
                    disabled={processingIds.has(app.id)}
                    className="rounded-lg bg-red-500 p-1.5 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                    title="Delete"
                  >
                    <TrashBinIcon className="w-4 h-4" />
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

// Component to show leadership member details (reuses AlumniExpandableDetails)
function LeadershipMemberDetails({ sapId, onClose }: { sapId: string; onClose: () => void }) {
  return (
    <div className="w-full">
      <AlumniExpandableDetails sapId={sapId} onClose={onClose} />
    </div>
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
      <div className="p-8 text-center text-gray-500">
        <div className="inline-block h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4">Loading members...</p>
      </div>
    );
  }

  if (members.length === 0) {
    return <div className="p-8 text-center text-gray-500">No members found</div>;
  }

  return (
    <Table className="w-full table-auto">
      <TableHeader className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-900/80 dark:to-gray-900/50 sticky top-0 z-10 backdrop-blur-sm">
        <TableRow className="border-b-2 border-gray-200 dark:border-gray-700">
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            SAP ID
          </TableCell>
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Name
          </TableCell>
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Email
          </TableCell>
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Faculty
          </TableCell>
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Department
          </TableCell>
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Program
          </TableCell>
          {type === "chapter" && (
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Chapters
            </TableCell>
          )}
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Position
          </TableCell>
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Joined At
          </TableCell>
          {isAdmin && (
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Actions
            </TableCell>
          )}
        </TableRow>
      </TableHeader>
      <TableBody className="divide-y divide-gray-200 dark:divide-white/[0.06]">
        {members.map((member) => (
          <React.Fragment key={member.id}>
            <TableRow className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
              <TableCell className="px-3 sm:px-6 py-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">{member.sapId}</TableCell>
              <TableCell className="px-3 sm:px-6 py-4 text-gray-700 dark:text-gray-300">{member.name}</TableCell>
              <TableCell className="px-3 sm:px-6 py-4 text-gray-700 dark:text-gray-300 break-words">{member.email}</TableCell>
              <TableCell className="px-3 sm:px-6 py-4 text-gray-700 dark:text-gray-300">{member.faculty || "-"}</TableCell>
              <TableCell className="px-3 sm:px-6 py-4 text-gray-700 dark:text-gray-300">{member.department || "-"}</TableCell>
              <TableCell className="px-3 sm:px-6 py-4 text-gray-700 dark:text-gray-300">{member.program || "-"}</TableCell>
              {type === "chapter" && (
                <TableCell className="px-3 sm:px-6 py-4 text-gray-700 dark:text-gray-300 break-words">
                  {member.chapters?.join(", ") || "-"}
                </TableCell>
              )}
              <TableCell className="px-3 sm:px-6 py-4 text-gray-700 dark:text-gray-300">{member.position}</TableCell>
              <TableCell className="px-3 sm:px-6 py-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                {new Date(member.createdAt).toLocaleDateString()}
              </TableCell>
              {isAdmin && (
                <TableCell className="px-3 sm:px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onExpand(expandedMemberId === member.id ? null : member.id)}
                      className={`flex items-center justify-center w-6 h-6 rounded transition-colors ${
                        expandedMemberId === member.id
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
                      }`}
                      aria-label={expandedMemberId === member.id ? "Collapse details" : "Expand details"}
                      title={expandedMemberId === member.id ? "Collapse details" : "Expand details"}
                    >
                      <PlusIcon className={`w-4 h-4 transition-transform ${expandedMemberId === member.id ? "rotate-45" : ""}`} />
                    </button>
                    <button
                      onClick={() => onDelete(member.id, type)}
                      disabled={processingIds.has(member.id)}
                      className="rounded-lg bg-red-500 p-1.5 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                      title="Delete"
                    >
                      <TrashBinIcon className="w-4 h-4" />
                    </button>
                  </div>
                </TableCell>
              )}
            </TableRow>
            {expandedMemberId === member.id && (
              <TableRow className="bg-blue-50/30 dark:bg-blue-900/10">
                <TableCell colSpan={type === "chapter" ? 10 : 9} className="px-3 sm:px-6 py-6">
                  <LeadershipMemberDetails sapId={member.sapId} onClose={() => onExpand(null)} />
                </TableCell>
              </TableRow>
            )}
          </React.Fragment>
        ))}
      </TableBody>
    </Table>
  );
}
