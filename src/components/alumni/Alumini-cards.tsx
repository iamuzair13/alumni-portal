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
 * AlumniCards — Enhanced Professional UI
 * Responsive card-based listing with animated tabs, real-time counters,
 * and polished interaction states.
 */

type AlumniCardItem = {
  alumniid?: number;
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
  cardaddress?: string | null;
  deliveryCity?: string | null;
  deliverySocietyName?: string | null;
  deliveryStreetNo?: string | null;
  deliveryHouseNo?: string | null;
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

type AlumniCardTab = CardStatusFilter | "overdue_by_alumni";

// ─── Animated Counter Hook ───
function useAnimatedCounter(target: number, duration = 600) {
  const [count, setCount] = useState(0);
  const prevRef = React.useRef(0);

  useEffect(() => {
    const start = prevRef.current;
    const diff = target - start;
    if (diff === 0) return;
    
    let startTime: number | null = null;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(start + diff * easeOut));
      if (progress < 1) requestAnimationFrame(animate);
      else prevRef.current = target;
    };
    
    requestAnimationFrame(animate);
  }, [target, duration]);

  return count;
}

function convertToAlumniCardItem(applicant: CardApplicant): AlumniCardItem & { department: string } {
  const rawSapid = applicant.sapid ? String(applicant.sapid).trim() : "";
  const normalizedSapid = rawSapid.toLowerCase() === "null" ? "" : rawSapid;
  const rawRegNo = applicant.registrationno ? String(applicant.registrationno).trim() : "";
  const effectiveId = normalizedSapid || rawRegNo || "";

  return {
    alumniid: applicant.alumniid,
    id: effectiveId,
    name: applicant.alumniname || "Unknown",
    email: applicant.email || undefined,
    program: applicant.degreetitle || "N/A",
    campus: "N/A",
    faculty: applicant.facultyname || "N/A",
    department: applicant.departmentname || "N/A",
    passingYear: applicant.yearofending || 0,
    workCountry: "N/A",
    status: mapDbStatusToUI(applicant.status),
    createdAt: applicant.createdat || new Date().toISOString(),
    registrationno: rawRegNo || null,
    cardaddress: applicant.cardaddress ?? null,
    deliveryCity: applicant.delivery_city ?? null,
    deliverySocietyName: applicant.delivery_society_name ?? null,
    deliveryStreetNo: applicant.delivery_street_no ?? null,
    deliveryHouseNo: applicant.delivery_house_no ?? null,
  };
}

export function getActionsForStatus(status: CardStatus): ActionDef[] {
  return [{ key: "view", label: "View", icon: EyeIcon, hoverClass: "hover:text-blue-600" }];
}

