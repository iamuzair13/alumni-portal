"use client";
/* eslint-disable @next/next/no-img-element */


import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ComponentCard from "@/components/common/ComponentCard";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import Pagination from "@/components/tables/Pagination";
import SyncedTableScroll from "@/components/tables/SyncedTableScroll";
import { useForm, Controller } from "react-hook-form";
import { storyFormSchema, type NewStoryPayload } from "@/lib/alumniStories";
import { zodResolver } from "@hookform/resolvers/zod";
import { EyeIcon, TrashBinIcon } from "@/icons";
import { useQueryClient } from "@tanstack/react-query";
import { useAlumniStories, alumniStoriesKey, type AlumniStoryItem } from "@/app/queries/fetch-alumni-stories";

// TypeScript typings for Stories
type Story = {
  id: string;
  date: string | Date;
  name: string;
  program: string;
  session: string;
  shortDescription: string;
  imageUrl: string;
};

// Tabs typing: maintain same tab styling and interaction model
type TabKey = "viewStories" | "addStory";

const TABS: { key: TabKey; label: string }[] = [
  { key: "viewStories", label: "View Stories" },
  { key: "addStory", label: "Add Story" },
];

// Stories are fetched from API; no local dummy data

// Helper to format date safely to YYYY-MM-DD
function formatDate(input: string | Date): string {
  try {
    const d = typeof input === "string" ? new Date(input) : input;
    if (Number.isNaN(d.getTime())) return "-";
    return d.toISOString().slice(0, 10);
  } catch {
    return "-";
  }
}

// Stories table component with identical styling conventions, responsive design,
// pagination, and accessibility
type StoryListProps = {
  items: Story[];
  loading?: boolean;
  isFetching?: boolean;
  errorMessage?: string | null;
  emptyMessage?: string;
  onDelete?: (id: string) => Promise<void> | void;
  deletingIds?: Set<string>;
  actionMessage?: string | null;
  actionError?: string | null;
};

