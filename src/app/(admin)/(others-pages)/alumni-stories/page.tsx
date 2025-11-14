"use client";
/* eslint-disable @next/next/no-img-element */


import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ComponentCard from "@/components/common/ComponentCard";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import Pagination from "@/components/tables/Pagination";
import { useForm, Controller } from "react-hook-form";
// zod imported via resolvers and schema; remove unused 'z'
import { storyFormSchema, type NewStoryPayload } from "@/lib/alumniStories";
import { zodResolver } from "@hookform/resolvers/zod";
import { EyeIcon, TrashBinIcon } from "@/icons";
import { useQueryClient } from "@tanstack/react-query";
import { useAlumniStories, alumniStoriesKey, type AlumniStoryItem } from "@/app/queries/fetch-alumni-stories";
import { useAlumniMe } from "@/app/queries/fetch-me-alumni";

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
      <div className="max-w-full overflow-x-auto custom-scrollbar max-h-[700px] overflow-y-auto">
        <div className="min-w-[950px] xl:min-w-full">
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

                  <TableCell className="px-4 py-3 border-r border-gray-200 text-gray-600 text-start text-theme-sm dark:text-gray-300">
                    <span className="line-clamp-2">{story.shortDescription || "-"}</span>
                  </TableCell>

                  <TableCell className="px-4 py-3 border-r border-gray-200 text-start">
                    <img
                      src={story.imageUrl || "https://via.placeholder.com/64"}
                      alt={`${story.name}'s story image`}
                      className="w-10 h-10 rounded-lg object-cover"
                      loading="lazy"
                    />
                  </TableCell>
                  {/* add action button to view full story(create new component having full information of the student) and delete story */}
                  <TableCell className="px-4 py-3 text-start">
                    <div className="flex items-center gap-4 justify-start">
                      {/* View icon button */}
                      <Link
                        href={`/alumni-stories/${story.id}`}
                        aria-label={`View story for ${story.name}`}
                        title="View story"
                        className="inline-flex items-center justify-center rounded-xl transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2980b9] dark:focus:ring-offset-gray-900"
                      >
                        <span
                          className="min-w-[48px] min-h-[48px] p-2 text-[#3498db] hover:text-[#2980b9]"
                        >
                          <EyeIcon className="w-6 h-6" />
                          <span className="sr-only">View story</span>
                        </span>
                      </Link>

                      {/* Delete icon button */}
                      <button
                        type="button"
                        onClick={() => onDelete?.(story.id)}
                        disabled={Boolean(deletingIds?.has(story.id))}
                        aria-label={`Delete story for ${story.name}`}
                        title="Delete story"
                        className="inline-flex items-center justify-center rounded-xl transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#c0392b] disabled:opacity-60 disabled:cursor-not-allowed dark:focus:ring-offset-gray-900"
                        aria-disabled={Boolean(deletingIds?.has(story.id))}
                        aria-busy={Boolean(deletingIds?.has(story.id))}
                      >
                        {deletingIds?.has(story.id) ? (
                          <span className="min-w-[48px] min-h-[48px] p-2 text-[#e74c3c]">
                            {/* Spinner */}
                            <svg
                              className="w-6 h-6 animate-spin"
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
                              <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="4" opacity="0.75" />
                            </svg>
                            <span className="sr-only">Deleting…</span>
                          </span>
                        ) : (
                          <span className="min-w-[48px] min-h-[48px] p-2 text-[#e74c3c] hover:text-[#c0392b]">
                            <TrashBinIcon className="w-6 h-6" />
                            <span className="sr-only">Delete story</span>
                          </span>
                        )}
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
      </div>
    </div>
  );
};

