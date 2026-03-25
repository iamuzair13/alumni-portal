"use client";
import React, { useMemo, useState, useCallback } from "react";
import ComponentCard from "@/components/common/ComponentCard";
import { GroupIcon, EyeIcon, TrashBinIcon } from "@/icons";
import { Table, TableHeader, TableBody, TableCell, TableRow } from "@/components/ui/table";
import Pagination from "@/components/tables/Pagination";
import { useAlumniParticipationList } from "@/app/queries/fetch-alumni-participation";
import type { MentorshipItem } from "@/app/queries/fetch-alumni-participation";
import { useAlumniAssociationList } from "@/app/queries/fetch-alumni-association";
import type { AssociationItem } from "@/app/queries/fetch-alumni-association";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { useSession } from "next-auth/react";
import { canModify } from "@/lib/alumniProfile";
import SyncedTableScroll from "@/components/tables/SyncedTableScroll";
import { useExcelExport } from "@/lib/excel-export";

type TabKey = "talkMentorship" | "alumniChapters" | "alumniAssociation";

const CATEGORY_TABS: { key: TabKey; label: string }[] = [
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

 function formatCreatedDate(v?: string | Date | null): string {
   if (!v) return "-";
   try {
     const d = typeof v === "string" ? new Date(v) : v;
     return d.toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "2-digit" });
   } catch {
     return String(v);
   }
 }

