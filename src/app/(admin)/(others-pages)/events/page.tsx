"use client";

/**
 * Events Page
 * Enhanced UI matching Alumni-tabs.tsx styling
 * View: Shows a responsive table with search and filters
 * Add: Provides an event creation form with image uploads
 */

/* eslint-disable @next/next/no-img-element */
import React, { Suspense, useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ComponentCard from "@/components/common/ComponentCard";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import Pagination from "@/components/tables/Pagination";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEventsList, eventsKey, type EventListItem } from "@/app/queries/fetch-events";
import Label from "@/components/form/Label";
import { TrashBinIcon } from "@/icons";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";
import { canModify } from "@/lib/alumniProfile";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapLink from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";

export const dynamic = "force-dynamic";

// TypeScript typings for Events
type EventItem = {
  id: string;
  title: string;
  category: string;
  type?: string | null;
  fromDate: string | null;
  toDate: string | null;
  eventTime: string | null;
  shortDescription: string;
  description: string | null;
  image1: string;
  image2?: string | null;
  image3?: string | null;
  image4?: string | null;
  image5?: string | null;
  chapterName?: string | null;
  chapterType?: string | null;
  associationTitle?: string | null;
};

// Tabs typing
type TabKey = "viewEvents" | "addEvent";

const TABS: { key: TabKey; label: string }[] = [
  { key: "viewEvents", label: "View Events" },
  { key: "addEvent", label: "Add Event" },
];

// Event category options - will be fetched from database

// Helper to format date safely
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString([], { year: "numeric", month: "short", day: "2-digit" });
  } catch {
    return dateStr;
  }
}

// Helper to format time
function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return "-";
  return timeStr;
}

// Events table component with enhanced styling
type EventListProps = {
  items: EventItem[];
  loading?: boolean;
  emptyMessage?: string;
  onDelete?: (id: string) => Promise<void> | void;
  onEdit?: (id: string) => void;
  deletingIds?: Set<string>;
};

