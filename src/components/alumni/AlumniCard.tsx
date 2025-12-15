"use client";
import React from "react";
import { useSession } from "next-auth/react";
import { BoltIcon, TimeIcon, LockIcon, GroupIcon, EyeIcon, UserIcon, MailIcon, TrashBinIcon, PlusIcon, CheckCircleIcon, ArrowUpIcon, ArrowDownIcon } from "@/icons";
import { AlumniExpandableDetails } from "./AlumniExpandableDetails";
import { ErpDataDetails } from "./ErpDataDetails";
import { canModify } from "@/lib/alumniProfile";
import { Modal } from "@/components/ui/modal";
import { useQueryClient } from "@tanstack/react-query";


export type CardStatus = "pending" | "process" | "active" | "delivered" | "onhold" | "all";

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
  pending: {
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    ringColor: "ring-amber-200",
    iconColor: "text-amber-600",
    pillBg: "bg-amber-100",
  },
  process: {
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    ringColor: "ring-blue-200",
    iconColor: "text-blue-600",
    pillBg: "bg-blue-100",
  },
  active: {
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    ringColor: "ring-emerald-200",
    iconColor: "text-emerald-600",
    pillBg: "bg-emerald-100",
  },
  delivered: {
    color: "text-green-700",
    bgColor: "bg-green-50",
    ringColor: "ring-green-200",
    iconColor: "text-green-600",
    pillBg: "bg-green-100",
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
  pending: TimeIcon,
  process: BoltIcon,
  active: CheckCircleIcon,
  delivered: CheckCircleIcon,
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
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${theme.pillBg} ${theme.color}`}>
                    {alum.status === "pending" ? "Pending" : 
                     alum.status === "process" ? "In-Process" : 
                     alum.status === "active" ? "Active" :
                     alum.status === "delivered" ? "Delivered" : 
                     alum.status === "onhold" ? "On Hold" :
                     alum.status === "all" ? "All" :
                     alum.status}
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
import { useCardApplicants } from "@/app/queries/fetch-card-applicants";
import PrintCardButton from "./PrintCardButton";

type SortDirection = "asc" | "desc";
type SortKey = "name" | "passingYear" | "program" | "designation" | "organization" | "contact" | "department" | "id" | "faculty";

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
        // Map database status to UI status
        // Database values: "Pending", "Process", "Delivered"
        let uiStatus: CardStatus = "pending";
        const dbStatus = r.status ? String(r.status).trim() : "";
        if (dbStatus.toUpperCase() === "DELIVERED") {
          uiStatus = "delivered";
        } else if (dbStatus.toUpperCase() === "PROCESS") {
          uiStatus = "process";
        } else {
          // Default to pending (NULL, empty, or "Pending")
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
  }, [debouncedQuery, sortKey, sortDir, pageSize, statusFilter]);

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

  // Export to Excel function - comprehensive export with ALL fields
  const handleExportToExcel = React.useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      // Dynamically import xlsx to avoid server-side bundling issues
      const XLSX = await import("xlsx");
      
      // Fetch comprehensive data from export endpoint
      const url = new URL("/api/alumni-cards/export", typeof window !== "undefined" ? window.location.origin : "");
      if (debouncedQuery) {
        url.searchParams.set("search", debouncedQuery);
      }
      if (statusFilter && statusFilter !== "all") {
        url.searchParams.set("status", statusFilter);
      }
      
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
      const excelData = allItems.map((item: Record<string, unknown>) => ({
        // Card Information
        "Card ID": item.id || "",
        "Card Status": item.status || "",
        "Card Created At": item.createdat || "",
        
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
        
        // Additional Information
        "About Me": item.aboutme || "",
        "Image 1": item.image1 || "",
        "Image 2": item.image2 || "",
        "CV": item.cv || "",
        
        // Social Links
        "Facebook": item.facebook || "",
        "Instagram": item.instagram || "",
        "YouTube": item.youtube || "",
        "LinkedIn": item.linkedin || "",
        
        // System Information
        "Verification Status": item.verify === "true" ? "Verified" : item.verify === "false" ? "Unverified" : item.verify === "pending" || item.verify === null || item.verify === "" ? "Under Approval" : item.verify || "",
        "Last Login": item.lasttimelogin || "",
        "Login Count": item.logincount || 0,
        "Email Send Count": item.emailsendcount || 0,
        "Email Send Status": item.emailsendstatus || "",
        "Data Source": item.datasource || "",
        "Alumni Status": item.alumnistatus || "",
        "Created Date Time": item.createddatetime || "",
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths for all columns (auto-width for comprehensive export)
      const colWidths = Object.keys(excelData[0] || {}).map(() => ({ wch: 20 }));
      ws["!cols"] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Alumni Cards");

      // Generate filename with current date and filters
      const dateStr = new Date().toISOString().split("T")[0];
      const statusStr = statusFilter && statusFilter !== "all" ? `_${statusFilter}` : "";
      const searchStr = debouncedQuery ? `_search` : "";
      const filename = `alumni_cards_export${statusStr}${searchStr}_${dateStr}.xlsx`;

      // Write and download
      XLSX.writeFile(wb, filename);
      setIsExporting(false);
    } catch (error) {
      console.error("Export error:", error);
      setIsExporting(false);
      alert("Failed to export data. Please try again.");
    }
  }, [isExporting, debouncedQuery, statusFilter]);

  const StatusSelect: React.FC<{ sapId: string; initialStatus?: CardStatus; readOnly?: boolean }> = ({ sapId, initialStatus, readOnly = false }) => {
    const { data: session } = useSession();
    const queryClient = useQueryClient();
    // Database values: "Pending", "Process", "Active", "Delivered", "Onhold"
    const [localStatus, setLocalStatus] = React.useState<"Pending" | "Process" | "Active" | "Delivered" | "Onhold" | null>(null);
    const [reasonOnhold, setReasonOnhold] = React.useState<string>("");
    const [showReasonInput, setShowReasonInput] = React.useState<boolean>(false);
    const [isUpdating, setIsUpdating] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [showConfirmModal, setShowConfirmModal] = React.useState(false);
    const [pendingStatusChange, setPendingStatusChange] = React.useState<{ status: "Pending" | "Process" | "Active" | "Delivered" | "Onhold"; reason?: string } | null>(null);
    const hasUpdatedRef = React.useRef(false);
    const isAdmin = canModify(session?.user);
    
    // Map UI status (from items list) to DB status
    const getDbStatusFromUI = (uiStatus?: CardStatus): "Pending" | "Process" | "Active" | "Delivered" | "Onhold" => {
      if (uiStatus === "delivered") return "Delivered";
      if (uiStatus === "active") return "Active";
      if (uiStatus === "process") return "Process";
      if (uiStatus === "onhold") return "Onhold";
      return "Pending"; // Default to Pending
    };
    
    // Get initial DB status from item prop or fetch from API
    const initialDbStatus = initialStatus ? getDbStatusFromUI(initialStatus) : null;
    
    // Always fetch card data to get reason_onhold, even if we have initialStatus
    const { data, isLoading } = useCardStatus(sapId);
    
    // Initialize local state from props first, then from fetched data
    React.useEffect(() => {
      if (!hasUpdatedRef.current && data !== undefined) {
        if (data?.status) {
          // Map database status to local state (always use fetched data for accuracy)
          const dbStatus = String(data.status).trim();
          if (dbStatus === "Delivered") {
            setLocalStatus("Delivered");
          } else if (dbStatus === "Active") {
            setLocalStatus("Active");
          } else if (dbStatus === "Process") {
            setLocalStatus("Process");
          } else if (dbStatus === "Onhold") {
            setLocalStatus("Onhold");
            // Always load reason from database when status is Onhold
            if (data.reason_onhold) {
              setReasonOnhold(data.reason_onhold || "");
            }
            setShowReasonInput(true);
          } else {
            setLocalStatus("Pending");
          }
        } else {
          // If no data from API but we have initial status, use that
          if (initialDbStatus && !data) {
            setLocalStatus(initialDbStatus);
          } else {
            setLocalStatus("Pending");
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
    
    const current = localStatus ?? initialDbStatus ?? (data?.status ? String(data.status).trim() : "Pending") as "Pending" | "Process" | "Active" | "Delivered" | "Onhold";
    
    // Show reason input when Onhold is selected
    React.useEffect(() => {
      setShowReasonInput(current === "Onhold");
      // Don't auto-fill the input field - it should only show what user types
      // The database reason is displayed in the "Current Reason (from database)" section
      if (current !== "Onhold") {
        setReasonOnhold("");
      }
    }, [current]);
    
    const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const next = e.target.value as "Pending" | "Process" | "Active" | "Delivered" | "Onhold";
      
      // Don't update if same status
      if (next === current) return;
      
      // If changing to Onhold, switch immediately (no confirmation needed) and show reason input
      if (next === "Onhold") {
        hasUpdatedRef.current = true; // Mark as manually updated to prevent useEffect from resetting
        setLocalStatus("Onhold");
        setShowReasonInput(true);
        // Don't pre-fill the input field - let user see the reason in "Current Reason" section and type new one if needed
        // Clear the input field so it's ready for new input
        setReasonOnhold("");
        return;
      }
      
      // For other statuses, show confirmation modal first (only for admins)
      if (isAdmin) {
        setPendingStatusChange({ status: next });
        setShowConfirmModal(true);
      } else {
        // Non-admins can change status directly (shouldn't happen, but just in case)
        await submitStatusChange(next, "");
      }
    };
    
    const handleReasonSubmit = async () => {
      if (!reasonOnhold.trim()) {
        setError("Reason is required when status is Onhold");
        return;
      }
      // Submit Onhold status with reason directly (no confirmation needed)
      await submitStatusChange("Onhold", reasonOnhold.trim());
    };
    
    const handleConfirmStatusChange = async () => {
      if (!pendingStatusChange) return;
      setShowConfirmModal(false);
      await submitStatusChange(pendingStatusChange.status, pendingStatusChange.reason || "");
      setPendingStatusChange(null);
    };
    
    const handleCancelStatusChange = () => {
      setShowConfirmModal(false);
      // Revert local status to the actual current status from data
      // Only revert if we're not in the middle of switching to Onhold
      if (pendingStatusChange?.status !== "Onhold") {
        if (data?.status) {
          const dbStatus = String(data.status).trim();
          if (dbStatus === "Delivered") {
            setLocalStatus("Delivered");
          } else if (dbStatus === "Active") {
            setLocalStatus("Active");
          } else if (dbStatus === "Process") {
            setLocalStatus("Process");
          } else if (dbStatus === "Onhold") {
            setLocalStatus("Onhold");
          } else {
            setLocalStatus("Pending");
          }
        } else {
          setLocalStatus("Pending");
        }
      }
      setPendingStatusChange(null);
    };
    
    const submitStatusChange = async (next: "Pending" | "Process" | "Active" | "Delivered" | "Onhold", reason: string) => {
      // Optimistic update
      const previousStatus = localStatus ?? (data?.status ? String(data.status).trim() : "Pending") as "Pending" | "Process" | "Active" | "Delivered" | "Onhold";
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
        
        // If status is Onhold and reason was saved, clear the input field after a short delay
        // This allows the cache update to complete first, then the reason will be displayed from database
        if (next === "Onhold" && reason) {
          // Clear input field after cache is updated
          setTimeout(() => {
            setReasonOnhold("");
          }, 100);
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
        console.error("[StatusSelect] Update error:", err);
      } finally {
        setIsUpdating(false);
      }
    };
    
    // Map status to display label
    const statusLabel = current === "Delivered" ? "Delivered" 
      : current === "Active" ? "Active"
      : current === "Process" ? "In-Process"
      : current === "Onhold" ? "On Hold"
      : "Pending";
    
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
            <option value="Pending">Pending</option>
            <option value="Process">In-Process</option>
            <option value="Active">Active</option>
            <option value="Delivered">Delivered</option>
            <option value="Onhold">On Hold</option>
          </select>
          {isUpdating && <span className="text-[11px] text-gray-500">Updating...</span>}
          {error && <span className="text-[11px] text-red-600" title={error}>Error</span>}
        </div>
        {showReasonInput && current === "Onhold" && isAdmin && (
          <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 dark:bg-gray-800/50 p-2.5">
            {/* Field 1: Display current reason from database (always visible) */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                Current Reason (from database):
              </label>
              {isLoading ? (
                <div className="rounded-md bg-gray-100 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 px-3 py-2">
                  <p className="text-[12px] text-gray-400 dark:text-gray-500 italic">
                    Loading reason...
                  </p>
                </div>
              ) : data?.reason_onhold ? (
                <div className="rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2">
                  <p className="text-[12px] text-gray-800 dark:text-gray-200 break-words leading-relaxed">
                    {data.reason_onhold}
                  </p>
                </div>
              ) : (
                <div className="rounded-md bg-gray-100 dark:bg-gray-900/50 border border-dashed border-gray-300 dark:border-gray-700 px-3 py-2">
                  <p className="text-[12px] text-gray-400 dark:text-gray-500 italic">
                    No reason has been set yet.
                  </p>
                </div>
              )}
            </div>
            
            {/* Field 2: Input field to add/update reason */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                {data?.reason_onhold ? "Update Reason:" : "Add Reason:"} <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={reasonOnhold}
                  onChange={(e) => {
                    setReasonOnhold(e.target.value);
                    setError(null); // Clear error when user types
                  }}
                  placeholder={data?.reason_onhold ? "Enter new reason..." : "Enter reason for on hold..."}
                  className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-[12px] text-gray-700 dark:text-gray-300 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isUpdating}
                />
                <button
                  onClick={handleReasonSubmit}
                  disabled={isUpdating || !reasonOnhold.trim()}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {data?.reason_onhold && reasonOnhold !== data.reason_onhold ? "Update" : "Save"}
                </button>
              </div>
            </div>
            {error && (
              <span className="text-[10px] text-red-600 dark:text-red-400">{error}</span>
            )}
          </div>
        )}
        {showReasonInput && current === "Onhold" && !isAdmin && data?.reason_onhold && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
            <span className="text-[10px] font-semibold text-gray-600">Reason for On Hold:</span>
            <p className="text-[11px] text-gray-800 mt-1">{data.reason_onhold}</p>
          </div>
        )}
        
        {/* Confirmation Modal for Status Change */}
        {isAdmin && (
          <Modal
            isOpen={showConfirmModal}
            onClose={handleCancelStatusChange}
            className="max-w-md mx-auto"
            showCloseButton={true}
          >
            <div className="p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                    Confirm Status Change
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Are you sure you want to change the card status?
                  </p>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mb-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Current Status:</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{statusLabel}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">New Status:</span>
                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                      {pendingStatusChange?.status === "Delivered" ? "Delivered" 
                        : pendingStatusChange?.status === "Active" ? "Active"
                        : pendingStatusChange?.status === "Process" ? "In-Process"
                        : pendingStatusChange?.status === "Onhold" ? "On Hold"
                        : "Pending"}
                    </span>
                  </div>
                  {pendingStatusChange?.status === "Onhold" && pendingStatusChange?.reason && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400 block mb-1">Reason:</span>
                      <p className="text-sm text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 rounded p-2 border border-gray-200 dark:border-gray-700">
                        {pendingStatusChange.reason}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3">
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
    const queryClient = useQueryClient();
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [showDeleteModal, setShowDeleteModal] = React.useState(false);
    const [deleteError, setDeleteError] = React.useState<string | null>(null);
    
    // Try to get status from cache first, then from item status, fallback to pending
    const cachedCardData = queryClient.getQueryData<CardData | null>(cardStatusKey(sapId));
    // Get actual database status string for checking Active/Delivered
    const dbStatusString = cachedCardData?.status ? String(cachedCardData.status).trim().toUpperCase() : "";
    const canDownload = dbStatusString === "ACTIVE" || dbStatusString === "DELIVERED";
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
          {canDownload && (
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
            <option value="process">In-Process</option>
            <option value="active">Active</option>
            <option value="delivered">Delivered</option>
            <option value="onhold">On Hold</option>
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
                  <TableCell isHeader className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[100px]">Card Status</TableCell>
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
                    <TableCell className="px-6 py-16 text-center" colSpan={9}>
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
                    <TableCell className="px-6 py-16 text-center text-gray-500 dark:text-gray-400" colSpan={9}>
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
                        <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden md:table-cell">{alum.faculty ?? "-"}</TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden md:table-cell">{alum.department ?? "-"}</TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden md:table-cell">{alum.program ?? "-"}</TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 text-start"><StatusSelect sapId={alum.id} initialStatus={alum.status} readOnly={!isAdmin} /></TableCell>
                        <TableCell className={`px-3 sm:px-6 py-5 text-end sticky right-0 z-10 ${
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
                          <TableCell colSpan={9} className="px-0 py-6">
                            <div className="w-full overflow-x-hidden" style={{ maxWidth: 'calc(100vw - 2rem)', boxSizing: 'border-box' }}>
                              <div className="w-full max-w-full overflow-x-hidden grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <AlumniExpandableDetails sapId={alum.id} onClose={() => setExpandedRowId(null)} readOnly={!isAdmin} />
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
    </section>
  );
};