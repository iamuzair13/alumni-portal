"use client";
import React, { useState, useMemo, useEffect } from "react";
import ComponentCard from "@/components/common/ComponentCard";
import { LockIcon, EyeIcon, CheckLineIcon, BoltIcon, TimeIcon, GroupIcon, FileIcon, AlertIcon } from "@/icons";
import { AlumniDataTable } from "./AlumniCard";
import { useCardApplicants, type CardStatusFilter, type CardApplicant, type OverdueType } from "@/app/queries/fetch-card-applicants";
import { useUpdateApplicantStatus } from "@/app/queries/fetch-card-applicants";
import toast from "react-hot-toast";
import { 
  type CardStatus,
  type DbCardStatus,
  CARD_STATUS_CONFIG, 
  mapDbStatusToUI, 
  getStatusLabel 
} from "@/lib/card-status-config";

/**
 * AlumniCards
 * Responsive card-based listing for alumni cards, organized by status.
 * Uses TanStack Query for data fetching with real-time counters.
 */

type AlumniCardItem = {
  id: string;
  name: string;
  email?: string;
  program: string;
  campus: string;
  faculty: string;
  passingYear: number;
  workCountry: string;
  status: CardStatus;
  createdAt: string;
  registrationno?: string | null;
};

type ActionKey = "view" | "verify" | "decline" | "suspend" | "delete";
type ActionDef = {
  key: ActionKey;
  label: string;
  icon: React.FC<{ className?: string }>;
  hoverClass?: string;
};

type AlumniCardsProps = {
  initialStatus?: CardStatus;
  pageSize?: number;
};

// Use centralized mapDbStatusToUI from card-status-config

// Convert CardApplicant to AlumniCardItem
function convertToAlumniCardItem(applicant: CardApplicant): AlumniCardItem & { department: string } {
  // Normalize identifiers: prefer SAP ID when present and valid, otherwise fall back to registration number
  const rawSapid = applicant.sapid ? String(applicant.sapid).trim() : "";
  const normalizedSapid = rawSapid.toLowerCase() === "null" ? "" : rawSapid;
  const rawRegNo = applicant.registrationno ? String(applicant.registrationno).trim() : "";
  const effectiveId = normalizedSapid || rawRegNo || "";

  return {
    id: effectiveId,
    name: applicant.alumniname || "Unknown",
    email: applicant.email || undefined,
    program: applicant.degreetitle || "N/A",
    campus: "N/A", // Not available in API response
    faculty: applicant.facultyname || "N/A",
    department: applicant.departmentname || "N/A",
    passingYear: applicant.yearofending || 0,
    workCountry: "N/A", // Not available in API response
    status: mapDbStatusToUI(applicant.status),
    createdAt: applicant.createdat || new Date().toISOString(),
    registrationno: rawRegNo || null,
  };
}

export function getActionsForStatus(status: CardStatus): ActionDef[] {
  // All statuses have view action
  return [
    { key: "view", label: "View", icon: EyeIcon, hoverClass: "hover:text-blue-600" },
  ];
}