const StoryTable: React.FC<StoryListProps> = ({ items, loading, isFetching, errorMessage, emptyMessage, onDelete, deletingIds, actionMessage, actionError }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [items]);

  const safeItems = useMemo<Story[]>(() => {
    try {
      return Array.isArray(items) ? items : [];
    } catch {
      return [];
    }
  }, [items]);

  const totalPages = Math.max(1, Math.ceil(safeItems.length / pageSize));
  const startIdx = (currentPage - 1) * pageSize;
  const paged = safeItems.slice(startIdx, startIdx + pageSize);

  return (
    <div className="overflow-hidden border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] ">
      <SyncedTableScroll minWidth={950} maxHeight={700}>
        <Table className="min-w-full border border-gray-200 dark:border-gray-800">
            <TableHeader className="bg-white whitespace-nowrap border-b border-gray-200 dark:border-white/[0.06]">
              <TableRow>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">SrNo.</TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Date</TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Name</TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Program &amp; Session</TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Short Description</TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Image</TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Actions</TableCell>
              </TableRow>
            </TableHeader>

            <TableBody className="whitespace-nowrap divide-y divide-gray-200 dark:divide-white/[0.06]">
              {(loading || isFetching) && (
                Array.from({ length: Math.min(pageSize, 5) }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`} className="odd:bg-gray-50">
                    <TableCell className="px-4 py-3 border-r border-gray-200"><div className="h-5 w-12 bg-gray-200 animate-pulse rounded" /></TableCell>
                    <TableCell className="px-4 py-3 border-r border-gray-200"><div className="h-5 w-28 bg-gray-200 animate-pulse rounded" /></TableCell>
                    <TableCell className="px-4 py-3 border-r border-gray-200"><div className="h-5 w-40 bg-gray-200 animate-pulse rounded" /></TableCell>
                    <TableCell className="px-4 py-3 border-r border-gray-200"><div className="h-5 w-48 bg-gray-200 animate-pulse rounded" /></TableCell>
                    <TableCell className="px-4 py-3 border-r border-gray-200"><div className="h-5 w-64 bg-gray-200 animate-pulse rounded" /></TableCell>
                    <TableCell className="px-4 py-3 border-r border-gray-200"><div className="h-10 w-10 bg-gray-200 animate-pulse rounded" /></TableCell>
                    <TableCell className="px-4 py-3"><div className="h-9 w-24 bg-gray-200 animate-pulse rounded" /></TableCell>
                  </TableRow>
                ))
              )}
              {!loading && !!errorMessage && (
                <TableRow>
                  <TableCell className="px-5 py-4 text-red-600 border-r border-gray-200" colSpan={7}>
                    <div className="flex items-center justify-between gap-4">
                      <span>{errorMessage}</span>
                      <button
                        type="button"
                        onClick={() => setCurrentPage(1)}
                        className="inline-flex items-center rounded-md bg-white border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >Retry</button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!loading && !errorMessage && paged.length === 0 && (
                <TableRow>
                  <TableCell className="px-5 py-6 text-gray-600 dark:text-gray-400 border-r border-gray-200" colSpan={7}>
                    {emptyMessage || "No stories found"}
                  </TableCell>
                </TableRow>
              )}
              {!loading && !errorMessage && paged.map((story, idx) => (
                <TableRow key={story.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.04]">
                  <TableCell className="px-4 py-3 border-r border-gray-200 text-start">
                    <span className="block text-gray-800 text-theme-sm dark:text-white/90">{startIdx + idx + 1}</span>
                  </TableCell>

                  <TableCell className="px-4 py-3 border-r border-gray-200 text-gray-600 text-start text-theme-sm dark:text-gray-300">
                    {formatDate(story.date)}
                  </TableCell>

                  <TableCell className="px-4 py-3 border-r border-gray-200 text-gray-800 text-start text-theme-sm dark:text-white/90">
                    {story.name || "-"}
                  </TableCell>

                  <TableCell className="px-4 py-3 border-r border-gray-200 text-gray-600 text-start text-theme-sm dark:text-gray-300">
                    {story.program || "-"}{story.session ? ` • ${story.session}` : ""}
                  </TableCell>

                  <TableCell className="px-4 py-3 border-r border-gray-200 text-gray-600 text-start text-theme-sm dark:text-gray-300 max-w-xs">
                    <span className="line-clamp-2 break-words">{story.shortDescription || "-"}</span>
                  </TableCell>

                  <TableCell className="px-4 py-3 border-r border-gray-200 text-start">
                    <img
                      src={safeImageSrc(story.imageUrl)}
                      alt={`${story.name}'s story image`}
                      className="w-10 h-10 rounded-lg object-cover"
                      loading="lazy"
                      onError={(e) => { e.currentTarget.src = "https://via.placeholder.com/64"; }}
                    />
                  </TableCell>
                  {/* Action buttons matching setup page style */}
                  <TableCell className="px-4 py-3 text-end">
                    <div className="flex items-center gap-2 justify-end">
                      {/* View icon button */}
                      <Link
                        href={`/alumni-stories/${story.id}`}
                        aria-label={`View story for ${story.name}`}
                        title="View story"
                        className="inline-flex items-center justify-center w-8 h-8 bg-white rounded-full shadow-sm border border-gray-200 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition-colors dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700"
                      >
                        <EyeIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                      </Link>

                      {/* Delete icon button */}
                      <button
                        type="button"
                        onClick={() => onDelete?.(story.id)}
                        disabled={Boolean(deletingIds?.has(story.id))}
                        aria-label={`Delete story for ${story.name}`}
                        title="Delete story"
                        className="inline-flex items-center justify-center w-8 h-8 bg-white rounded-full shadow-sm border border-gray-200 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700"
                        aria-disabled={Boolean(deletingIds?.has(story.id))}
                        aria-busy={Boolean(deletingIds?.has(story.id))}
                      >
                        {deletingIds?.has(story.id) ? (
                          <svg className="w-4 h-4 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        ) : (
                          <TrashBinIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                        )}
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
      </SyncedTableScroll>
      <div className="px-4" aria-live="polite" aria-atomic="true">
            {actionMessage && (
              <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {actionMessage}
              </div>
            )}
            {actionError && (
              <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {actionError}
              </div>
            )}
          </div>

      <div className="flex items-center justify-between p-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {(() => {
                const start = (currentPage - 1) * pageSize + 1;
                const end = start + paged.length - 1;
                const total = safeItems.length;
                return `Showing ${paged.length ? start : 0}-${paged.length ? end : 0} of ${total}`;
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
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={(p) => setCurrentPage(Math.max(1, Math.min(totalPages, p)))} />
            </div>
          </div>
    </div>
  );
};

// Default export function name preserved
export default function AlumniPage() {
  const [selected, setSelected] = useState<TabKey>("viewStories");
  const queryClient = useQueryClient();
  const { data: rawStories, isLoading, isFetching, isError, error, refetch } = useAlumniStories();
  const [stories, setStories] = useState<Story[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredStories = useMemo<Story[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return stories;
    try {
      return stories.filter((s) => {
        const fields = [s.name, s.program, s.session, s.shortDescription].map((v) => String(v || "").toLowerCase());
        return fields.some((f) => f.includes(q));
      });
    } catch {
      return stories;
    }
  }, [stories, searchQuery]);

  useEffect(() => {
    const mapped: Story[] = (rawStories ?? []).map((s: AlumniStoryItem) => ({
      id: s.id,
      date: s.date,
      name: s.name,
      program: s.program,
      session: s.session,
      shortDescription: s.shortDescription,
      imageUrl: s.imageUrl,
    }));
    setStories(mapped);
  }, [rawStories]);

  // Ensure data is fetched on mount
  useEffect(() => {
    if (!isLoading && !rawStories && !isError) {
      refetch();
    }
  }, [isLoading, rawStories, isError, refetch]);

  return (
    <ComponentCard title="Alumni Stories" className="">
      {/* Tabs navigation: identical styling and accessible keyboard interaction */}
      <div
        className="tab-list flex flex-wrap gap-4 lg:gap-6 justify-start"
        role="tablist"
        aria-label="Stories filters"
      >
        {TABS.map((tab, idx) => (
          <button
            key={tab.key}
            className={`rounded-xl border px-4 py-2 cursor-pointer transform scale-100 transform-gpu transition-transform duration-300 ease-in-out hover:scale-[1.02] hover:shadow-sm ${
              selected === tab.key
                ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/20"
                : "border-gray-200 bg-slate-100 text-gray-700 dark:border-gray-800 dark:bg-white/[0.03]"
            }`}
            onClick={() => setSelected(tab.key)}
            role="tab"
            aria-selected={selected === tab.key}
            tabIndex={selected === tab.key ? 0 : -1}
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
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {selected === "viewStories" && (
          <div className="flex flex-wrap gap-3 items-center mb-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-300" htmlFor="stories-search">
                Search:
              </label>
              <input
                id="stories-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Name, program, session, description"
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                aria-label="Search stories by name, program, session, or description"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: alumniStoriesKey });
                refetch();
              }}
              disabled={isFetching}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              aria-label="Refresh stories list"
            >
              {isFetching ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Refreshing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </>
              )}
            </button>
          </div>
        )}
        {selected === "viewStories" && (
          <StoryTable
            items={filteredStories}
            loading={isLoading}
            isFetching={isFetching}
            errorMessage={isError ? (error?.message ?? "Failed to load data.") : null}
            emptyMessage="No stories available"
            deletingIds={deletingIds}
            actionMessage={actionMessage}
            actionError={actionError}
            onDelete={async (id: string) => {
              try {
                setActionMessage(null);
                setActionError(null);
                setDeletingIds((prev) => new Set(prev).add(id));
                const res = await fetch(`/api/alumni-stories/${id}`, { method: "DELETE" });
                if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
                await queryClient.invalidateQueries({ queryKey: alumniStoriesKey, exact: false });
                await queryClient.refetchQueries({ queryKey: alumniStoriesKey, exact: false });
                setActionMessage("Story deleted successfully.");
              } catch (err) {
                const msg = err instanceof Error ? err.message : "Failed to delete. Please try again.";
                setActionError(msg);
              } finally {
                setDeletingIds((prev) => {
                  const next = new Set(prev);
                  next.delete(id);
                  return next;
                });
              }
            }}
          />
        )}

        {selected === "addStory" && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 dark:border-white/10 dark:bg-white/[0.02]">
            <AddStoryForm />
          </div>
        )}
      </div>
    </ComponentCard>
  );
}