// ─── Design System Tokens ───
const STATUS_THEME: Record<string, {
  active: { border: string; bg: string; text: string; badge: string; badgeText: string; shadow: string; icon: string };
  inactive: { border: string; bg: string; text: string; badge: string; badgeText: string; hover: string };
}> = {
  all: {
    active: { border: "border-blue-500", bg: "bg-blue-50", text: "text-blue-700", badge: "bg-blue-600", badgeText: "text-white", shadow: "shadow-blue-500/20", icon: "text-blue-500" },
    inactive: { border: "border-gray-200", bg: "bg-white", text: "text-gray-600", badge: "bg-gray-100", badgeText: "text-gray-600", hover: "hover:border-blue-300 hover:bg-blue-50/50" },
  },
  "under-review": {
    active: { border: "border-amber-500", bg: "bg-amber-50", text: "text-amber-800", badge: "bg-amber-500", badgeText: "text-white", shadow: "shadow-amber-500/20", icon: "text-amber-500" },
    inactive: { border: "border-gray-200", bg: "bg-white", text: "text-gray-600", badge: "bg-gray-100", badgeText: "text-gray-600", hover: "hover:border-amber-300 hover:bg-amber-50/50" },
  },
  underprinting: {
    active: { border: "border-purple-500", bg: "bg-purple-50", text: "text-purple-800", badge: "bg-purple-500", badgeText: "text-white", shadow: "shadow-purple-500/20", icon: "text-purple-500" },
    inactive: { border: "border-gray-200", bg: "bg-white", text: "text-gray-600", badge: "bg-gray-100", badgeText: "text-gray-600", hover: "hover:border-purple-300 hover:bg-purple-50/50" },
  },
  active: {
    active: { border: "border-emerald-500", bg: "bg-emerald-50", text: "text-emerald-800", badge: "bg-emerald-500", badgeText: "text-white", shadow: "shadow-emerald-500/20", icon: "text-emerald-500" },
    inactive: { border: "border-gray-200", bg: "bg-white", text: "text-gray-600", badge: "bg-gray-100", badgeText: "text-gray-600", hover: "hover:border-emerald-300 hover:bg-emerald-50/50" },
  },
  delivered: {
    active: { border: "border-green-500", bg: "bg-green-50", text: "text-green-800", badge: "bg-green-500", badgeText: "text-white", shadow: "shadow-green-500/20", icon: "text-green-500" },
    inactive: { border: "border-gray-200", bg: "bg-white", text: "text-gray-600", badge: "bg-gray-100", badgeText: "text-gray-600", hover: "hover:border-green-300 hover:bg-green-50/50" },
  },
  onhold: {
    active: { border: "border-rose-500", bg: "bg-rose-50", text: "text-rose-800", badge: "bg-rose-500", badgeText: "text-white", shadow: "shadow-rose-500/20", icon: "text-rose-500" },
    inactive: { border: "border-gray-200", bg: "bg-white", text: "text-gray-600", badge: "bg-gray-100", badgeText: "text-gray-600", hover: "hover:border-rose-300 hover:bg-rose-50/50" },
  },
  overdue: {
    active: { border: "border-red-500", bg: "bg-red-50", text: "text-red-800", badge: "bg-red-500", badgeText: "text-white", shadow: "shadow-red-500/20", icon: "text-red-500" },
    inactive: { border: "border-gray-200", bg: "bg-white", text: "text-gray-600", badge: "bg-gray-100", badgeText: "text-gray-600", hover: "hover:border-red-300 hover:bg-red-50/50" },
  },
  overdue_by_alumni: {
    active: { border: "border-orange-500", bg: "bg-orange-50", text: "text-orange-800", badge: "bg-orange-500", badgeText: "text-white", shadow: "shadow-orange-500/20", icon: "text-orange-500" },
    inactive: { border: "border-gray-200", bg: "bg-white", text: "text-gray-600", badge: "bg-gray-100", badgeText: "text-gray-600", hover: "hover:border-orange-300 hover:bg-orange-50/50" },
  },
};

const STATUS_TABS: { key: AlumniCardTab; label: string; icon: React.FC<{ className?: string }>; desc: string }[] = [
  { key: "all", label: "All Cards", icon: GroupIcon, desc: "" },
  { key: "under-review", label: "Under Review", icon: TimeIcon, desc: "" },
  { key: "underprinting", label: "Under Printing", icon: FileIcon, desc: "" },
  { key: "active", label: "Active", icon: CheckLineIcon, desc: "" },
  { key: "onhold", label: "On Hold", icon: LockIcon, desc: "" },
  { key: "delivered", label: "Delivered", icon: CheckLineIcon, desc: "" },
  { key: "overdue", label: "Overdue (Admin)", icon: AlertIcon, desc: "" },
  { key: "overdue_by_alumni", label: "Overdue (Alumni)", icon: AlertIcon, desc: "" },
];

// ─── Sub-Components ───

