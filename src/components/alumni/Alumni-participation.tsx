"use client";
import React, { useMemo, useState } from "react";
import ComponentCard from "@/components/common/ComponentCard";
import { GroupIcon, EyeIcon, TrashBinIcon, CheckLineIcon, CloseLineIcon, LockIcon } from "@/icons";
import Badge from "../ui/badge/Badge";
import { Table, TableHeader, TableBody, TableCell, TableRow } from "@/components/ui/table";
import Pagination from "@/components/tables/Pagination";
import { useRouter } from "next/navigation";
import { useAlumniParticipationList } from "@/app/queries/fetch-alumni-participation";
import type { AlumniListItem } from "@/app/queries/fetch-alumni";

type TabKey = "talkMentorship" | "alumniChapters" | "alumniAssociation";

const TABS: { key: TabKey; label: string }[] = [
  { key: "talkMentorship", label: "Mentorship Session" },
  { key: "alumniChapters", label: "Alumni Chapters" },
  { key: "alumniAssociation", label: "Alumni Association" },
];


// Per-status color classes to visually distinguish each participation type
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
  talkMentorship: {
    selectedContainer:
      "border-indigo-500 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-900/20",
    hoverBorder: "hover:border-indigo-400",
    iconBg: "bg-indigo-100 dark:bg-indigo-800",
    iconColor: "text-indigo-700 dark:text-indigo-200",
    labelText: "text-indigo-600 dark:text-indigo-300",
  },
  alumniChapters: {
    selectedContainer:
      "border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20",
    hoverBorder: "hover:border-blue-400",
    iconBg: "bg-blue-100 dark:bg-blue-800",
    iconColor: "text-blue-700 dark:text-blue-200",
    labelText: "text-blue-600 dark:text-blue-300",
  },
  alumniAssociation: {
    selectedContainer:
      "border-violet-500 bg-violet-50 dark:border-violet-500 dark:bg-violet-900/20",
    hoverBorder: "hover:border-violet-400",
    iconBg: "bg-violet-100 dark:bg-violet-800",
    iconColor: "text-violet-700 dark:text-violet-200",
    labelText: "text-violet-600 dark:text-violet-300",
  },
};

