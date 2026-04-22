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
import { SendEmailButton } from "@/components/email/SendEmailButton";
import { EMAIL_ACTION_TYPE, generateAdminActionEmail } from "@/lib/emailTemplates";
import { 
  type CardStatus, 
  type DbCardStatus,
  CARD_STATUS_CONFIG, 
  mapDbStatusToUI, 
  mapUIStatusToDb, 
  getStatusLabel,
  normalizeDbStatus 
} from "@/lib/card-status-config";
import { formatCardDeliveryAddressLine } from "@/lib/cardDeliveryAddress";

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
  selectedStatus?: CardStatusFilter;
  selectedOverdueType?: OverdueType;
  onRowAction?: (item: AlumniListItem, action: ActionKey) => void;
}

export const AlumniDataTable: React.FC<AlumniDataTableProps> = ({
  items,
  loading = false,
  error,
  defaultPageSize = 10,
  selectedStatus = "all",
  selectedOverdueType,
  onRowAction,
}) => {
  const [query, setQuery] = React.useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = React.useState<string>("");
  const [selectedDeliveryPreference, setSelectedDeliveryPreference] = React.useState<"all" | "collect" | "deliver">("all");
  const [sortKey, setSortKey] = React.useState<SortKey>("name");
  const [sortDir, setSortDir] = React.useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = React.useState<number>(1);
  const [pageSize] = React.useState<number>(defaultPageSize);
  const [selectedRowId, setSelectedRowId] = React.useState<string | null>(null);
  const [expandedRowId, setExpandedRowId] = React.useState<string | null>(null);
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
          deliveryStreetNo: (r as { delivery_street_no?: string | null }).delivery_street_no ?? null,
          deliveryHouseNo: (r as { delivery_house_no?: string | null }).delivery_house_no ?? null,
        };
      }) as AlumniListItem[];
    }
    return items;
  }, [items, applicants]);

  const effectiveLoading = loading || applicantsLoading;
  const effectiveError: string | null = error ?? (applicantsError ? (applicantsErrorObj?.message || "Failed to load applicants") : null);

  const getDeliveryPreference = React.useCallback((item: AlumniListItem): "collect" | "deliver" => {
    const cardAddress = String(item.cardaddress ?? "").trim().toLowerCase();
    if (!cardAddress || cardAddress === "collect from campus") {
      return "collect";
    }
    return "deliver";
  }, []);

  const statusFilteredItems = React.useMemo(() => {
    let filteredByStatus = baseItems;

    // Filter by status - strict matching
    if (selectedStatus !== "all" && selectedStatus !== "overdue") {
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

    return filteredByStatus;
  }, [baseItems, selectedStatus]);

  const deliveryPreferenceCounts = React.useMemo(() => {
    let collect = 0;
    let deliver = 0;
    for (const item of statusFilteredItems) {
      if (getDeliveryPreference(item) === "collect") collect += 1;
      else deliver += 1;
    }
    return { collect, deliver };
  }, [statusFilteredItems, getDeliveryPreference]);

  const filtered = React.useMemo(() => {
    let filteredByDelivery = statusFilteredItems;

    if (selectedDeliveryPreference !== "all") {
      filteredByDelivery = statusFilteredItems.filter(
        (i) => getDeliveryPreference(i) === selectedDeliveryPreference,
      );
    }

    // Filter by search query
    if (!debouncedQuery) return filteredByDelivery;
    const q = debouncedQuery.toLowerCase();
    return filteredByDelivery.filter((i) => {
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
  }, [statusFilteredItems, selectedDeliveryPreference, getDeliveryPreference, debouncedQuery]);

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
  }, [debouncedQuery, sortKey, sortDir, pageSize, selectedStatus, selectedDeliveryPreference]);

  // Sync scroll between top scrollbar and table container
  React.useEffect(() => {
    const tableContainer = tableContainerRef.current;
    const topScrollbar = topScrollbarRef.current;
    
    if (!tableContainer || !topScrollbar) return;

    // Sync scrollbar width with table content
    const syncScrollbarWidth = () => {
      const tableContent = tableContainer.querySelector('.table-content-wrapper') as HTMLElement;
      if (tableContent) {
        const scrollbarContent = topScrollbar.querySelector('.table-scrollbar-content') as HTMLElement;
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

    const tableContent = tableContainer.querySelector('.table-content-wrapper');
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
      if (selectedStatus && selectedStatus !== "all") {
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
      const allItems = data.items || [];

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
  }, [debouncedQuery, selectedStatus, selectedOverdueType, openExportModal]);

  const StatusSelect: React.FC<{
    sapId: string;
    alumniId?: number | null;
    recipientEmail?: string | null;
    alumniName?: string;
    initialStatus?: CardStatus;
    readOnly?: boolean;
  }> = ({ sapId, alumniId, recipientEmail, alumniName, initialStatus, readOnly = false }) => {
    const { data: session } = useSession();
    const queryClient = useQueryClient();
    // Database values: "Pending", "Process", "Active", "Delivered", "Onhold", "UnderPrinting"
    const [localStatus, setLocalStatus] = React.useState<DbCardStatus | null>(null);
    const [showReasonInput, setShowReasonInput] = React.useState<boolean>(false);
    const [isUpdating, setIsUpdating] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [showConfirmModal, setShowConfirmModal] = React.useState(false);
    const [pendingStatusChange, setPendingStatusChange] = React.useState<{ status: DbCardStatus; reason?: string } | null>(null);
    const hasUpdatedRef = React.useRef(false);
    const canEdit = canModify(session?.user); // Includes both admin and superadmin
    
    // Map UI status (from items list) to DB status using centralized config
    const getDbStatusFromUI = (uiStatus?: CardStatus): DbCardStatus => {
      const dbStatus = mapUIStatusToDb(uiStatus || "under-review");
      return dbStatus || "UnderReview";
    };
    
    // Get initial DB status from item prop or fetch from API
    const initialDbStatus = initialStatus ? getDbStatusFromUI(initialStatus) : null;
    
    // Always fetch card data to get reason_onhold, even if we have initialStatus
    const { data, isLoading } = useCardStatus(sapId);
    
    // Initialize local state from props first, then from fetched data
    React.useEffect(() => {
      if (!hasUpdatedRef.current && data !== undefined) {
        if (data?.status) {
          // Normalize and migrate database status
          const normalizedStatus = normalizeDbStatus(data.status);
          setLocalStatus(normalizedStatus);
          
          // Always load reason from database when status is Onhold
          if (normalizedStatus === "Onhold" && data.reason_onhold) {
            setShowReasonInput(true);
          }
        } else {
          // If no data from API but we have initial status, use that
          if (initialDbStatus && !data) {
            setLocalStatus(initialDbStatus);
          } else {
            setLocalStatus("UnderReview");
          }
        }
      } else if (initialDbStatus && !hasUpdatedRef.current && !data) {
        // Fallback: use initial status if no data fetched yet
        setLocalStatus(initialDbStatus);
      }
    }, [data, initialDbStatus]);
    
    // Sync local state with initialStatus prop if it changes (but only if we haven't manually updated)
    React.useEffect(() => {
      if (!hasUpdatedRef.current && initialDbStatus && localStatus !== initialDbStatus) {
        setLocalStatus(initialDbStatus);
      }
    }, [initialDbStatus, localStatus]);
    
    const current = localStatus ?? initialDbStatus ?? (data?.status ? normalizeDbStatus(data.status) : "UnderReview");
    
    // Show reason input when Onhold is selected
    React.useEffect(() => {
      setShowReasonInput(current === "Onhold");
      // Don't auto-fill the input field - it should only show what user types
      // The database reason is displayed in the "Current Reason (from database)" section
    }, [current]);
    
    const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const next = normalizeDbStatus(e.target.value) as DbCardStatus;
      
      // Don't update if same status
      if (next === current) return;
      
      // For other statuses, show confirmation modal first (for admins and superadmins)
      if (canEdit) {
        setPendingStatusChange({ status: next, reason: next === "Onhold" ? "" : undefined });
        setShowConfirmModal(true);
      } else {
        // Non-admins/superadmins can change status directly (shouldn't happen, but just in case)
        await submitStatusChange(next, "");
      }
    };
    
    const handleConfirmStatusChange = async () => {
      if (!pendingStatusChange) return;
      if (pendingStatusChange.status === "Onhold" && !String(pendingStatusChange.reason || "").trim()) {
        setError("Reason is required when status is Onhold");
        return;
      }
      setShowConfirmModal(false);
      await submitStatusChange(pendingStatusChange.status, pendingStatusChange.reason || "");
      setPendingStatusChange(null);
    };
    
    const handleCancelStatusChange = () => {
      setShowConfirmModal(false);
      // Revert local status to the actual current status from data
      if (data?.status) {
        const normalizedStatus = normalizeDbStatus(data.status);
        setLocalStatus(normalizedStatus);
      } else {
        setLocalStatus("UnderReview");
      }
      setPendingStatusChange(null);
    };
    
    const submitStatusChange = async (next: DbCardStatus, reason: string) => {
      // Optimistic update
      const previousStatus = localStatus ?? (data?.status ? normalizeDbStatus(data.status) : "UnderReview");
      setLocalStatus(next);
      setIsUpdating(true);
      setError(null);
      hasUpdatedRef.current = true; // Mark that we've manually updated
      
      try {
        const body: { status: string; reason_onhold?: string } = { status: next };
        if (next === "Onhold" && reason) {
          body.reason_onhold = reason;
        }
        
        const res = await fetch(`/api/alumni-cards/by-sap/${encodeURIComponent(sapId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || `Failed (${res.status})`);
        }
        
        // Update local cache with the new status immediately
        queryClient.setQueryData(cardStatusKey(sapId), (old: CardData | null) => {
          if (!old) {
            // If no old data, create a minimal card data object
            return {
              cardid: 0,
              alumniid: 0,
              cnicno: null,
              cardaddress: null,
              status: next,
              cardpicture: null,
              card_image: null,
              createdat: null,
              reason_onhold: next === "Onhold" ? reason : null,
            };
          }
          return { 
            ...old, 
            status: next,
            reason_onhold: next === "Onhold" ? reason : null
          };
        });
        
        // Keep local state as the new status (don't let refetch override it)
        setLocalStatus(next);
        
        // Reorder items to move the updated item to the first position
        const statuses: CardStatusFilter[] = ["all", "under-review", "underprinting", "active", "onhold", "delivered"];
        for (const s of statuses) {
          const key = cardApplicantsKey(s);
          const current = queryClient.getQueryData<CardApplicantsResponse>(key);
          
          if (current) {
            const itemIndex = current.items.findIndex((r) => String(r.sapid) === String(sapId));
            if (itemIndex !== -1 && itemIndex !== 0) {
              // Move the updated item to the first position
              const updatedItem = { ...current.items[itemIndex], status: next };
              const reorderedItems = [
                updatedItem,
                ...current.items.slice(0, itemIndex),
                ...current.items.slice(itemIndex + 1)
              ];
              queryClient.setQueryData(key, {
                ...current,
                items: reorderedItems,
              });
            } else if (itemIndex !== -1) {
              // Item is already first, just update its status
              const updatedItem = { ...current.items[itemIndex], status: next };
              queryClient.setQueryData(key, {
                ...current,
                items: [
                  updatedItem,
                  ...current.items.slice(1)
                ],
              });
            }
          }
        }
        
        // If status is Onhold and reason was saved, clear the input field after a short delay
        // This allows the cache update to complete first, then the reason will be displayed from database
        if (next === "Onhold" && reason) {
          // no-op (reason is chosen in modal)
        }
        
        // Invalidate applicants list to update counts, but debounce to prevent rapid refetches
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["alumni", "card", "applicants"], exact: false });
        }, 500);
        
      } catch (err) {
        // Revert on error
        setLocalStatus(previousStatus);
        hasUpdatedRef.current = false; // Reset flag on error
        const errorMsg = err instanceof Error ? err.message : "Failed to update status";
        setError(errorMsg);

      } finally {
        setIsUpdating(false);
      }
    };
    
    // Map status to display label using centralized config
    const uiStatus = current ? mapDbStatusToUI(current) : "under-review";
    const statusLabel = getStatusLabel(uiStatus);
    
    if (readOnly) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">{statusLabel}</span>
          {current === "Onhold" && data?.reason_onhold && (
            <span className="text-[10px] text-gray-500" title={data.reason_onhold}>
              (Reason: {data.reason_onhold})
            </span>
          )}
        </div>
      );
    }
    
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <select
            aria-label="Card status"
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-[12px] text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
            value={current}
            disabled={isLoading || isUpdating || readOnly}
            onChange={handleStatusChange}
          >
            {Object.entries(CARD_STATUS_CONFIG)
              .filter(([key]) => key !== "all")
              .map(([key, config]) => (
                <option key={key} value={config.dbValue || ""}>
                  {config.label}
                </option>
              ))}
          </select>
          {isUpdating && <span className="text-[11px] text-gray-500">Updating...</span>}
          {error && <span className="text-[11px] text-red-600" title={error}>Error</span>}
        </div>
        {showReasonInput && current === "Onhold" && data?.reason_onhold && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
            <span className="text-[10px] font-semibold text-gray-600">Reason for On Hold:</span>
            <p className="text-[11px] text-gray-800 mt-1">{data.reason_onhold}</p>
          </div>
        )}
        {showReasonInput && current === "Onhold" && !canEdit && data?.reason_onhold && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
            <span className="text-[10px] font-semibold text-gray-600">Reason for On Hold:</span>
            <p className="text-[11px] text-gray-800 mt-1">{data.reason_onhold}</p>
          </div>
        )}
        
        {/* Confirmation Modal for Status Change */}
        {canEdit && (
          <Modal
            isOpen={showConfirmModal}
            onClose={handleCancelStatusChange}
            className="max-w-md mx-auto"
            showCloseButton={true}
          >
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Confirm Status Change</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Are you sure you want to update this card status?
              </p>

              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">New Status:</span>
                  <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                    {pendingStatusChange?.status ? getStatusLabel(mapDbStatusToUI(pendingStatusChange.status)) : "Under-Review"}
                  </span>
                </div>

                {pendingStatusChange?.status === "Onhold" && (
                  <div className="mt-4">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">On Hold Reason</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">This will be stored in database and included in email</div>
                    <select
                      aria-label="On hold reason"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={pendingStatusChange?.reason || ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPendingStatusChange((prev) => (prev ? { ...prev, reason: v } : prev));
                        setError(null);
                      }}
                      disabled={isUpdating}
                    >
                      <option value="">Select reason...</option>
                      <option value="Picture issue">Picture issue</option>
                      <option value="Data Mismatch">Data Mismatch</option>
                    </select>
                  </div>
                )}

                {(() => {
                  const next = pendingStatusChange?.status;
                  if (!next) return null;
                  if (next !== "Onhold" && next !== "Active") return null;
                  if (!alumniId || !recipientEmail) {
                    return (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="text-xs text-amber-700 dark:text-amber-400">
                          Email preview is not available because alumni email or alumniId is missing for this record.
                        </div>
                      </div>
                    );
                  }

                  if (next === "Onhold" && !String(pendingStatusChange?.reason || "").trim()) {
                    return (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="text-xs text-amber-700 dark:text-amber-400">
                          Select an On Hold reason to enable email preview.
                        </div>
                      </div>
                    );
                  }

                  const actionType =
                    next === "Onhold"
                      ? EMAIL_ACTION_TYPE.ALUMNI_CARD_ONHOLD
                      : next === "Active"
                        ? EMAIL_ACTION_TYPE.ALUMNI_CARD_READY_FOR_DELIVERY
                        : EMAIL_ACTION_TYPE.ALUMNI_CARD_READY_FOR_DELIVERY;

                  const tpl = generateAdminActionEmail({
                    actionType,
                    alumniName: alumniName || "Alumni",
                    extraBodyHtml:
                      next === "Onhold" && pendingStatusChange?.reason
                        ? `<p style="margin: 12px 0 0 0; color: #333333; font-size: 14px;"><strong>Reason:</strong> ${String(pendingStatusChange.reason)}</p>`
                        : "",
                  });

                  return (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between gap-3">
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
                          disabled={isUpdating}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancelStatusChange}
                  disabled={isUpdating}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmStatusChange}
                  disabled={isUpdating}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isUpdating ? "Updating..." : "Confirm"}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
  };

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
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-800/50 dark:to-gray-800/30 rounded-2xl p-5 border border-gray-200/50 dark:border-gray-700/50 shadow-sm">
        <div className="flex-1 w-full sm:max-w-lg">
          <label htmlFor="alumni-card-table-search" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2.5 uppercase tracking-wider">
            Search Alumni Cards
          </label>
          <div className="relative">
            <svg 
              className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              id="alumni-card-table-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, degree, company, contact..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300/80 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:text-gray-100 transition-all duration-200"
              aria-label="Search alumni"
            />
          </div>
        </div>
        <div className="w-full sm:w-80">
          <label
            htmlFor="alumni-card-delivery-preference-filter"
            className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2.5 uppercase tracking-wider"
          >
            Delivery Preference
          </label>
          <select
            id="alumni-card-delivery-preference-filter"
            value={selectedDeliveryPreference}
            onChange={(e) => setSelectedDeliveryPreference(e.target.value as "all" | "collect" | "deliver")}
            className="w-full px-4 py-3 rounded-xl border border-gray-300/80 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 transition-all duration-200"
            aria-label="Filter by delivery preference"
          >
            <option value="all">
              All ({statusFilteredItems.length})
            </option>
            <option value="collect">
              Collect from campus ({deliveryPreferenceCounts.collect})
            </option>
            <option value="deliver">
              Deliver to home address ({deliveryPreferenceCounts.deliver})
            </option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportToExcel}
            disabled={isExporting || effectiveLoading || filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isExporting ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export Excel
              </>
            )}
          </button>
          
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-lg dark:border-gray-700/80 dark:bg-gray-800/50">
        {/* Top Horizontal Scrollbar - Prominent and Easy to Interact */}
        <div 
          ref={topScrollbarRef}
          className="top-horizontal-scrollbar w-full overflow-x-auto overflow-y-hidden border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50"
          style={{
            height: '24px',
            scrollbarWidth: 'auto' as const,
            scrollbarColor: '#3b82f6 #e5e7eb',
          }}
        >
          <div className="table-scrollbar-content h-full" style={{ minWidth: '800px' }}></div>
        </div>
        <div 
          ref={tableContainerRef}
          className="max-w-full overflow-x-hidden custom-scrollbar max-h-[700px] overflow-y-auto relative"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
          aria-live="polite"
        >
          <div className="table-content-wrapper" style={{ minWidth: '800px' }}>
            <Table className="min-w-full">
              <TableHeader className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-900/80 dark:to-gray-900/50 sticky top-0 z-10 backdrop-blur-sm">
                <TableRow className="border-b-2 border-gray-200 dark:border-gray-700">
                  <TableCell isHeader className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[50px]">{null}</TableCell>
                  <TableCell 
                    isHeader 
                    className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[150px] cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" 
                    onClick={() => toggleSort("name")} 
                    aria-sort={sortKey === "name" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <div className="flex items-center gap-2">
                      <span>Full Name</span>
                      <div className="flex flex-col">
                        <ArrowUpIcon className={`w-3 h-3 ${sortKey === "name" && sortDir === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                        <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortKey === "name" && sortDir === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell 
                    isHeader 
                    className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px] cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" 
                    onClick={() => toggleSort("id")} 
                    aria-sort={sortKey === "id" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <div className="flex items-center gap-2">
                      <span>SAP ID / Registration</span>
                      <div className="flex flex-col">
                        <ArrowUpIcon className={`w-3 h-3 ${sortKey === "id" && sortDir === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                        <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortKey === "id" && sortDir === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell 
                    isHeader 
                    className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[180px] hidden lg:table-cell cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" 
                    onClick={() => toggleSort("contact")} 
                    aria-sort={sortKey === "contact" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <div className="flex items-center gap-2">
                      <span>Email</span>
                      <div className="flex flex-col">
                        <ArrowUpIcon className={`w-3 h-3 ${sortKey === "contact" && sortDir === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                        <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortKey === "contact" && sortDir === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell 
                    isHeader 
                    className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[200px] hidden lg:table-cell"
                  >
                    <span>Home Address</span>
                  </TableCell>
                  <TableCell 
                    isHeader 
                    className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[200px] hidden lg:table-cell"
                  >
                    <span>Delivery Address</span>
                  </TableCell>
                  <TableCell 
                    isHeader 
                    className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[130px] hidden lg:table-cell"
                  >
                    <span>Application Date</span>
                  </TableCell>
                  <TableCell isHeader className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[100px]">Card Status</TableCell>
                  <TableCell 
                    isHeader 
                    className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px] hidden md:table-cell cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" 
                    onClick={() => toggleSort("faculty")} 
                    aria-sort={sortKey === "faculty" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <div className="flex items-center gap-2">
                      <span>Faculty</span>
                      <div className="flex flex-col">
                        <ArrowUpIcon className={`w-3 h-3 ${sortKey === "faculty" && sortDir === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                        <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortKey === "faculty" && sortDir === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell 
                    isHeader 
                    className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px] hidden md:table-cell cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" 
                    onClick={() => toggleSort("department")} 
                    aria-sort={sortKey === "department" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <div className="flex items-center gap-2">
                      <span>Department</span>
                      <div className="flex flex-col">
                        <ArrowUpIcon className={`w-3 h-3 ${sortKey === "department" && sortDir === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                        <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortKey === "department" && sortDir === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell 
                    isHeader 
                    className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[150px] hidden md:table-cell cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" 
                    onClick={() => toggleSort("program")} 
                    aria-sort={sortKey === "program" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <div className="flex items-center gap-2">
                      <span>Program</span>
                      <div className="flex flex-col">
                        <ArrowUpIcon className={`w-3 h-3 ${sortKey === "program" && sortDir === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                        <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortKey === "program" && sortDir === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell isHeader className="px-3 sm:px-6 py-4 text-right text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px] sticky right-0 bg-gradient-to-r from-transparent via-gray-50/95 to-gray-50 dark:via-gray-900/95 dark:to-gray-900/50 backdrop-blur-sm z-20">Actions</TableCell>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                {effectiveLoading && (
                  Array.from({ length: Math.min(pageSize, 5) }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`} className="bg-white dark:bg-gray-800/30">
                      <TableCell className="px-3 sm:px-6 py-5">
                        <div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                      </TableCell>
                      <TableCell className="px-3 sm:px-6 py-5">
                        <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                      </TableCell>
                      <TableCell className="px-3 sm:px-6 py-5">
                        <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                      </TableCell>
                      <TableCell className="px-3 sm:px-6 py-5 hidden lg:table-cell">
                        <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                      </TableCell>
                      <TableCell className="px-3 sm:px-6 py-5 hidden lg:table-cell">
                        <div className="h-5 w-56 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                      </TableCell>
                      <TableCell className="px-3 sm:px-6 py-5 hidden lg:table-cell">
                        <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                      </TableCell>
                      <TableCell className="px-3 sm:px-6 py-5 hidden lg:table-cell">
                        <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                      </TableCell>
                      <TableCell className="px-3 sm:px-6 py-5 hidden md:table-cell">
                        <div className="h-5 w-28 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                      </TableCell>
                      <TableCell className="px-3 sm:px-6 py-5 hidden md:table-cell">
                        <div className="h-5 w-36 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                      </TableCell>
                      <TableCell className="px-3 sm:px-6 py-5 hidden md:table-cell">
                        <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                      </TableCell>
                      <TableCell className="px-3 sm:px-6 py-5">
                        <div className="h-7 w-28 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-full" />
                      </TableCell>
                      <TableCell className="px-3 sm:px-6 py-5 sticky right-0 bg-white dark:bg-gray-800/30 z-10">
                        <div className="h-9 w-28 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                )}

                {!effectiveLoading && effectiveError && (
                  <TableRow>
                    <TableCell className="px-6 py-16 text-center" colSpan={12}>
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                          <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-base font-semibold text-red-600 dark:text-red-400 mb-1">{effectiveError}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-500">Please try again</p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {!effectiveLoading && !effectiveError && pageItems.length === 0 && (
                  <TableRow>
                    <TableCell className="px-6 py-16 text-center text-gray-500 dark:text-gray-400" colSpan={12}>
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                          <svg className="w-8 h-8 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-base font-semibold text-gray-700 dark:text-gray-300">No alumni found{debouncedQuery ? ` for "${debouncedQuery}"` : ""}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Try adjusting your search or filters</p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {!effectiveLoading && !effectiveError && pageItems.map((alum, idx) => {
                  return (
                    <React.Fragment key={`${alum.id}-fragment-${idx}`}>
                      <TableRow
                        key={`${alum.id}-${idx}`}
                        className={`hover:bg-blue-50/60 dark:hover:bg-white/[0.05] transition-all duration-200 cursor-pointer ${selectedRowId === alum.id ? "bg-blue-50/80 dark:bg-blue-900/30 ring-2 ring-blue-300 dark:ring-blue-700 shadow-sm" : "odd:bg-white even:bg-gray-50/30 dark:odd:bg-gray-800/30 dark:even:bg-gray-800/20"}`}
                        onClick={() => setSelectedRowId(alum.id)}
                        aria-selected={selectedRowId === alum.id}
                      >
                        <TableCell className="px-6 py-5 text-start">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedRowId(expandedRowId === alum.id ? null : alum.id);
                            }}
                            className={`flex items-center justify-center w-6 h-6 rounded transition-colors ${
                              expandedRowId === alum.id
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
                            }`}
                            aria-label={expandedRowId === alum.id ? "Collapse details" : "Expand details"}
                            title={expandedRowId === alum.id ? "Collapse details" : "Expand details"}
                          >
                            <PlusIcon className={`w-4 h-4 transition-transform ${expandedRowId === alum.id ? "rotate-45" : ""}`} />
                          </button>
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 text-start">
                          <div className="flex items-center gap-3">
                            <span className="block font-semibold text-gray-900 text-sm dark:text-gray-100">{toTitleCase(alum.name)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 font-mono text-xs">
                          {alum.registrationno ? (
                            <div>
                              <div>{formatSapId(alum.id)}</div>
                              <div className="text-xs text-gray-500">{alum.registrationno}</div>
                            </div>
                          ) : (
                            formatSapId(alum.id)
                          )}
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden lg:table-cell">
                          <a 
                            href={alum.email ? `mailto:${alum.email}` : "#"} 
                            className={`${alum.email ? "text-blue-600 hover:text-blue-700 hover:underline font-medium transition-colors" : "text-gray-400"}`}
                          >
                            {formatEmail(alum.email)}
                          </a>
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden lg:table-cell">
                          <div className="max-w-[280px] whitespace-normal break-words leading-snug">
                            {alum.cardaddress && String(alum.cardaddress).trim() ? String(alum.cardaddress) : "-"}
                          </div>
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden lg:table-cell">
                          <div className="max-w-[280px] whitespace-normal break-words leading-snug">
                            {formatCardDeliveryAddressLine(
                              alum.deliveryCity,
                              alum.deliveryStreetNo,
                              alum.deliveryHouseNo
                            ) || "-"}
                          </div>
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden lg:table-cell">
                          {formatApplicationDate(alum.createdAt)}
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 text-start">
                          <StatusSelect
                            sapId={alum.id}
                            alumniId={alum.alumniid ?? null}
                            recipientEmail={alum.email ?? null}
                            alumniName={alum.name}
                            initialStatus={alum.status}
                            readOnly={!canEdit}
                          />
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 min-w-[220px] py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden md:table-cell">{alum.faculty ?? "-"}</TableCell>
                        <TableCell className="px-3 sm:px-6 min-w-[220px] py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden md:table-cell">{alum.department ?? "-"}</TableCell>
                        <TableCell className="px-3 sm:px-6 min-w-[250px] py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden md:table-cell">{alum.program ?? "-"}</TableCell>
                        <TableCell className={`px-3 sm:px-6 py-5 text-end bg-gray-100 sticky right-0 z-10 min-w-[170px] ${
                          selectedRowId === alum.id 
                            ? "bg-blue-50/80 dark:bg-blue-900/30" 
                            : idx % 2 === 0 
                              ? "bg-gray-50/30 dark:bg-gray-800/20" 
                              : "bg-white dark:bg-gray-800/30"
                        }`}>
                          <RowActions sapId={alum.id} studentName={alum.name} alumItem={alum} />
                        </TableCell>
                      </TableRow>
                      {expandedRowId === alum.id && (
                        <TableRow key={`${alum.id}-expanded`} className="bg-blue-50/30 dark:bg-blue-900/10">
                          <TableCell colSpan={12} className="px-0 py-6">
                            <div className="w-full overflow-x-hidden" style={{ maxWidth: 'calc(100vw - 2rem)', boxSizing: 'border-box' }}>
                              <div className="w-full max-w-full overflow-x-hidden flex ">
                                <AlumniExpandableDetails sapId={alum.id} onClose={() => setExpandedRowId(null)} readOnly={!canEdit} />
                                <ErpDataDetails sapId={alum.id} registrationNo={alum.registrationno ?? null} onClose={() => setExpandedRowId(null)} />
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-5 bg-gray-50/50 dark:bg-gray-900/30 border-t border-gray-200 dark:border-gray-700">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {(() => {
              const start = total > 0 ? (currentPage - 1) * pageSize + 1 : 0;
              const end = Math.min(start + pageItems.length - 1, total);
              return `Showing ${start.toLocaleString()}-${end.toLocaleString()} of ${total.toLocaleString()}`;
            })()}
          </span>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(p) => {
              const newPage = Math.max(1, Math.min(totalPages, p));
              setCurrentPage(newPage);
              // Scroll to top of table when page changes
              if (tableContainerRef.current) {
                tableContainerRef.current.scrollTop = 0;
              }
              // Also reset horizontal scroll
              if (topScrollbarRef.current) {
                topScrollbarRef.current.scrollLeft = 0;
              }
            }}
          />
        </div>
      </div>
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
      <ExportModal />
    </section>
  );
};