function TabCounter({ count, isLoading, theme }: { count: number; isLoading: boolean; theme: any }) {
  const animated = useAnimatedCounter(isLoading ? 0 : count);
  
  if (isLoading) {
    return (
      <span className={`inline-flex h-5 w-8 items-center justify-center rounded-md ${theme.badge} ${theme.badgeText}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      </span>
    );
  }
  
  return (
    <span className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-md px-1.5 text-[10px] font-bold tabular-nums transition-all duration-300 ${theme.badge} ${theme.badgeText}`}>
      {animated.toLocaleString()}
    </span>
  );
}

function StatusTab({
  tab,
  isSelected,
  count,
  isLoading,
  onClick,
}: {
  tab: typeof STATUS_TABS[0];
  isSelected: boolean;
  count: number;
  isLoading: boolean;
  onClick: () => void;
}) {
  const activeTheme = STATUS_THEME[tab.key].active;
  const inactiveTheme = STATUS_THEME[tab.key].inactive;
  const theme = isSelected ? activeTheme : inactiveTheme;
  const Icon = tab.icon;

  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={isSelected}
      className={`
        group relative flex items-center gap-2.5 rounded-xl border px-4 py-3
        transition-all duration-300 ease-out
        ${isSelected 
          ? `${activeTheme.border} ${activeTheme.bg} ${activeTheme.text} shadow-lg ${activeTheme.shadow} ring-1 ring-inset ring-white/20 scale-[1.02]` 
          : `${inactiveTheme.border} ${inactiveTheme.bg} ${inactiveTheme.text} ${inactiveTheme.hover} hover:shadow-md hover:-translate-y-0.5`
        }
      `}
    >
      {/* Active indicator dot */}
      {isSelected && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${theme.badge}`} />
          <span className={`relative inline-flex rounded-full h-3 w-3 ${theme.badge}`} />
        </span>
      )}
      
      <Icon className={`h-4 w-4 transition-transform duration-300 ${isSelected ? 'scale-110' : 'group-hover:scale-105'} ${isSelected ? activeTheme.icon : ''}`} />
      
      <div className="flex flex-col items-start">
        <span className={`text-sm font-semibold leading-tight ${isSelected ? '' : 'group-hover:text-gray-900'}`}>
          {tab.label}
        </span>
        <span className={`text-[10px] font-medium opacity-70 leading-tight ${isSelected ? '' : 'hidden sm:block'}`}>
          {tab.desc}
        </span>
      </div>
      
      <TabCounter count={count} isLoading={isLoading} theme={theme} />
    </button>
  );
}

function OverdueSelector({
  value,
  onChange,
  counts,
  isLoading,
}: {
  value: OverdueType;
  onChange: (v: OverdueType) => void;
  counts: Record<string, number>;
  isLoading: boolean;
}) {
  const options: { value: OverdueType; label: string; countKey: string }[] = [
    { value: "under-review", label: "Under Review", countKey: "overdue-under-review" },
    { value: "under-printing", label: "Under Printing", countKey: "overdue-under-printing" },
  ];

  return (
    <div className="flex items-center gap-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-1.5 shadow-sm">
      {options.map((opt) => {
        const isActive = value === opt.value;
        const count = counts[opt.countKey] || 0;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`
              relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200
              ${isActive 
                ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 shadow-sm" 
                : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700/50"
              }
            `}
          >
            <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
            {opt.label}
            <span className={`ml-1 text-xs font-bold tabular-nums ${isActive ? 'text-red-600' : 'text-gray-400'}`}>
              {isLoading ? "—" : count.toLocaleString()}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function EmptyState({ status }: { status: AlumniCardTab }) {
  const themes: Record<string, { icon: string; title: string; desc: string }> = {
    all: { icon: "📋", title: "No cards yet", desc: "Alumni cards will appear here once submitted" },
    "under-review": { icon: "⏳", title: "Nothing under review", desc: "All cards have been processed" },
    underprinting: { icon: "🖨️", title: "Nothing in production", desc: "No cards are currently being printed" },
    active: { icon: "✅", title: "No active cards", desc: "No cards are ready for delivery" },
    onhold: { icon: "🔒", title: "No holds", desc: "No cards require attention" },
    delivered: { icon: "🎉", title: "No deliveries yet", desc: "Cards will appear here once delivered" },
    overdue: { icon: "⚠️", title: "No overdue cards", desc: "All cards are within schedule" },
    overdue_by_alumni: { icon: "👤", title: "No alumni flags", desc: "No cards flagged by alumni" },
  };

  const t = themes[status] || themes.all;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="h-20 w-20 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mb-4 shadow-inner">
        <span className="text-3xl">{t.icon}</span>
      </div>
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{t.title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm">{t.desc}</p>
    </div>
  );
}

function LoadingState({ pageSize }: { pageSize: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: Math.min(pageSize, 6) }).map((_, i) => (
        <div 
          key={i} 
          className="animate-pulse rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/30 p-5"
        >
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-700" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 bg-gray-100 dark:bg-gray-700 rounded" />
              <div className="h-3 w-1/4 bg-gray-100 dark:bg-gray-700 rounded" />
            </div>
            <div className="h-8 w-24 bg-gray-100 dark:bg-gray-700 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export const AlumniCards: React.FC<AlumniCardsProps> = ({ initialStatus = "all", pageSize = 12 }) => {
  const [selectedStatus, setSelectedStatus] = useState<AlumniCardTab>(initialStatus as CardStatusFilter);
  const [selectedOverdueType, setSelectedOverdueType] = useState<OverdueType>("under-review");
  const [overdueByAlumniIds, setOverdueByAlumniIds] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("alumni-card-overdue-by-alumni");
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        setOverdueByAlumniIds(parsed.map((x) => String(x)).filter(Boolean));
      }
    } catch {
      // ignore malformed local storage
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("alumni-card-overdue-by-alumni", JSON.stringify(overdueByAlumniIds));
  }, [overdueByAlumniIds]);
  
  const apiStatusForFetch: CardStatusFilter = selectedStatus === "overdue_by_alumni" ? "all" : selectedStatus;
  const { data, isLoading, isError, error } = useCardApplicants(
    apiStatusForFetch,
    apiStatusForFetch === "overdue" ? { overdueType: selectedOverdueType } : undefined
  );
  
  const { data: countsData, isLoading: countsLoading } = useCardApplicants("all");
  
  const counts = useMemo(() => {
    const c = countsData?.counts || data?.counts;
    return c || { 
      all: 0, "under-review": 0, underprinting: 0, active: 0, onhold: 0, delivered: 0,
      "overdue-under-review": 0, "overdue-under-printing": 0,
    };
  }, [countsData, data]);
  
  const updateStatusMutation = useUpdateApplicantStatus();

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

  const getTabCount = (key: AlumniCardTab): number => {
    if (key === "all") return counts.all || 0;
    if (key === "under-review") return counts["under-review"] || 0;
    if (key === "underprinting") return counts.underprinting || 0;
    if (key === "active") return counts.active || 0;
    if (key === "delivered") return counts.delivered || 0;
    if (key === "onhold") return counts.onhold || 0;
    if (key === "overdue") return (counts["overdue-under-review"] || 0) + (counts["overdue-under-printing"] || 0);
    if (key === "overdue_by_alumni") return overdueByAlumniIds.length;
    return 0;
  };

  const handleAction = async (alumni: AlumniCardItem, key: ActionKey) => {
    try {
      if (key === "view") {
        if (typeof window !== "undefined") {
          window.open(`/alumni-profile?sapid=${encodeURIComponent(alumni.id)}`, "_blank", "noopener,noreferrer");
        }
        return;
      }
      if (key === "delete") {
        toast.success("Alumni card deleted successfully");
        return;
      }
      let newDbStatus: DbCardStatus | null = null;
      if (key === "verify") {
        if (alumni.status === "under-review") newDbStatus = "UnderPrinting";
        else if (alumni.status === "underprinting") newDbStatus = "Active";
        else if (alumni.status === "active") newDbStatus = "Delivered";
      }
      if (newDbStatus) {
        await updateStatusMutation.mutateAsync({ sapId: alumni.id, status: newDbStatus });
        toast.success("Status updated successfully");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const total = cards.length;
  const loading = isLoading;

  return (
    <ComponentCard className="p-0 overflow-hidden border-0 shadow-xl shadow-gray-200/50 dark:shadow-none dark:bg-gray-900">
      {/* ─── Header Section ─── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 px-6 pt-8 pb-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100/40 via-transparent to-transparent dark:from-blue-900/10" />
        
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <GroupIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Alumni Cards</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Manage and track alumni card applications</p>
            </div>
          </div>
          
          {/* Quick Stats Bar */}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {countsLoading ? "Loading..." : `${(counts.all || 0).toLocaleString()} total cards`}
              </span>
            </div>
            {(counts["overdue-under-review"] || 0) + (counts["overdue-under-printing"] || 0) > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
                <AlertIcon className="h-3.5 w-3.5 text-red-500" />
                <span className="text-xs font-semibold text-red-700 dark:text-red-400">
                  {((counts["overdue-under-review"] || 0) + (counts["overdue-under-printing"] || 0)).toLocaleString()} overdue
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Tabs Navigation ─── */}
      <div className="px-6 -mt-3 relative py-2 z-10">
        <div 
          className="flex gap-2 overflow-x-auto pb-3 py-2 px-2 scrollbar-hide"
          role="tablist" 
          aria-label="Card status tabs"
        >
          {STATUS_TABS.map((tab) => (
            <StatusTab
              key={tab.key}
              tab={tab}
              isSelected={selectedStatus === tab.key}
              count={getTabCount(tab.key)}
              isLoading={countsLoading || isLoading}
              onClick={() => {
                if (tab.key === "overdue") {
                  setSelectedStatus("overdue");
                  setSelectedOverdueType("under-review");
                } else {
                  setSelectedStatus(tab.key);
                }
              }}
            />
          ))}
        </div>
      </div>

      {/* ─── Overdue Sub-Selector ─── */}
      {selectedStatus === "overdue" && (
        <div className="px-6 py-4 bg-amber-50/50 dark:bg-amber-900/10 border-y border-amber-100 dark:border-amber-900/20">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <AlertIcon className="h-4 w-4" />
              <span className="text-sm font-semibold">Overdue Filter</span>
            </div>
            <OverdueSelector
              value={selectedOverdueType}
              onChange={setSelectedOverdueType}
              counts={counts}
              isLoading={countsLoading || isLoading}
            />
          </div>
        </div>
      )}

      {/* ─── Content Area ─── */}
      <div className="px-6 py-6">
        {isError && (
          <div role="alert" className="mb-4 rounded-xl border border-red-200/80 bg-red-50/80 dark:bg-red-900/20 dark:border-red-800/50 px-4 py-3 text-sm font-medium text-red-800 dark:text-red-200 shadow-sm flex items-center gap-2">
            <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error instanceof Error ? error.message : "Failed to load alumni cards"}
          </div>
        )}

        {loading ? (
          <LoadingState pageSize={pageSize} />
        ) : cards.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-700/80 dark:bg-gray-800/30 shadow-sm">
            <EmptyState status={selectedStatus} />
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200/80 bg-white shadow-lg dark:border-gray-700/80 dark:bg-gray-800/50 overflow-hidden">
            <AlumniDataTable
              items={cards}
              loading={loading}
              error={isError ? (error instanceof Error ? error.message : "Failed to load") : null}
              defaultPageSize={pageSize}
              selectedStatus={selectedStatus}
              selectedOverdueType={selectedOverdueType}
              overdueByAlumniIds={overdueByAlumniIds}
              onToggleOverdueByAlumni={(item, checked) => {
                const key = String(item.id || "").trim();
                if (!key) return;
                setOverdueByAlumniIds((prev) => 
                  checked ? (prev.includes(key) ? prev : [...prev, key]) : prev.filter((id) => id !== key)
                );
              }}
              onRowAction={(item, key) => handleAction(item, key)}
            />
          </div>
        )}
      </div>

      {/* ─── Footer ─── */}
      {!loading && total > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-4 bg-gray-50/80 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Showing <span className="font-bold text-gray-900 dark:text-white">{total.toLocaleString()}</span> {total === 1 ? "record" : "records"}
          </span>
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Last updated just now
          </div>
        </div>
      )}
    </ComponentCard>
  );
};