// Faculty and departments options
const FACULTY_OPTIONS = [
  "Faculty of Information Technology",
  "Faculty of Medicine & Dentistry",
  "Faculty of Law",
  "Faculty of Engineering & Technology",
  "Faculty of Management Sciences",
  "Faculty of Sciences",
  "Faculty of Languages & Literature",
  "Faculty of Arts & Architecture",
  "Faculty of Social Sciences",
  "Faculty of Pharmacy",
  "Faculty of Allied Health Sciences",
];

const DEPARTMENTS_BY_FACULTY: Record<string, string[]> = {
  "Faculty of Arts & Architecture": [
    "School of Architecture",
    "School of Creative Arts",
    "School of Fashion & Textiles",
  ],
  "Faculty of Engineering & Technology": [
    "Department of Electrical Engineering",
    "Department of Mechanical Engineering",
    "Department of Civil Engineering",
    "Department of Computer Engineering",
    "Department of Technology",
  ],
  "Faculty of Allied Health Sciences": [
    "University Institute of Radiological Sciences & Medical Imaging Technology",
    "University Institute of Physical Therapy",
    "Department of Sports Sciences and Physical Education",
    "University Institute of Diet & Nutritional Sciences",
    "University Institute of Food Science & Technology",
    "University Institute of Medical Lab Technology",
    "University Institute of Public Health",
    "Department of Health Professional Technologies",
    "Department of Optometry & Vision Sciences",
    "Department of Emerging Allied Health Technologies",
    "Department of Rehabilitation Sciences",
    "Lahore School of Nursing",
    "Department of Audiology",
  ],
  "Faculty of Information Technology": [
    "Department of Computer Science & Information Technology",
    "Department of Software Engineering",
    "Department of Intelligent Systems",
  ],
  "Faculty of Management Sciences": [
    "Lahore Business School",
    "Department of Economics",
    "Lahore School of Aviation",
    "Department of Information Management",
  ],
  "Faculty of Social Sciences": [
    "Department of Islamic Studies",
    "Lahore School of Behavioural Sciences",
    "School of Integrated Social Sciences",
    "Department of Education",
    "Department of Sociology",
    "Department of Criminology",
  ],
  "Faculty of Medicine & Dentistry": [
    "University College of Medicine and Dentistry",
    "Institute of Postgraduate Medical Sciences",
    "University Institute of Health Professions Education and Research",
    "Centre for Health Professionals Development & Lifelong Learning",
    "Dental Paramedical School",
  ],
  "Faculty of Sciences": [
    "Department of Physics",
    "Department of Chemistry",
    "Department of Environmental Sciences",
    "Department of Mathematics and Statistics",
    "Institute of Molecular Biology & Biotechnology",
    "School of Pain and Regenerative Medicine",
  ],
  "Faculty of Pharmacy": [
    "Department of Pharmacy",
  ],
  "Faculty of Law": [
    "M.A. Raoof College of Law",
  ],
  "Faculty of Languages & Literature": [
    "Department of English Language & Literature",
    "Department of Urdu",
  ],
  "International Qualifications": [
    "Department of International Qualifications",
  ],
  "Centre for Microcredential-Based Skill Development": [
    "Microcredential-Based Skill Development Centre",
  ],
};