// Color mapping for status tabs
const STATUS_TAB_COLORS: Record<CardStatus | "overdue", {
  border: string;
  bg: string;
  text: string;
  badgeBg: string;
  badgeText: string;
  hoverBorder: string;
}> = {
  all: {
    border: "border-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    text: "text-blue-700 dark:text-blue-300",
    badgeBg: "bg-blue-200 dark:bg-blue-800",
    badgeText: "text-blue-800 dark:text-blue-200",
    hoverBorder: "hover:border-blue-400",
  },
  "under-review": {
    border: "border-amber-500",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-700 dark:text-amber-300",
    badgeBg: "bg-amber-200 dark:bg-amber-800",
    badgeText: "text-amber-800 dark:text-amber-200",
    hoverBorder: "hover:border-amber-400",
  },
  underprinting: {
    border: "border-purple-500",
    bg: "bg-purple-50 dark:bg-purple-900/20",
    text: "text-purple-700 dark:text-purple-300",
    badgeBg: "bg-purple-200 dark:bg-purple-800",
    badgeText: "text-purple-800 dark:text-purple-200",
    hoverBorder: "hover:border-purple-400",
  },
  active: {
    border: "border-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    text: "text-emerald-700 dark:text-emerald-300",
    badgeBg: "bg-emerald-200 dark:bg-emerald-800",
    badgeText: "text-emerald-800 dark:text-emerald-200",
    hoverBorder: "hover:border-emerald-400",
  },
  delivered: {
    border: "border-green-500",
    bg: "bg-green-50 dark:bg-green-900/20",
    text: "text-green-700 dark:text-green-300",
    badgeBg: "bg-green-200 dark:bg-green-800",
    badgeText: "text-green-800 dark:text-green-200",
    hoverBorder: "hover:border-green-400",
  },
  onhold: {
    border: "border-rose-500",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    text: "text-rose-700 dark:text-rose-300",
    badgeBg: "bg-rose-200 dark:bg-rose-800",
    badgeText: "text-rose-800 dark:text-rose-200",
    hoverBorder: "hover:border-rose-400",
  },
  overdue: {
    border: "border-red-500",
    bg: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-700 dark:text-red-300",
    badgeBg: "bg-red-200 dark:bg-red-800",
    badgeText: "text-red-800 dark:text-red-200",
    hoverBorder: "hover:border-red-400",
  },
};

const STATUS_TABS: { key: CardStatus | "overdue"; label: string; icon: React.FC<{ className?: string }> }[] = [
  { key: "all", label: CARD_STATUS_CONFIG["all"].label, icon: GroupIcon },
  { key: "under-review", label: CARD_STATUS_CONFIG["under-review"].label, icon: TimeIcon },
  { key: "underprinting", label: CARD_STATUS_CONFIG["underprinting"].label, icon: FileIcon },
  { key: "active", label: CARD_STATUS_CONFIG["active"].label, icon: CheckLineIcon },
  { key: "onhold", label: CARD_STATUS_CONFIG["onhold"].label, icon: LockIcon },
  { key: "delivered", label: CARD_STATUS_CONFIG["delivered"].label, icon: CheckLineIcon },
  { key: "overdue", label: "Over Due", icon: AlertIcon },
];

