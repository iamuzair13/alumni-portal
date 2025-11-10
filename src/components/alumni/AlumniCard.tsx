"use client";
import React from "react";
import { BoltIcon, TimeIcon, LockIcon, GroupIcon, EyeIcon, UserIcon, MailIcon, TrashBinIcon, CheckLineIcon, CloseLineIcon } from "@/icons";

/**
 * AlumniCard
 * A clean, modern, and accessible card component for displaying a single alumni item.
 * - Preserves all existing data fields and structure via `item` prop
 * - Uses inline Tailwind CSS classes for styling (no external CSS files)
 * - Fully responsive with clear typography and visual hierarchy
 * - Subtle transitions and focus states for polished interactions
 * - Reusable with the same action model as the existing implementation
 */

export type CardStatus = "active" | "pending" | "declined" | "all";

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
  declined: {
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
  declined: LockIcon,
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

type SortDirection = "asc" | "desc";
type SortKey = "name" | "passingYear" | "program" | "designation" | "organization" | "contact";

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

  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => clearTimeout(id);
  }, [query]);

  const filtered = React.useMemo(() => {
    if (!debouncedQuery) return items;
    const q = debouncedQuery.toLowerCase();
    return items.filter((i) => {
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
  }, [items, debouncedQuery]);

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
  }, [debouncedQuery, sortKey, sortDir, pageSize]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const headerClass = "px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 select-none";
  const cellClass = "px-4 py-3 text-gray-600 text-start text-theme-sm dark:text-gray-300";

  return (
    <section aria-labelledby="alumni-table-title" className="w-full">
      <div className="mb-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <label className="w-full sm:w-1/2">
          <span className="sr-only">Search alumni</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, degree, company, contact..."
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            aria-label="Search alumni"
          />
        </label>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-500 dark:text-gray-400" htmlFor="page-size-select">Items per page:</label>
          <select
            id="page-size-select"
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
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

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] ">
        <div className="max-w-full overflow-x-auto custom-scrollbar max-h-[700px] overflow-y-auto" aria-live="polite">
          <div className="min-w-full">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell
                    isHeader
                    className={headerClass}
                    onClick={() => toggleSort("name")}
                    aria-sort={sortKey === "name" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    Name
                  </TableCell>
                  <TableCell
                    isHeader
                    className={headerClass}
                    onClick={() => toggleSort("passingYear")}
                    aria-sort={sortKey === "passingYear" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    Graduation Year
                  </TableCell>
                  <TableCell
                    isHeader
                    className={headerClass}
                    onClick={() => toggleSort("program")}
                    aria-sort={sortKey === "program" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    Degree
                  </TableCell>
                  <TableCell
                    isHeader
                    className={headerClass}
                    onClick={() => toggleSort("designation")}
                    aria-sort={sortKey === "designation" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    Current Position
                  </TableCell>
                  <TableCell
                    isHeader
                    className={headerClass}
                    onClick={() => toggleSort("organization")}
                    aria-sort={sortKey === "organization" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    Company
                  </TableCell>
                  <TableCell
                    isHeader
                    className={`${headerClass} text-end`}
                  >
                    Actions
                  </TableCell>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {loading && (
                  Array.from({ length: Math.min(pageSize, 5) }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      <TableCell className="px-5 py-4"><div className="h-5 w-48 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3"><div className="h-5 w-24 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3"><div className="h-5 w-40 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3"><div className="h-5 w-36 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3"><div className="h-5 w-40 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3"><div className="h-5 w-56 bg-gray-200 animate-pulse rounded" /></TableCell>
                    </TableRow>
                  ))
                )}

                {!loading && error && (
                  <TableRow>
                    <TableCell className="px-5 py-4 text-red-600" colSpan={6}>{error}</TableCell>
                  </TableRow>
                )}

                {!loading && !error && pageItems.length === 0 && (
                  <TableRow>
                    <TableCell className="px-5 py-6 text-gray-600 dark:text-gray-400" colSpan={6}>
                      No alumni found{debouncedQuery ? ` for "${debouncedQuery}"` : ""}. Try adjusting your search or filters.
                    </TableCell>
                  </TableRow>
                )}

                {!loading && !error && pageItems.map((alum, idx) => (
                  <TableRow
                    key={`${alum.id}-${idx}`}
                    className="hover:bg-gray-50 dark:hover:bg-white/[0.04]"
                  >
                    <TableCell className="px-5 py-4 sm:px-6 text-start">
                      <div className="flex items-center gap-3">
                        <span className="block font-medium text-gray-800 text-theme-sm dark:text-white/90">{alum.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className={cellClass}>{alum.passingYear}</TableCell>
                    <TableCell className={cellClass}>{alum.program}</TableCell>
                    <TableCell className={cellClass}>{alum.designation ?? "-"}</TableCell>
                    <TableCell className={cellClass}>{alum.organization ?? "-"}</TableCell>
                    <TableCell className={cellClass}>{alum.email ?? "-"}{alum.mobile ? ` • ${alum.mobile}` : ""}</TableCell>
                    <TableCell className="px-4 py-3 text-end">
                      <div role="group" aria-label="Row actions" className="inline-flex items-center gap-2">
                        {(() => {
                          const actions: Array<{ key: ActionKey; label: string; icon: React.ComponentType<{ className?: string }>; hover?: string; onClick: () => void }>
                            = alum.status === "active"
                            ? [
                                { key: "suspend", label: "Suspend", icon: LockIcon, hover: "hover:text-amber-600", onClick: () => onRowAction?.(alum, "suspend") },
                                { key: "delete", label: "Delete", icon: TrashBinIcon, hover: "hover:text-rose-600", onClick: () => onRowAction?.(alum, "delete") },
                                { key: "view", label: "View", icon: EyeIcon, hover: "hover:text-blue-600", onClick: () => onRowAction?.(alum, "view") },
                              ]
                            : alum.status === "pending"
                            ? [
                                { key: "verify", label: "Verify", icon: CheckLineIcon, hover: "hover:text-emerald-600", onClick: () => onRowAction?.(alum, "verify") },
                                { key: "decline", label: "Decline", icon: CloseLineIcon, hover: "hover:text-rose-600", onClick: () => onRowAction?.(alum, "decline") },
                                { key: "view", label: "View", icon: EyeIcon, hover: "hover:text-blue-600", onClick: () => onRowAction?.(alum, "view") },
                              ]
                            : [
                                { key: "delete", label: "Delete", icon: TrashBinIcon, hover: "hover:text-rose-600", onClick: () => onRowAction?.(alum, "delete") },
                                { key: "view", label: "View", icon: EyeIcon, hover: "hover:text-blue-600", onClick: () => onRowAction?.(alum, "view") },
                              ];
                          return actions.map(({ key, label, icon: Icon, onClick, hover }, i) => (
                            <button
                              key={`${alum.id}-action-${key}-${i}`}
                              type="button"
                              onClick={onClick}
                              className={`text-gray-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded ${hover ?? "hover:text-gray-700"}`}
                              aria-label={label}
                              title={label}
                            >
                              <Icon className="h-5 w-5" />
                            </button>
                          ));
                        })()}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className="flex items-center justify-between p-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {(() => {
              const start = (currentPage - 1) * pageSize + 1;
              const end = start + pageItems.length - 1;
              return `Showing ${pageItems.length ? start : 0}-${pageItems.length ? end : 0} of ${total}`;
            })()}
          </span>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(p) => setCurrentPage(Math.max(1, Math.min(totalPages, p)))}
          />
        </div>
      </div>
    </section>
  );
};