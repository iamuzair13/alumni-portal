"use client";
import React from "react";
import { useSession } from "next-auth/react";
import { TimeIcon, LockIcon, GroupIcon, EyeIcon, UserIcon, MailIcon, TrashBinIcon, PlusIcon, CheckCircleIcon, ArrowUpIcon, ArrowDownIcon, FileIcon } from "@/icons";
import { AlumniExpandableDetails } from "./AlumniExpandableDetails";
import { ErpDataDetails } from "./ErpDataDetails";
import { canModify } from "@/lib/alumniProfile";
import { Modal } from "@/components/ui/modal";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import PassportPhotoCropModal from "@/components/ui/PassportPhotoCropModal";
import { useExcelExport, type ColumnOption } from "@/lib/excel-export";
import {
  CardStatusSelect,
  CardStatusConfirmModal,
  submitCardStatusChange,
  ON_HOLD_REASON_OPTIONS,
  type OnHoldReason,
  type PendingCardStatusChange,
} from "@/components/alumni/CardStatusSelect";
import { 
  type CardStatus, 
  type DbCardStatus,
  CARD_STATUS_CONFIG, 
  mapDbStatusToUI, 
  mapUIStatusToDb, 
  getStatusLabel,
  normalizeDbStatus 
} from "@/lib/card-status-config";
import { formatCardDeliveryAddressLabeled } from "@/lib/cardDeliveryAddress";