function sanitizeHtml(input: string): string {
  // Very basic sanitation: allow b, i, u, br, a tags; strip others
  // Note: For production, use a robust sanitizer like DOMPurify.
  const allowed = /<(\/?)(b|i|u|br|a)([^>]*)>/gi;
  return input
    .replace(/<script[^>]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, (tag) => (allowed.test(tag) ? tag : ""));
}

const inputBaseClass =
  "rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300";
const buttonPrimaryClass =
  "inline-flex items-center rounded-xl border border-blue-500 bg-blue-50 px-4 py-2 text-blue-700 hover:bg-blue-100 transition-colors dark:border-blue-500 dark:bg-blue-900/20 dark:text-blue-200";
const buttonSecondaryClass =
  "inline-flex items-center rounded-xl border border-gray-300 bg-slate-100 px-4 py-2 text-gray-700 hover:bg-gray-200 transition-colors dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300";

const AddStoryForm: React.FC = () => {
  const queryClient = useQueryClient();
  const [serverMsg, setServerMsg] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<NewStoryPayload>({
    resolver: zodResolver(storyFormSchema),
    defaultValues: {
      sapId: "",
      name: "",
      email: "",
      faculty: "",
      department: "",
      storyHtml: "",
    },
    mode: "onChange",
  });
  const selectedFaculty = watch("faculty") || "";
  const deptOptions = useMemo(() => DEPARTMENTS_BY_FACULTY[selectedFaculty] || [], [selectedFaculty]);

  const onSubmit = async (data: NewStoryPayload) => {
    setServerMsg(null);
    setServerError(null);
    try {
      const payload = {
        sapId: data.sapId,
        name: data.name,
        email: data.email,
        faculty: data.faculty,
        department: data.department,
        storyHtml: sanitizeHtml(data.storyHtml || ""),
      };
      const res = await fetch("/api/alumni-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `Failed (${res.status})`);
      }
      setServerMsg("Story saved successfully.");
      await queryClient.invalidateQueries({ queryKey: alumniStoriesKey, exact: false });
      await queryClient.refetchQueries({ queryKey: alumniStoriesKey, exact: false });
      reset();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unexpected error while saving.";
      setServerError(msg);
    }
  };

  

  return (
    <form className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-label="Add story form" onSubmit={handleSubmit(onSubmit)}>
      <div className="flex flex-col gap-2">
        <label htmlFor="sapId" className="text-sm text-gray-600 dark:text-gray-300">SAP ID</label>
        <input id="sapId" className={inputBaseClass} aria-label="SAP ID" {...register("sapId")} />
        {errors.sapId && <span className="text-xs text-red-600">{errors.sapId.message as string}</span>}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="name" className="text-sm text-gray-600 dark:text-gray-300">Name</label>
        <input id="name" className={inputBaseClass} aria-label="Name" {...register("name")} />
        {errors.name && <span className="text-xs text-red-600">{errors.name.message}</span>}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm text-gray-600 dark:text-gray-300">Email</label>
        <input id="email" className={inputBaseClass} aria-label="Email" type="email" {...register("email")} />
        {errors.email && <span className="text-xs text-red-600">{errors.email.message as string}</span>}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="faculty" className="text-sm text-gray-600 dark:text-gray-300">Faculty</label>
        <select id="faculty" className={inputBaseClass} aria-label="Faculty" {...register("faculty")}>
          <option value="">Select</option>
          {FACULTY_OPTIONS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        {errors.faculty && <span className="text-xs text-red-600">{errors.faculty.message as string}</span>}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="department" className="text-sm text-gray-600 dark:text-gray-300">Department</label>
        <select id="department" className={inputBaseClass} aria-label="Department" {...register("department")}>
          <option value="">Select</option>
          {deptOptions.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        {errors.department && <span className="text-xs text-red-600">{errors.department.message as string}</span>}
      </div>

      <div className="md:col-span-2 flex flex-col gap-2">
        <label className="text-sm text-gray-600 dark:text-gray-300">Story</label>
        <Controller
          name="storyHtml"
          control={control}
          render={({ field }) => (
            <div>
              <div
                role="textbox"
                aria-label="Story rich text"
                className={`${inputBaseClass} min-h-24`}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => {
                  const html = (e.target as HTMLElement).innerHTML;
                  field.onChange(html);
                }}
                dangerouslySetInnerHTML={{ __html: field.value || "" }}
              />
              <p className="text-xs text-gray-500 mt-1">Supports basic formatting (bold/italic/underline/links). Unsafe HTML is stripped on submit.</p>
            </div>
          )}
        />
        {errors.storyHtml && <span className="text-xs text-red-600">{errors.storyHtml.message as string}</span>}
      </div>

      <div className="md:col-span-2 mt-2">
        {serverMsg && <div className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-green-700">{serverMsg}</div>}
        {serverError && <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-700">{serverError}</div>}
      </div>

      <div className="md:col-span-2 flex items-center justify-end gap-3 mt-2">
        <button type="reset" className={buttonSecondaryClass} onClick={() => { reset(); }}>
          Reset
        </button>
        <button type="submit" className={buttonPrimaryClass} disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Story"}
        </button>
      </div>
    </form>
  );
};
function safeImageSrc(input?: string): string {
  const u = String(input || "").trim();
  if (!u || u === "null") return "https://via.placeholder.com/64";
  try {
    // If it's an absolute URL (http/https), use it as is
    if (/^https?:\/\//i.test(u)) {
      const parsed = new URL(u);
      if (parsed.protocol === "http:") parsed.protocol = "https:";
      return parsed.toString();
    }
    // If it starts with /, use it as is
    if (u.startsWith('/')) {
      return u;
    }
    // Otherwise, assume it's a filename and prepend /images/
    return `/images/${u}`;
  } catch {
    return "https://via.placeholder.com/64";
  }
}