const EventTable: React.FC<EventListProps> = ({ items, loading, emptyMessage, onDelete, onEdit, deletingIds }) => {
  const { data: session } = useSession();
  const canEdit = canModify(session?.user);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const topScrollbarRef = React.useRef<HTMLDivElement>(null);
  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const isScrollingRef = React.useRef<boolean>(false);

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

  // Sync scroll between top scrollbar and table container
  useEffect(() => {
    const tableContainer = tableContainerRef.current;
    const topScrollbar = topScrollbarRef.current;
    
    if (!tableContainer || !topScrollbar) return;

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

    syncScrollbarWidth();

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
  }, [paged, loading]);

  return (
    <div className="px-3  sm:px-1 pb-8">
      <div className="overflow-hidden rounded-2xl border max-w-[1400px] border-gray-200/80 bg-white shadow-lg dark:border-gray-700/80 dark:bg-gray-800/50">
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
          <div className="table-scrollbar-content h-full" style={{ minWidth: '1300px' }}></div>
        </div>
        <div 
          ref={tableContainerRef}
          className="max-w-full overflow-x-hidden custom-scrollbar max-h-[750px] overflow-y-auto relative"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
        <div className="table-content-wrapper" style={{ minWidth: '1300px' }}>
        <Table className="min-w-full">
            <TableHeader className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-900/80 dark:to-gray-900/50 sticky top-0 z-10 backdrop-blur-sm">
              <TableRow className="border-b-2 border-gray-200 dark:border-gray-700">
                <TableCell className="px-3  sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[60px]">
                  Sr. No.
                </TableCell>
                <TableCell className="px-3  sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[200px]">
                  Title
                </TableCell>
                <TableCell className="px-3  sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px]">
                  Category
                </TableCell>
                <TableCell className="px-3  sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px]">
                  Type
                </TableCell>
                <TableCell className="px-3  sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[110px]">
                  From Date
                </TableCell>
                <TableCell className="px-3  sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[110px]">
                  To Date
                </TableCell>
                <TableCell className="px-3  sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[100px]">
                  Time
                </TableCell>
                <TableCell className="px-3  sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[200px] hidden lg:table-cell">
                  Description
                </TableCell>
                <TableCell className="px-3  sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[150px]">
                  Chapter
                </TableCell>
                <TableCell className="px-3  sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[150px]">
                  Association
                </TableCell>
                <TableCell className="px-3  sm:px-6 py-4 text-right text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider sticky right-0 bg-gradient-to-r from-transparent via-gray-50/95 to-gray-50 dark:via-gray-900/95 dark:to-gray-900/50 backdrop-blur-sm z-20 min-w-[140px]">
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-gray-100 dark:divide-gray-800/50">
              {loading && (
                Array.from({ length: Math.min(pageSize, 5) }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`} className="bg-white dark:bg-gray-800/30">
                    <TableCell className="px-3  sm:px-6 py-5">
                      <div className="h-5 w-12 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                    </TableCell>
                    <TableCell className="px-3  sm:px-6 py-5">
                      <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                    </TableCell>
                    <TableCell className="px-3  sm:px-6 py-5">
                      <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-full" />
                    </TableCell>
                    <TableCell className="px-3  sm:px-6 py-5">
                      <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                    </TableCell>
                    <TableCell className="px-3  sm:px-6 py-5">
                      <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                    </TableCell>
                    <TableCell className="px-3  sm:px-6 py-5">
                      <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                    </TableCell>
                    <TableCell className="px-3  sm:px-6 py-5">
                      <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                    </TableCell>
                    <TableCell className="px-3  sm:px-6 py-5 hidden lg:table-cell">
                      <div className="h-5 w-64 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                    </TableCell>
                    <TableCell className="px-3  sm:px-6 py-5">
                      <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                    </TableCell>
                    <TableCell className="px-3  sm:px-6 py-5">
                      <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                    </TableCell>
                    <TableCell className="px-3  sm:px-6 py-5 sticky right-0 bg-white dark:bg-gray-800/30 z-10">
                      <div className="h-9 w-28 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              )}
              {!loading && paged.length === 0 && (
                <TableRow>
                  <TableCell className="px-6 py-16 text-center" colSpan={11}>
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-base font-semibold text-gray-700 dark:text-gray-300">{emptyMessage || "No events found"}</p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!loading && paged.map((evt, idx) => (
                <TableRow
                  key={evt.id}
                  className="hover:bg-blue-50/60 dark:hover:bg-white/[0.05] transition-all duration-200 odd:bg-white even:bg-gray-50/30 dark:odd:bg-gray-800/30 dark:even:bg-gray-800/20 group"
                >
                  <TableCell className="px-3  sm:px-6 py-5 text-start">
                    <span className="block text-gray-800 text-sm font-medium dark:text-white/90">{startIdx + idx + 1}</span>
                  </TableCell>
                  <TableCell className="px-3  sm:px-6 py-5 text-start">
                    <div className="flex flex-col gap-1">
                      <span className="block text-gray-900 text-sm font-semibold dark:text-white/95 line-clamp-1">{evt.title || "Untitled Event"}</span>
                      <span className="block text-gray-500 text-xs dark:text-gray-400 line-clamp-1 lg:hidden">{evt.shortDescription || "-"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-3  sm:px-6 py-5 text-start">
                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 capitalize">
                      {evt.category || "-"}
                    </span>
                  </TableCell>
                  <TableCell className="px-3  sm:px-6 py-5 text-start">
                    <span className="text-gray-700 text-sm dark:text-gray-300">
                      {evt.type === "past" ? "Past" : evt.type === "upcoming" ? "Up-Coming" : "-"}
                    </span>
                  </TableCell>
                  <TableCell className="px-3  sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300">
                    <div className="flex flex-col">
                      <span className="font-medium">{formatDate(evt.fromDate)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-3  sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300">
                    <div className="flex flex-col">
                      <span className="font-medium">{formatDate(evt.toDate)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-3  sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    {formatTime(evt.eventTime)}
                    </span>
                  </TableCell>
                  <TableCell className="px-3  sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden lg:table-cell">
                    <span className="line-clamp-2 text-gray-600 dark:text-gray-400">{evt.shortDescription || "-"}</span>
                  </TableCell>
                  <TableCell className="px-3  sm:px-6 py-5 text-start">
                    {evt.chapterName ? (
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                          {evt.chapterName}
                        </span>
                        {evt.chapterType && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{evt.chapterType}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500 text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="px-3  sm:px-6 py-5 text-start">
                    {evt.associationTitle ? (
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        {evt.associationTitle}
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500 text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className={`px-3 sm:px-6 py-5 text-end sticky right-0 z-10 ${
                    idx % 2 === 0 
                      ? "bg-gray-50 dark:bg-gray-800/20" 
                      : "bg-white dark:bg-gray-800/30"
                  }`}>
                    <div role="group" aria-label="Row actions" className="inline-flex items-center gap-2 justify-end">
                      <NextLink
                        href={`/events/${evt.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 hover:text-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                        aria-label="View event"
                        title="View event"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span className="hidden sm:inline">View</span>
                      </NextLink>
                      {canEdit && onEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit(evt.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 hover:text-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                          aria-label="Edit event"
                          title="Edit event"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => onDelete?.(evt.id)}
                          disabled={Boolean(deletingIds?.has(evt.id))}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 hover:text-red-800 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="Delete event"
                          title="Delete event"
                        >
                          {deletingIds?.has(evt.id) ? (
                            <div className="h-4 w-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <TrashBinIcon className="h-4 w-4" />
                              <span className="hidden sm:inline">Delete</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
        </Table>
          </div>
        </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-5 bg-gray-50/50 dark:bg-gray-900/30 border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {(() => {
                const start = (currentPage - 1) * pageSize + 1;
                const end = start + paged.length - 1;
                const total = safeItems.length;
                return `Showing ${paged.length ? start : 0}-${paged.length ? end : 0} of ${total.toLocaleString()}`;
              })()}
            </span>
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400" htmlFor="page-size">Items per page:</label>
              <select
                id="page-size"
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                value={pageSize}
                onChange={(e) => {
                  const newPageSize = Number(e.target.value);
                  setPageSize(newPageSize);
                  setCurrentPage(1);
                }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(p) => {
                  const newPage = Math.max(1, Math.min(totalPages, p));
                  setCurrentPage(newPage);
                  const tableContainer = document.querySelector('.custom-scrollbar');
                  if (tableContainer) {
                    tableContainer.scrollTop = 0;
                  }
                }}
              />
            </div>
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
    </div>
  );
};

// Form schema
type EventFormValues = {
  title: string;
  category: string;
  type?: "" | "past" | "upcoming";
  fromDate: string | undefined;
  toDate: string | undefined;
  eventTime: string | undefined;
  shortDescription: string;
  description: string;
  chapterId?: string;
  associationId?: string;
  image1: File | null;
  image2?: File | null;
  image3?: File | null;
  image4?: File | null;
  image5?: File | null;
};

const createEventFormSchema = (isEditing: boolean = false) => z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be 200 characters or less"),
  category: z.string().min(1, "Category is required"),
  type: z.enum(["past", "upcoming"]).optional().or(z.literal("")),
  fromDate: isEditing 
    ? z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "Invalid date format (YYYY-MM-DD)").or(z.literal("")).optional()
    : z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "From date is required"),
  toDate: isEditing
    ? z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "Invalid date format (YYYY-MM-DD)").or(z.literal("")).optional()
    : z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "To date is required"),
  eventTime: isEditing
    ? z.string().regex(/^\d{2}:\d{2}$/u, "Invalid time format (HH:MM)").or(z.literal("")).optional()
    : z.string().regex(/^\d{2}:\d{2}$/u, "Event time is required (HH:MM format)"),
  shortDescription: z.string().min(1, "Short description is required").max(500, "Short description must be 500 characters or less"),
  description: z.string().min(1, "Description is required"),
  chapterId: z.string().optional(),
  associationId: z.string().optional(),
  image1: isEditing
    ? z
        .any()
        .refine((f) => !f || f instanceof File, { message: "Invalid file" })
        .refine((f) => !f || ["image/png", "image/jpeg", "image/jpg"].includes((f as File).type), { message: "Only PNG or JPG allowed" })
        .refine((f) => !f || (f as File).size <= 5 * 1024 * 1024, { message: "Max size 5MB" })
        .nullable()
        .optional()
    : z
        .any()
        .refine((f) => f instanceof File, { message: "Image 1 is required" })
        .refine((f) => !f || ["image/png", "image/jpeg", "image/jpg"].includes((f as File).type), { message: "Only PNG or JPG allowed" })
        .refine((f) => !f || (f as File).size <= 5 * 1024 * 1024, { message: "Max size 5MB" }),
  image2: z
    .any()
    .refine((f) => !f || f instanceof File, { message: "Invalid file" })
    .refine((f) => !f || ["image/png", "image/jpeg", "image/jpg"].includes((f as File).type), { message: "Only PNG or JPG allowed" })
    .refine((f) => !f || (f as File).size <= 5 * 1024 * 1024, { message: "Max size 5MB" })
    .nullable()
    .optional(),
  image3: z
    .any()
    .refine((f) => !f || f instanceof File, { message: "Invalid file" })
    .refine((f) => !f || ["image/png", "image/jpeg", "image/jpg"].includes((f as File).type), { message: "Only PNG or JPG allowed" })
    .refine((f) => !f || (f as File).size <= 5 * 1024 * 1024, { message: "Max size 5MB" })
    .nullable()
    .optional(),
  image4: z
    .any()
    .refine((f) => !f || f instanceof File, { message: "Invalid file" })
    .refine((f) => !f || ["image/png", "image/jpeg", "image/jpg"].includes((f as File).type), { message: "Only PNG or JPG allowed" })
    .refine((f) => !f || (f as File).size <= 5 * 1024 * 1024, { message: "Max size 5MB" })
    .nullable()
    .optional(),
  image5: z
    .any()
    .refine((f) => !f || f instanceof File, { message: "Invalid file" })
    .refine((f) => !f || ["image/png", "image/jpeg", "image/jpg"].includes((f as File).type), { message: "Only PNG or JPG allowed" })
    .refine((f) => !f || (f as File).size <= 5 * 1024 * 1024, { message: "Max size 5MB" })
    .nullable()
    .optional(),
}).refine((data) => {
  if (data.toDate && data.fromDate) {
    return new Date(data.toDate) >= new Date(data.fromDate);
  }
  return true;
}, { message: "To date must be on or after from date", path: ["toDate"] });

// Add Event Form Component
type AddEventFormProps = {
  eventId?: string | null;
  onSuccess?: () => void;
};

const AddEventForm: React.FC<AddEventFormProps> = ({ eventId, onSuccess }) => {
  const queryClient = useQueryClient();
  const [serverMsg, setServerMsg] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<number, string>>({});
  const [chapters, setChapters] = useState<Array<{ id: number; name: string; type: string }>>([]);
  const [associations, setAssociations] = useState<Array<{ id: number; title: string }>>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(true);
  const [loadingAssociations, setLoadingAssociations] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingEvent, setLoadingEvent] = useState(false);

  // Tiptap editor for description
  const descriptionEditor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      TiptapLink.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    ],
    content: "",
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setValue("description", html, { shouldValidate: true });
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4",
      },
    },
    editable: true,
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<EventFormValues>({
    resolver: zodResolver(createEventFormSchema(!!eventId)),
    defaultValues: {
      title: "",
      category: "",
      type: "",
      fromDate: "",
      toDate: "",
      eventTime: "",
      shortDescription: "",
      description: "",
      chapterId: "",
      associationId: "",
      image1: null,
      image2: undefined,
      image3: undefined,
      image4: undefined,
      image5: undefined,
    },
    mode: "onChange",
  });

  // Cleanup editor on unmount
  useEffect(() => {
    return () => {
      if (descriptionEditor) {
        descriptionEditor.destroy();
      }
    };
  }, [descriptionEditor]);

  // Fetch event data if editing
  useEffect(() => {
    if (eventId) {
      setLoadingEvent(true);
      fetch(`/api/events/${eventId}`)
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            // Populate form with existing data
            setValue("title", data.title || "");
            setValue("category", data.category || "");
            setValue("type", data.type || "");
            setValue("fromDate", data.fromDate || "");
            setValue("toDate", data.toDate || "");
            setValue("eventTime", data.eventTime || "");
            setValue("shortDescription", data.shortDescription || "");
            setValue("description", data.description || "");
            setValue("chapterId", data.chapterId || "");
            setValue("associationId", data.associationId || "");
            
            // Set editor content if available
            if (descriptionEditor && data.description) {
              descriptionEditor.commands.setContent(data.description);
            }
            
            // Set preview URLs for existing images
            const existingPreviewUrls: Record<number, string> = {};
            if (data.images && Array.isArray(data.images)) {
              data.images.forEach((img: string, idx: number) => {
                if (img) {
                  existingPreviewUrls[idx + 1] = `/images/${img}`;
                }
              });
            }
            setPreviewUrls(existingPreviewUrls);
          }
        })
        .catch((err) => {

          toast.error("Failed to load event data");
        })
        .finally(() => {
          setLoadingEvent(false);
        });
    }
  }, [eventId, setValue, descriptionEditor]);

  // Fetch chapters, associations, and categories on mount
  useEffect(() => {
    const fetchChapters = async () => {
      try {
        const res = await fetch("/api/chapters/list");
        if (res.ok) {
          const data = await res.json();
          setChapters(data.chapters || []);
        }
      } catch (err) {

      } finally {
        setLoadingChapters(false);
      }
    };

    const fetchAssociations = async () => {
      try {
        const res = await fetch("/api/associations/list");
        if (res.ok) {
          const data = await res.json();
          setAssociations(data.associations || []);
        }
      } catch (err) {

      } finally {
        setLoadingAssociations(false);
      }
    };

    const fetchCategories = async () => {
      try {
        const res = await fetch("/api/events/categories");
        if (res.ok) {
          const data = await res.json();
          setCategories(data.categories || []);
        }
      } catch (err) {

      } finally {
        setLoadingCategories(false);
      }
    };

    fetchChapters();
    fetchAssociations();
    fetchCategories();
  }, []);

  // Watch all image fields for preview
  const image1 = watch("image1");
  const image2 = watch("image2");
  const image3 = watch("image3");
  const image4 = watch("image4");
  const image5 = watch("image5");

  useEffect(() => {
    const urls: Record<number, string> = {};
    const images = [image1, image2, image3, image4, image5];
    
    images.forEach((img, idx) => {
      if (img && img instanceof File) {
        const url = URL.createObjectURL(img);
        urls[idx + 1] = url;
      }
    });

    setPreviewUrls(urls);
    return () => {
      Object.values(urls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [image1, image2, image3, image4, image5]);

  const onSubmit = async (data: EventFormValues) => {
    setServerMsg(null);
    setServerError(null);

    try {
      // Create FormData for file uploads
      const formData = new FormData();
      formData.append("title", data.title);
      formData.append("category", data.category);
      
      // For editing, only append date/time if they have values (preserve existing if empty)
      if (eventId) {
        if (data.fromDate && data.fromDate.trim() !== "") {
          formData.append("fromDate", data.fromDate);
        }
        if (data.toDate && data.toDate.trim() !== "") {
          formData.append("toDate", data.toDate);
        }
        if (data.eventTime && data.eventTime.trim() !== "") {
          formData.append("eventTime", data.eventTime);
        }
      } else {
        // For new events, all fields are required
        if (data.fromDate) formData.append("fromDate", data.fromDate);
        if (data.toDate) formData.append("toDate", data.toDate);
        if (data.eventTime) formData.append("eventTime", data.eventTime);
      }
      
      formData.append("shortDescription", data.shortDescription);
      formData.append("description", data.description);
      
      if (data.type) formData.append("type", data.type);
      if (data.chapterId) formData.append("chapterId", data.chapterId);
      if (data.associationId) formData.append("associationId", data.associationId);
      
      if (data.image1) formData.append("image1", data.image1);
      if (data.image2) formData.append("image2", data.image2);
      if (data.image3) formData.append("image3", data.image3);
      if (data.image4) formData.append("image4", data.image4);
      if (data.image5) formData.append("image5", data.image5);

      const url = eventId ? `/api/events/${eventId}` : "/api/events";
      const method = eventId ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        body: formData,
      });

      const responseData = await res.json();
      
      if (!res.ok) {
        throw new Error(responseData?.error || responseData?.message || `Failed (${res.status})`);
      }

      const successMsg = eventId ? "Event updated successfully!" : "Event created successfully!";
      setServerMsg(successMsg);
      toast.success(successMsg);
      reset();
      Object.keys(previewUrls).forEach(key => {
        const url = previewUrls[parseInt(key)];
        if (url && url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      });
      setPreviewUrls({});
      
      // Invalidate queries to refresh the list
      await queryClient.invalidateQueries({ queryKey: eventsKey });
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
      
      // Reset form after short delay
      setTimeout(() => {
        setServerMsg(null);
      }, 3000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unexpected error while saving.";
      setServerError(msg);
      toast.error(msg);
    }
  };

  const handleImageChange = (imageNum: 1 | 2 | 3 | 4 | 5, file: File | null) => {
    const fieldName = `image${imageNum}` as keyof EventFormValues;
    setValue(fieldName, file);
    setServerError(null);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" aria-label="Add event form">
      {(serverMsg || serverError) && (
        <div className="rounded-lg border p-4" aria-live="polite" aria-atomic="true">
          {serverMsg && (
            <div role="status" className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded p-2">
              {serverMsg}
            </div>
          )}
          {serverError && (
            <div role="alert" className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded p-2">
              {serverError}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        {/* Title */}
        <div className="sm:col-span-2">
          <Label htmlFor="title">Event Title *</Label>
          <input
            id="title"
            type="text"
            className={`h-11 w-full rounded-lg border px-4 py-2.5 text-sm shadow-theme-xs text-gray-800 placeholder:text-gray-400 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 focus:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800 ${
              errors.title ? "border-red-500 dark:border-red-500" : "border-gray-300"
            }`}
            placeholder="Enter event title"
            {...register("title")}
          />
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">Maximum 200 characters</p>
          {errors.title && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.title.message}</p>}
        </div>

        {/* Category */}
        <div>
          <Label htmlFor="category">Category *</Label>
          <select
            id="category"
            className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm shadow-theme-xs text-gray-800 placeholder:text-gray-400 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 focus:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
            {...register("category")}
            disabled={loadingCategories}
          >
            <option value="">{loadingCategories ? "Loading categories..." : "Select category"}</option>
            {categories.map((opt) => (
              <option key={opt} value={opt}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </option>
            ))}
          </select>
          {errors.category && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.category.message}</p>}
        </div>

        {/* Event Type */}
        <div>
          <Label htmlFor="type">Event Type (Optional)</Label>
          <select
            id="type"
            className={`h-11 w-full rounded-lg border px-4 py-2.5 text-sm shadow-theme-xs text-gray-800 placeholder:text-gray-400 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 focus:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800 ${
              errors.type ? "border-red-500 dark:border-red-500" : "border-gray-300"
            }`}
            {...register("type")}
          >
            <option value="">Select event type (optional)</option>
            <option value="past">Past</option>
            <option value="upcoming">Up-Coming</option>
          </select>
          {errors.type && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.type.message}</p>}
        </div>

        {/* Event Time */}
        <div>
          <Label htmlFor="eventTime">Event Time {!eventId ? "*" : ""}</Label>
          <input
            id="eventTime"
            type="time"
            className={`h-11 w-full rounded-lg border px-4 py-2.5 text-sm shadow-theme-xs text-gray-800 placeholder:text-gray-400 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 focus:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800 ${
              errors.eventTime ? "border-red-500 dark:border-red-500" : "border-gray-300"
            }`}
            {...register("eventTime")}
          />
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">Format: HH:MM {eventId && "(optional when editing)"}</p>
          {errors.eventTime && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.eventTime.message}</p>}
        </div>

        {/* From Date */}
        <div>
          <Label htmlFor="fromDate">From Date {!eventId ? "*" : ""}</Label>
          <input
            id="fromDate"
            type="date"
            className={`h-11 w-full rounded-lg border px-4 py-2.5 text-sm shadow-theme-xs text-gray-800 placeholder:text-gray-400 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 focus:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800 ${
              errors.fromDate ? "border-red-500 dark:border-red-500" : "border-gray-300"
            }`}
            {...register("fromDate")}
          />
          {eventId && <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">Optional when editing</p>}
          {errors.fromDate && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.fromDate.message}</p>}
        </div>

        {/* To Date */}
        <div>
          <Label htmlFor="toDate">To Date {!eventId ? "*" : ""}</Label>
          <input
            id="toDate"
            type="date"
            className={`h-11 w-full rounded-lg border px-4 py-2.5 text-sm shadow-theme-xs text-gray-800 placeholder:text-gray-400 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 focus:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800 ${
              errors.toDate ? "border-red-500 dark:border-red-500" : "border-gray-300"
            }`}
            {...register("toDate")}
          />
          {eventId && <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">Optional when editing</p>}
          {errors.toDate && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.toDate.message}</p>}
        </div>

        {/* Chapter */}
        <div>
          <Label htmlFor="chapterId">Chapter (Optional)</Label>
          <select
            id="chapterId"
            className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm shadow-theme-xs text-gray-800 placeholder:text-gray-400 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 focus:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
            {...register("chapterId")}
            disabled={loadingChapters}
          >
            <option value="">Select a chapter (optional)</option>
            {chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {chapter.name} ({chapter.type})
              </option>
            ))}
          </select>
          {loadingChapters && <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">Loading chapters...</p>}
        </div>

        {/* Association */}
        <div>
          <Label htmlFor="associationId">Association (Optional)</Label>
          <select
            id="associationId"
            className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm shadow-theme-xs text-gray-800 placeholder:text-gray-400 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 focus:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
            {...register("associationId")}
            disabled={loadingAssociations}
          >
            <option value="">Select an association (optional)</option>
            {associations.map((association) => (
              <option key={association.id} value={association.id}>
                {association.title}
              </option>
            ))}
          </select>
          {loadingAssociations && <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">Loading associations...</p>}
        </div>

        {/* Short Description */}
        <div className="sm:col-span-2">
          <Label htmlFor="shortDescription">Short Description *</Label>
          <input
            id="shortDescription"
            type="text"
            className={`h-11 w-full rounded-lg border px-4 py-2.5 text-sm shadow-theme-xs text-gray-800 placeholder:text-gray-400 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 focus:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800 ${
              errors.shortDescription ? "border-red-500 dark:border-red-500" : "border-gray-300"
            }`}
            placeholder="Brief description (max 500 characters)"
            {...register("shortDescription")}
          />
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">Maximum 500 characters</p>
          {errors.shortDescription && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.shortDescription.message}</p>}
        </div>

        {/* Description - HTML Editor */}
        <div className="sm:col-span-2">
          <Label htmlFor="description">Description *</Label>
          <div className={`rounded-lg border ${
            errors.description ? "border-red-500 dark:border-red-500" : "border-gray-300 dark:border-gray-700"
          } bg-white dark:bg-gray-900 shadow-theme-xs focus-within:ring-3 focus-within:ring-brand-500/10 focus-within:border-brand-300 dark:focus-within:border-brand-800`}>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <button
                type="button"
                onClick={() => descriptionEditor?.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`px-2 py-1 text-xs font-semibold rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
                  descriptionEditor?.isActive("heading", { level: 1 }) ? "bg-gray-200 dark:bg-gray-700" : ""
                }`}
                title="Heading 1"
              >
                H1
              </button>
              <button
                type="button"
                onClick={() => descriptionEditor?.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`px-2 py-1 text-xs font-semibold rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
                  descriptionEditor?.isActive("heading", { level: 2 }) ? "bg-gray-200 dark:bg-gray-700" : ""
                }`}
                title="Heading 2"
              >
                H2
              </button>
              <button
                type="button"
                onClick={() => descriptionEditor?.chain().focus().toggleHeading({ level: 3 }).run()}
                className={`px-2 py-1 text-xs font-semibold rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
                  descriptionEditor?.isActive("heading", { level: 3 }) ? "bg-gray-200 dark:bg-gray-700" : ""
                }`}
                title="Heading 3"
              >
                H3
              </button>
              <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
              <button
                type="button"
                onClick={() => descriptionEditor?.chain().focus().toggleBold().run()}
                className={`px-2 py-1 text-xs font-bold rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
                  descriptionEditor?.isActive("bold") ? "bg-gray-200 dark:bg-gray-700" : ""
                }`}
                title="Bold"
              >
                B
              </button>
              <button
                type="button"
                onClick={() => descriptionEditor?.chain().focus().toggleItalic().run()}
                className={`px-2 py-1 text-xs italic rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
                  descriptionEditor?.isActive("italic") ? "bg-gray-200 dark:bg-gray-700" : ""
                }`}
                title="Italic"
              >
                I
              </button>
              <button
                type="button"
                onClick={() => descriptionEditor?.chain().focus().toggleUnderline().run()}
                className={`px-2 py-1 text-xs underline rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
                  descriptionEditor?.isActive("underline") ? "bg-gray-200 dark:bg-gray-700" : ""
                }`}
                title="Underline"
              >
                U
              </button>
              <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
              <button
                type="button"
                onClick={() => descriptionEditor?.chain().focus().toggleBulletList().run()}
                className={`px-2 py-1 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
                  descriptionEditor?.isActive("bulletList") ? "bg-gray-200 dark:bg-gray-700" : ""
                }`}
                title="Bullet List"
              >
                •
              </button>
              <button
                type="button"
                onClick={() => descriptionEditor?.chain().focus().toggleOrderedList().run()}
                className={`px-2 py-1 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
                  descriptionEditor?.isActive("orderedList") ? "bg-gray-200 dark:bg-gray-700" : ""
                }`}
                title="Numbered List"
              >
                1.
              </button>
              <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
              <button
                type="button"
                onClick={() => {
                  const url = window.prompt("Enter URL:");
                  if (url) {
                    descriptionEditor?.chain().focus().setLink({ href: url }).run();
                  }
                }}
                className={`px-2 py-1 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
                  descriptionEditor?.isActive("link") ? "bg-gray-200 dark:bg-gray-700" : ""
                }`}
                title="Add Link"
              >
                🔗
              </button>
            </div>
            {/* Editor Content */}
            <div className="min-h-[300px] max-h-[500px] overflow-y-auto">
              {descriptionEditor ? (
                <EditorContent editor={descriptionEditor} />
              ) : (
                <div className="min-h-[300px] p-4 flex items-center justify-center text-gray-400">
                  <p>Loading editor...</p>
                </div>
              )}
            </div>
          </div>
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">Use the toolbar above to format your description with headings, lists, links, and more.</p>
          {errors.description && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.description.message}</p>}
        </div>

        {/* Images Section */}
        <div className="sm:col-span-2 space-y-5 rounded-lg border border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800/50">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Event Images</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {eventId 
                ? "Upload new images to replace existing ones, or leave empty to keep current images. All images are optional when editing."
                : "Upload images for the event. Image 1 is required. Additional images are optional."}
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Image 1 - Required for new, optional for edit */}
            {[1, 2, 3, 4, 5].map((num) => (
              <div key={num}>
                <Label htmlFor={`image${num}`}>
                  Image {num} {num === 1 && !eventId ? "*" : ""}
                </Label>
                <Controller
                  name={`image${num}` as keyof EventFormValues}
                  control={control}
                  render={() => (
                    <>
                      <input
                        id={`image${num}`}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg"
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          handleImageChange(num as 1 | 2 | 3 | 4 | 5, file);
                        }}
                      />
                      {previewUrls[num] && (
                        <div className="mt-2">
                          <img
                            src={previewUrls[num]}
                            alt={`Preview ${num}`}
                            className="h-24 w-full rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                          />
                        </div>
                      )}
                    </>
                  )}
                />
                {errors[`image${num}` as keyof EventFormValues] && (
                  <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                    {String(errors[`image${num}` as keyof EventFormValues]?.message || "")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => {
            reset();
            Object.keys(previewUrls).forEach(key => URL.revokeObjectURL(previewUrls[parseInt(key)]));
            setPreviewUrls({});
            setServerMsg(null);
            setServerError(null);
          }}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Reset
        </button>
        <button
          type="submit"
          disabled={isSubmitting || loadingEvent}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-brand-500 dark:hover:bg-brand-600"
        >
          {loadingEvent ? "Loading..." : isSubmitting ? (eventId ? "Updating..." : "Creating...") : (eventId ? "Update Event" : "Create Event")}
        </button>
      </div>
    </form>
  );
};

// Default export function
function EventsPageInner() {
  const [selected, setSelected] = useState<TabKey>("viewEvents");
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: rawEvents, isLoading, isFetching, isError, error } = useEventsList();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const deleteModal = useModal();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const safeSearchParams = searchParams ?? new URLSearchParams();

  useEffect(() => {
    const tab = safeSearchParams.get("tab");
    if (tab === "viewEvents" || tab === "addEvent") {
      setSelected(tab);
    }
  }, [safeSearchParams]);

  // Map server events to our format
  useEffect(() => {
    const mapped: EventItem[] = (rawEvents ?? []).map((e: EventListItem) => ({
      id: e.id,
      title: e.title || "",
      category: e.category || "",
      type: e.type || null,
      fromDate: e.startTimeUTC ? new Date(e.startTimeUTC).toISOString().split('T')[0] : null,
      toDate: e.endTimeUTC ? new Date(e.endTimeUTC).toISOString().split('T')[0] : null,
      eventTime: e.startTimeUTC ? new Date(e.startTimeUTC).toTimeString().slice(0, 5) : null,
      shortDescription: e.shortDescription || "",
      description: null, // Not in current API response
      image1: e.imageUrl || "",
      image2: null,
      image3: null,
      image4: null,
      image5: null,
      chapterName: e.chapterName || null,
      chapterType: e.chapterType || null,
      associationTitle: e.associationTitle || null,
    }));
    setEvents(mapped);
  }, [rawEvents]);

  // Filter events by search query
  const filteredEvents = useMemo<EventItem[]>(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return events;
    
    return events.filter((e) => {
      const searchFields = [
        e.title,
        e.category,
        e.shortDescription,
        e.description,
      ].map(v => String(v || "").toLowerCase());
      return searchFields.some(f => f.includes(q));
    });
  }, [events, debouncedQuery]);

  const handleDelete = async (id: string) => {
    setDeletingEventId(id);
    deleteModal.openModal();
  };

  const handleEdit = (id: string) => {
    setEditingEventId(id);
    setSelected("addEvent");
    const qp = new URLSearchParams(safeSearchParams.toString());
    qp.set("tab", "addEvent");
    router.replace(`${pathname}?${qp.toString()}`);
  };

  const handleEditSuccess = () => {
    setEditingEventId(null);
    setSelected("viewEvents");
    const qp = new URLSearchParams(safeSearchParams.toString());
    qp.set("tab", "viewEvents");
    router.replace(`${pathname}?${qp.toString()}`);
  };

  const confirmDelete = async () => {
    if (!deletingEventId) return;
    
    try {
      setDeletingIds((prev) => new Set(prev).add(deletingEventId));
      const res = await fetch(`/api/events/${deletingEventId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: eventsKey });
      toast.success("Event deleted successfully!");
      deleteModal.closeModal();
      setDeletingEventId(null);
    } catch (err) {

      toast.error("Failed to delete event. Please try again.");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(deletingEventId);
        return next;
      });
    }
  };

  return (
    <ComponentCard className="p-0">
      <div className="flex flex-col gap-8">
        {/* Tabs navigation */}
        <div className="px-6 pt-2">
          <div className="tab-list flex flex-wrap gap-4" role="tablist" aria-label="Events sections">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                className={`rounded-xl border px-4 py-2 cursor-pointer transform scale-100 transform-gpu transition-transform duration-300 ease-in-out hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  selected === tab.key
                    ? "bg-white text-blue-700 dark:border-blue-500 dark:bg-blue-900/20"
                    : "border-gray-200 bg-white text-gray-700 dark:border-gray-800 dark:bg-white/[0.03]"
                }`}
                onClick={() => {
                  setSelected(tab.key);
                  if (tab.key === "addEvent" && editingEventId) {
                    setEditingEventId(null);
                  }
                  const qp = new URLSearchParams(safeSearchParams.toString());
                  qp.set("tab", tab.key);
                  router.replace(`${pathname}?${qp.toString()}`);
                }}
                role="tab"
                aria-selected={selected === tab.key}
                tabIndex={0}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Section */}
        <div className="px-6 pb-8">
          {selected === "viewEvents" && (
            <>
              {/* Search Section */}
              <div className="mb-6">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-800/50 dark:to-gray-800/30 rounded-2xl p-5 border border-gray-200/50 dark:border-gray-700/50 shadow-sm">
                  <div className="flex-1 w-full sm:max-w-lg">
                    <label htmlFor="events-search" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2.5 uppercase tracking-wider">
                      Search Events
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
                        id="events-search"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by category, description..."
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300/80 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:text-gray-100 transition-all duration-200"
                      />
                    </div>
                  </div>
                  {isFetching && !isLoading && (
                    <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 px-3 sm:px-4 py-2 sm:py-2.5 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl border border-gray-200/80 dark:border-gray-600/80 shadow-sm">
                      <div className="h-3.5 w-3.5 sm:h-4 sm:w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className="hidden sm:inline">Updating...</span>
                      <span className="sm:hidden">...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Events Table */}
              <EventTable
                items={filteredEvents}
                loading={isLoading || isFetching}
                emptyMessage={isError ? (error?.message ?? "Failed to load events") : "No events found"}
                deletingIds={deletingIds}
                onDelete={handleDelete}
                onEdit={handleEdit}
              />
            </>
          )}

          {selected === "addEvent" && (
            <div className="bg-white dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <AddEventForm eventId={editingEventId} onSuccess={handleEditSuccess} />
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => {
          if (!deletingIds.has(deletingEventId || "")) {
            deleteModal.closeModal();
            setDeletingEventId(null);
          }
        }}
        className="max-w-lg mx-auto"
        showCloseButton={true}
      >
        <div className="p-8" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
              <TrashBinIcon className="h-6 w-6 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">Confirm Deletion</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone.</p>
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Are you sure you want to delete this event? This will permanently remove the event record.
            </p>
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={deletingIds.has(deletingEventId || "")}
              onClick={() => {
                if (!deletingIds.has(deletingEventId || "")) {
                  deleteModal.closeModal();
                  setDeletingEventId(null);
                }
              }}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deletingIds.has(deletingEventId || "")}
              onClick={confirmDelete}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
            >
              {deletingIds.has(deletingEventId || "") ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Deleting...
                </span>
              ) : (
                "Delete"
              )}
            </button>
          </div>
        </div>
      </Modal>
    </ComponentCard>
  );
}

// Default export function
export default function EventsPage() {
  return (
    <Suspense fallback={null}>
      <EventsPageInner />
    </Suspense>
  );
}