export const AlumniCards: React.FC<AlumniCardsProps> = ({ initialStatus = "all", pageSize = 12 }) => {
  const [selectedStatus, setSelectedStatus] = useState<CardStatusFilter>(initialStatus as CardStatusFilter);
  const [selectedOverdueType, setSelectedOverdueType] = useState<OverdueType>("under-review");
  
  // Fetch cards for selected status - this also returns counts
  const { data, isLoading, isError, error } = useCardApplicants(
    selectedStatus,
    selectedStatus === "overdue" ? { overdueType: selectedOverdueType } : undefined
  );
  
  // Fetch counts separately to ensure we always have them (even when switching tabs)
  const { data: countsData, isLoading: countsLoading } = useCardApplicants("all");
  
  // All tabs are visible to all users
  const visibleTabs = useMemo(() => {
    return STATUS_TABS;
  }, []);
  
  // Use counts from the "all" query, fallback to data counts if available, or default to 0
  const counts = useMemo(() => {
    const countsFromAll = countsData?.counts;
    const countsFromData = data?.counts;
    
    // Prefer counts from "all" query as it's always accurate
    if (countsFromAll) {
      return countsFromAll;
    }
    if (countsFromData) {
      return countsFromData;
    }
    return { 
      all: 0, 
      "under-review": 0, 
      underprinting: 0, 
      active: 0, 
      onhold: 0, 
      delivered: 0,
      "overdue-under-review": 0,
      "overdue-under-printing": 0,
    };
  }, [countsData, data]);
  
  // Debug: Log counts to console (remove in production if needed)
  useEffect(() => {
    if (countsData || data) {

    }
  }, [countsData, data, counts]);
  
  // Update status mutation
  const updateStatusMutation = useUpdateApplicantStatus();

  // Convert API data to component format
  const cards = useMemo(() => {
    if (!data?.items) return [];
    return data.items.map(convertToAlumniCardItem).map((item) => ({
      ...item,
      mobile: undefined,
      verified: item.status === "active" || item.status === "delivered",
      organization: undefined,
      designation: undefined,
      workCity: undefined,
    }));
  }, [data]);

  const handleAction = async (alumni: AlumniCardItem, key: ActionKey) => {
    try {
      if (key === "view") {
        // Navigate to profile or show details
        window.location.href = `/alumni-profile?sapid=${encodeURIComponent(alumni.id)}`;
        return;
      }

      if (key === "delete") {
        // RowActions in AlumniCard.tsx already performed the delete.
        // Just show a success toast and let React Query refresh the list.
        toast.success("Alumni card deleted successfully");
        return;
      }

      // Handle status updates using centralized status config
      // Database values: "UnderReview", "UnderPrinting", "Active", "Onhold", "Delivered"
      let newDbStatus: DbCardStatus | null = null;
      
      if (key === "verify") {
        // Map UI status to next status in workflow
        if (alumni.status === "under-review") {
          newDbStatus = "UnderPrinting";
        } else if (alumni.status === "underprinting") {
          newDbStatus = "Active";
        } else if (alumni.status === "active") {
          newDbStatus = "Delivered";
        }
      }

      if (newDbStatus) {
        await updateStatusMutation.mutateAsync({
          sapId: alumni.id,
          status: newDbStatus,
        });
        toast.success("Status updated successfully");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to update status";
      toast.error(errorMsg);
    }
  };

  const total = cards.length;
  const loading = isLoading;

  return (
    <ComponentCard className="p-0">
      <div className="flex flex-col gap-6">
        {/* Tabs with Counters */}
        <div className="px-6 pt-6">
          <div className="flex flex-wrap gap-3 lg:gap-4" role="tablist" aria-label="Card status tabs">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              // Get count based on tab key
              let count = 0;
              if (tab.key === "all") {
                count = counts.all || 0;
              } else if (tab.key === "under-review") {
                count = counts["under-review"] || 0;
              } else if (tab.key === "underprinting") {
                count = counts.underprinting || 0;
              } else if (tab.key === "active") {
                count = counts.active || 0;
              } else if (tab.key === "delivered") {
                count = counts.delivered || 0;
              } else if (tab.key === "onhold") {
                count = counts.onhold || 0;
              } else if (tab.key === "overdue") {
                // For overdue tab, show total of both overdue types
                count = (counts["overdue-under-review"] || 0) + (counts["overdue-under-printing"] || 0);
              }
              const isSelected = selectedStatus === tab.key;
              const colors = tab.key === "overdue" ? STATUS_TAB_COLORS.overdue : STATUS_TAB_COLORS[tab.key as CardStatus];
              
              return (
                <button
                  key={tab.key}
                  className={`rounded-xl border px-4 py-2.5 cursor-pointer transform scale-100 transform-gpu transition-all duration-300 ease-in-out hover:scale-[1.02] hover:shadow-sm flex items-center gap-2 ${
                    isSelected
                      ? `${colors.border} ${colors.bg} ${colors.text} shadow-md`
                      : `border-gray-300 bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:opacity-100 ${colors.hoverBorder}`
                  }`}
                  onClick={() => {
                    if (tab.key === "overdue") {
                      setSelectedStatus("overdue");
                      // Reset to "under-review" when switching to overdue tab
                      setSelectedOverdueType("under-review");
                    } else {
                      setSelectedStatus(tab.key as CardStatusFilter);
                    }
                  }}
                  role="tab"
                  aria-selected={isSelected}
                  tabIndex={0}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{tab.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    isSelected
                      ? `${colors.badgeBg} ${colors.badgeText}`
                      : `bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300`
                  }`}>
                    {countsLoading || isLoading ? "..." : count.toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Overdue Sub-tabs */}
        {selectedStatus === "overdue" && (
          <div className="px-6">
            <div className="flex flex-wrap gap-3 lg:gap-4" role="tablist" aria-label="Overdue type tabs">
              <button
                className={`rounded-xl border px-4 py-2.5 cursor-pointer transform scale-100 transform-gpu transition-all duration-300 ease-in-out hover:scale-[1.02] hover:shadow-sm flex items-center gap-2 ${
                  selectedOverdueType === "under-review"
                    ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 shadow-md"
                    : "border-gray-300 bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:border-amber-400"
                }`}
                onClick={() => setSelectedOverdueType("under-review")}
                role="tab"
                aria-selected={selectedOverdueType === "under-review"}
              >
                <TimeIcon className="w-4 h-4" />
                <span className="font-medium">Under Review</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  selectedOverdueType === "under-review"
                    ? "bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                }`}>
                  {countsLoading || isLoading ? "..." : (counts["overdue-under-review"] || 0).toLocaleString()}
                </span>
              </button>
              <button
                className={`rounded-xl border px-4 py-2.5 cursor-pointer transform scale-100 transform-gpu transition-all duration-300 ease-in-out hover:scale-[1.02] hover:shadow-sm flex items-center gap-2 ${
                  selectedOverdueType === "under-printing"
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 shadow-md"
                    : "border-gray-300 bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:border-purple-400"
                }`}
                onClick={() => setSelectedOverdueType("under-printing")}
                role="tab"
                aria-selected={selectedOverdueType === "under-printing"}
              >
                <FileIcon className="w-4 h-4" />
                <span className="font-medium">Under Printing</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  selectedOverdueType === "under-printing"
                    ? "bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                }`}>
                  {countsLoading || isLoading ? "..." : (counts["overdue-under-printing"] || 0).toLocaleString()}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="px-6 pb-8">
          <div className="min-h-[200px]">
            {isError && (
              <div role="alert" className="rounded-xl border border-red-200/80 bg-red-50/80 dark:bg-red-900/20 dark:border-red-800/50 px-4 py-3 text-sm font-medium text-red-800 dark:text-red-200 shadow-sm mb-4">
                {error instanceof Error ? error.message : "Failed to load alumni cards"}
              </div>
            )}

            {loading ? (
              <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-lg dark:border-gray-700/80 dark:bg-gray-800/50">
                <div className="p-6">
                  <div className="grid grid-cols-1 gap-4">
                    {Array.from({ length: Math.min(pageSize, 5) }).map((_, i) => (
                      <div key={i} className="animate-pulse rounded-xl border border-gray-200 p-4 bg-gray-50 dark:bg-gray-800/30">
                        <div className="h-5 w-2/3 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
                        <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                        <div className="h-4 w-1/3 bg-gray-200 dark:bg-gray-700 rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : cards.length === 0 ? (
              <div className="rounded-xl border border-gray-200/80 bg-white shadow-lg dark:border-gray-700/80 dark:bg-gray-800/50 p-8 text-center">
                <p className="text-gray-600 dark:text-gray-400">No cards found for this status.</p>
              </div>
            ) : (
              <AlumniDataTable
                items={cards}
                loading={loading}
                error={isError ? (error instanceof Error ? error.message : "Failed to load") : null}
                defaultPageSize={pageSize}
                onRowAction={(item, key) => handleAction(item, key)}
              />
            )}
          </div>
        </div>

        {/* Pagination Info */}
        {!loading && total > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-5 bg-gray-50/50 dark:bg-gray-900/30 border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Showing {total.toLocaleString()} {total === 1 ? "card" : "cards"}
            </span>
          </div>
        )}
      </div>
    </ComponentCard>
  );
};