export type AlumniCardItem = {
  id: string;
  alumniid?: number;
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

export type ActionKey = "view" | "verify" | "decline" | "suspend" | "delete";
export type ActionDef = {
  key: ActionKey;
  label: string;
  icon: React.FC<{ className?: string }>;
  hoverClass?: string;
};

const STATUS_CLASS_MAP: Record<
  CardStatus,
  { color: string; bgColor: string; ringColor: string; iconColor: string; pillBg: string }
> = {
  all: {
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    ringColor: "ring-blue-200",
    iconColor: "text-blue-500",
    pillBg: "bg-blue-100",
  },
  "under-review": {
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    ringColor: "ring-amber-200",
    iconColor: "text-amber-600",
    pillBg: "bg-amber-100",
  },
  underprinting: {
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    ringColor: "ring-purple-200",
    iconColor: "text-purple-600",
    pillBg: "bg-purple-100",
  },
  active: {
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    ringColor: "ring-emerald-200",
    iconColor: "text-emerald-600",
    pillBg: "bg-emerald-100",
  },
  onhold: {
    color: "text-rose-700",
    bgColor: "bg-rose-50",
    ringColor: "ring-rose-200",
    iconColor: "text-rose-600",
    pillBg: "bg-rose-100",
  },
  delivered: {
    color: "text-green-700",
    bgColor: "bg-green-50",
    ringColor: "ring-green-200",
    iconColor: "text-green-600",
    pillBg: "bg-green-100",
  },
};

const STATUS_ICON_MAP: Record<CardStatus, React.FC<{ className?: string }>> = {
  all: GroupIcon,
  "under-review": TimeIcon,
  underprinting: FileIcon,
  active: CheckCircleIcon,
  onhold: LockIcon,
  delivered: CheckCircleIcon,
};

export { ON_HOLD_REASON_OPTIONS, type OnHoldReason };

export type AlumniCardProps = {
  item: AlumniCardItem;
  actions: ActionDef[];
  busy?: boolean;
  error?: string | null;
  onAction: (action: ActionKey) => Promise<void> | void;
};

export const AlumniCard: React.FC<AlumniCardProps> = ({ item, actions, busy = false, error, onAction }) => {
  const Icon = STATUS_ICON_MAP[item.status];
  const theme = STATUS_CLASS_MAP[item.status];
  const titleId = `alumni-card-title-${item.id}`;

  return (
    <article
      aria-labelledby={titleId}
      className="group relative rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition-transform duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${theme.bgColor} ring-1 ring-inset ${theme.ringColor} transition-colors`}>
            <Icon className={`h-6 w-6 ${theme.iconColor}`} />
          </span>
          <div className="min-w-0">
            <h3 id={titleId} className="text-base font-semibold text-neutral-900 truncate">{item.name}</h3>
            {item.email && <p className="mt-0.5 text-sm text-neutral-500 truncate" aria-label="Email">{item.email}</p>}
          </div>
        </div>
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${theme.pillBg} ${theme.color}`}>{item.status}</span>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div className="space-y-0.5"><dt className="text-neutral-500">Faculty</dt><dd className="text-neutral-800">{item.faculty}</dd></div>
        <div className="space-y-0.5"><dt className="text-neutral-500">Degree</dt><dd className="text-neutral-800">{item.program}</dd></div>
        <div className="space-y-0.5"><dt className="text-neutral-500">Campus</dt><dd className="text-neutral-800">{item.campus}</dd></div>
        <div className="space-y-0.5"><dt className="text-neutral-500">Graduated</dt><dd className="text-neutral-800">{item.passingYear}</dd></div>
        <div className="space-y-0.5"><dt className="text-neutral-500">Work Country</dt><dd className="text-neutral-800">{item.workCountry}</dd></div>
        <div className="space-y-0.5"><dt className="text-neutral-500">SAP-ID</dt><dd className="text-neutral-800">{item.id}</dd></div>
      </dl>

      <div className="mt-5 flex items-center justify-between">
        <div role="group" aria-label="Card actions" className="inline-flex items-center gap-2">
          {actions.map(({ key, label, icon: ActionIcon, hoverClass }) => (
            <button
              key={`${item.id}-${key}`}
              type="button"
              className={`rounded-md p-2 text-neutral-600 transition-all duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 hover:text-neutral-800 ${hoverClass ?? ""} disabled:opacity-50 disabled:cursor-not-allowed`}
              aria-label={label}
              title={label}
              disabled={busy}
              onClick={() => onAction(key)}
            >
              <ActionIcon className="h-5 w-5" />
            </button>
          ))}
        </div>
        {error && <span role="alert" className="text-sm text-red-600">{error}</span>}
      </div>
    </article>
  );
};

// Card-based list with interactive actions: View Profile, Connect, Message
export type AlumniListItem = AlumniCardItem & {
  mobile?: string;
  department?: string;
  verified?: boolean;
  organization?: string;
  designation?: string;
  workCity?: string;
  cardaddress?: string | null;
  deliveryCity?: string | null;
  deliverySocietyName?: string | null;
  deliveryStreetNo?: string | null;
  deliveryHouseNo?: string | null;
};

export type AlumniCardListProps = {
  items: AlumniListItem[];
  loading: boolean;
  error?: string | null;
  emptyMessage?: string;
  onViewProfile: (item: AlumniListItem) => void;
  onConnect: (item: AlumniListItem) => void;
  onMessage: (item: AlumniListItem) => void;
};

export const AlumniCardList: React.FC<AlumniCardListProps> = ({ items, loading, error, emptyMessage = "No alumni found", onViewProfile, onConnect, onMessage }) => {
  return (
    <div className="min-h-[200px]">
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 p-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: Math.min(items.length || 8, 8) }).map((_, i) => (
            <div key={`skeleton-${i}`} className="animate-pulse rounded-xl border border-neutral-200 p-4 bg-neutral-50">
              <div className="h-6 w-2/3 bg-neutral-200 rounded mb-3" />
              <div className="h-4 w-1/2 bg-neutral-200 rounded mb-2" />
              <div className="h-4 w-1/3 bg-neutral-200 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((alum) => {
            const Icon = STATUS_ICON_MAP[alum.status];
            const theme = STATUS_CLASS_MAP[alum.status];
            return (
              <article key={alum.id} className="rounded-xl border border-neutral-200 p-4 bg-white shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${theme.bgColor}`}>
                      <Icon className={`h-6 w-6 ${theme.iconColor}`} />
                    </span>
                    <div className="min-w-0">
                      <h5 className="font-semibold truncate">{alum.name}</h5>
                      <p className="text-sm text-neutral-500 truncate">{alum.email ?? "-"}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${theme.pillBg} ${theme.color}`}>
                    {getStatusLabel(alum.status)}
                  </span>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <dt className="text-neutral-500">Department</dt>
                    <dd className="text-neutral-800">{alum.department ?? alum.program}</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">SAP-ID</dt>
                    <dd className="text-neutral-800">{alum.id}</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Mobile</dt>
                    <dd className="text-neutral-800">{alum.mobile ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Verified</dt>
                    <dd className="text-neutral-800">{alum.verified ? "Yes" : "No"}</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Organization</dt>
                    <dd className="text-neutral-800">{alum.organization ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Designation</dt>
                    <dd className="text-neutral-800">{alum.designation ?? "-"}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-neutral-500">Work Country/City</dt>
                    <dd className="text-neutral-800">{alum.workCountry}{alum.workCity ? ` / ${alum.workCity}` : ""}</dd>
                  </div>
                </dl>

                <div className="mt-4 flex items-center justify-between">
                  <div role="group" aria-label="Card actions" className="inline-flex items-center gap-3">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      aria-label="View Profile"
                      onClick={() => onViewProfile(alum)}
                    >
                      <EyeIcon className="h-5 w-5" />
                      <span>View Profile</span>
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      aria-label="Connect"
                      onClick={() => onConnect(alum)}
                    >
                      <UserIcon className="h-5 w-5" />
                      <span>Connect</span>
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      aria-label="Message"
                      onClick={() => onMessage(alum)}
                    >
                      <MailIcon className="h-5 w-5" />
                      <span>Message</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          {items.length === 0 && !error && (
            <div className="col-span-full rounded-xl border border-neutral-200 bg-neutral-50 p-6 text-center text-neutral-600">{emptyMessage}</div>
          )}
        </div>
      )}
    </div>
  );
};

// Comprehensive Data Table view, matching dashboard style from Alumni-tabs
import { Table, TableHeader, TableBody, TableRow, TableCell } from "@/components/ui/table";
import Pagination from "@/components/tables/Pagination";
import { useCardStatus, cardStatusKey, type CardData } from "@/app/queries/fetch-card-status";
import { useCardApplicants, cardApplicantsKey, type CardApplicantsResponse, type CardStatusFilter, type OverdueType } from "@/app/queries/fetch-card-applicants";
import PrintCardButton from "./PrintCardButton";

type SortDirection = "asc" | "desc";
type SortKey = "name" | "passingYear" | "program" | "designation" | "organization" | "contact" | "department" | "id" | "faculty";

export interface AlumniDataTableProps {
  items: AlumniListItem[];
  loading?: boolean;
  error?: string | null;
  defaultPageSize?: number;
  selectedStatus?: CardStatusFilter | "overdue_by_alumni";
  selectedOverdueType?: OverdueType;
  onRowAction?: (item: AlumniListItem, action: ActionKey) => void;
  overdueByAlumniIds?: string[];
  onToggleOverdueByAlumni?: (item: AlumniListItem, checked: boolean) => void;
}

export const AlumniDataTable: React.FC<AlumniDataTableProps> = ({
  items,
  loading = false,
  error,
  defaultPageSize = 10,
  selectedStatus = "all",
  selectedOverdueType,
  onRowAction,
  overdueByAlumniIds = [],
  onToggleOverdueByAlumni,
}) => {
  const [query, setQuery] = React.useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = React.useState<string>("");
  const [sortKey, setSortKey] = React.useState<SortKey>("name");
  const [sortDir, setSortDir] = React.useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = React.useState<number>(1);
  const [pageSize] = React.useState<number>(defaultPageSize);
  const [selectedRowId, setSelectedRowId] = React.useState<string | null>(null);
  const [expandedRowId, setExpandedRowId] = React.useState<string | null>(null);
  const [showOverdueByAlumniConfirmModal, setShowOverdueByAlumniConfirmModal] = React.useState(false);
  const [pendingOverdueByAlumniChange, setPendingOverdueByAlumniChange] = React.useState<{
    item: AlumniListItem;
    checked: boolean;
  } | null>(null);
  const [pendingCardStatusChange, setPendingCardStatusChange] = React.useState<PendingCardStatusChange | null>(null);
  const [showStatusConfirmModal, setShowStatusConfirmModal] = React.useState(false);
  const [statusChangeError, setStatusChangeError] = React.useState<string | null>(null);
  const [isStatusUpdating, setIsStatusUpdating] = React.useState(false);
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const canEdit = canModify(session?.user);
  const { isExporting, openExportModal, ExportModal } = useExcelExport();
  const topScrollbarRef = React.useRef<HTMLDivElement>(null);
  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const isScrollingRef = React.useRef<boolean>(false);
  // Only fetch if items are not provided (backward compatibility)
  const shouldFetch = !items || items.length === 0;
  const { data: applicantsData, isLoading: applicantsLoading, isError: applicantsError, error: applicantsErrorObj } = useCardApplicants("all", { enabled: shouldFetch });
  const applicants = applicantsData?.items;

  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => clearTimeout(id);
  }, [query]);

  const baseItems = React.useMemo(() => {
    // If items are provided, use them (for filtered views)
    if (items && items.length > 0) {
      return items;
    }
    // Otherwise use fetched applicants
    if (applicants && applicants.length) {
      return applicants.map((r) => {
        // Normalize identifiers: use SAP ID if valid, otherwise fallback to registration number
        const rawSapid = r.sapid ? String(r.sapid).trim() : "";
        const normalizedSapid = rawSapid.toLowerCase() === "null" ? "" : rawSapid;
        const rawRegNo = r.registrationno ? String(r.registrationno).trim() : "";
        const effectiveId = normalizedSapid || rawRegNo || "";

        // Map database status to UI status using centralized config
        const uiStatus = mapDbStatusToUI(r.status);
        
        return {
          id: effectiveId,
          alumniid: r.alumniid,
          name: String(r.alumniname ?? ""),
          email: r.email ?? undefined,
          program: String(r.degreetitle ?? ""),
          campus: "",
          faculty: String(r.facultyname ?? ""),
          passingYear: Number(r.yearofending ?? 0),
          workCountry: "",
          status: uiStatus,
          createdAt: String(r.createdat ?? ""),
          department: String(r.departmentname ?? ""),
          registrationno: rawRegNo || null,
          cardaddress: r.cardaddress ?? null,
          deliveryCity: (r as { delivery_city?: string | null }).delivery_city ?? null,
          deliverySocietyName: (r as { delivery_society_name?: string | null }).delivery_society_name ?? null,
          deliveryStreetNo: (r as { delivery_street_no?: string | null }).delivery_street_no ?? null,
          deliveryHouseNo: (r as { delivery_house_no?: string | null }).delivery_house_no ?? null,
        };
      }) as AlumniListItem[];
    }
    return items;
  }, [items, applicants]);

  const effectiveLoading = loading || applicantsLoading;
  const effectiveError: string | null = error ?? (applicantsError ? (applicantsErrorObj?.message || "Failed to load applicants") : null);
  const overdueByAlumniSet = React.useMemo(() => new Set(overdueByAlumniIds), [overdueByAlumniIds]);

  const filtered = React.useMemo(() => {
    let filteredByStatus = baseItems;
    
    // Filter by status - strict matching
    if (selectedStatus !== "all" && selectedStatus !== "overdue") {
      if (selectedStatus === "overdue_by_alumni") {
        filteredByStatus = baseItems.filter((i) => overdueByAlumniSet.has(i.id));
      } else {
      const filterStatus = selectedStatus.toLowerCase().trim();
      filteredByStatus = baseItems.filter((i) => {
        // Get the actual status from the item, normalize it
        // Handle null, undefined, empty string, or actual status value
        let itemStatus: string;
        if (!i.status || String(i.status).trim() === "") {
          itemStatus = "pending";
        } else {
          itemStatus = String(i.status).trim().toLowerCase();
        }
        // Only match if statuses are exactly equal
        const matches = itemStatus === filterStatus;
        return matches;
      });
      }
    }
    
    // Filter by search query
    if (!debouncedQuery) return filteredByStatus;
    const q = debouncedQuery.toLowerCase();
    return filteredByStatus.filter((i) => {
      const contact = `${i.email ?? ""} ${i.mobile ?? ""}`.toLowerCase();
      const sapId = i.id?.toLowerCase() ?? "";
      const registrationNo = (i.registrationno ?? "").toLowerCase();
      return (
        i.name.toLowerCase().includes(q) ||
        String(i.passingYear).includes(q) ||
        i.program.toLowerCase().includes(q) ||
        (i.designation ?? "").toLowerCase().includes(q) ||
        (i.organization ?? "").toLowerCase().includes(q) ||
        contact.includes(q) ||
        sapId.includes(q) ||
        registrationNo.includes(q)
      );
    });
  }, [baseItems, debouncedQuery, selectedStatus, overdueByAlumniSet]);

  const sorted = React.useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const getVal = (x: AlumniListItem): string | number => {
        switch (sortKey) {
          case "name":
            return x.name.toLowerCase();
          case "passingYear":
            return x.passingYear;
          case "program":
            return x.program.toLowerCase();
          case "designation":
            return (x.designation ?? "").toLowerCase();
          case "organization":
            return (x.organization ?? "").toLowerCase();
          case "department":
            return (x.department ?? "").toLowerCase();
          case "faculty":
            return (x.faculty ?? "").toLowerCase();
          case "contact":
            return `${x.email ?? ""} ${x.mobile ?? ""}`.toLowerCase();
          case "id":
            return String(x.id).toLowerCase();
          default:
            return x.name.toLowerCase();
        }
      };
      const va = getVal(a);
      const vb = getVal(b);
      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * dir;
      }
      return String(va).localeCompare(String(vb)) * dir;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageItems = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQuery, sortKey, sortDir, pageSize, selectedStatus]);

  // Sync scroll between top scrollbar and table container
  React.useEffect(() => {
    const tableContainer = tableContainerRef.current;
    const topScrollbar = topScrollbarRef.current;
    
    if (!tableContainer || !topScrollbar) return;

    // Sync scrollbar width with table content
    const syncScrollbarWidth = () => {
      const tableContent = tableContainer.querySelector(".table-content-wrapper") as HTMLElement;
      if (tableContent) {
        const scrollbarContent = topScrollbar.querySelector(".table-scrollbar-content") as HTMLElement;
        if (scrollbarContent) {
          scrollbarContent.style.minWidth = `${tableContent.scrollWidth}px`;
        }
      }
    };

    const handleTableScroll = () => {
      if (!isScrollingRef.current) {
        isScrollingRef.current = true;
        topScrollbar.scrollLeft = tableContainer.scrollLeft;
        setTimeout(() => {
          isScrollingRef.current = false;
        }, 10);
      }
    };

    const handleTopScroll = () => {
      if (!isScrollingRef.current) {
        isScrollingRef.current = true;
        tableContainer.scrollLeft = topScrollbar.scrollLeft;
        setTimeout(() => {
          isScrollingRef.current = false;
        }, 10);
      }
    };

    // Initial sync
    syncScrollbarWidth();

    // Watch for content changes
    const resizeObserver = new ResizeObserver(() => {
      syncScrollbarWidth();
    });

    const tableContent = tableContainer.querySelector(".table-content-wrapper");
    if (tableContent) {
      resizeObserver.observe(tableContent);
    }

    tableContainer.addEventListener('scroll', handleTableScroll);
    topScrollbar.addEventListener('scroll', handleTopScroll);

    return () => {
      resizeObserver.disconnect();
      tableContainer.removeEventListener('scroll', handleTableScroll);
      topScrollbar.removeEventListener('scroll', handleTopScroll);
    };
  }, [pageItems, effectiveLoading]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  function toTitleCase(s: string | undefined): string {
    const v = String(s || "").toLowerCase();
    return v.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  function formatSapId(id: string | undefined): string {
    const digits = String(id || "").replace(/\D/g, "");
    if (!digits) return "-";
    return digits.padStart(8, "0").slice(-8);
  }
  function formatEmail(e: string | undefined): string {
    const v = String(e || "");
    return v.includes("@") ? v : "-";
  }

  function formatApplicationDate(dateStr: string | null | undefined): string {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "-";
      return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "-";
    }
  }

  // Export to Excel function with column selection
  const handleExportToExcel = React.useCallback(() => {
    // Async function to fetch and transform data (only called when Export is clicked)
    const fetchAndTransformData = async (): Promise<Record<string, unknown>[]> => {
      // Fetch comprehensive data from export endpoint
      const url = new URL("/api/alumni-cards/export", typeof window !== "undefined" ? window.location.origin : "");
      if (debouncedQuery) {
        url.searchParams.set("search", debouncedQuery);
      }
      if (selectedStatus && selectedStatus !== "all" && selectedStatus !== "overdue_by_alumni") {
        url.searchParams.set("status", selectedStatus);
        if (selectedStatus === "overdue" && selectedOverdueType) {
          url.searchParams.set("overdueType", selectedOverdueType);
        }
      }
      
      const res = await fetch(url.toString(), {
        headers: { "accept": "application/json" }
      });
      
      if (!res.ok) {
        throw new Error(`Failed to fetch export data: ${res.status}`);
      }
      
      const data = await res.json();
      let allItems = data.items || [];
      if (selectedStatus === "overdue_by_alumni") {
        allItems = allItems.filter((item: Record<string, unknown>) => {
          const sap = String(item.sapid ?? "").trim();
          const reg = String(item.registrationno ?? "").trim();
          const key = sap || reg;
          return key ? overdueByAlumniSet.has(key) : false;
        });
      }

      if (!allItems || allItems.length === 0) {
        throw new Error("No data found to export with the applied filters.");
      }

      const getExportStatusLabel = (raw: unknown): string => {
        const db = normalizeDbStatus(String(raw ?? "")) as DbCardStatus;
        const ui = mapDbStatusToUI(db);
        return getStatusLabel(ui);
      };

      const isOverdueUnderReview = (rawStatus: unknown, createdAt: unknown): boolean => {
        const db = normalizeDbStatus(String(rawStatus ?? "")) as DbCardStatus;
        if (db !== "UnderReview") return false;
        const d = new Date(String(createdAt ?? ""));
        if (Number.isNaN(d.getTime())) return false;
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return d < sevenDaysAgo;
      };

      const isOverdueUnderPrinting = (rawStatus: unknown, createdAt: unknown): boolean => {
        const db = normalizeDbStatus(String(rawStatus ?? "")) as DbCardStatus;
        if (db !== "UnderPrinting") return false;
        const d = new Date(String(createdAt ?? ""));
        if (Number.isNaN(d.getTime())) return false;
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return d < sevenDaysAgo;
      };

      // Map ALL fields to Excel format
      return allItems.map((item: Record<string, unknown>) => ({
        "SR.No": String(item.alumniid || ""),
        Sapid: String(item.sapid || ""),
        "Registration no": String(item.registrationno || ""),
        Alumniname: String(item.alumniname || ""),
        "Alumni cnic/passport": String(item.cnicpassport || ""),
        Faculty: String(item.faculty_name || item.facultyname || ""),
        Department: String(item.department_name || item.departmentname || ""),
        "Card status": getExportStatusLabel(item.status),
        "Onhold reason": String((item.reason_onhold ?? "") as string),
        "Overdue-under-review": isOverdueUnderReview(item.status, item.createdat) ? "true" : "false",
        "Overdue-under printing": isOverdueUnderPrinting(item.status, item.createdat) ? "true" : "false",
      }));
    };

    // Define column options
    const columns: ColumnOption[] = [
      { key: "SR.No", label: "SR.No", defaultSelected: true },
      { key: "Sapid", label: "Sapid", defaultSelected: true },
      { key: "Registration no", label: "REgistration no", defaultSelected: true },
      { key: "Alumniname", label: "Alumniname", defaultSelected: true },
      { key: "Alumni cnic/passport", label: "Alumni cnic/passport", defaultSelected: true },
      { key: "Faculty", label: "faculty", defaultSelected: true },
      { key: "Department", label: "department", defaultSelected: true },
      { key: "Card status", label: "card status", defaultSelected: true },
      { key: "Onhold reason", label: "onhold reason", defaultSelected: false },
      { key: "Overdue-under-review", label: "overdue-under-review as true false", defaultSelected: false },
      { key: "Overdue-under printing", label: "over due-under printing as true false", defaultSelected: false },
    ];
    // Generate filename with current date and filters
    const dateStr = new Date().toISOString().split("T")[0];
    const searchStr = debouncedQuery ? `_search` : "";
    const statusStr = selectedStatus && selectedStatus !== "all" ? `_${selectedStatus}` : "";
    const overdueStr = selectedStatus === "overdue" && selectedOverdueType ? `_${selectedOverdueType}` : "";
    const filename = `alumni_cards_export${statusStr}${overdueStr}${searchStr}_${dateStr}`;

    // Open export modal immediately with async data function
    openExportModal({
      data: fetchAndTransformData,
      columns,
      filename,
      sheetName: "Alumni Cards",
    });
  }, [debouncedQuery, selectedStatus, selectedOverdueType, openExportModal, overdueByAlumniSet]);

  const handleStatusChangeRequest = React.useCallback((change: PendingCardStatusChange) => {
    setStatusChangeError(null);
    setPendingCardStatusChange(change);
    setShowStatusConfirmModal(true);
  }, []);

  const handleCancelCardStatusChange = React.useCallback(() => {
    setShowStatusConfirmModal(false);
    setPendingCardStatusChange(null);
    setStatusChangeError(null);
  }, []);

  const handleConfirmCardStatusChange = React.useCallback(async () => {
    if (!pendingCardStatusChange) return;

    if (pendingCardStatusChange.toStatus === "Onhold") {
      const reason = String(pendingCardStatusChange.reason || "").trim();
      if (!reason) {
        setStatusChangeError("Reason is required when status is Onhold");
        return;
      }
      const validReasons = ON_HOLD_REASON_OPTIONS.map((o) => o.value);
      if (!validReasons.includes(reason as OnHoldReason)) {
        setStatusChangeError("Please select a valid On Hold reason from the list");
        return;
      }
    }

    setIsStatusUpdating(true);
    setStatusChangeError(null);
    try {
      await submitCardStatusChange(
        pendingCardStatusChange.sapId,
        pendingCardStatusChange.toStatus,
        pendingCardStatusChange.reason || "",
        queryClient
      );
      setShowStatusConfirmModal(false);
      setPendingCardStatusChange(null);
    } catch (err) {
      setStatusChangeError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setIsStatusUpdating(false);
    }
  }, [pendingCardStatusChange, queryClient]);


  const RowActions: React.FC<{ sapId: string; studentName: string; alumItem: AlumniListItem }> = ({ sapId, studentName, alumItem }) => {
    const { data: session } = useSession();
    const queryClient = useQueryClient();
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [showDeleteModal, setShowDeleteModal] = React.useState(false);
    const [deleteError, setDeleteError] = React.useState<string | null>(null);
    const [isSavingPicture, setIsSavingPicture] = React.useState(false);
    const [showCropModal, setShowCropModal] = React.useState(false);
    const [pendingCropFile, setPendingCropFile] = React.useState<File | null>(null);
    
    // Preview button available for ALL statuses (fixed rendering issue - no conditional logic)
    const canPreview = true;
    const canEdit = canModify(session?.user); // Includes both admin and superadmin
    
    const handleView = React.useCallback(() => {
      if (typeof window === "undefined") return;
      const url = `/alumni-profile?sapid=${encodeURIComponent(sapId)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    }, [sapId]);

    const handleDelete = async () => {
      if (!sapId || sapId.trim() === "") {
        setDeleteError("Invalid SAP ID");
        return;
      }

      setIsDeleting(true);
      setDeleteError(null);

      try {
        const res = await fetch(`/api/alumni-cards/by-sap/${encodeURIComponent(sapId)}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: "Failed to delete card" }));
          throw new Error(errorData.error || `Failed to delete: ${res.status}`);
        }

        // Invalidate queries to refresh the list and card status
        // Card applicants lists use the key prefix ["alumni", "card", "applicants", status]
        queryClient.invalidateQueries({ queryKey: ["alumni", "card", "applicants"], exact: false });
        queryClient.invalidateQueries({ queryKey: ["alumni-cards", "status", sapId] });
        
        setShowDeleteModal(false);
        // Optionally show success message or trigger a callback
        onRowAction?.(alumItem, "delete");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to delete card";
        setDeleteError(msg);

      } finally {
        setIsDeleting(false);
      }
    };

    const handleEditPicture = async () => {
      if (!sapId || sapId.trim() === "") {
        toast.error("Invalid SAP ID");
        return;
      }
      const alumniId = alumItem.alumniid;
      if (!alumniId) {
        toast.error("Missing alumniId for this record");
        return;
      }

      try {
        setIsSavingPicture(true);
        setShowCropModal(true);
        setPendingCropFile(null);

        const res = await fetch(`/api/alumni-cards/by-sap/${encodeURIComponent(sapId)}`, { cache: "no-store" });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || `Failed to load card (${res.status})`);
        }
        const j = await res.json();
        const card = (j?.card ?? null) as { cardpicture?: string | null; card_image?: string | null } | null;
        let raw = String(card?.cardpicture ?? card?.card_image ?? "").trim();

        // Some card records do not store cardpicture/card_image, even though the picture exists
        // (e.g. stored only in tbl_alumni image1/image2). Fallback to alumni profile image.
        if (!raw) {
          const alumniRes = await fetch(`/api/alumni/${encodeURIComponent(sapId)}/full-details`, { cache: "no-store" });
          if (!alumniRes.ok) {
            const jj = await alumniRes.json().catch(() => ({}));
            throw new Error(jj?.error || `No card picture found (${alumniRes.status})`);
          }
          const jj = await alumniRes.json().catch(() => ({}));
          const alumni = (jj?.item ?? null) as { image2?: string | null; image1?: string | null } | null;
          raw = String(alumni?.image2 ?? alumni?.image1 ?? "").trim();
          if (!raw) {
            throw new Error("No card picture found for this applicant");
          }
        }

        // cardpicture/card_image may be just a filename, or already contain a path.
        // Normalize to a public URL that Next can serve.
        const normalized = raw
          .replace(/\\/g, "/")
          .replace(/^public\//, "")
          .replace(/^\.\//, "")
          .replace(/^\/public\//, "/")
          .trim();
        const imageUrl = /^https?:\/\//i.test(normalized)
          ? normalized
          : normalized.startsWith("/")
            ? normalized
            : normalized.toLowerCase().startsWith("images/")
              ? `/${normalized}`
              : `/images/${normalized}`;

        const imgRes = await fetch(imageUrl, { cache: "no-store" });
        if (!imgRes.ok) {
          throw new Error(`Failed to load image (${imgRes.status})`);
        }
        const blob = await imgRes.blob();
        const inferredType = blob.type || "image/jpeg";
        const safeName = raw.split("/").pop() || "card-picture.jpg";
        const existingFile = new File([blob], safeName, { type: inferredType });

        setPendingCropFile(existingFile);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load card picture";
        toast.error(msg);
        setPendingCropFile(null);
      } finally {
        setIsSavingPicture(false);
      }
    };

    const uploadCroppedPicture = async (cropped: File) => {
      const alumniId = alumItem.alumniid;
      if (!alumniId) {
        toast.error("Missing alumniId for this record");
        return;
      }

      setIsSavingPicture(true);
      const loadingToast = toast.loading("Saving picture...");
      try {
        const formData = new FormData();
        formData.append("alumniId", String(alumniId));
        formData.append("sapId", String(sapId));
        formData.append("image", cropped);

        const res = await fetch("/api/alumni-cards", {
          method: "POST",
          body: formData,
        });

        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(j?.error || `Failed (${res.status})`);
        }

        toast.dismiss(loadingToast);
        toast.success("Picture updated successfully");

        queryClient.invalidateQueries({ queryKey: ["alumni", "card", "applicants"], exact: false });
        queryClient.invalidateQueries({ queryKey: ["alumni", "card", sapId], exact: true });
      } catch (err) {
        toast.dismiss(loadingToast);
        const msg = err instanceof Error ? err.message : "Failed to save picture";
        toast.error(msg);
      } finally {
        setIsSavingPicture(false);
      }
    };

    return (
      <>
        <PassportPhotoCropModal
          isOpen={showCropModal}
          file={pendingCropFile}
          onClose={() => {
            setShowCropModal(false);
            setPendingCropFile(null);
          }}
          onCropped={(cropped) => {
            setShowCropModal(false);
            setPendingCropFile(null);
            uploadCroppedPicture(cropped);
          }}
          title="Edit Card Picture"
        />
        <div role="group" aria-label="Row actions" className=" items-center gap-2 flex flex-row justify-start flex-wrap">
          {canEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleView();
              }}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              aria-label="View Profile"
              title="View Profile"
            >
              <EyeIcon className="h-4 w-4" />
            </button>
          )}
          {canPreview && (
            <PrintCardButton sapId={sapId} studentName={studentName} registrationNo={alumItem.registrationno} />
          )}
          {canEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleEditPicture();
              }}
              disabled={isSavingPicture || isDeleting}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Edit Picture"
              title="Edit Picture"
            >
              <FileIcon className="h-4 w-4" />
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteModal(true);
              }}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              aria-label="Delete Card"
              title="Delete Card"
            >
              <TrashBinIcon className="h-4 w-4" />
            </button>
          )}
        </div>
        
        <Modal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setDeleteError(null);
          }}
          showCloseButton={true}
        >
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Delete Alumni Card
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Are you sure you want to delete the card for <strong>{studentName}</strong> (SAP ID: {sapId})?
              <br />
              <span className="text-sm text-amber-600 dark:text-amber-400 mt-2 block">
                This will delete the card record and associated images. The alumni record will not be affected.
              </span>
            </p>
            
            {deleteError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800/50 px-4 py-3 text-sm text-red-800 dark:text-red-200">
                {deleteError}
              </div>
            )}
            
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? "Deleting..." : "Delete Card"}
              </button>
            </div>
          </div>
        </Modal>
      </>
    );
  };

  return (
    <section aria-labelledby="alumni-table-title" className="w-full">
      {/* ─── Enhanced Toolbar ─── */}
      <div className="mb-6 flex flex-col gap-4  py-2 px-2 	 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex-1 w-full lg:max-w-xl">
          <label 
            htmlFor="alumni-card-table-search" 
            className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-[0.15em]"
          >
            Search Alumni Cards
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg 
                className="h-5 w-5 text-gray-400 transition-colors group-focus-within:text-blue-500" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              id="alumni-card-table-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, degree, company, contact..."
              className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-900 placeholder-gray-400 shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-600 dark:hover:border-gray-600"
              aria-label="Search alumni"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Clear search"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 dark:bg-gray-900 dark:border-gray-800">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Total:</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{total.toLocaleString()}</span>
          </div>
          <button
            type="button"
            onClick={handleExportToExcel}
            disabled={isExporting || effectiveLoading || filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-500/20 hover:bg-emerald-700 hover:shadow-md hover:shadow-emerald-500/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-200 active:scale-[0.98]"
          >
            {isExporting ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Export Excel</span>
              </>
            )}
          </button>
        </div>
      </div>
  
      {/* ─── Main Table Container ─── */}
      <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-xl shadow-gray-200/50 dark:border-gray-800 dark:bg-gray-900 dark:shadow-none">
        {/* Synced Scrollbar */}
        <div 
          ref={topScrollbarRef}
          className="top-horizontal-scrollbar w-full overflow-x-auto overflow-y-hidden border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50"
          style={{
            height: "24px",
            scrollbarWidth: "auto",
            scrollbarColor: "#3b82f6 #e5e7eb",
          }}
        >
          <div className="table-scrollbar-content h-full" style={{ minWidth: "800px" }} />
        </div>
  
        <div 
          ref={tableContainerRef}
          className="max-w-full overflow-x-auto custom-scrollbar max-h-[680px] overflow-y-auto relative"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
          aria-live="polite"
        >
          <div className="table-content-wrapper" style={{ minWidth: "1400px" }}>
            <table className="min-w-full border-collapse">
              {/* ─── Table Header ─── */}
              <thead className="sticky top-0 z-20">
                <tr className="bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
                  <th className="w-12 px-4 py-4 text-left">
                    <span className="sr-only">Expand</span>
                  </th>
                  
                  <SortableHeader 
                    label="Full Name" 
                    sortKey="name" 
                    currentSort={sortKey} 
                    sortDir={sortDir} 
                    onSort={toggleSort}
                    className="min-w-[180px]"
                  />
                  
                  <SortableHeader 
                    label="SAP ID / Reg. No" 
                    sortKey="id" 
                    currentSort={sortKey} 
                    sortDir={sortDir} 
                    onSort={toggleSort}
                    className="min-w-[140px]"
                  />
                  
                  <SortableHeader 
                    label="Email" 
                    sortKey="contact" 
                    currentSort={sortKey} 
                    sortDir={sortDir} 
                    onSort={toggleSort}
                    className="min-w-[220px] hidden lg:table-cell"
                  />
                  
                  <th className="px-4 py-4 text-left text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[240px] hidden lg:table-cell">
                    Home Address
                  </th>
                  
                  <th className="px-4 py-4 text-left text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[240px] hidden lg:table-cell">
                    Delivery Address
                  </th>
                  
                  <th className="px-4 py-4 text-left text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[130px] hidden lg:table-cell">
                    Applied On
                  </th>
                  
                  <th className="px-4 py-4 text-left text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[140px]">
                    Status
                  </th>
                  
                  <SortableHeader 
                    label="Faculty" 
                    sortKey="faculty" 
                    currentSort={sortKey} 
                    sortDir={sortDir} 
                    onSort={toggleSort}
                    className="min-w-[160px] hidden md:table-cell"
                  />
                  
                  <SortableHeader 
                    label="Department" 
                    sortKey="department" 
                    currentSort={sortKey} 
                    sortDir={sortDir} 
                    onSort={toggleSort}
                    className="min-w-[160px] hidden md:table-cell"
                  />
                  
                  <SortableHeader 
                    label="Program" 
                    sortKey="program" 
                    currentSort={sortKey} 
                    sortDir={sortDir} 
                    onSort={toggleSort}
                    className="min-w-[180px] hidden md:table-cell"
                  />
                  
                  <th className="px-4 py-4 text-center text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[100px]">
                    <span className="inline-flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Overdue
                    </span>
                  </th>
                  
                  <th className="px-4 py-4 text-right text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[140px] sticky right-0 bg-gray-50 dark:bg-gray-900 z-30 shadow-[-4px_0_12px_-6px_rgba(0,0,0,0.1)]">
                    Actions
                  </th>
                </tr>
              </thead>
  
              {/* ─── Table Body ─── */}
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                {effectiveLoading && <TableSkeletons pageSize={pageSize} />}
                
                {!effectiveLoading && effectiveError && <ErrorState message={effectiveError} />}
                
                {!effectiveLoading && !effectiveError && pageItems.length === 0 && (
                  <EmptyState query={debouncedQuery} />
                )}
  
                {!effectiveLoading && !effectiveError && pageItems.map((alum, idx) => (
                  <AlumniTableRow
                    key={`${alum.id}-${idx}`}
                    alum={alum}
                    idx={idx}
                    isSelected={selectedRowId === alum.id}
                    isExpanded={expandedRowId === alum.id}
                    onSelect={() => setSelectedRowId(alum.id)}
                    onToggleExpand={() => setExpandedRowId(expandedRowId === alum.id ? null : alum.id)}
                    isOverdue={overdueByAlumniSet.has(alum.id)}
                    onToggleOverdue={(checked) => {
                      setPendingOverdueByAlumniChange({ item: alum, checked });
                      setShowOverdueByAlumniConfirmModal(true);
                    }}
                    canEdit={canEdit}
                    onStatusChangeRequest={handleStatusChangeRequest}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
  
        {/* ─── Table Footer ─── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-4 bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {total > 0 ? ((currentPage - 1) * pageSize + 1).toLocaleString() : 0}
              </span>
              {" - "}
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {Math.min(currentPage * pageSize, total).toLocaleString()}
              </span>
              {" of "}
              <span className="font-semibold text-gray-900 dark:text-white">{total.toLocaleString()}</span>
              {" results"}
            </span>
            {debouncedQuery && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium dark:bg-blue-900/20 dark:text-blue-400">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {debouncedQuery}
                <button 
                  onClick={() => setQuery("")}
                  className="ml-1 hover:text-blue-900"
                  aria-label="Clear filter"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(p) => {
              const newPage = Math.max(1, Math.min(totalPages, p));
              setCurrentPage(newPage);
              tableContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              topScrollbarRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
            }}
          />
        </div>
      </div>
  
      {/* ─── Overdue Confirmation Modal ─── */}
      <Modal
        isOpen={showOverdueByAlumniConfirmModal}
        onClose={() => {
          setShowOverdueByAlumniConfirmModal(false);
          setPendingOverdueByAlumniChange(null);
        }}
        className="max-w-md mx-auto"
        showCloseButton={true}
      >
        <div className="p-6">
          <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-4 dark:bg-amber-900/20">
            <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
            {pendingOverdueByAlumniChange?.checked ? "Mark as Overdue" : "Remove Overdue Flag"}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
            {pendingOverdueByAlumniChange?.checked
              ? `Are you sure you want to mark ${pendingOverdueByAlumniChange.item.name} as overdue by alumni? This will flag the record for follow-up.`
              : `Remove the overdue flag for ${pendingOverdueByAlumniChange?.item.name}? The record will return to normal status.`}
          </p>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              className="px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              onClick={() => {
                setShowOverdueByAlumniConfirmModal(false);
                setPendingOverdueByAlumniChange(null);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`px-4 py-2.5 rounded-xl text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all active:scale-[0.98] ${
                pendingOverdueByAlumniChange?.checked
                  ? "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500"
                  : "bg-gray-800 hover:bg-gray-900 focus:ring-gray-500"
              }`}
              onClick={() => {
                if (pendingOverdueByAlumniChange) {
                  onToggleOverdueByAlumni?.(
                    pendingOverdueByAlumniChange.item,
                    pendingOverdueByAlumniChange.checked,
                  );
                }
                setShowOverdueByAlumniConfirmModal(false);
                setPendingOverdueByAlumniChange(null);
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      </Modal>
  
      {/* ─── Scrollbar Styles ─── */}
      <style jsx global>{`
        .top-horizontal-scrollbar::-webkit-scrollbar {
          height: 24px !important;
        }
        .top-horizontal-scrollbar::-webkit-scrollbar-track {
          background: #e5e7eb !important;
          border-radius: 0 !important;
        }
        .top-horizontal-scrollbar::-webkit-scrollbar-thumb {
          background: #3b82f6 !important;
          border-radius: 12px !important;
          border: 3px solid #e5e7eb !important;
          min-width: 50px !important;
        }
        .top-horizontal-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #2563eb !important;
          border-color: #d1d5db !important;
        }
        .top-horizontal-scrollbar::-webkit-scrollbar-thumb:active {
          background: #1d4ed8 !important;
        }
        .custom-scrollbar::-webkit-scrollbar {
          display: none !important;
        }
        .custom-scrollbar {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
      `}</style>
      <CardStatusConfirmModal
        pending={pendingCardStatusChange}
        isOpen={showStatusConfirmModal}
        isUpdating={isStatusUpdating}
        error={statusChangeError}
        onClose={handleCancelCardStatusChange}
        onConfirm={handleConfirmCardStatusChange}
        onReasonChange={(reason) =>
          setPendingCardStatusChange((prev) => (prev ? { ...prev, reason } : prev))
        }
        onClearError={() => setStatusChangeError(null)}
      />

      <ExportModal />
    </section>
  );
  
  // ─── Sub-Components ───
  
  function SortableHeader({ 
    label, 
    sortKey, 
    currentSort, 
    sortDir, 
    onSort,
    className = ""
  }: { 
    label: string; 
    sortKey: SortKey; 
    currentSort: SortKey; 
    sortDir: SortDirection; 
    onSort: (key: SortKey) => void;
    className?: string;
  }) {
    const isActive = currentSort === sortKey;
    
    return (
      <th 
        className={`px-4 py-4 text-left cursor-pointer group transition-colors hover:bg-gray-100/50 dark:hover:bg-gray-800/50 ${className}`}
        onClick={() => onSort(sortKey)}
        aria-sort={isActive ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-bold uppercase tracking-wider transition-colors ${
            isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300"
          }`}>
            {label}
          </span>
          <div className="flex flex-col gap-0">
            <svg 
              className={`w-3 h-3 transition-colors ${isActive && sortDir === "asc" ? "text-blue-500" : "text-gray-300 dark:text-gray-600"}`} 
              fill="currentColor" 
              viewBox="0 0 24 24"
            >
              <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z" />
            </svg>
            <svg 
              className={`w-3 h-3 -mt-1 transition-colors ${isActive && sortDir === "desc" ? "text-blue-500" : "text-gray-300 dark:text-gray-600"}`} 
              fill="currentColor" 
              viewBox="0 0 24 24"
            >
              <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z" />
            </svg>
          </div>
        </div>
      </th>
    );
  }
  
  function TableSkeletons({ pageSize }: { pageSize: number }) {
    return (
      <>
        {Array.from({ length: Math.min(pageSize, 6) }).map((_, i) => (
          <tr key={`skeleton-${i}`} className="animate-pulse">
            <td className="px-4 py-5">
              <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded-md" />
            </td>
            <td className="px-4 py-5">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700" />
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </td>
            <td className="px-4 py-5">
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
            </td>
            <td className="px-4 py-5 hidden lg:table-cell">
              <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
            </td>
            <td className="px-4 py-5 hidden lg:table-cell">
              <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
            </td>
            <td className="px-4 py-5 hidden lg:table-cell">
              <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
            </td>
            <td className="px-4 py-5 hidden lg:table-cell">
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
            </td>
            <td className="px-4 py-5">
              <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded-full" />
            </td>
            <td className="px-4 py-5 hidden md:table-cell">
              <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
            </td>
            <td className="px-4 py-5 hidden md:table-cell">
              <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
            </td>
            <td className="px-4 py-5 hidden md:table-cell">
              <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
            </td>
            <td className="px-4 py-5">
              <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded mx-auto" />
            </td>
            <td className="px-4 py-5 sticky right-0 z-10 bg-white dark:bg-gray-900 shadow-[-8px_0_16px_-8px_rgba(0,0,0,0.05)]">
              <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg ml-auto" />
            </td>
          </tr>
        ))}
      </>
    );
  }
  
  function ErrorState({ message }: { message: string }) {
    return (
      <tr>
        <td className="px-6 py-16 text-center" colSpan={13}>
          <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center dark:bg-red-900/20">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">Failed to load data</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100 transition-colors dark:bg-red-900/20 dark:text-red-400"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry
            </button>
          </div>
        </td>
      </tr>
    );
  }
  
  function EmptyState({ query }: { query: string }) {
    return (
      <tr>
        <td className="px-6 py-16 text-center" colSpan={13}>
          <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center dark:bg-gray-800">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
                No alumni found{query ? ` for "${query}"` : ""}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {query ? "Try adjusting your search terms or clearing filters" : "No records match the current filters"}
              </p>
            </div>
            {query && (
              <button 
                onClick={() => {/* clear query */}}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors dark:bg-gray-800 dark:text-gray-300"
              >
                Clear Search
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  }
  
  function AlumniTableRow({ 
    alum, 
    idx, 
    isSelected, 
    isExpanded, 
    onSelect, 
    onToggleExpand,
    isOverdue,
    onToggleOverdue,
    canEdit,
    onStatusChangeRequest,
  }: {
    alum: AlumniListItem;
    idx: number;
    isSelected: boolean;
    isExpanded: boolean;
    onSelect: () => void;
    onToggleExpand: () => void;
    isOverdue: boolean;
    onToggleOverdue: (checked: boolean) => void;
    canEdit: boolean;
    onStatusChangeRequest: (change: PendingCardStatusChange) => void;
  }) {
    const rowBg = isSelected 
      ? "bg-blue-50/70 dark:bg-blue-900/20" 
      : idx % 2 === 0 
        ? "bg-white dark:bg-gray-900" 
        : "bg-gray-50/50 dark:bg-gray-800/30";
  
    return (
      <>
        <tr
          className={`group transition-all duration-200 ${rowBg} hover:bg-blue-50/40 dark:hover:bg-white/[0.03] ${isSelected ? "ring-1 ring-inset ring-blue-200 dark:ring-blue-800" : ""}`}
          onClick={onSelect}
          aria-selected={isSelected}
        >
          <td className="px-4 py-4">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
              className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200 ${
                isExpanded
                  ? "bg-blue-100 text-blue-700 rotate-45 dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
              }`}
              aria-label={isExpanded ? "Collapse details" : "Expand details"}
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          </td>
          
          <td className="px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-xs font-bold text-blue-700 dark:from-blue-900/30 dark:to-indigo-900/30 dark:text-blue-400">
                {alum.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                  {toTitleCase(alum.name)}
                </div>
                {alum.email && (
                  <div className="text-xs text-gray-500 dark:text-gray-500 lg:hidden">
                    {formatEmail(alum.email)}
                  </div>
                )}
              </div>
            </div>
          </td>
          
          <td className="px-4 py-4">
            <div className="font-mono text-xs text-gray-700 dark:text-gray-300">
              {formatSapId(alum.id)}
            </div>
            {alum.registrationno && (
              <div className="text-[11px] text-gray-400 mt-0.5 font-mono">{alum.registrationno}</div>
            )}
          </td>
          
          <td className="px-4 py-4 hidden lg:table-cell">
            <a 
              href={alum.email ? `mailto:${alum.email}` : undefined}
              className={`text-sm ${alum.email ? "text-blue-600 hover:text-blue-700 hover:underline font-medium" : "text-gray-400"} transition-colors`}
            >
              {formatEmail(alum.email)}
            </a>
          </td>
          
          <td className="px-4 py-4 hidden lg:table-cell">
            <div className="max-w-[260px] text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2">
              {alum.cardaddress?.trim() || "-"}
            </div>
          </td>
          
          <td className="px-4 py-4 hidden lg:table-cell">
            <div className="max-w-[260px] space-y-0.5 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
              {formatCardDeliveryAddressLabeled(
                alum.deliveryCity,
                alum.deliverySocietyName,
                alum.deliveryStreetNo,
                alum.deliveryHouseNo
              ).map(({ label, value }) => (
                <div key={label} className="line-clamp-1">
                  <span className="font-medium text-gray-500 dark:text-gray-500">{label}.</span>{" "}
                  <span className={value === "-" ? "text-gray-400 dark:text-gray-500" : ""}>{value}</span>
                </div>
              ))}
            </div>
          </td>
          
          <td className="px-4 py-4 hidden lg:table-cell">
            <span className="text-sm text-gray-600 dark:text-gray-400 tabular-nums">
              {formatApplicationDate(alum.createdAt)}
            </span>
          </td>
          
          <td className="px-4 py-4">
            <CardStatusSelect
              sapId={alum.id}
              alumniId={alum.alumniid ?? null}
              recipientEmail={alum.email ?? null}
              alumniName={alum.name}
              initialStatus={alum.status}
              readOnly={!canEdit}
              onStatusChangeRequest={onStatusChangeRequest}
            />
          </td>
          
          <td className="px-4 py-4 hidden md:table-cell">
            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-100 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {alum.faculty || "-"}
            </span>
          </td>
          
          <td className="px-4 py-4 hidden md:table-cell">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {alum.department || "-"}
            </span>
          </td>
          
          <td className="px-4 py-4 hidden md:table-cell">
            <span className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
              {alum.program || "-"}
            </span>
          </td>
          
          <td className="px-4 py-4 text-center">
            <label className="relative inline-flex items-center cursor-pointer group/check">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={isOverdue}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onToggleOverdue(e.target.checked)}
                aria-label={`Mark ${alum.name} as overdue by alumni`}
              />
              <div className={`w-5 h-5 rounded border-2 transition-all duration-200 flex items-center justify-center ${
                isOverdue 
                  ? "bg-amber-500 border-amber-500" 
                  : "border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500"
              }`}>
                {isOverdue && (
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </label>
          </td>
          
          <td className={`px-4 py-4 text-right sticky right-0 z-10 transition-colors ${
            isSelected 
              ? "bg-blue-50 dark:bg-blue-900" 
              : idx % 2 === 0 
                ? "bg-white dark:bg-gray-900" 
                : "bg-gray-50 dark:bg-gray-800"
          } shadow-[-8px_0_16px_-8px_rgba(0,0,0,0.05)]`}>
            <RowActions sapId={alum.id} studentName={alum.name} alumItem={alum} />
          </td>
        </tr>
        
        {isExpanded && (
          <tr className="bg-blue-50/30 dark:bg-blue-900/5">
            <td colSpan={13} className="px-0 py-0">
              <div className="p-6 border-t border-blue-100 dark:border-blue-900/20">
                <div className="flex gap-6 overflow-x-auto pb-2">
                  <AlumniExpandableDetails 
                    sapId={alum.id} 
                    onClose={() => {}} 
                    readOnly={!canEdit} 
                  />
                  <ErpDataDetails 
                    sapId={alum.id} 
                    registrationNo={alum.registrationno ?? null} 
                    onClose={() => {}} 
                  />
                </div>
              </div>
            </td>
          </tr>
        )}
      </>
    );
  }
};
