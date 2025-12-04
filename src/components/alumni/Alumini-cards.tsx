"use client";
import React, { useState, useMemo, useEffect } from "react";
import ComponentCard from "@/components/common/ComponentCard";
import { LockIcon, EyeIcon, TrashBinIcon, CheckLineIcon, CloseLineIcon, BoltIcon, TimeIcon, GroupIcon } from "@/icons";
import { AlumniDataTable } from "./AlumniCard";
import { useCardApplicants, type CardStatusFilter, type CardApplicant } from "@/app/queries/fetch-card-applicants";
import { useUpdateApplicantStatus } from "@/app/queries/fetch-card-applicants";
import toast from "react-hot-toast";

/**
 * AlumniCards
 * Responsive card-based listing for alumni cards, organized by status (all, active, pending, onhold).
 * Uses TanStack Query for data fetching with real-time counters.
 */

type CardStatus = "active" | "pending" | "onhold" | "all";

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

// Map database status to UI status
function mapDbStatusToUI(dbStatus: string | null): CardStatus {
  if (!dbStatus) return "pending";
  const lower = dbStatus.toLowerCase().trim();
  if (lower === "delivered") return "active";
  if (lower === "pending") return "pending";
  if (lower === "rejected") return "onhold";
  return "pending";
}

// Convert CardApplicant to AlumniCardItem
function convertToAlumniCardItem(applicant: CardApplicant): AlumniCardItem {
  return {
    id: String(applicant.sapid),
    name: applicant.alumniname || "Unknown",
    email: applicant.email || undefined,
    program: applicant.degreetitle || "N/A",
    campus: "N/A", // Not available in API response
    faculty: applicant.facultyname || "N/A",
    passingYear: applicant.yearofending || 0,
    workCountry: "N/A", // Not available in API response
    status: mapDbStatusToUI(applicant.status),
    createdAt: applicant.createdat || new Date().toISOString(),
  };
}

export function getActionsForStatus(status: CardStatus): ActionDef[] {
  switch (status) {
    case "active":
      return [
        { key: "suspend", label: "Suspend", icon: LockIcon, hoverClass: "hover:text-amber-600" },
        { key: "delete", label: "Delete", icon: TrashBinIcon, hoverClass: "hover:text-rose-600" },
        { key: "view", label: "View", icon: EyeIcon, hoverClass: "hover:text-blue-600" },
      ];
    case "pending":
      return [
        { key: "verify", label: "Verify", icon: CheckLineIcon, hoverClass: "hover:text-emerald-600" },
        { key: "decline", label: "Decline", icon: CloseLineIcon, hoverClass: "hover:text-rose-600" },
        { key: "view", label: "View", icon: EyeIcon, hoverClass: "hover:text-blue-600" },
      ];
    case "onhold":
      return [
        { key: "delete", label: "Delete", icon: TrashBinIcon, hoverClass: "hover:text-rose-600" },
        { key: "view", label: "View", icon: EyeIcon, hoverClass: "hover:text-blue-600" },
      ];
    case "all":
    default:
      return [{ key: "view", label: "View", icon: EyeIcon, hoverClass: "hover:text-blue-600" }];
  }
}

const STATUS_TABS: { key: CardStatus; label: string; icon: React.FC<{ className?: string }> }[] = [
  { key: "all", label: "All", icon: GroupIcon },
  { key: "active", label: "Active", icon: BoltIcon },
  { key: "pending", label: "Pending", icon: TimeIcon },
  { key: "onhold", label: "Onhold", icon: LockIcon },
];

export const AlumniCards: React.FC<AlumniCardsProps> = ({ initialStatus = "all", pageSize = 12 }) => {
  const [selectedStatus, setSelectedStatus] = useState<CardStatusFilter>(initialStatus as CardStatusFilter);
  
  // Fetch cards for selected status - this also returns counts
  const { data, isLoading, isError, error } = useCardApplicants(selectedStatus);
  
  // Fetch counts separately to ensure we always have them (even when switching tabs)
  const { data: countsData, isLoading: countsLoading } = useCardApplicants("all");
  
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
    return { all: 0, active: 0, pending: 0, onhold: 0 };
  }, [countsData, data]);
  
  // Debug: Log counts to console (remove in production if needed)
  useEffect(() => {
    if (countsData || data) {
      console.log("[AlumniCards] Counts:", {
        countsFromAll: countsData?.counts,
        countsFromData: data?.counts,
        finalCounts: counts,
      });
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
      department: item.faculty,
      verified: item.status === "active",
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
        // Handle delete - you may want to add a delete API endpoint
        toast.error("Delete functionality not yet implemented");
        return;
      }

      // Handle status updates
      let newDbStatus: "pending" | "rejected" | "delivered" | null = null;
      
      if (key === "verify" && alumni.status === "pending") {
        newDbStatus = "delivered";
      } else if (key === "decline" && alumni.status === "pending") {
        newDbStatus = "rejected";
      } else if (key === "suspend" && alumni.status === "active") {
        newDbStatus = "rejected";
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
            {STATUS_TABS.map((tab) => {
              const Icon = tab.icon;
              // Get count based on tab key
              let count = 0;
              if (tab.key === "all") {
                count = counts.all;
              } else if (tab.key === "active") {
                count = counts.active;
              } else if (tab.key === "pending") {
                count = counts.pending;
              } else if (tab.key === "onhold") {
                count = counts.onhold;
              }
              const isSelected = selectedStatus === tab.key;
              
              return (
                <button
                  key={tab.key}
                  className={`rounded-xl border px-4 py-2.5 cursor-pointer transform scale-100 transform-gpu transition-all duration-300 ease-in-out hover:scale-[1.02] hover:shadow-sm flex items-center gap-2 ${
                    isSelected
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/20 shadow-md"
                      : "border-gray-200 bg-slate-100 text-gray-700 dark:border-gray-800 dark:bg-white/[0.03] hover:border-blue-400"
                  }`}
                  onClick={() => setSelectedStatus(tab.key as CardStatusFilter)}
                  role="tab"
                  aria-selected={isSelected}
                  tabIndex={0}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{tab.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    isSelected
                      ? "bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200"
                      : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                  }`}>
                    {countsLoading || isLoading ? "..." : count.toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

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