export const AlumniParticipation: React.FC = () => {
  const [selected, setSelected] = useState<TabKey>("talkMentorship");
  const { data: participationData, isLoading: isLoadingParticipation, error: participationError } = useAlumniParticipationList();
  const { data: associationData, isLoading: isLoadingAssociation, error: associationError } = useAlumniAssociationList();
  const qc = useQueryClient();
  const { data: session } = useSession();
  const canPerformActions = canModify(session?.user);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetSapId, setTargetSapId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const { isExporting, openExportModal, ExportModal } = useExcelExport();

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
    email?: string;
    createdAt?: string | Date | null;
    department?: string | null;
    faculty?: string | null;
    program?: string | null;
    topics?: string[];
    areas?: string[];
    day?: string;
    time?: string;
    role?: string | null;
    level: TabKey[];
  };
  const PARTICIPANTS = useMemo<TableItem[]>(() => {
    const items = (participationData ?? []) as MentorshipItem[];
    return items.map((it) => {
      const level: TabKey[] = ["talkMentorship"];
      if (it.day && it.time) level.push("alumniChapters");
      return {
        id: it.sapid,
        name: it.name,
        email: it.email ?? undefined,
        createdAt: (it as unknown as { created_at?: string | null }).created_at ?? null,
        department: it.department ?? null,
        faculty: it.faculty ?? null,
        program: it.program ?? null,
        topics: it.topics,
        areas: it.areas,
        day: it.day,
        time: it.time,
        level,
      } as TableItem;
    });
  }, [participationData]);

  const ASSOCIATIONS = useMemo<TableItem[]>(() => {
    const items = (associationData ?? []) as AssociationItem[];
    return items.map((it) => ({
      id: it.sapid,
      name: it.name,
      email: it.email ?? undefined,
      createdAt: it.createdAt ?? null,
      department: it.department ?? null,
      faculty: it.faculty ?? null,
      program: it.program ?? null,
      role: it.role ?? null,
      level: ["alumniAssociation"] as TabKey[],
    })) as TableItem[];
  }, [associationData]);

  async function deleteMentorshipBySapId(sapid: string) {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/alumni/talks?sapid=${encodeURIComponent(sapid)}`, {
        method: "DELETE",
        headers: { accept: "application/json" },
        credentials: "same-origin",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `Failed (${res.status})`);
      const key = ["alumni", "participation", "list"] as const;
      const prev = qc.getQueryData<MentorshipItem[]>(key);
      if (prev) {
        const next = prev.filter((r) => String(r.sapid) !== String(sapid));
        qc.setQueryData(key, next);
      }
      setDeleteSuccess("Mentorship session deleted successfully");
      setConfirmOpen(false);
      setTargetSapId(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  }

  const filteredParticipants = useMemo(() => {
    if (selected === "alumniAssociation") {
      return ASSOCIATIONS;
    }
    return PARTICIPANTS.filter((p) => p.level.includes(selected));
  }, [PARTICIPANTS, ASSOCIATIONS, selected]);

  type SortKey = keyof TableItem;
  type SortDir = "asc" | "desc";

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const loading = selected === "alumniAssociation" ? isLoadingAssociation : isLoadingParticipation;
  const errorMsg = selected === "alumniAssociation" 
    ? (associationError instanceof Error ? associationError.message : null)
    : (participationError instanceof Error ? participationError.message : null);

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

  // Export to Excel function - comprehensive export with ALL fields
  const handleExportToExcel = useCallback(() => {
    const exportColumnKeys: string[] = [
      "SR.No",
      "SAP ID",
      "Registration No",
      "Full Name",
      "Gender",
      "Father Name",
      "Father CNIC",
      "Date of Birth",
      "Marital Status",
      "CNIC/Passport",
      "Contact No",
      "Contact No 1",
      "Contact No 1 Show",
      "Personal Email",
      "Personal Email Show",
      "University Email",
      "Wrok Email",
      "Wrok Number",
      "Address",
      "Country",
      "Province",
      "City",
      "Academic Session",
      "Degree Title",
      "CGPA",
      "Year of Starting",
      "Year of Ending",
      "Faculty",
      "Campus",
      "Department",
      "Major Subject",
      "Industry",
      "Employment Status",
      "Organization",
      "Designation",
      "Total Years of Experience",
      "Work City",
      "Work Country",
      "Organization Address",
      "Supervisor Designation",
      "Supervisor Number",
      "Chapter 1",
      "Chapter 2",
      "Chapter 3",
      "All Chapters",
      "Chapter Remarks",
      "Association Title",
      "Association Description",
      "Association Dean",
      "Association Phone",
      "Association Email",
      "Association Address",
      // Participation-specific unions
      "Association Role",
      "Association Status",
      "Association Created At",
      "Association Updated At",
      "Association Rejection Reason",
      "Topic",
      "Day",
      "Timings",
      "Activity",
      "Talks Created At",
    ];

    const columns = exportColumnKeys.map((key) => ({
      key,
      label: key,
      defaultSelected: true,
    }));

    // Determine export type
    let exportType = "all";
    let filename = "alumni_participation_export";
    let sheetName = "Participation";
    if (selected === "alumniAssociation") {
      exportType = "association";
      filename = "alumni_association_export";
      sheetName = "Association";
    } else if (selected === "talkMentorship") {
      exportType = "talks";
      filename = "alumni_talks_export";
      sheetName = "Talks";
    } else {
      exportType = "talks";
      filename = "alumni_chapters_participation_export";
      sheetName = "Chapters";
    }

    // Helper function to format chapter names
    const formatChapters = (item: Record<string, unknown>) => {
      const chapters: string[] = [];
      const chapter1 = String(item.chapter1_national || item.chapter1_international || "");
      const chapter2 = String(item.chapter2_national || item.chapter2_international || "");
      const chapter3 = String(item.chapter3_national || item.chapter3_international || "");
      if (chapter1) chapters.push(chapter1);
      if (chapter2) chapters.push(chapter2);
      if (chapter3) chapters.push(chapter3);
      return chapters.filter((c) => c).join(", ") || "";
    };

    const fetchAndTransformData = async (): Promise<Record<string, unknown>[]> => {
      const url = new URL(
        "/api/alumni/participation/export",
        typeof window !== "undefined" ? window.location.origin : ""
      );
      url.searchParams.set("type", exportType);

      const res = await fetch(url.toString(), {
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch export data: ${res.status}`);
      }

      const data = await res.json();
      const allItems = data.items || [];
      if (!allItems || allItems.length === 0) {
        throw new Error("No data found to export with the applied filters.");
      }

      return allItems.map((item: Record<string, unknown>) => {
        const baseFields = {
          "SR.No": item.alumniid || "",
          "SAP ID": item.sapid || "",
          "Registration No": item.registrationno || "",
          "Full Name": item.alumniname || "",
          "Gender": item.gender || "",
          "Father Name": item.fathername || "",
          "Father CNIC": item.father_cnic || "",
          "Date of Birth": item.dateofbirth || "",
          "Marital Status": item.maritalstatus || "",
          "CNIC/Passport": item.cnicpassport || "",
          "Contact No": item.contactno || "",
          "Contact No 1": item.contactno1 || "",
          "Contact No 1 Show": item.contactno1show || "",
          "Personal Email": item.personalemail || "",
          "Personal Email Show": item.personalemailshow || "",
          "University Email": item.universityemail || "",
          "Wrok Email": item.officialemail || "",
          "Wrok Number": item.officialnumber || "",
          "Address": item.address || "",
          "Country": item.country || "",
          "Province": item.province || "",
          "City": item.city || "",
          "Academic Session": item.academicsession || "",
          "Degree Title": item.degreetitle || "",
          "CGPA": item.cgpa || "",
          "Year of Starting": item.yearofstarting || "",
          "Year of Ending": item.yearofending || "",
          "Faculty": item.facultyname || "",
          "Campus": item.campusname || "",
          "Department": item.departmentname || "",
          "Major Subject": item.majorsubject || "",
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
          "Chapter 1": item.chapter1_national || item.chapter1_international || "",
          "Chapter 2": item.chapter2_national || item.chapter2_international || "",
          "Chapter 3": item.chapter3_national || item.chapter3_international || "",
          "All Chapters": formatChapters(item),
          "Chapter Remarks": item.chapter_remarks || "",
          "Association Title": item.association_title || "",
          "Association Description": item.association_description || "",
          "Association Dean": item.association_dean || "",
          "Association Phone": item.association_phone || "",
          "Association Email": item.association_email || "",
          "Association Address": item.association_address || "",
        };

        if (exportType === "association") {
          return {
            ...baseFields,
            "Association Role": item.q3 || "",
            "Association Status": item.status || "",
            "Association Created At": item.createddatetime || "",
            "Association Updated At": item.updated_at || "",
            "Association Rejection Reason": item.rejection_reason || "",
          };
        }

        return {
          ...baseFields,
          "Topic": item.topic || "",
          "Day": item.day || "",
          "Timings": item.timings || "",
          "Activity": item.activity || "",
          "Talks Created At": item.created_at || "",
        };
      });
    };

    openExportModal({
      data: fetchAndTransformData,
      columns,
      filename,
      sheetName,
    });
  }, [selected, openExportModal]);

  return (
    <ComponentCard className="">
      <div className="flex flex-col gap-6">
        <div className="rounded-2xl  dark:bg-white/[0.03]">
          <div
            className="tab-list flex flex-nowrap items-center gap-3 overflow-x-auto p-1"
            role="tablist"
            aria-label="Alumni participation categories"
          >
            {CATEGORY_TABS.map((tab: { key: TabKey; label: string }, idx: number) => {
              const stat = { 
                count: tab.key === "alumniAssociation" 
                  ? ASSOCIATIONS.length 
                  : PARTICIPANTS.filter((p) => p.level.includes(tab.key)).length 
              };
              const statusClasses = STATUS_CLASS_MAP[tab.key];
              const Icon = ICON_COMPONENT_MAP[tab.key];
              return (
                <div key={tab.key}>
                  <button
                    key={tab.key}
                    type="button"
                    className={`w-[240px]  last:border-0 bg-white flex flex-col items-center whitespace-nowrap text-center border-r border-gray-300 px-4 py-2 text-sm transition-colors transition-transform hover:translate-y-[-1px] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900`}
                    onClick={() => setSelected(tab.key)}
                    role="tab"
                    aria-selected={selected === tab.key}
                    aria-label={`${tab.label} (${stat.count.toLocaleString()})`}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowRight") {
                        e.preventDefault();
                        const nextIdx = (idx + 1) % CATEGORY_TABS.length;
                        setSelected(CATEGORY_TABS[nextIdx].key);
                      } else if (e.key === "ArrowLeft") {
                        e.preventDefault();
                        const prevIdx = (idx - 1 + CATEGORY_TABS.length) % CATEGORY_TABS.length;
                        setSelected(CATEGORY_TABS[prevIdx].key);
                      } else if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(tab.key);
                      }
                    }}
                  >
                    <Icon className="hidden" aria-hidden="true" />
                    <h6 className={`text-[20px] font-bold mt-2 ${statusClasses.labelText}`}>{tab.label}</h6>
                    <h3 className={`text-[35px] font-bold mt-6`}>{stat.count.toLocaleString()}</h3>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {deleteSuccess && (
          <div className="inline-flex items-center gap-2 rounded-md bg-emerald-50 text-emerald-700 px-3 py-2 border border-emerald-200">
            <span className="text-sm">{deleteSuccess}</span>
          </div>
        )}
        {deleteError && (
          <div className="inline-flex items-center gap-2 rounded-md bg-rose-50 text-rose-700 px-3 py-2 border border-rose-200">
            <span className="text-sm">{deleteError}</span>
          </div>
        )}

        <ExportModal />

        <div className="flex items-center justify-end mb-4">
          <button
            type="button"
            onClick={handleExportToExcel}
            disabled={isExporting || loading || filteredParticipants.length === 0}
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
        <div className="overflow-hidden rounded-2xl bg-white dark:bg-white/[0.03]">
          <SyncedTableScroll minWidth={950} maxHeight={700} className="" >
            <div aria-live={loading ? "polite" : undefined}>
              <Table className="min-w-full border border-gray-200 dark:border-gray-800">
                <TableHeader className="bg-white whitespace-nowrap border-b border-gray-200 dark:border-white/[0.06]">
                  <TableRow className="border-b border-gray-200 dark:border-white/[0.06]">
                    {(
                      (selected === "alumniAssociation"
                        ? [
                            { label: "Name", key: "name" as SortKey, align: "text-start" },
                            { label: "SAP ID", key: "id" as SortKey, align: "text-start" },
                            { label: "Email", key: "email" as SortKey, align: "text-start" },
                            { label: "Created Date", key: "createdAt" as SortKey, align: "text-start" },
                            { label: "Department", key: "department" as SortKey, align: "text-start" },
                            { label: "Faculty", key: "faculty" as SortKey, align: "text-start" },
                            { label: "Program", key: "program" as SortKey, align: "text-start" },
                            { label: "Role", key: "role" as SortKey, align: "text-start" },
                          ]
                        : [
                        { label: "Name", key: "name" as SortKey, align: "text-start" },
                        { label: "SAP ID", key: "id" as SortKey, align: "text-start" },
                        { label: "Email", key: "email" as SortKey, align: "text-start" },
                        { label: "Created Date", key: "createdAt" as SortKey, align: "text-start" },
                        { label: "Department", key: "department" as SortKey, align: "text-start" },
                        { label: "Faculty", key: "faculty" as SortKey, align: "text-start" },
                        { label: "Program", key: "program" as SortKey, align: "text-start" },
                        { label: "Topics", key: "topics" as SortKey, align: "text-start" },
                        { label: "Areas", key: "areas" as SortKey, align: "text-start" },
                        { label: "Day", key: "day" as SortKey, align: "text-start" },
                        { label: "Time", key: "time" as SortKey, align: "text-start" },
                          ]
                      ) as { label: string; key: SortKey; align: string }[]
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
                      <TableCell className="px-4 py-3"><div className="h-5 w-28 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3"><div className="h-5 w-40 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3"><div className="h-5 w-32 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3"><div className="h-5 w-24 bg-gray-200 animate-pulse rounded" /></TableCell>
                      {selected === "alumniAssociation" ? (
                        <>
                          <TableCell className="px-4 py-3"><div className="h-5 w-32 bg-gray-200 animate-pulse rounded" /></TableCell>
                          <TableCell className="px-4 py-3"><div className="h-9 w-24 bg-gray-200 animate-pulse rounded" /></TableCell>
                        </>
                      ) : (
                        <>
                      <TableCell className="px-4 py-3"><div className="h-5 w-56 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3"><div className="h-5 w-36 bg-gray-200 animate-pulse rounded" /></TableCell>
                          <TableCell className="px-4 py-3"><div className="h-5 w-40 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3"><div className="h-5 w-40 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3"><div className="h-9 w-24 bg-gray-200 animate-pulse rounded" /></TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                )}
                {!loading && errorMsg && (
                  <TableRow>
                    <TableCell className="px-4 py-3 text-red-600" colSpan={selected === "alumniAssociation" ? 8 : 11}>{errorMsg}</TableCell>
                  </TableRow>
                )}
                {!loading && !errorMsg && pageItems.length === 0 && (
                  <TableRow>
                    <TableCell className="px-4 py-6 text-gray-600 dark:text-gray-400" colSpan={selected === "alumniAssociation" ? 8 : 11}>
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
                    <TableCell className="px-4 py-3 text-gray-600 text-start text-theme-sm dark:text-gray-300">{alum.email ?? "-"}</TableCell>
                    <TableCell className="px-4 py-3 text-gray-600 text-start text-theme-sm dark:text-gray-300">{formatCreatedDate(alum.createdAt)}</TableCell>
                    <TableCell className="px-4 py-3 text-gray-600 text-start text-theme-sm dark:text-gray-300">{alum.department ?? "-"}</TableCell>
                    <TableCell className="px-4 py-3 text-gray-600 text-start text-theme-sm dark:text-gray-300">{alum.faculty ?? "-"}</TableCell>
                    <TableCell className="px-4 py-3 text-gray-600 text-start text-theme-sm dark:text-gray-300">{alum.program ?? "-"}</TableCell>
                    {selected === "alumniAssociation" ? (
                      <TableCell className="px-4 py-3 text-gray-600 text-start text-theme-sm dark:text-gray-300">{alum.role ?? "-"}</TableCell>
                    ) : (
                      <>
                        <TableCell className="px-4 py-3 text-gray-600 text-start text-theme-sm dark:text-gray-300">{alum.topics?.join(", ") || "-"}</TableCell>
                        <TableCell className="px-4 py-3 text-gray-600 text-start text-theme-sm dark:text-gray-300">{alum.areas?.join(", ") || "-"}</TableCell>
                        <TableCell className="px-4 py-3 text-gray-600 text-start text-theme-sm dark:text-gray-300">{alum.day ?? "-"}</TableCell>
                        <TableCell className="px-4 py-3 text-gray-600 text-start text-theme-sm dark:text-gray-300">{alum.time ?? "-"}</TableCell>
                      </>
                    )}
                    <TableCell className="px-4 py-3 text-end">
                      <div role="group" aria-label="Row actions" className="inline-flex items-center gap-2">
                            {(() => {
                              // Only admin and superadmin can see View button
                              if (!canPerformActions) {
                                return null;
                              }
                              
                              const actions: Array<{ label: string; icon: React.ComponentType<{ className?: string }>; onClick: () => void; hover?: string }> = [
                                { label: "View", icon: EyeIcon, onClick: () => { const url = `/alumni-profile?sapid=${encodeURIComponent(alum.id)}`; window.open(url, "_blank", "noopener,noreferrer"); }, hover: "hover:text-blue-600" },
                                { label: "Delete", icon: TrashBinIcon, onClick: () => { setTargetSapId(alum.id); setConfirmOpen(true); setDeleteError(null); setDeleteSuccess(null); }, hover: "hover:text-rose-600" },
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
          </SyncedTableScroll>
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
      {confirmOpen && (
        <Modal isOpen={confirmOpen} onClose={() => { if (!deleting) { setConfirmOpen(false); setTargetSapId(null); } }} className="max-w-md mx-auto">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Are you sure you want to delete this mentorship session?</h3>
            <div className="mt-4 flex items-center justify-end gap-3">
              <button type="button" disabled={deleting} onClick={() => { setConfirmOpen(false); setTargetSapId(null); }} className="rounded-md px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400">Cancel</button>
              <button type="button" disabled={deleting || !targetSapId} onClick={() => { if (targetSapId) deleteMentorshipBySapId(targetSapId); }} className="rounded-md px-4 py-2 text-white bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500">
                {deleting ? "Deleting…" : "Confirm"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </ComponentCard>
  );
};

export async function deleteMentorshipSessionBySapId(qc: import("@tanstack/react-query").QueryClient, sapid: string) {
  const res = await fetch(`/api/alumni/talks?sapid=${encodeURIComponent(sapid)}`, {
    method: "DELETE",
    headers: { accept: "application/json" },
    credentials: "same-origin",
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error || `Failed (${res.status})`);
  const key = ["alumni", "participation", "list"] as const;
  const prev = qc.getQueryData<MentorshipItem[]>(key);
  if (prev) {
    const next = prev.filter((r) => String(r.sapid) !== String(sapid));
    qc.setQueryData(key, next);
  }
  return true;
}