export const AlumniParticipation: React.FC = () => {
  const [selected, setSelected] = useState<TabKey>("talkMentorship");
  const router = useRouter();
  const { data, isLoading, error } = useAlumniParticipationList();

  // Icon mapping (replicates Alumni-tabs typed map; using GroupIcon consistently)
  const ICON_COMPONENT_MAP: Record<
    TabKey,
    React.ComponentType<{ className?: string }>
  > = {
    talkMentorship: GroupIcon,
    alumniChapters: GroupIcon,
    alumniAssociation: GroupIcon,
  };

  type TableItem = {
    id: string;
    name: string;
    mobile?: string;
    email?: string;
    department?: string;
    verified?: boolean;
    organization?: string;
    designation?: string;
    workCountry?: string;
    workCity?: string;
    level: TabKey[];
  };
  const PARTICIPANTS = useMemo<TableItem[]>(() => {
    const items = (data ?? []) as AlumniListItem[];
    const parseVerified = (v: string | null | undefined) => {
      if (!v) return false;
      const s = String(v).toLowerCase();
      return s === "true" || s === "yes" || s === "verified";
    };
    return items.map((it) => {
      const level: TabKey[] = [];
      if (parseVerified(it.verify)) level.push("talkMentorship");
      if (it.country || it.city) level.push("alumniChapters");
      if (it.nameoforganization || it.designation) level.push("alumniAssociation");
      return {
        id: it.sapid,
        name: it.alumniname,
        mobile: it.contactno ?? it.officialnumber ?? undefined,
        email: it.personalemail ?? it.officialemail ?? undefined,
        department: it.departmentname ?? undefined,
        verified: parseVerified(it.verify),
        organization: it.nameoforganization ?? undefined,
        designation: it.designation ?? undefined,
        workCountry: it.country ?? undefined,
        workCity: it.city ?? undefined,
        level,
      } as TableItem;
    });
  }, [data]);

  const filteredParticipants = useMemo(
    () => PARTICIPANTS.filter((p) => p.level.includes(selected)),
    [PARTICIPANTS, selected]
  );

  type SortKey = keyof TableItem;
  type SortDir = "asc" | "desc";

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const loading = isLoading;
  const errorMsg = error instanceof Error ? error.message : null;

  const sortedParticipants = useMemo(() => {
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
    const toComparable = (val: unknown): string | number => {
      if (val == null) return "";
      if (typeof val === "boolean") return val ? 1 : 0;
      if (typeof val === "number") return val;
      return String(val).toLowerCase();
    };
    const items = [...filteredParticipants];
    items.sort((a, b) => {
      const va = toComparable(a[sortKey]);
      const vb = toComparable(b[sortKey]);
      let cmp = 0;
      if (typeof va === "number" && typeof vb === "number") {
        cmp = va - vb;
      } else {
        cmp = collator.compare(String(va), String(vb));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return items;
  }, [filteredParticipants, sortKey, sortDir]);

  const total = sortedParticipants.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = sortedParticipants.slice(start, end);

  return (
    <ComponentCard className="">
      <div className="flex flex-col gap-6">
        <div className="rounded-2xl dark:bg-white/[0.03]">
          <div
            className="tab-list flex flex-nowrap items-center gap-3 overflow-x-auto p-1"
            role="tablist"
            aria-label="Alumni participation categories"
          >
            {TABS.map((tab, idx) => {
              const stat = { count: PARTICIPANTS.filter((p) => p.level.includes(tab.key)).length };
              const statusClasses = STATUS_CLASS_MAP[tab.key];
              const Icon = ICON_COMPONENT_MAP[tab.key];
              return (
                <div key={tab.key}>
                <button
                  key={tab.key}
                  type="button"
                  className={`w-[180px]  whitespace-nowrap flex flex-col items-start gap-2 rounded-xl border px-3 py-3 text-sm transition-colors transition-transform ${statusClasses.hoverBorder} ${
                    selected === tab.key
                      ? statusClasses.selectedContainer
                      : "border-gray-200 bg-slate-100 dark:border-gray-800 dark:bg-white/[0.03]"
                  } hover:translate-y-[-1px] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900`}
                  onClick={() => setSelected(tab.key)}
                  role="tab"
                  aria-selected={selected === tab.key}
                  aria-label={`${tab.label} (${stat.count.toLocaleString()})`}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight") {
                      e.preventDefault();
                      const nextIdx = (idx + 1) % TABS.length;
                      setSelected(TABS[nextIdx].key);
                    } else if (e.key === "ArrowLeft") {
                      e.preventDefault();
                      const prevIdx = (idx - 1 + TABS.length) % TABS.length;
                      setSelected(TABS[prevIdx].key);
                    } else if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(tab.key);
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`${statusClasses.iconColor} size-6`} />
                    <span className={`font-medium  ${statusClasses.labelText}`}>{tab.label}</span>
                  </div>
                  <span className="ml-1 text-[40px] text-gray-600 dark:text-gray-400">
                    {stat.count.toLocaleString()}
                  </span>
                </button>

                
                </div>
              );
            })}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto custom-scrollbar max-h-[700px] overflow-y-auto" aria-live={loading ? "polite" : undefined}>
            <div className="min-w-full xl:min-w-full">
              <Table className="min-w-full border border-gray-200 dark:border-gray-800">
                <TableHeader className="bg-white whitespace-nowrap border-b border-gray-200 dark:border-white/[0.06]">
                  <TableRow className="border-b border-gray-200 dark:border-white/[0.06]">
                    {(
                      [
                        { label: "Name", key: "name" as SortKey, align: "text-start" },
                        { label: "SAP ID", key: "id" as SortKey, align: "text-start" },
                        { label: "Mobile No", key: "mobile" as SortKey, align: "text-start" },
                        { label: "Active Email", key: "email" as SortKey, align: "text-start" },
                        { label: "Department", key: "department" as SortKey, align: "text-start" },
                        { label: "Work Status", key: "verified" as SortKey, align: "text-start" },
                        { label: "Designation", key: "designation" as SortKey, align: "text-start" },
                        { label: "Work Country/City", key: "workCountry" as SortKey, align: "text-start" },
                      ] as { label: string; key: SortKey; align: string }[]
                    ).map(({ label, key, align }) => {
                      const ariaSort = sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : "none";
                      return (
                        <TableCell
                          key={`hdr-${String(key)}`}
                          className={`px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300 ${align}`}
                          aria-sort={ariaSort}
                        >
                          <button
                            type="button"
                            className="group inline-flex items-center gap-1 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                            onClick={() => {
                              setSelectedRowId(null);
                              setCurrentPage(1);
                              setSortKey(key);
                              setSortDir(sortKey === key && sortDir === "asc" ? "desc" : "asc");
                            }}
                            aria-label={`Sort by ${label} ${sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}`}
                          >
                            <span>{label}</span>
                            <span className="text-[10px] text-gray-400 group-hover:text-gray-600" aria-hidden="true">
                              {sortKey === key ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                            </span>
                          </button>
                        </TableCell>
                      );
                    })}
                    <TableCell className="px-4 py-3 text-right text-[13px] font-medium text-slate-600 dark:text-gray-300">Actions</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                  {loading && (
                    Array.from({ length: Math.min(pageSize, 5) }).map((_, i) => (
                      <TableRow key={`skeleton-${i}`}>
                      <TableCell className="px-5 py-4"><div className="h-5 w-48 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3"><div className="h-5 w-24 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3"><div className="h-5 w-28 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3"><div className="h-5 w-40 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3"><div className="h-5 w-32 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3"><div className="h-5 w-24 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3"><div className="h-5 w-56 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3"><div className="h-5 w-36 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3"><div className="h-5 w-40 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3"><div className="h-9 w-24 bg-gray-200 animate-pulse rounded" /></TableCell>
                    </TableRow>
                  ))
                )}
                {!loading && errorMsg && (
                  <TableRow>
                    <TableCell className="px-4 py-3 text-red-600" colSpan={10}>{errorMsg}</TableCell>
                  </TableRow>
                )}
                {!loading && !errorMsg && pageItems.length === 0 && (
                  <TableRow>
                    <TableCell className="px-4 py-6 text-gray-600 dark:text-gray-400" colSpan={10}>
                      No alumni found for this category.
                    </TableCell>
                  </TableRow>
                )}
                {!loading && !errorMsg && pageItems.map((alum, idx) => (
                  <TableRow
                    key={`${alum.id}-${idx}`}
                    className={`hover:bg-gray-50 dark:hover:bg-white/[0.04] ${selectedRowId === alum.id ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
                    onClick={() => setSelectedRowId(alum.id)}
                    aria-selected={selectedRowId === alum.id}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedRowId(alum.id);
                      }
                    }}
                  >
                    <TableCell className="px-5 py-4 sm:px-6 text-start">
                      <div className="flex items-center gap-3">
                        <span className="block font-medium text-gray-800 text-theme-sm dark:text-white/90">{alum.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-gray-600 text-start text-theme-sm dark:text-gray-300">{alum.id}</TableCell>
                    <TableCell className="px-4 py-3 text-gray-600 text-start text-theme-sm dark:text-gray-300">{alum.mobile ?? "-"}</TableCell>
                    <TableCell className="px-4 py-3 text-gray-600 text-start text-theme-sm dark:text-gray-300">{alum.email ?? "-"}</TableCell>
                    <TableCell className="px-4 py-3 text-gray-600 text-start text-theme-sm dark:text-gray-300">{alum.department ?? "-"}</TableCell>
                    <TableCell className="px-4 py-3 text-start">
                      <Badge size="sm" color={alum.verified ? "success" : "error"}>{alum.verified ? "Verified" : "Un-Verified"}</Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-gray-600 text-start text-theme-sm dark:text-gray-300">{alum.organization ?? "-"}</TableCell>
                    <TableCell className="px-4 py-3 text-gray-600 text-start text-theme-sm dark:text-gray-300">{alum.designation ?? "-"}</TableCell>
                    <TableCell className="px-4 py-3 text-gray-600 text-start text-theme-sm dark:text-gray-300">{alum.workCountry ? `${alum.workCountry}${alum.workCity ? ` / ${alum.workCity}` : ""}` : "-"}</TableCell>
                    <TableCell className="px-4 py-3 text-end">
                      <div role="group" aria-label="Row actions" className="inline-flex items-center gap-2">
                        {(() => {
                          const actions: Array<{ label: string; icon: React.ComponentType<{ className?: string }>; onClick: () => void; hover?: string }> =
                            selected === "talkMentorship"
                              ? [
                                  { label: "Suspend", icon: LockIcon, onClick: () => {/* TODO: wire suspend */}, hover: "hover:text-amber-600" },
                                  { label: "Delete", icon: TrashBinIcon, onClick: () => {/* TODO: wire delete */}, hover: "hover:text-rose-600" },
                                  { label: "View", icon: EyeIcon, onClick: () => router.push(`/alumni/${alum.id}`), hover: "hover:text-blue-600" },
                                ]
                              : selected === "alumniChapters"
                              ? [
                                  { label: "Verify", icon: CheckLineIcon, onClick: () => {/* TODO: wire verify */}, hover: "hover:text-emerald-600" },
                                  { label: "Decline", icon: CloseLineIcon, onClick: () => {/* TODO: wire decline */}, hover: "hover:text-rose-600" },
                                  { label: "View", icon: EyeIcon, onClick: () => router.push(`/alumni/${alum.id}`), hover: "hover:text-blue-600" },
                                ]
                              : [
                                  { label: "View", icon: EyeIcon, onClick: () => router.push(`/alumni/${alum.id}`), hover: "hover:text-blue-600" },
                                ];
                          return actions.map(({ label, icon: Icon, onClick, hover }, i) => (
                            <button
                              key={`${alum.id}-action-${i}`}
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
              const startIdx = (safePage - 1) * pageSize + 1;
              const endIdx = startIdx + pageItems.length - 1;
              return `Showing ${pageItems.length ? startIdx : 0}-${pageItems.length ? endIdx : 0} of ${total}`;
            })()}
          </span>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-500 dark:text-gray-400" htmlFor="page-size">Items per page:</label>
            <select
              id="page-size"
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={(p) => setCurrentPage(Math.max(1, Math.min(totalPages, p)))} />
          </div>
          </div>
        </div>
      </div>
    </ComponentCard>
  );
};
