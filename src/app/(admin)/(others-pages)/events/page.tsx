"use client";

/**
 * Events
 * Displays events with tabbed navigation, search, pagination, and actions.
 * View: Shows a responsive table; Add: Provides an event creation form.
 * Integrates with `/api/events` and `/api/events/[id]` for data and deletion.
 */


/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ComponentCard from "@/components/common/ComponentCard";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import Pagination from "@/components/tables/Pagination";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
// Note: events page defines its own schema locally to mirror alumni stories patterns

// TypeScript typings for Events
type EventItem = {
  id: string;
  date: string | Date; // formatted to YYYY-MM-DD
  title: string; // event title
  venue: string; // event venue/location
  shortDescription: string; // brief summary
  imageUrl: string; // cover image
  startTimeUTC?: string; // ISO UTC with seconds
  endTimeUTC?: string; // ISO UTC with seconds
};

// Tabs typing: maintain same tab styling and interaction model
type TabKey = "viewEvents" | "addEvent";

const TABS: { key: TabKey; label: string }[] = [
  { key: "viewEvents", label: "View Events" },
  { key: "addEvent", label: "Add Event" },
];

// Dummy events (replace with API integration when available)
const DUMMY_EVENTS: EventItem[] = [
  {
    id: "E-2001",
    date: "2024-01-15",
    title: "AI Seminar",
    venue: "Main Auditorium",
    shortDescription: "Explore the latest in AI research and applications.",
    imageUrl: "https://i.pravatar.cc/64?u=E-2001",
    startTimeUTC: "2024-01-15T09:00:00Z",
    endTimeUTC: "2024-01-15T11:00:00Z",
  },
  {
    id: "E-2002",
    date: "2024-03-05",
    title: "Startup Workshop",
    venue: "Innovation Lab",
    shortDescription: "Hands-on session on building MVPs and pitching.",
    imageUrl: "https://i.pravatar.cc/64?u=E-2002",
    startTimeUTC: "2024-03-05T13:30:00Z",
    endTimeUTC: "2024-03-05T15:00:00Z",
  },
  {
    id: "E-2003",
    date: "2024-06-10",
    title: "Career Fair",
    venue: "Hall B",
    shortDescription: "Meet top employers and explore internships.",
    imageUrl: "https://i.pravatar.cc/64?u=E-2003",
    startTimeUTC: "2024-06-10T08:00:00Z",
    endTimeUTC: "2024-06-10T17:00:00Z",
  },
  {
    id: "E-2004",
    date: "2024-09-22",
    title: "Research Symposium",
    venue: "Conference Center",
    shortDescription: "Showcase of faculty and student research projects.",
    imageUrl: "https://i.pravatar.cc/64?u=E-2004",
    startTimeUTC: "2024-09-22T10:00:00Z",
    endTimeUTC: "2024-09-22T14:00:00Z",
  },
];

// Helper to format date safely to YYYY-MM-DD
export function formatDate(input: string | Date): string {
  try {
    const d = typeof input === "string" ? new Date(input) : input;
    if (Number.isNaN(d.getTime())) return "-";
    return d.toISOString().slice(0, 10);
  } catch {
    return "-";
  }
}

