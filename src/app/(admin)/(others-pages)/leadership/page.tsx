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

  // Export to Excel function - comprehensive export with ALL fields
  const handleExport = async () => {
    try {
      // Dynamically import xlsx to avoid server-side bundling issues
      const XLSX = await import("xlsx");
      
      // Determine export type
      let exportType = "all";
      let status = "all";
      let filename = "leadership_export";
      
      if (selectedTab === "chapterMembers") {
        exportType = "chapter";
        status = "approved";
        filename = "chapter_leadership_members_export";
      } else if (selectedTab === "associationMembers") {
        exportType = "association";
        status = "approved";
        filename = "association_leadership_members_export";
      } else if (selectedTab === "applications") {
        exportType = "all";
        status = "pending";
        filename = "leadership_applications_export";
      }

      // Fetch comprehensive data from export endpoint
      const url = new URL("/api/leadership/export", typeof window !== "undefined" ? window.location.origin : "");
      url.searchParams.set("type", exportType);
      url.searchParams.set("status", status);
      
      const res = await fetch(url.toString(), {
        headers: { "accept": "application/json" }
      });
      
      if (!res.ok) {
        throw new Error(`Failed to fetch export data: ${res.status}`);
      }
      
      const data = await res.json();
      const allItems = data.items || [];

      // Helper function to format chapter names
      const formatChapters = (item: Record<string, unknown>) => {
        const chapters: string[] = [];
        const chapter1 = String(item.chapter1_national || item.chapter1_international || "");
        const chapter2 = String(item.chapter2_national || item.chapter2_international || "");
        const chapter3 = String(item.chapter3_national || item.chapter3_international || "");
        if (chapter1) chapters.push(chapter1);
        if (chapter2) chapters.push(chapter2);
        if (chapter3) chapters.push(chapter3);
        return chapters.filter(c => c).join(", ") || "";
      };

      // Map ALL fields to Excel format
      const excelData = allItems.map((item: Record<string, unknown>) => {
        const baseFields = {
          // Leadership Information
          "Leadership Type": item.leadership_type || "",
          "Leadership ID": item.id || "",
          "Leadership Status": item.status || "",
          "Leadership Rejection Reason": item.rejection_reason || "",
          "Leadership Created At": item.created_at || item.createddatetime || "",
          "Leadership Updated At": item.updated_at || "",
          
          // Position/Role
          "Position": item.post || item.q3 || "",
          
          // Basic Information
          "Alumni ID": item.alumniid || "",
          "SAP ID": item.sapid || "",
          "Registration No": item.registrationno || "",
          "Alumni Email": item.alumniemail || "",
          "Full Name": item.alumniname || "",
          "Gender": item.gender || "",
          "Father Name": item.fathername || "",
          "Father CNIC": item.father_cnic || "",
          "Date of Birth": item.dateofbirth || "",
          "Marital Status": item.maritalstatus || "",
          "CNIC/Passport": item.cnicpassport || "",
          
          // Contact Information
          "Contact No": item.contactno || "",
          "Contact No 1": item.contactno1 || "",
          "Contact No 1 Show": item.contactno1show || "",
          "Personal Email": item.personalemail || "",
          "Personal Email Show": item.personalemailshow || "",
          "University Email": item.universityemail || "",
          "Official Email": item.officialemail || "",
          "Official Number": item.officialnumber || "",
          "Address": item.address || "",
          "Country": item.country || "",
          "Province": item.province || "",
          "City": item.city || "",
          
          // Academic Information
          "Academic Session": item.academicsession || "",
          "Degree Title": item.degreetitle || "",
          "CGPA": item.cgpa || "",
          "Year of Starting": item.yearofstarting || "",
          "Year of Ending": item.yearofending || "",
          "Faculty": item.facultyname || "",
          "Campus": item.campusname || "",
          "Department": item.departmentname || "",
          "Major Subject": item.majorsubject || "",
          
          // Professional Information
          "Industry": item.industry || "",
          "Employment Status": item.employeed || "",
          "Organization": item.nameoforganization || "",
          "Designation": item.designation || "",
          "Total Years of Experience": item.totalyearsofexpereince || "",
          "Work City": item.work_city || "",
          "Work Country": item.work_country || "",
          "Organization Address": item.organization_address || "",
          "Supervisor Designation": item.supervisordesignation || "",
          "Supervisor Number": item.supervisornumber || "",
          
          // Chapters
          "Chapter 1 ID": item.chapter1_id || "",
          "Chapter 1": item.chapter1_national || item.chapter1_international || "",
          "Chapter 2 ID": item.chapter2_id || "",
          "Chapter 2": item.chapter2_national || item.chapter2_international || "",
          "Chapter 3 ID": item.chapter3_id || "",
          "Chapter 3": item.chapter3_national || item.chapter3_international || "",
          "All Chapters": formatChapters(item),
          "Chapter Remarks": item.chapter_remarks || "",
          
          // Association
          "Association ID": item.association_id_value || "",
          "Association Title": item.association_title || "",
          "Association Description": item.association_description || "",
          "Association Dean": item.association_dean || "",
          "Association Phone": item.association_phone || "",
          "Association Email": item.association_email || "",
          "Association Address": item.association_address || "",
        };

        return baseFields;
      });

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths for all columns (auto-width for comprehensive export)
      const colWidths = Object.keys(excelData[0] || {}).map(() => ({ wch: 20 }));
      ws["!cols"] = colWidths;

      // Add worksheet to workbook
      const sheetName = selectedTab === "chapterMembers" ? "Chapter Leadership" : selectedTab === "associationMembers" ? "Association Leadership" : "Applications";
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      // Generate filename with current date
      const dateStr = new Date().toISOString().split("T")[0];
      const finalFilename = `${filename}_${dateStr}.xlsx`;

      // Write and download
      XLSX.writeFile(wb, finalFilename);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data. Please try again.");
    }
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
                aria-label="Export to Excel"
              >
                <DownloadIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Export Excel</span>
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
            <div className="max-w-full overflow-x-auto custom-scrollbar max-h-[750px] overflow-y-auto relative">
              <div className="min-w-[800px]">
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
      <Table className="min-w-full">
        <TableHeader className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-900/80 dark:to-gray-900/50 sticky top-0 z-10 backdrop-blur-sm">
          <TableRow className="border-b-2 border-gray-200 dark:border-gray-700">
            {isAdmin && (
              <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[50px]">
                {null}
              </TableCell>
            )}
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px]">SAP ID</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[150px]">Name</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[180px] hidden lg:table-cell">Email</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px] hidden md:table-cell">Faculty</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px] hidden md:table-cell">Department</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[150px]">Type</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px]">Position</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px]">Applied At</TableCell>
            {isAdmin && (
              <TableCell className="px-3 sm:px-6 py-4 text-right text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[200px] sticky right-0 bg-gradient-to-r from-transparent via-gray-50/95 to-gray-50 dark:via-gray-900/95 dark:to-gray-900/50 backdrop-blur-sm z-20">Actions</TableCell>
            )}
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-gray-100 dark:divide-gray-800/50">
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={`skeleton-${i}`} className="bg-white dark:bg-gray-800/30">
              {isAdmin && (
                <TableCell className="px-3 sm:px-6 py-5"><div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
              )}
              <TableCell className="px-3 sm:px-6 py-5"><div className="h-5 w-24 sm:w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" /></TableCell>
              <TableCell className="px-3 sm:px-6 py-5"><div className="h-5 w-32 sm:w-48 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" /></TableCell>
              <TableCell className="px-3 sm:px-6 py-5 hidden lg:table-cell"><div className="h-5 w-32 sm:w-40 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" /></TableCell>
              <TableCell className="px-3 sm:px-6 py-5 hidden md:table-cell"><div className="h-5 w-28 sm:w-36 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" /></TableCell>
              <TableCell className="px-3 sm:px-6 py-5 hidden md:table-cell"><div className="h-5 w-32 sm:w-40 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" /></TableCell>
              <TableCell className="px-3 sm:px-6 py-5"><div className="h-5 w-24 sm:w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" /></TableCell>
              <TableCell className="px-3 sm:px-6 py-5"><div className="h-5 w-20 sm:w-28 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" /></TableCell>
              <TableCell className="px-3 sm:px-6 py-5"><div className="h-5 w-24 sm:w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" /></TableCell>
              {isAdmin && (
                <TableCell className="px-3 sm:px-6 py-5 sticky right-0 bg-white dark:bg-gray-800/30 z-10">
                  <div className="h-9 w-24 sm:w-28 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg ml-auto" />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (applications.length === 0) {
    return (
      <Table className="min-w-full">
        <TableHeader className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-900/80 dark:to-gray-900/50 sticky top-0 z-10 backdrop-blur-sm">
          <TableRow className="border-b-2 border-gray-200 dark:border-gray-700">
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px]">SAP ID</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[150px]">Name</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[180px] hidden lg:table-cell">Email</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px] hidden md:table-cell">Faculty</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px] hidden md:table-cell">Department</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[150px]">Type</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px]">Position</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px]">Applied At</TableCell>
            {isAdmin && (
              <TableCell className="px-3 sm:px-6 py-4 text-right text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[200px] sticky right-0 bg-gradient-to-r from-transparent via-gray-50/95 to-gray-50 dark:via-gray-900/95 dark:to-gray-900/50 backdrop-blur-sm z-20">Actions</TableCell>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={isAdmin ? 10 : 9} className="px-6 py-16 text-center text-gray-500 dark:text-gray-400">
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-base font-semibold text-gray-700 dark:text-gray-300">No applications found</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Try adjusting your search or filters</p>
                </div>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }

  return (
    <Table className="min-w-full">
      <TableHeader className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-900/80 dark:to-gray-900/50 sticky top-0 z-10 backdrop-blur-sm">
        <TableRow className="border-b-2 border-gray-200 dark:border-gray-700">
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px]">
            SAP ID
          </TableCell>
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[150px]">
            Name
          </TableCell>
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[180px] hidden lg:table-cell">
            Email
          </TableCell>
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px] hidden md:table-cell">
            Faculty
          </TableCell>
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px] hidden md:table-cell">
            Department
          </TableCell>
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[150px]">
            Type
          </TableCell>
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px]">
            Position
          </TableCell>
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px]">
            Applied At
          </TableCell>
          {isAdmin && (
            <TableCell className="px-3 sm:px-6 py-4 text-right text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[200px] sticky right-0 bg-gradient-to-r from-transparent via-gray-50/95 to-gray-50 dark:via-gray-900/95 dark:to-gray-900/50 backdrop-blur-sm z-20">
              Actions
            </TableCell>
          )}
        </TableRow>
      </TableHeader>
      <TableBody className="divide-y divide-gray-100 dark:divide-gray-800/50">
        {applications.map((app) => (
          <TableRow key={`${app.type}-${app.id}`} className="hover:bg-blue-50/60 dark:hover:bg-white/[0.05] transition-all duration-200 odd:bg-white even:bg-gray-50/30 dark:odd:bg-gray-800/30 dark:even:bg-gray-800/20">
            {isAdmin && (
              <TableCell className="px-3 sm:px-6 py-5 text-start">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Applications don't have expand functionality, but keeping structure consistent
                  }}
                  className="flex items-center justify-center w-6 h-6 rounded transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 opacity-50 cursor-not-allowed"
                  aria-label="Expand details"
                  title="Expand details"
                  disabled
                >
                  <PlusIcon className="w-4 h-4" />
                </button>
              </TableCell>
            )}
            <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 font-mono text-xs whitespace-nowrap">
              <span className="truncate block max-w-[120px] sm:max-w-none">{app.sapId}</span>
            </TableCell>
            <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300">
              <span className="block font-semibold text-gray-900 text-sm dark:text-gray-100 truncate max-w-[150px] sm:max-w-none">{app.name || "-"}</span>
              {/* Show email on small screens when hidden in table */}
              <a 
                href={app.email ? `mailto:${app.email}` : "#"} 
                className={`lg:hidden text-xs ${app.email ? "text-blue-600 hover:text-blue-700 hover:underline font-medium transition-colors truncate" : "text-gray-400"}`}
              >
                {app.email || ""}
              </a>
            </TableCell>
            <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden lg:table-cell">
              <a 
                href={app.email ? `mailto:${app.email}` : "#"} 
                className={`${app.email ? "text-blue-600 hover:text-blue-700 hover:underline font-medium transition-colors truncate block max-w-[180px]" : "text-gray-400"}`}
              >
                {app.email || "-"}
              </a>
            </TableCell>
            <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden md:table-cell">
              <span className="truncate block max-w-[120px]">{app.faculty || "-"}</span>
            </TableCell>
            <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden md:table-cell">
              <span className="truncate block max-w-[120px]">{app.department || "-"}</span>
            </TableCell>
            <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 whitespace-nowrap">
              {app.type === "chapter" ? "Chapter Leadership" : "Association Leadership"}
            </TableCell>
            <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300">
              <span className="truncate block max-w-[120px]">{app.position}</span>
            </TableCell>
            <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 whitespace-nowrap">
              {new Date(app.createdAt).toLocaleDateString()}
            </TableCell>
            {isAdmin && (
              <TableCell className={`px-3 sm:px-6 py-5 text-end sticky right-0 z-10 bg-white dark:bg-gray-800/30`}>
                <div role="group" aria-label="Row actions" className="inline-flex items-center gap-1.5 sm:gap-2.5 flex-wrap justify-end">
                  <button
                    onClick={() => onAction("approve", app.id, app.type)}
                    disabled={processingIds.has(app.id)}
                    className="p-1.5 sm:p-2 rounded-lg text-gray-500 dark:text-gray-400 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Approve"
                    title="Approve"
                  >
                    <CheckLineIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                  <button
                    onClick={() => onAction("reject", app.id, app.type)}
                    disabled={processingIds.has(app.id)}
                    className="p-1.5 sm:p-2 rounded-lg text-gray-500 dark:text-gray-400 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Reject"
                    title="Reject"
                  >
                    <CloseLineIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                  <button
                    onClick={() => onAction("delete", app.id, app.type)}
                    disabled={processingIds.has(app.id)}
                    className="p-1.5 sm:p-2 rounded-lg text-gray-500 dark:text-gray-400 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Delete"
                    title="Delete"
                  >
                    <TrashBinIcon className="h-4 w-4 sm:h-5 sm:w-5" />
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
      <Table className="min-w-full">
        <TableHeader className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-900/80 dark:to-gray-900/50 sticky top-0 z-10 backdrop-blur-sm">
          <TableRow className="border-b-2 border-gray-200 dark:border-gray-700">
            {isAdmin && (
              <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[50px]">
                {null}
              </TableCell>
            )}
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px]">SAP ID</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[150px]">Name</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[180px] hidden lg:table-cell">Email</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px] hidden md:table-cell">Faculty</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px] hidden md:table-cell">Department</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[150px] hidden md:table-cell">Program</TableCell>
            {type === "chapter" && (
              <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[150px]">Chapters</TableCell>
            )}
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px]">Position</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px]">Joined At</TableCell>
            {isAdmin && (
              <TableCell className="px-3 sm:px-6 py-4 text-right text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[200px] sticky right-0 bg-gradient-to-r from-transparent via-gray-50/95 to-gray-50 dark:via-gray-900/95 dark:to-gray-900/50 backdrop-blur-sm z-20">Actions</TableCell>
            )}
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-gray-100 dark:divide-gray-800/50">
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={`skeleton-${i}`} className="bg-white dark:bg-gray-800/30">
              {isAdmin && (
                <TableCell className="px-3 sm:px-6 py-5"><div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
              )}
              <TableCell className="px-3 sm:px-6 py-5"><div className="h-5 w-24 sm:w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" /></TableCell>
              <TableCell className="px-3 sm:px-6 py-5"><div className="h-5 w-32 sm:w-48 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" /></TableCell>
              <TableCell className="px-3 sm:px-6 py-5 hidden lg:table-cell"><div className="h-5 w-32 sm:w-40 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" /></TableCell>
              <TableCell className="px-3 sm:px-6 py-5 hidden md:table-cell"><div className="h-5 w-28 sm:w-36 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" /></TableCell>
              <TableCell className="px-3 sm:px-6 py-5 hidden md:table-cell"><div className="h-5 w-32 sm:w-40 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" /></TableCell>
              <TableCell className="px-3 sm:px-6 py-5 hidden md:table-cell"><div className="h-5 w-36 sm:w-44 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" /></TableCell>
              {type === "chapter" && (
                <TableCell className="px-3 sm:px-6 py-5"><div className="h-5 w-32 sm:w-40 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" /></TableCell>
              )}
              <TableCell className="px-3 sm:px-6 py-5"><div className="h-5 w-20 sm:w-28 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" /></TableCell>
              <TableCell className="px-3 sm:px-6 py-5"><div className="h-5 w-24 sm:w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" /></TableCell>
              {isAdmin && (
                <TableCell className="px-3 sm:px-6 py-5 sticky right-0 bg-white dark:bg-gray-800/30 z-10">
                  <div className="h-9 w-24 sm:w-28 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg ml-auto" />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (members.length === 0) {
    const colCount = type === "chapter" ? (isAdmin ? 11 : 9) : (isAdmin ? 10 : 8);
    return (
      <Table className="min-w-full">
        <TableHeader className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-900/80 dark:to-gray-900/50 sticky top-0 z-10 backdrop-blur-sm">
          <TableRow className="border-b-2 border-gray-200 dark:border-gray-700">
            {isAdmin && (
              <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[50px]">
                {null}
              </TableCell>
            )}
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px]">SAP ID</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[150px]">Name</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[180px] hidden lg:table-cell">Email</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px] hidden md:table-cell">Faculty</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px] hidden md:table-cell">Department</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[150px] hidden md:table-cell">Program</TableCell>
            {type === "chapter" && (
              <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[150px]">Chapters</TableCell>
            )}
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px]">Position</TableCell>
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px]">Joined At</TableCell>
            {isAdmin && (
              <TableCell className="px-3 sm:px-6 py-4 text-right text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[200px] sticky right-0 bg-gradient-to-r from-transparent via-gray-50/95 to-gray-50 dark:via-gray-900/95 dark:to-gray-900/50 backdrop-blur-sm z-20">Actions</TableCell>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={colCount} className="px-6 py-16 text-center text-gray-500 dark:text-gray-400">
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-base font-semibold text-gray-700 dark:text-gray-300">No members found</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Try adjusting your search or filters</p>
                </div>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }

  return (
    <Table className="min-w-full">
      <TableHeader className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-900/80 dark:to-gray-900/50 sticky top-0 z-10 backdrop-blur-sm">
        <TableRow className="border-b-2 border-gray-200 dark:border-gray-700">
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px]">
            SAP ID
          </TableCell>
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[150px]">
            Name
          </TableCell>
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[180px] hidden lg:table-cell">
            Email
          </TableCell>
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px] hidden md:table-cell">
            Faculty
          </TableCell>
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px] hidden md:table-cell">
            Department
          </TableCell>
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[150px] hidden md:table-cell">
            Program
          </TableCell>
          {type === "chapter" && (
            <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[150px]">
              Chapters
            </TableCell>
          )}
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px]">
            Position
          </TableCell>
          <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px]">
            Joined At
          </TableCell>
          {isAdmin && (
            <TableCell className="px-3 sm:px-6 py-4 text-right text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[200px] sticky right-0 bg-gradient-to-r from-transparent via-gray-50/95 to-gray-50 dark:via-gray-900/95 dark:to-gray-900/50 backdrop-blur-sm z-20">
              Actions
            </TableCell>
          )}
        </TableRow>
      </TableHeader>
      <TableBody className="divide-y divide-gray-100 dark:divide-gray-800/50">
        {members.map((member) => (
          <React.Fragment key={member.id}>
            <TableRow className="hover:bg-blue-50/60 dark:hover:bg-white/[0.05] transition-all duration-200 odd:bg-white even:bg-gray-50/30 dark:odd:bg-gray-800/30 dark:even:bg-gray-800/20">
              {isAdmin && (
                <TableCell className="px-3 sm:px-6 py-5 text-start">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExpand(expandedMemberId === member.id ? null : member.id);
                    }}
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
                </TableCell>
              )}
              <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 font-mono text-xs whitespace-nowrap">
                <span className="truncate block max-w-[120px] sm:max-w-none">{member.sapId}</span>
              </TableCell>
              <TableCell className="px-3 sm:px-6 py-5 text-start">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="block font-semibold text-gray-900 text-sm dark:text-gray-100 truncate max-w-[150px] sm:max-w-none">{member.name || "-"}</span>
                  </div>
                  {/* Show email on small screens when hidden in table */}
                  <a 
                    href={member.email ? `mailto:${member.email}` : "#"} 
                    className={`lg:hidden text-xs ${member.email ? "text-blue-600 hover:text-blue-700 hover:underline font-medium transition-colors truncate" : "text-gray-400"}`}
                  >
                    {member.email || ""}
                  </a>
                  {/* Show faculty, department, and program on small screens when hidden in table */}
                  <div className="md:hidden flex flex-col gap-0.5 text-xs text-gray-600 dark:text-gray-400">
                    {member.faculty && <span className="truncate">{member.faculty}</span>}
                    {member.department && <span className="truncate">{member.department}</span>}
                    {member.program && <span className="truncate">{member.program}</span>}
                  </div>
                </div>
              </TableCell>
              <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden lg:table-cell">
                <a 
                  href={member.email ? `mailto:${member.email}` : "#"} 
                  className={`${member.email ? "text-blue-600 hover:text-blue-700 hover:underline font-medium transition-colors truncate block max-w-[180px]" : "text-gray-400"}`}
                >
                  {member.email || "-"}
                </a>
              </TableCell>
              <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden md:table-cell">
                <span className="truncate block max-w-[120px]">{member.faculty || "-"}</span>
              </TableCell>
              <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden md:table-cell">
                <span className="truncate block max-w-[120px]">{member.department || "-"}</span>
              </TableCell>
              <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden md:table-cell">
                <span className="truncate block max-w-[150px]">{member.program || "-"}</span>
              </TableCell>
              {type === "chapter" && (
                <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 break-words">
                  <span className="truncate block max-w-[150px]">{member.chapters?.join(", ") || "-"}</span>
                </TableCell>
              )}
              <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300">
                <span className="truncate block max-w-[120px]">{member.position}</span>
              </TableCell>
              <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 whitespace-nowrap">
                {new Date(member.createdAt).toLocaleDateString()}
              </TableCell>
              {isAdmin && (
                <TableCell className={`px-3 sm:px-6 py-5 text-end sticky right-0 z-10 bg-white dark:bg-gray-800/30`}>
                  <div role="group" aria-label="Row actions" className="inline-flex items-center gap-1.5 sm:gap-2.5 flex-wrap justify-end">
                    <button
                      onClick={() => onDelete(member.id, type)}
                      disabled={processingIds.has(member.id)}
                      className="p-1.5 sm:p-2 rounded-lg text-gray-500 dark:text-gray-400 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Delete"
                      title="Delete"
                    >
                      <TrashBinIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </button>
                  </div>
                </TableCell>
              )}
            </TableRow>
            {expandedMemberId === member.id && (
              <TableRow className="bg-blue-50/30 dark:bg-blue-900/10">
                <TableCell colSpan={type === "chapter" ? (isAdmin ? 11 : 9) : (isAdmin ? 10 : 8)} className="px-0 py-6">
                  <div className="w-full overflow-x-hidden">
                    <div className="px-3 sm:px-6 w-full max-w-full overflow-x-hidden">
                      <LeadershipMemberDetails sapId={member.sapId} onClose={() => onExpand(null)} />
                    </div>
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