// Default export function name preserved
export default function AlumniPage() {
  const [selected, setSelected] = useState<TabKey>("viewStories");
  const queryClient = useQueryClient();
  const { data: rawStories, isLoading, isFetching, isError, error } = useAlumniStories();
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
                await queryClient.invalidateQueries({ queryKey: alumniStoriesKey });
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

// Sessions options
const SESSION_OPTIONS = [
  "2018",
  "2019",
  "2020",
  "2021",
  "2022",
  "2023",
  "2024",
];

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
  const { data: me, isLoading: isLoadingMe, isError: isMeError } = useAlumniMe();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [serverMsg, setServerMsg] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<NewStoryPayload>({
    resolver: zodResolver(storyFormSchema),
    defaultValues: {
      name: "",
      degreeSession: "",
      faculty: "",
      company: "",
      designation: "",
      cityCountry: "",
      shortStoriesHtml: "",
      description: "",
      showHome: false,
      date: "",
      imageFile: undefined,
    },
    mode: "onChange",
  });

  const onSubmit = async (data: NewStoryPayload) => {
    setServerMsg(null);
    setServerError(null);
    try {
      const cleanHtml = sanitizeHtml(data.shortStoriesHtml || "");
      const createdAt = data.date ? new Date(data.date).toISOString() : new Date().toISOString();
      const status = data.showHome ? "active" : "pending";
      const res = await fetch("/api/alumni-stories/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanHtml || data.description || "", imageUrl: null, status, createdAt }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Failed (${res.status})`);
      }
      setServerMsg("Story saved successfully.");
      await queryClient.invalidateQueries({ queryKey: alumniStoriesKey });
      reset();
      setPreviewUrl(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unexpected error while saving.";
      setServerError(msg);
    }
  };

  const imageFile = watch("imageFile");
  useEffect(() => {
    if (imageFile && imageFile instanceof File) {
      const url = URL.createObjectURL(imageFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [imageFile]);

  return (
    <form className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-label="Add story form" onSubmit={handleSubmit(onSubmit)}>
      {/* Image upload */}
      <div className="flex flex-col gap-2">
        <label htmlFor="image" className="text-sm text-gray-600 dark:text-gray-300">Image (JPG/PNG, max 2MB)</label>
        <Controller
          name="imageFile"
          control={control}
          render={({ field }) => (
            <input
              id="image"
              type="file"
              accept="image/png, image/jpeg"
              className={inputBaseClass}
              aria-label="Upload image"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) {
                  field.onChange(undefined);
                  return;
                }
                const isValidType = ["image/png", "image/jpeg"].includes(file.type);
                const isValidSize = file.size <= 2 * 1024 * 1024;
                if (!isValidType || !isValidSize) {
                  setServerError(!isValidType ? "Invalid image type. Use JPG/PNG." : "Image exceeds 2MB size limit.");
                  e.target.value = "";
                  setValue("imageFile", undefined);
                  setPreviewUrl(null);
                  return;
                }
                setServerError(null);
                field.onChange(file);
              }}
            />
          )}
        />
        {previewUrl && (
          <img src={previewUrl} alt="Selected image preview" className="mt-2 h-16 w-16 rounded-md object-cover border border-gray-200 dark:border-gray-700" />
        )}
        {errors.imageFile && <span className="text-xs text-red-600">{errors.imageFile.message as string}</span>}
      </div>

      {/* Name */}
      <div className="flex flex-col gap-2">
        <label htmlFor="name" className="text-sm text-gray-600 dark:text-gray-300">Name</label>
        <input id="name" className={inputBaseClass} aria-label="Name" {...register("name")} />
        {errors.name && <span className="text-xs text-red-600">{errors.name.message}</span>}
      </div>

      {/* Degree (auto-populated, read-only) */}
      <div className="flex flex-col gap-2">
        <label htmlFor="degree" className="text-sm text-gray-600 dark:text-gray-300">Degree</label>
        <input id="degree" className={inputBaseClass} aria-label="Degree" value={isLoadingMe ? "Loading…" : (me?.degree ?? "")} readOnly />
      </div>
      {/* Session (used to compose degreeSession on submit) */}
      <div className="flex flex-col gap-2">
        <label htmlFor="degreeSession" className="text-sm text-gray-600 dark:text-gray-300">Session</label>
        <select
          id="degreeSession"
          className={inputBaseClass}
          aria-label="Session"
          {...register("degreeSession")}
          disabled={isLoadingMe || isMeError}
          onChange={(e) => {
            const ses = e.target.value;
            const deg = me?.degree ?? "";
            setValue("degreeSession", deg && ses ? `${deg} (${ses})` : deg || ses);
          }}
        >
          <option value="">Select session</option>
          {SESSION_OPTIONS.map((ses) => (
            <option key={ses} value={ses}>{ses}</option>
          ))}
        </select>
        {errors.degreeSession && <span className="text-xs text-red-600">{errors.degreeSession.message}</span>}
      </div>

      {/* Faculty (auto-populated, read-only) */}
      <div className="flex flex-col gap-2">
        <label htmlFor="faculty" className="text-sm text-gray-600 dark:text-gray-300">Faculty</label>
        <input id="faculty" className={inputBaseClass} aria-label="Faculty" value={isLoadingMe ? "Loading…" : (me?.faculty ?? "")} readOnly />
      </div>

      {/* Company */}
      <div className="flex flex-col gap-2">
        <label htmlFor="company" className="text-sm text-gray-600 dark:text-gray-300">Company</label>
        <input id="company" className={inputBaseClass} aria-label="Company" {...register("company")} />
        {errors.company && <span className="text-xs text-red-600">{errors.company.message}</span>}
      </div>

      {/* Designation */}
      <div className="flex flex-col gap-2">
        <label htmlFor="designation" className="text-sm text-gray-600 dark:text-gray-300">Designation</label>
        <input id="designation" className={inputBaseClass} aria-label="Designation" {...register("designation")} />
        {errors.designation && <span className="text-xs text-red-600">{errors.designation.message}</span>}
      </div>

      {/* City, Country */}
      <div className="flex flex-col gap-2">
        <label htmlFor="cityCountry" className="text-sm text-gray-600 dark:text-gray-300">City, Country</label>
        <input id="cityCountry" className={inputBaseClass} aria-label="City, Country" placeholder="e.g., Lahore, Pakistan" {...register("cityCountry")} />
        {errors.cityCountry && <span className="text-xs text-red-600">{errors.cityCountry.message}</span>}
      </div>

      {/* Short Stories (rich text) */}
      <div className="md:col-span-2 flex flex-col gap-2">
        <label className="text-sm text-gray-600 dark:text-gray-300">Short Stories</label>
        <Controller
          name="shortStoriesHtml"
          control={control}
          render={({ field }) => (
            <div>
              <div
                role="textbox"
                aria-label="Short stories rich text"
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
        {errors.shortStoriesHtml && <span className="text-xs text-red-600">{errors.shortStoriesHtml.message}</span>}
      </div>

      {/* Description */}
      <div className="md:col-span-2 flex flex-col gap-2">
        <label htmlFor="description" className="text-sm text-gray-600 dark:text-gray-300">Description (min 100 characters)</label>
        <textarea id="description" rows={4} className={inputBaseClass} aria-label="Description" {...register("description")} />
        {errors.description && <span className="text-xs text-red-600">{errors.description.message}</span>}
      </div>

      {/* Show Home toggle */}
      <div className="flex items-center gap-3">
        <label htmlFor="showHome" className="text-sm text-gray-600 dark:text-gray-300">Show Home</label>
        <input id="showHome" type="checkbox" aria-label="Show on homepage" {...register("showHome")} />
        {errors.showHome && <span className="text-xs text-red-600">{errors.showHome.message as string}</span>}
      </div>

      {/* Date */}
      <div className="flex flex-col gap-2">
        <label htmlFor="date" className="text-sm text-gray-600 dark:text-gray-300">Date</label>
        <input id="date" type="date" className={inputBaseClass} aria-label="Date" {...register("date")} />
        {errors.date && <span className="text-xs text-red-600">{errors.date.message}</span>}
      </div>

      {/* Feedback */}
      <div className="md:col-span-2 mt-2">
        {serverMsg && <div className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-green-700">{serverMsg}</div>}
        {serverError && <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-700">{serverError}</div>}
      </div>

      {/* Actions */}
      <div className="md:col-span-2 flex items-center justify-end gap-3 mt-2">
        <button type="reset" className={buttonSecondaryClass} onClick={() => { reset(); setPreviewUrl(null); }}>
          Reset
        </button>
        <button type="submit" className={buttonPrimaryClass} disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Story"}
        </button>
      </div>
    </form>
  );
};