function formatLocalDateTime(utcIso?: string): string {
  if (!utcIso) return "-";
  try {
    const d = new Date(utcIso);
    return d.toLocaleString([], { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return "-";
  }
}

// Convert local datetime without seconds (YYYY-MM-DDTHH:MM) to ISO UTC with seconds
function localToUtcIsoWithSeconds(localNoSeconds: string): string | null {
  try {
    const s = localNoSeconds.length === 16 ? `${localNoSeconds}:00` : localNoSeconds;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().replace(/\.\d{3}Z$/, "Z");
  } catch {
    return null;
  }
}

// Stories table component with identical styling conventions, responsive design,
// pagination, and accessibility
type EventListProps = {
  items: EventItem[];
  loading?: boolean;
  emptyMessage?: string;
  onDelete?: (id: string) => Promise<void> | void;
  deletingIds?: Set<string>;
};

export const EventTable: React.FC<EventListProps> = ({ items, loading, emptyMessage, onDelete, deletingIds }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(8);

  useEffect(() => {
    setCurrentPage(1);
  }, [items]);

  const safeItems = useMemo<EventItem[]>(() => {
    try {
      return Array.isArray(items) ? items : [];
    } catch {
      return [];
    }
  }, [items]);

  const totalPages = Math.max(1, Math.ceil(safeItems.length / pageSize));
  const startIdx = (currentPage - 1) * pageSize;
  const paged = safeItems.slice(startIdx, startIdx + pageSize);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-gray-200 animate-pulse dark:bg-white/10" />
        ))}
      </div>
    );
  }

  if (!safeItems.length) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-300">{emptyMessage || "No events found"}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <div className="min-w-[950px] xl:min-w-full">
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
              <TableRow>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">SrNo.</TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Start Time</TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">End Time</TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Title</TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Venue</TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Short Description</TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Image</TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Actions</TableCell>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {paged.map((evt, idx) => (
                <TableRow key={evt.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.04]">
                  <TableCell className="px-5 py-4 sm:px-6 text-start">
                    <span className="block text-gray-800 text-theme-sm dark:text-white/90">
                      {startIdx + idx + 1}
                    </span>
                  </TableCell>

                  <TableCell className="px-4 py-3 text-gray-600 text-start text-theme-sm dark:text-gray-300">
                    {formatLocalDateTime(evt.startTimeUTC)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-600 text-start text-theme-sm dark:text-gray-300">
                    {formatLocalDateTime(evt.endTimeUTC)}
                  </TableCell>

                  <TableCell className="px-4 py-3 text-gray-800 text-start text-theme-sm dark:text-white/90">
                    {evt.title || "-"}
                  </TableCell>

                  <TableCell className="px-4 py-3 text-gray-600 text-start text-theme-sm dark:text-gray-300">
                    {evt.venue || "-"}
                  </TableCell>

                  <TableCell className="px-4 py-3 text-gray-600 text-start text-theme-sm dark:text-gray-300">
                    <span className="line-clamp-2">{evt.shortDescription || "-"}</span>
                  </TableCell>

                  <TableCell className="px-4 py-3 text-start">
                    <img
                      src={evt.imageUrl || "https://via.placeholder.com/64"}
                      alt={`${evt.title} image`}
                      className="w-10 h-10 rounded-lg object-cover"
                      loading="lazy"
                    />
                  </TableCell>
                  {/* add action button to view full story(create new component having full information of the student) and delete story */}
                  <TableCell className="px-4 py-3 text-start">
                    <div className="flex items-center gap-2 justify-start">
                      <Link
                        href={`/events/${evt.id}`}
                        className="inline-flex items-center rounded-xl border border-blue-500 bg-blue-50 px-3 py-1.5 text-blue-700 text-sm hover:bg-blue-100 transition-colors dark:border-blue-500 dark:bg-blue-900/20 dark:text-blue-200"
                        aria-label={`View full event ${evt.title}`}
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        onClick={() => onDelete?.(evt.id)}
                        disabled={Boolean(deletingIds?.has(evt.id))}
                        className="inline-flex items-center rounded-xl border border-red-500 bg-red-50 px-3 py-1.5 text-red-700 text-sm hover:bg-red-100 transition-colors disabled:opacity-60 dark:border-red-500 dark:bg-red-900/20 dark:text-red-200"
                        aria-label={`Delete event ${evt.title}`}
                      >
                        {deletingIds?.has(evt.id) ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination footer */}
          <div className="flex items-center justify-between p-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Showing {paged.length} of {safeItems.length}
            </span>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(p) => setCurrentPage(Math.max(1, Math.min(totalPages, p)))}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Default export function name preserved
export default function EventsPage() {
  const [selected, setSelected] = useState<TabKey>("viewEvents");
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [upcomingOnly, setUpcomingOnly] = useState<boolean>(false);

  const filteredEvents = useMemo<EventItem[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = events;
    try {
      if (q) {
        list = list.filter((e) => {
          const fields = [e.title, e.venue, e.shortDescription].map((v) => String(v || "").toLowerCase());
          return fields.some((f) => f.includes(q));
        });
      }

      if (upcomingOnly) {
        const now = Date.now();
        list = list.filter((e) => {
          const end = e.endTimeUTC ? new Date(e.endTimeUTC).getTime() : (e.date ? new Date(e.date as string).getTime() : 0);
          return end >= now;
        });
      }

      list = [...list].sort((a, b) => {
        const sa = a.startTimeUTC ? new Date(a.startTimeUTC).getTime() : 0;
        const sb = b.startTimeUTC ? new Date(b.startTimeUTC).getTime() : 0;
        return sortOrder === "asc" ? sa - sb : sb - sa;
      });

      return list;
    } catch {
      return events;
    }
  }, [events, searchQuery, upcomingOnly, sortOrder]);

  // Simulate async data load with error handling and cleanup
  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        // Replace with real fetch when API is ready
        // const res = await fetch("/api/events", { cache: "no-store" });
        // if (!res.ok) throw new Error(`Failed: ${res.status}`);
        // const data: EventItem[] = await res.json();
        const data = DUMMY_EVENTS;
        if (active) setEvents(data);
      } catch (err) {
        console.error("Failed to load events:", err);
        if (active) setEvents([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selected]);

  return (
    <ComponentCard title="Events" className="">
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
        {selected === "viewEvents" && (
          <div className="flex flex-wrap gap-3 items-center mb-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-300" htmlFor="events-search">
                Search:
              </label>
              <input
                id="events-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Title, venue, description"
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                aria-label="Search events by title, venue, or description"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-300" htmlFor="sort-time">Sort:</label>
              <select
                id="sort-time"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value === "asc" ? "asc" : "desc")}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                aria-label="Sort events by start time"
              >
                <option value="asc">Start Time (oldest)</option>
                <option value="desc">Start Time (newest)</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-300" htmlFor="upcoming-only">Upcoming only</label>
              <input
                id="upcoming-only"
                type="checkbox"
                checked={upcomingOnly}
                onChange={(e) => setUpcomingOnly(e.target.checked)}
                aria-label="Filter upcoming events"
              />
            </div>
          </div>
        )}
        {selected === "viewEvents" && (
          <EventTable
            items={filteredEvents}
            loading={loading}
            emptyMessage="No events available"
            deletingIds={deletingIds}
            onDelete={async (id: string) => {
              try {
                setDeletingIds((prev) => new Set(prev).add(id));
                const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
                if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
                setEvents((prev) => prev.filter((e) => e.id !== id));
              } catch (err) {
                console.error("Failed to delete event:", err);
                alert("Failed to delete. Please try again.");
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

        {selected === "addEvent" && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 dark:border-white/10 dark:bg-white/[0.02]">
            <AddEventForm />
          </div>
        )}
      </div>
    </ComponentCard>
  );
}

// Event options
const EVENT_CATEGORY_OPTIONS = [
  "Seminar",
  "Workshop",
  "Webinar",
  "Meetup",
  "Conference",
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

type NewEventPayload = {
  title: string;
  venue: string;
  organizer: string;
  cityCountry: string;
  category: string;
  shortHtml: string;
  description: string;
  isFeatured: boolean;
  date: string; // YYYY-MM-DD
  startTime: string; // local datetime without seconds; YYYY-MM-DDTHH:MM
  endTime: string; // local datetime without seconds; YYYY-MM-DDTHH:MM
  imageFile?: File | undefined;
};

export const eventFormSchema = z
  .object({
    title: z.string().min(2, "Title is required").max(80, "Title must be under 80 characters"),
    venue: z.string().min(2, "Venue is required").max(80, "Venue must be under 80 characters"),
    organizer: z.string().min(2, "Organizer is required").max(80, "Organizer must be under 80 characters"),
    cityCountry: z.string().min(2, "City/Country is required").max(80, "City/Country must be under 80 characters"),
    category: z.string().min(2, "Category is required"),
    shortHtml: z.string().min(10, "Short info must be at least 10 characters").max(2000, "Too long"),
    description: z.string().min(100, "Description must be at least 100 characters").max(5000, "Too long"),
    // Keep isFeatured required in schema to align input/output types
    isFeatured: z.boolean(),
    
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "Date must be YYYY-MM-DD"),
    startTime: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u, "Use YYYY-MM-DDTHH:MM"),
    endTime: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u, "Use YYYY-MM-DDTHH:MM"),
    imageFile: z
      .any()
      .refine((f) => f === undefined || f instanceof File, { message: "Invalid file" })
      .refine((f) => !f || ["image/png", "image/jpeg"].includes((f as File).type), { message: "Only PNG or JPG allowed" })
      .refine((f) => !f || (f as File).size <= 2 * 1024 * 1024, { message: "Max size 2MB" })
      .optional(),

  })
  .refine((vals) => {
    try {
      const s = new Date(vals.startTime.length === 16 ? `${vals.startTime}:00` : vals.startTime);
      const e = new Date(vals.endTime.length === 16 ? `${vals.endTime}:00` : vals.endTime);
      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return false;
      return e.getTime() > s.getTime();
    } catch {
      return false;
    }
  }, { message: "End time must be after start time", path: ["endTime"] });

export const AddEventForm: React.FC = () => {
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
  } = useForm<NewEventPayload>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: "",
      venue: "",
      organizer: "",
      cityCountry: "",
      category: "",
      shortHtml: "",
      description: "",
      isFeatured: false,
      date: "",
      startTime: "",
      endTime: "",
      imageFile: undefined,
    },
    mode: "onChange",
  });

  useEffect(() => {
    const f = watch("imageFile");
    if (f && f instanceof File) {
      const url = URL.createObjectURL(f);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
    return () => {};
  }, [watch]);

  const onSubmit = async (data: NewEventPayload) => {
    setServerMsg(null);
    setServerError(null);
    try {
      const startIso = localToUtcIsoWithSeconds(data.startTime);
      const endIso = localToUtcIsoWithSeconds(data.endTime);
      if (!startIso || !endIso) {
        throw new Error("Invalid start/end time");
      }
      const payload = {
        ...data,
        shortHtml: sanitizeHtml(data.shortHtml || ""),
        shortDescription: (data.shortHtml || "").replace(/<[^>]+>/g, "").slice(0, 160).trim(),
        startTimeUTC: startIso,
        endTimeUTC: endIso,
        // Do not send local fields to server in final payload
        startTime: undefined,
        endTime: undefined,
        imageFile: undefined, // send image separately or URL in real implementation
      };
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `Failed (${res.status})`);
      }
      setServerMsg("Event saved successfully.");
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
    <form className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-label="Add event form" onSubmit={handleSubmit(onSubmit)}>
      {/* Image upload */}
      <div className="flex flex-col gap-2">
        <label htmlFor="event-image" className="text-sm text-gray-600 dark:text-gray-300">Image (JPG/PNG, max 2MB)</label>
        <Controller
          name="imageFile"
          control={control}
          render={({ field }) => (
            <input
              id="event-image"
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

      {/* Title */}
      <div className="flex flex-col gap-2">
        <label htmlFor="title" className="text-sm text-gray-600 dark:text-gray-300">Title</label>
        <input id="title" className={inputBaseClass} aria-label="Title" {...register("title")} />
        {errors.title && <span className="text-xs text-red-600">{errors.title.message}</span>}
      </div>

      {/* Venue */}
      <div className="flex flex-col gap-2">
        <label htmlFor="venue" className="text-sm text-gray-600 dark:text-gray-300">Venue</label>
        <input id="venue" className={inputBaseClass} aria-label="Venue" {...register("venue")} />
        {errors.venue && <span className="text-xs text-red-600">{errors.venue.message}</span>}
      </div>

      {/* Organizer */}
      <div className="flex flex-col gap-2">
        <label htmlFor="organizer" className="text-sm text-gray-600 dark:text-gray-300">Organizer</label>
        <input id="organizer" className={inputBaseClass} aria-label="Organizer" {...register("organizer")} />
        {errors.organizer && <span className="text-xs text-red-600">{errors.organizer.message}</span>}
      </div>

      {/* Category */}
      <div className="flex flex-col gap-2">
        <label htmlFor="category" className="text-sm text-gray-600 dark:text-gray-300">Category</label>
        <select id="category" className={inputBaseClass} aria-label="Category" {...register("category")}>
          <option value="">Select category</option>
          {EVENT_CATEGORY_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        {errors.category && <span className="text-xs text-red-600">{errors.category.message as string}</span>}
      </div>

      {/* City, Country */}
      <div className="flex flex-col gap-2">
        <label htmlFor="cityCountry" className="text-sm text-gray-600 dark:text-gray-300">City, Country</label>
        <input id="cityCountry" className={inputBaseClass} aria-label="City, Country" placeholder="e.g., Lahore, Pakistan" {...register("cityCountry")} />
        {errors.cityCountry && <span className="text-xs text-red-600">{errors.cityCountry.message}</span>}
      </div>

      {/* Short Info (rich text) */}
      <div className="flex flex-col gap-2">
        <label htmlFor="shortHtml" className="text-sm text-gray-600 dark:text-gray-300">Short Info (supports basic HTML)</label>
        <textarea id="shortHtml" className={`${inputBaseClass} min-h-[90px]`} aria-label="Short info" {...register("shortHtml")} />
        {errors.shortHtml && <span className="text-xs text-red-600">{errors.shortHtml.message}</span>}
      </div>

      {/* Description */}
      <div className="md:col-span-2 flex flex-col gap-2">
        <label htmlFor="description" className="text-sm text-gray-600 dark:text-gray-300">Description</label>
        <textarea id="description" rows={4} className={inputBaseClass} aria-label="Description" {...register("description")} />
        {errors.description && <span className="text-xs text-red-600">{errors.description.message}</span>}
      </div>

      {/* Featured toggle */}
      <div className="flex items-center gap-3">
        <label htmlFor="isFeatured" className="text-sm text-gray-600 dark:text-gray-300">Feature on home</label>
        <input id="isFeatured" type="checkbox" aria-label="Feature on homepage" {...register("isFeatured")} />
        {errors.isFeatured && <span className="text-xs text-red-600">{errors.isFeatured.message as string}</span>}
      </div>

      {/* Date */}
      <div className="flex flex-col gap-2">
        <label htmlFor="date" className="text-sm text-gray-600 dark:text-gray-300">Date</label>
        <input id="date" type="date" className={inputBaseClass} aria-label="Date" {...register("date")} />
        {errors.date && <span className="text-xs text-red-600">{errors.date.message as string}</span>}
      </div>

      {/* Start Time */}
      <div className="flex flex-col gap-2">
        <label htmlFor="startTime" className="text-sm text-gray-600 dark:text-gray-300">Start time</label>
        <input id="startTime" type="datetime-local" step={60} className={inputBaseClass} aria-label="Start time" {...register("startTime")} />
        {errors.startTime && <span className="text-xs text-red-600">{errors.startTime.message as string}</span>}
      </div>

      {/* End Time */}
      <div className="flex flex-col gap-2">
        <label htmlFor="endTime" className="text-sm text-gray-600 dark:text-gray-300">End time</label>
        <input id="endTime" type="datetime-local" step={60} className={inputBaseClass} aria-label="End time" {...register("endTime")} />
        {errors.endTime && <span className="text-xs text-red-600">{errors.endTime.message as string}</span>}
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
          {isSubmitting ? "Saving..." : "Save Event"}
        </button>
      </div>
    </form>
  );
};
