"use client";
import React from "react";
import { useSession } from "next-auth/react";
import { BoltIcon, TimeIcon, LockIcon, GroupIcon, EyeIcon, UserIcon, MailIcon, TrashBinIcon, PlusIcon } from "@/icons";
import { AlumniExpandableDetails } from "./AlumniExpandableDetails";
import { canModify } from "@/lib/alumniProfile";
import { Modal } from "@/components/ui/modal";
import { useQueryClient } from "@tanstack/react-query";


export type CardStatus = "active" | "pending" | "onhold" | "all";

export type AlumniCardItem = {
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
  active: {
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    ringColor: "ring-emerald-200",
    iconColor: "text-emerald-600",
    pillBg: "bg-emerald-100",
  },
  pending: {
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    ringColor: "ring-amber-200",
    iconColor: "text-amber-600",
    pillBg: "bg-amber-100",
  },
  onhold: {
    color: "text-rose-700",
    bgColor: "bg-rose-50",
    ringColor: "ring-rose-200",
    iconColor: "text-rose-600",
    pillBg: "bg-rose-100",
  },
};

const STATUS_ICON_MAP: Record<CardStatus, React.FC<{ className?: string }>> = {
  all: GroupIcon,
  active: BoltIcon,
  pending: TimeIcon,
  onhold: LockIcon,
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
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${theme.pillBg} ${theme.color}`}>{alum.status}</span>
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
import { useCardApplicants } from "@/app/queries/fetch-card-applicants";
import PrintCardButton from "./PrintCardButton";

type SortDirection = "asc" | "desc";
type SortKey = "name" | "passingYear" | "program" | "designation" | "organization" | "contact" | "department" | "id";

export interface AlumniDataTableProps {
  items: AlumniListItem[];
  loading?: boolean;
  error?: string | null;
  defaultPageSize?: number;
  onRowAction?: (item: AlumniListItem, action: ActionKey) => void;
}

export const AlumniDataTable: React.FC<AlumniDataTableProps> = ({
  items,
  loading = false,
  error,
  defaultPageSize = 10,
  onRowAction,
}) => {
  const [query, setQuery] = React.useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = React.useState<string>("");
  const [sortKey, setSortKey] = React.useState<SortKey>("name");
  const [sortDir, setSortDir] = React.useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = React.useState<number>(1);
  const [pageSize, setPageSize] = React.useState<number>(defaultPageSize);
  const [selectedRowId, setSelectedRowId] = React.useState<string | null>(null);
  const [expandedRowId, setExpandedRowId] = React.useState<string | null>(null);
  const [isExporting, setIsExporting] = React.useState<boolean>(false);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const { data: session } = useSession();
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
        // Map database status to UI status
        let uiStatus: CardStatus = "pending";
        const dbStatus = r.status ? String(r.status).trim().toLowerCase() : "pending";
        if (dbStatus === "delivered") {
          uiStatus = "active";
        } else if (dbStatus === "rejected") {
          uiStatus = "onhold";
        } else if (dbStatus === "pending") {
          uiStatus = "pending";
        }
        
        return {
          id: String(r.sapid ?? ""),
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
        };
      }) as AlumniListItem[];
    }
    return items;
  }, [items, applicants]);

  const effectiveLoading = loading || applicantsLoading;
  const effectiveError: string | null = error ?? (applicantsError ? (applicantsErrorObj?.message || "Failed to load applicants") : null);

  const filtered = React.useMemo(() => {
    let filteredByStatus = baseItems;
    
    // Filter by status - strict matching
    if (statusFilter !== "all") {
      const filterStatus = statusFilter.toLowerCase().trim();
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
    
    // Filter by search query
    if (!debouncedQuery) return filteredByStatus;
    const q = debouncedQuery.toLowerCase();
    return filteredByStatus.filter((i) => {
      const contact = `${i.email ?? ""} ${i.mobile ?? ""}`.toLowerCase();
      return (
        i.name.toLowerCase().includes(q) ||
        String(i.passingYear).includes(q) ||
        i.program.toLowerCase().includes(q) ||
        (i.designation ?? "").toLowerCase().includes(q) ||
        (i.organization ?? "").toLowerCase().includes(q) ||
        contact.includes(q)
      );
    });
  }, [baseItems, debouncedQuery, statusFilter]);

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
          case "contact":
            return `${x.email ?? ""} ${x.mobile ?? ""}`.toLowerCase();
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
  }, [debouncedQuery, sortKey, sortDir, pageSize, statusFilter]);

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

  const handleExportToExcel = React.useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      // Dynamically import xlsx to avoid server-side bundling issues
      const XLSX = await import("xlsx");
      
      // Fetch all applicants from API
      const res = await fetch("/api/alumni-cards/applicants", { headers: { "accept": "application/json" } });
      if (!res.ok) throw new Error("Failed to fetch data");
      const data = (await res.json()) as { items: Array<{ sapid: string; alumniname: string; email: string | null; degreetitle: string | null; facultyname: string | null; departmentname: string | null; yearofending: number | null; status: string; createdat: string | Date | null }> };
      const allItems = data.items ?? [];

      // Filter by status if needed (based on current view)
      // Note: The status filter would need to be passed as a prop or determined from the current view
      // For now, we'll export all items and let the user filter in Excel if needed
      
      // Filter by status - strict matching
      let itemsToExport = allItems;
      if (statusFilter !== "all") {
        const filterStatus = statusFilter.toLowerCase().trim();
        itemsToExport = allItems.filter((item) => {
          const itemStatus = item.status ? String(item.status).trim().toLowerCase() : "pending";
          return itemStatus === filterStatus;
        });
      }
      
      // Apply search filter if any
      if (debouncedQuery) {
        itemsToExport = itemsToExport.filter((item) => {
          const q = debouncedQuery.toLowerCase();
          return (
            item.sapid?.toLowerCase().includes(q) ||
            item.alumniname?.toLowerCase().includes(q) ||
            item.email?.toLowerCase().includes(q) ||
            item.degreetitle?.toLowerCase().includes(q) ||
            item.facultyname?.toLowerCase().includes(q) ||
            item.departmentname?.toLowerCase().includes(q)
          );
        });
      }

      // Map to Excel format
      const excelData = itemsToExport.map((item) => ({
        "SAP ID": item.sapid || "",
        "Full Name": item.alumniname || "",
        "Email": item.email || "",
        "Faculty": item.facultyname || "",
        "Department": item.departmentname || "",
        "Program": item.degreetitle || "",
        "Year of Ending": item.yearofending || "",
        "Status": item.status || "",
        "Created At": item.createdat ? (typeof item.createdat === "string" ? item.createdat : new Date(item.createdat).toISOString().split("T")[0]) : "",
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      ws["!cols"] = [
        { wch: 12 }, // SAP ID
        { wch: 25 }, // Full Name
        { wch: 30 }, // Email
        { wch: 25 }, // Faculty
        { wch: 25 }, // Department
        { wch: 30 }, // Program
        { wch: 15 }, // Year of Ending
        { wch: 15 }, // Status
        { wch: 20 }, // Created At
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Alumni Cards");

      // Generate filename with status
      const dateStr = new Date().toISOString().split("T")[0];
      const searchStr = debouncedQuery ? `_search` : "";
      const statusStr = statusFilter !== "all" ? `_${statusFilter}` : "";
      const filename = `alumni_cards_export${statusStr}${searchStr}_${dateStr}.xlsx`;

      XLSX.writeFile(wb, filename);
      setIsExporting(false);
    } catch (error) {
      console.error("Export error:", error);
      setIsExporting(false);
      alert("Failed to export data. Please try again.");
    }
  }, [isExporting, debouncedQuery, statusFilter]);

  const StatusSelect: React.FC<{ sapId: string; initialStatus?: CardStatus; readOnly?: boolean }> = ({ sapId, initialStatus, readOnly = false }) => {
    const queryClient = useQueryClient();
    const [localStatus, setLocalStatus] = React.useState<"pending" | "rejected" | "delivered" | null>(null);
    const [isUpdating, setIsUpdating] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const hasUpdatedRef = React.useRef(false);
    
    // Map UI status (from items list) to DB status
    const getDbStatusFromUI = (uiStatus?: CardStatus): "pending" | "rejected" | "delivered" => {
      if (uiStatus === "active") return "delivered";
      if (uiStatus === "onhold") return "rejected";
      return "pending";
    };
    
    // Get initial DB status from item prop or fetch from API
    const initialDbStatus = initialStatus ? getDbStatusFromUI(initialStatus) : null;
    
    // Only fetch if we don't have initial status from props
    const { data, isLoading } = useCardStatus(initialDbStatus ? undefined : sapId);
    
    // Initialize local state from props first, then from fetched data
    React.useEffect(() => {
      if (initialDbStatus && !hasUpdatedRef.current) {
        setLocalStatus(initialDbStatus);
        return;
      }
      
      // Only initialize from API if we haven't manually updated and don't have initial status
      if (!hasUpdatedRef.current && !initialDbStatus && data !== undefined) {
        if (data?.status) {
          setLocalStatus(data.status as "pending" | "rejected" | "delivered");
        } else {
          setLocalStatus("pending");
        }
      }
    }, [data, initialDbStatus]);
    
    // Sync local state with initialStatus prop if it changes (but only if we haven't manually updated)
    React.useEffect(() => {
      if (!hasUpdatedRef.current && initialDbStatus && localStatus !== initialDbStatus) {
        setLocalStatus(initialDbStatus);
      }
    }, [initialDbStatus, localStatus]);
    
    const current = localStatus ?? initialDbStatus ?? (data?.status ?? "pending") as "pending" | "rejected" | "delivered";
    
    const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const next = e.target.value as "pending" | "rejected" | "delivered";
      
      // Don't update if same status
      if (next === current) return;
      
      // Optimistic update
      const previousStatus = localStatus ?? (data?.status as "pending" | "rejected" | "delivered" ?? "pending");
      setLocalStatus(next);
      setIsUpdating(true);
      setError(null);
      hasUpdatedRef.current = true; // Mark that we've manually updated
      
      try {
        const res = await fetch(`/api/alumni-cards/by-sap/${encodeURIComponent(sapId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
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
            };
          }
          return { ...old, status: next };
        });
        
        // Keep local state as the new status (don't let refetch override it)
        setLocalStatus(next);
        
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
        console.error("[StatusSelect] Update error:", err);
      } finally {
        setIsUpdating(false);
      }
    };
    
    // Map status to display label
    const statusLabel = current === "delivered" ? "Active" : current === "rejected" ? "On Hold" : "Pending";
    
    if (readOnly) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">{statusLabel}</span>
        </div>
      );
    }
    
    return (
      <div className="flex items-center gap-2">
        <select
          aria-label="Card status"
          className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-[12px] text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
          value={current}
          disabled={isLoading || isUpdating || readOnly}
          onChange={handleStatusChange}
        >
          <option value="pending">Pending</option>
          <option value="rejected">On Hold</option>
          <option value="delivered">Active</option>
        </select>
        {isUpdating && <span className="text-[11px] text-gray-500">Updating...</span>}
        {error && <span className="text-[11px] text-red-600" title={error}>Error</span>}
      </div>
    );
  };

  const RowActions: React.FC<{ sapId: string; studentName: string; alumItem: AlumniListItem }> = ({ sapId, studentName, alumItem }) => {
    const queryClient = useQueryClient();
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [showDeleteModal, setShowDeleteModal] = React.useState(false);
    const [deleteError, setDeleteError] = React.useState<string | null>(null);
    
    // Try to get status from cache first, then from item status, fallback to pending
    const cachedCardData = queryClient.getQueryData<CardData | null>(cardStatusKey(sapId));
    const itemStatus = alumItem.status ? String(alumItem.status).toLowerCase().trim() : null;
    // Map UI status (active/onhold/pending) back to DB status (delivered/rejected/pending) for comparison
    let dbStatusFromItem: "pending" | "rejected" | "delivered" | null = null;
    if (itemStatus === "active") {
      dbStatusFromItem = "delivered";
    } else if (itemStatus === "onhold") {
      dbStatusFromItem = "rejected";
    } else if (itemStatus === "pending") {
      dbStatusFromItem = "pending";
    }
    const cardStatus = (cachedCardData?.status ?? dbStatusFromItem ?? "pending") as "pending" | "rejected" | "delivered";
    const isDelivered = cardStatus === "delivered"; // Keep internal check as "delivered" for logic
    const isAdmin = canModify(session?.user);

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

        // Invalidate queries to refresh the list
        queryClient.invalidateQueries({ queryKey: ["alumni-cards", "applicants"] });
        queryClient.invalidateQueries({ queryKey: ["alumni-cards", "status", sapId] });
        
        setShowDeleteModal(false);
        // Optionally show success message or trigger a callback
        onRowAction?.(alumItem, "delete");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to delete card";
        setDeleteError(msg);
        console.error("[AlumniCard] Delete error:", err);
      } finally {
        setIsDeleting(false);
      }
    };

    return (
      <>
        <div role="group" aria-label="Row actions" className="inline-flex items-center gap-2.5">
          {isDelivered && (
            <PrintCardButton sapId={sapId} studentName={studentName} />
          )}
          {isAdmin && (
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
              <TrashBinIcon className="h-5 w-5" />
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
      <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-800/50 dark:to-gray-800/30 rounded-2xl p-5 border border-gray-200/50 dark:border-gray-700/50 shadow-sm">
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
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-600 dark:text-gray-400" htmlFor="status-filter-select">Status:</label>
          <select
            id="status-filter-select"
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="rejected">On Hold</option>
            <option value="delivered">Active</option>
          </select>
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
          <label className="text-sm font-medium text-gray-600 dark:text-gray-400" htmlFor="page-size-select">Items per page:</label>
          <select
            id="page-size-select"
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            aria-label="Items per page"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-lg dark:border-gray-700/80 dark:bg-gray-800/50">
        <div className="max-w-full overflow-x-auto custom-scrollbar max-h-[700px] overflow-y-auto" aria-live="polite">
          <div className="min-w-full xl:min-w-full">
            <Table className="min-w-full">
              <TableHeader className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-900/80 dark:to-gray-900/50 sticky top-0 z-10 backdrop-blur-sm whitespace-nowrap">
                <TableRow className="border-b-2 border-gray-200 dark:border-gray-700">
                  <TableCell isHeader className="px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[50px]">{null}</TableCell>
                  <TableCell isHeader className="px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider" onClick={() => toggleSort("name")} aria-sort={sortKey === "name" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>Name</TableCell>
                  <TableCell isHeader className="px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider" onClick={() => toggleSort("id")} aria-sort={sortKey === "id" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>SAP ID</TableCell>
                  <TableCell isHeader className="px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Mobile No</TableCell>
                  <TableCell isHeader className="px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Active Email</TableCell>
                  <TableCell isHeader className="px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider" onClick={() => toggleSort("department")} aria-sort={sortKey === "department" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>Department</TableCell>
                  <TableCell isHeader className="px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Card Status</TableCell>
                  <TableCell isHeader className="px-6 py-4 text-right text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider sticky right-0 bg-gradient-to-r from-transparent via-gray-50/95 to-gray-50 dark:via-gray-900/95 dark:to-gray-900/50 backdrop-blur-sm z-20">Actions</TableCell>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                {effectiveLoading && (
                  Array.from({ length: Math.min(pageSize, 5) }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`} className="bg-white dark:bg-gray-800/30">
                      <TableCell className="px-6 py-5">
                        <div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                      </TableCell>
                      <TableCell className="px-6 py-5">
                        <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                      </TableCell>
                      <TableCell className="px-6 py-5">
                        <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                      </TableCell>
                      <TableCell className="px-6 py-5">
                        <div className="h-5 w-28 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                      </TableCell>
                      <TableCell className="px-6 py-5">
                        <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                      </TableCell>
                      <TableCell className="px-6 py-5">
                        <div className="h-5 w-36 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                      </TableCell>
                      <TableCell className="px-6 py-5">
                        <div className="h-7 w-28 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-full" />
                      </TableCell>
                      <TableCell className="px-6 py-5 sticky right-0 bg-white dark:bg-gray-800/30 z-10">
                        <div className="h-9 w-28 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                )}

                {!effectiveLoading && effectiveError && (
                  <TableRow>
                    <TableCell className="px-6 py-16 text-center" colSpan={8}>
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
                    <TableCell className="px-6 py-16 text-center text-gray-500 dark:text-gray-400" colSpan={8}>
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
                  const isAdmin = canModify(session?.user);
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
                        <TableCell className="px-6 py-5 text-start">
                          <div className="flex items-center gap-3">
                            <span className="block font-semibold text-gray-900 text-sm dark:text-gray-100">{toTitleCase(alum.name)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 font-mono text-xs">
                          {formatSapId(alum.id)}
                        </TableCell>
                        <TableCell className="px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300">{alum.mobile ?? "-"}</TableCell>
                        <TableCell className="px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300">
                          <a 
                            href={alum.email ? `mailto:${alum.email}` : "#"} 
                            className={`${alum.email ? "text-blue-600 hover:text-blue-700 hover:underline font-medium transition-colors" : "text-gray-400"}`}
                          >
                            {formatEmail(alum.email)}
                          </a>
                        </TableCell>
                        <TableCell className="px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300">{`${alum.faculty} - ${alum.department ?? "-"}`}</TableCell>
                        <TableCell className="px-6 py-5 text-start"><StatusSelect sapId={alum.id} initialStatus={alum.status} readOnly={!isAdmin} /></TableCell>
                        <TableCell className={`px-6 py-5 text-end sticky right-0 z-10 ${
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
                          <TableCell colSpan={8} className="px-0 py-6">
                            <div className="w-full overflow-x-hidden" style={{ maxWidth: 'calc(100vw - 2rem)', boxSizing: 'border-box' }}>
                              <div className="w-full max-w-full overflow-x-hidden flex flex-row justify-start">
                                <AlumniExpandableDetails sapId={alum.id} onClose={() => setExpandedRowId(null)} readOnly={!isAdmin} />
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
              const tableContainer = document.querySelector('.custom-scrollbar');
              if (tableContainer) {
                tableContainer.scrollTop = 0;
              }
            }}
          />
        </div>
      </div>
    </section>
  );
};