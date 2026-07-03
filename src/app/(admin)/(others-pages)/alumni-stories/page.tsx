"use client";
/* eslint-disable @next/next/no-img-element */

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import ComponentCard from "@/components/common/ComponentCard";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import Pagination from "@/components/tables/Pagination";
import SyncedTableScroll from "@/components/tables/SyncedTableScroll";
import { EyeIcon, TrashBinIcon, CheckLineIcon, CloseLineIcon } from "@/icons";
import { useQueryClient } from "@tanstack/react-query";
import { useAlumniStories, alumniStoriesKey, type AlumniStoryItem } from "@/app/queries/fetch-alumni-stories";
import AlumniSuccessForm from "@/components/forms/alumni-success";
import { canModify, isSuperAdminUser } from "@/lib/alumniProfile";
import { storyHtmlTextContent } from "@/lib/sanitizeStoryHtml";
import StoryStatusBadge from "@/components/alumni/StoryStatusBadge";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import { normalizeStoryStatus } from "@/lib/alumniStories";

export const dynamic = "force-dynamic";

// TypeScript typings for Stories
type Story = {
  id: string;
  date: string | Date;
  title: string;
  name: string;
  program: string;
  session: string;
  shortDescription: string;
  imageUrl: string;
  status: string;
  rejectionReason?: string | null;
};

type StatusTabKey = "all" | "pending" | "approved" | "notApproved";

const STATUS_TABS: { key: StatusTabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "notApproved", label: "Not Approved" },
];

// Tabs typing
type TabKey = "viewStories" | "addStory";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "viewStories", label: "View Stories", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
  { key: "addStory", label: "Add Story", icon: "M12 4v16m8-8H4" },
];

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

// Toast notification component
const Toast: React.FC<{ message: string; type: "success" | "error"; onClose: () => void }> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-6 right-6 z-50 animate-slide-in-right">
      <div className={`flex items-center gap-3 rounded-2xl px-5 py-4 shadow-2xl backdrop-blur-xl border ${
        type === "success" 
          ? "bg-emerald-50/95 border-emerald-200/50 text-emerald-800 dark:bg-emerald-900/90 dark:border-emerald-700/30 dark:text-emerald-200" 
          : "bg-rose-50/95 border-rose-200/50 text-rose-800 dark:bg-rose-900/90 dark:border-rose-700/30 dark:text-rose-200"
      }`}>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          type === "success" ? "bg-emerald-100 dark:bg-emerald-800/50" : "bg-rose-100 dark:bg-rose-800/50"
        }`}>
          {type === "success" ? (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-2 rounded-lg p-1 hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
          <svg className="h-4 w-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// Shimmer skeleton for table rows
const ShimmerRow: React.FC = () => (
  <TableRow className="relative overflow-hidden">
    {Array.from({ length: 8 }).map((_, i) => (
      <TableCell key={i} className="px-4 py-4">
        <div className="h-4 rounded-lg bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-shimmer bg-[length:200%_100%]" 
             style={{ width: i === 0 ? '2rem' : i === 5 ? '2.5rem' : i === 6 ? '5rem' : '80%' }} />
      </TableCell>
    ))}
  </TableRow>
);

// Stories table component with modern styling
type StoryListProps = {
  items: Story[];
  loading?: boolean;
  isFetching?: boolean;
  errorMessage?: string | null;
  emptyMessage?: string;
  onDelete?: (id: string) => Promise<void> | void;
  onApprove?: (id: string) => Promise<void> | void;
  onReject?: (id: string, reason: string) => Promise<void> | void;
  deletingIds?: Set<string>;
  reviewingIds?: Set<string>;
  canDelete?: boolean;
  canReview?: boolean;
  actionMessage?: string | null;
  actionError?: string | null;
};

const StoryTable: React.FC<StoryListProps> = ({
  items,
  loading,
  isFetching,
  errorMessage,
  emptyMessage,
  onDelete,
  onApprove,
  onReject,
  deletingIds,
  reviewingIds,
  canDelete = false,
  canReview = false,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const rejectModal = useModal();
  const approveModal = useModal();
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [approveTargetId, setApproveTargetId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

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
    <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white/80 shadow-xl shadow-gray-200/50 backdrop-blur-sm dark:border-white/[0.08] dark:bg-gray-900/60 dark:shadow-none">
      <SyncedTableScroll minWidth={950} maxHeight={700}>
        <Table className="min-w-full">
          <TableHeader className="sticky top-0 z-10">
            <TableRow className="border-b border-gray-100 bg-gray-50/80 backdrop-blur-xl dark:border-white/[0.06] dark:bg-gray-800/80">
              {["SrNo.", "Date", "Name & Title", "Program & Session", "Short Description", "Status", "Image", "Actions"].map((header) => (
                <TableCell 
                  key={header} 
                  isHeader 
                  className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  {header}
                </TableCell>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody className="divide-y divide-gray-50 dark:divide-white/[0.04]">
            {(loading || isFetching) && (
              Array.from({ length: Math.min(pageSize, 5) }).map((_, i) => (
                <ShimmerRow key={`skeleton-${i}`} />
              ))
            )}
            
            {!loading && !!errorMessage && (
              <TableRow>
                <TableCell className="px-5 py-8" colSpan={8}>
                  <div className="flex flex-col items-center justify-center gap-4 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-900/20">
                      <svg className="h-8 w-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{errorMessage}</p>
                      <button
                        type="button"
                        onClick={() => setCurrentPage(1)}
                        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-gray-900/20 transition-all hover:bg-gray-800 hover:shadow-xl hover:shadow-gray-900/30 active:scale-95 dark:bg-white dark:text-gray-900 dark:shadow-none dark:hover:bg-gray-100"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Try Again
                      </button>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}
            
            {!loading && !errorMessage && paged.length === 0 && (
              <TableRow>
                <TableCell className="px-5 py-16" colSpan={8}>
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700">
                      <svg className="h-10 w-10 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400">{emptyMessage || "No stories found"}</p>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Get started by adding your first alumni story</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            
            {!loading && !errorMessage && paged.map((story, idx) => (
              <TableRow 
                key={story.id} 
                className="group transition-all duration-200 hover:bg-blue-50/30 dark:hover:bg-blue-900/10"
              >
                <TableCell className="px-5 py-4">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100 text-xs font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {startIdx + idx + 1}
                  </span>
                </TableCell>

                <TableCell className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
                      <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{formatDate(story.date)}</span>
                  </div>
                </TableCell>

                <TableCell className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white shadow-lg shadow-blue-500/30">
                      {story.name?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">{story.name || "-"}</div>
                      {story.title && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{story.title}</div>
                      )}
                    </div>
                  </div>
                </TableCell>

                <TableCell className="px-5 py-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{story.program || "-"}</span>
                    {story.session && (
                      <span className="inline-flex w-fit items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                        {story.session}
                      </span>
                    )}
                  </div>
                </TableCell>

                <TableCell className="px-5 py-4 max-w-xs">
                  <p className="line-clamp-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                    {storyHtmlTextContent(story.shortDescription).slice(0, 200) || "-"}
                  </p>
                </TableCell>

                <TableCell className="px-5 py-4">
                  <StoryStatusBadge status={story.status} size="sm" />
                  {normalizeStoryStatus(story.status) === "not-approved" && story.rejectionReason && (
                    <p className="mt-1 line-clamp-2 text-xs text-rose-600 dark:text-rose-400">{story.rejectionReason}</p>
                  )}
                </TableCell>

                <TableCell className="px-5 py-4">
                  <div className="relative h-12 w-12 overflow-hidden rounded-xl ring-2 ring-gray-100 transition-all duration-300 group-hover:ring-blue-200 dark:ring-gray-800 dark:group-hover:ring-blue-800">
                    <img
                      src={safeImageSrc(story.imageUrl)}
                      alt={`${story.name}'s story image`}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                      onError={(e) => { e.currentTarget.src = "https://via.placeholder.com/64"; }}
                    />
                  </div>
                </TableCell>

                <TableCell className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/alumni-stories/${story.id}`}
                      aria-label={`View story for ${story.name}`}
                      className="group/btn inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-gray-600 shadow-sm ring-1 ring-gray-200 transition-all duration-200 hover:bg-blue-50 hover:text-blue-600 hover:shadow-md hover:ring-blue-200 active:scale-95 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 dark:hover:ring-blue-800"
                    >
                      <EyeIcon className="h-4 w-4 transition-transform duration-200 group-hover/btn:scale-110" />
                    </Link>

                    {canReview && (normalizeStoryStatus(story.status) === "pending" || normalizeStoryStatus(story.status) === "not-approved") && (
                      <button
                        type="button"
                        onClick={() => {
                          setApproveTargetId(story.id);
                          approveModal.openModal();
                        }}
                        disabled={Boolean(reviewingIds?.has(story.id))}
                        aria-label={`Approve story for ${story.name}`}
                        className="group/btn inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-200 transition-all duration-200 hover:bg-emerald-50 hover:shadow-md active:scale-95 disabled:opacity-50"
                      >
                        <CheckLineIcon className="h-4 w-4" />
                      </button>
                    )}

                    {canReview && (normalizeStoryStatus(story.status) === "pending" || normalizeStoryStatus(story.status) === "approved") && (
                      <button
                        type="button"
                        onClick={() => {
                          setRejectTargetId(story.id);
                          setRejectionReason("");
                          rejectModal.openModal();
                        }}
                        disabled={Boolean(reviewingIds?.has(story.id))}
                        aria-label={`Reject story for ${story.name}`}
                        className="group/btn inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-rose-600 shadow-sm ring-1 ring-rose-200 transition-all duration-200 hover:bg-rose-50 hover:shadow-md active:scale-95 disabled:opacity-50"
                      >
                        <CloseLineIcon className="h-4 w-4" />
                      </button>
                    )}

                    {canDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete?.(story.id)}
                      disabled={Boolean(deletingIds?.has(story.id))}
                      aria-label={`Delete story for ${story.name}`}
                      className="group/btn inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-gray-600 shadow-sm ring-1 ring-gray-200 transition-all duration-200 hover:bg-rose-50 hover:text-rose-600 hover:shadow-md hover:ring-rose-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-rose-900/20 dark:hover:text-rose-400 dark:hover:ring-rose-800"
                    >
                      {deletingIds?.has(story.id) ? (
                        <svg className="h-4 w-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : (
                        <TrashBinIcon className="h-4 w-4 transition-transform duration-200 group-hover/btn:scale-110" />
                      )}
                    </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SyncedTableScroll>

      <div className="flex flex-col gap-4 border-t border-gray-100 bg-gray-50/50 px-6 py-4 dark:border-white/[0.06] dark:bg-gray-800/30 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {(() => {
            const start = (currentPage - 1) * pageSize + 1;
            const end = start + paged.length - 1;
            const total = safeItems.length;
            return (
              <span>
                Showing <span className="font-semibold text-gray-700 dark:text-gray-300">{paged.length ? start : 0}-{paged.length ? end : 0}</span> of <span className="font-semibold text-gray-700 dark:text-gray-300">{total}</span> stories
              </span>
            );
          })()}
        </span>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 dark:text-gray-400" htmlFor="page-size">Show</label>
            <select
              id="page-size"
              className="rounded-xl border-0 bg-white py-2 pl-3 pr-8 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 transition-all hover:ring-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 dark:hover:ring-gray-600"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={(p) => setCurrentPage(Math.max(1, Math.min(totalPages, p)))} />
        </div>
      </div>

      <Modal
        isOpen={approveModal.isOpen}
        onClose={() => {
          approveModal.closeModal();
          setApproveTargetId(null);
        }}
        className="max-w-lg p-6"
      >
        <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Approve Story</h3>
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
          Are you sure you want to approve this success story? It will be published and visible to the alumni
          community.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              approveModal.closeModal();
              setApproveTargetId(null);
            }}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!approveTargetId) return;
              await onApprove?.(approveTargetId);
              approveModal.closeModal();
              setApproveTargetId(null);
            }}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Confirm Approval
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={rejectModal.isOpen}
        onClose={() => {
          rejectModal.closeModal();
          setRejectTargetId(null);
          setRejectionReason("");
        }}
        className="max-w-lg p-6"
      >
        <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Reject Story</h3>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Are you sure you want to reject this story? Please provide a reason so the alumni can revise and resubmit.
        </p>
        <textarea
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          placeholder="Enter rejection reason..."
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={rejectModal.closeModal}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!rejectTargetId || !rejectionReason.trim()) return;
              await onReject?.(rejectTargetId, rejectionReason.trim());
              rejectModal.closeModal();
              setRejectTargetId(null);
              setRejectionReason("");
            }}
            disabled={!rejectionReason.trim()}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            Confirm Rejection
          </button>
        </div>
      </Modal>
    </div>
  );
};

function AlumniPageInner() {
  const [selected, setSelected] = useState<TabKey>("viewStories");
  const [isTabAnimating, setIsTabAnimating] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<StatusTabKey>("all");
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const isSuperAdmin = isSuperAdminUser(session?.user);
  const canReviewStories = canModify(session?.user);
  const statusParam = selectedStatus === "notApproved" ? "not-approved" : selectedStatus;
  const { data: storiesResponse, isLoading, isFetching, isError, error, refetch } = useAlumniStories(
    selectedStatus === "all" ? undefined : statusParam
  );
  const [stories, setStories] = useState<Story[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [reviewingIds, setReviewingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const statusCounts = useMemo(() => {
    const c = storiesResponse?.counts;
    const pending = c?.pending ?? 0;
    const approved = c?.approved ?? 0;
    const notApproved = c?.notApproved ?? 0;
    return { all: pending + approved + notApproved, pending, approved, notApproved };
  }, [storiesResponse?.counts]);

  const filteredStories = useMemo<Story[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return stories;
    try {
      return stories.filter((s) => {
        const fields = [s.title, s.name, s.program, s.session, storyHtmlTextContent(s.shortDescription)].map((v) => String(v || "").toLowerCase());
        return fields.some((f) => f.includes(q));
      });
    } catch {
      return stories;
    }
  }, [stories, searchQuery]);

  useEffect(() => {
    const mapped: Story[] = (storiesResponse?.items ?? []).map((s: AlumniStoryItem) => ({
      id: s.id,
      date: s.date,
      title: s.title,
      name: s.name,
      program: s.program,
      session: s.session,
      shortDescription: s.shortDescription,
      imageUrl: s.imageUrl,
      status: s.status,
      rejectionReason: s.rejectionReason,
    }));
    setStories(mapped);
  }, [storiesResponse?.items]);

  useEffect(() => {
    if (!isLoading && !storiesResponse?.items && !isError) {
      refetch();
    }
  }, [isLoading, storiesResponse?.items, isError, refetch]);

  const handleApprove = async (id: string) => {
    try {
      setReviewingIds((prev) => new Set(prev).add(id));
      const res = await fetch(`/api/alumni-stories/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      if (!res.ok) throw new Error(`Approve failed: ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: alumniStoriesKey, exact: false });
      await queryClient.invalidateQueries({ queryKey: ["alumni-stories-counts"] });
      setToast({ message: "Story approved successfully", type: "success" });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed to approve", type: "error" });
    } finally {
      setReviewingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleReject = async (id: string, reason: string) => {
    try {
      setReviewingIds((prev) => new Set(prev).add(id));
      const res = await fetch(`/api/alumni-stories/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", rejectionReason: reason }),
      });
      if (!res.ok) throw new Error(`Reject failed: ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: alumniStoriesKey, exact: false });
      await queryClient.invalidateQueries({ queryKey: ["alumni-stories-counts"] });
      setToast({ message: "Story rejected", type: "success" });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed to reject", type: "error" });
    } finally {
      setReviewingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const safeSearchParams = searchParams ?? new URLSearchParams();

  useEffect(() => {
    const tab = safeSearchParams.get("tab");
    if (tab === "viewStories" || tab === "addStory") {
      setSelected(tab);
    }
  }, [safeSearchParams]);

  const handleTabChange = (tabKey: TabKey) => {
    if (tabKey === selected) return;
    setIsTabAnimating(true);
    setTimeout(() => {
      setSelected(tabKey);
      const qp = new URLSearchParams(safeSearchParams.toString());
      qp.set("tab", tabKey);
      router.replace(`${pathname}?${qp.toString()}`);
      setTimeout(() => setIsTabAnimating(false), 50);
    }, 150);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950/20">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-lg shadow-blue-600/25">
              <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              Alumni Stories
            </h1>
          </div>
          <p className="mt-2 text-base text-gray-500 dark:text-gray-400 max-w-2xl">
            Celebrate the achievements of our graduates. Browse inspiring stories or share a new success story with our community.
          </p>
        </div>

        <ComponentCard className="border-0 bg-white/70 shadow-2xl shadow-gray-200/50 backdrop-blur-xl dark:bg-gray-900/70 dark:shadow-none dark:ring-1 dark:ring-white/[0.08]">
          {/* Modern Tab Navigation */}
          <div className="mb-8">
            <div className="flex flex-wrap gap-2 p-1.5 bg-gray-100/80 rounded-2xl dark:bg-gray-800/50 w-fit">
              {TABS.map((tab, idx) => (
                <button
                  key={tab.key}
                  className={`relative flex items-center gap-2.5 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-300 ${
                    selected === tab.key
                      ? "bg-white text-blue-700 shadow-lg shadow-blue-900/10 dark:bg-gray-700 dark:text-blue-400 dark:shadow-none"
                      : "text-gray-600 hover:text-gray-900 hover:bg-white/50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700/50"
                  }`}
                  onClick={() => handleTabChange(tab.key)}
                  role="tab"
                  aria-selected={selected === tab.key}
                  tabIndex={selected === tab.key ? 0 : -1}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight") {
                      e.preventDefault();
                      const nextIdx = (idx + 1) % TABS.length;
                      handleTabChange(TABS[nextIdx].key);
                    } else if (e.key === "ArrowLeft") {
                      e.preventDefault();
                      const prevIdx = (idx - 1 + TABS.length) % TABS.length;
                      handleTabChange(TABS[prevIdx].key);
                    }
                  }}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                  </svg>
                  {tab.label}
                  {selected === tab.key && (
                    <span className="absolute inset-0 rounded-xl ring-2 ring-blue-500/20 dark:ring-blue-400/20" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className={`transition-all duration-300 ${isTabAnimating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
            {selected === "viewStories" && (
              <div className="space-y-6">
                {/* Search and Actions Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-md">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      id="stories-search"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name, program, session..."
                      className="w-full rounded-2xl border-0 bg-gray-100 py-3 pl-11 pr-4 text-sm font-medium text-gray-900 shadow-inner transition-all duration-200 placeholder:text-gray-400 focus:bg-white focus:shadow-lg focus:shadow-gray-200/50 focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500 dark:focus:bg-gray-800 dark:focus:shadow-none dark:focus:ring-blue-600"
                      aria-label="Search stories by name, program, session, or description"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => {
                      queryClient.invalidateQueries({ queryKey: alumniStoriesKey });
                      refetch();
                    }}
                    disabled={isFetching}
                    className="group inline-flex items-center gap-2.5 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200 transition-all duration-200 hover:bg-gray-50 hover:shadow-md hover:ring-gray-300 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-gray-700 dark:hover:ring-gray-600"
                    aria-label="Refresh stories list"
                  >
                    <svg className={`h-4 w-4 transition-transform duration-500 ${isFetching ? 'animate-spin' : 'group-hover:rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {isFetching ? "Syncing..." : "Refresh"}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {STATUS_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setSelectedStatus(tab.key)}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                        selectedStatus === tab.key
                          ? "bg-blue-600 text-white shadow-md"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                      }`}
                    >
                      {tab.label}
                      <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                        {statusCounts[tab.key]}
                      </span>
                    </button>
                  ))}
                </div>

                <StoryTable
                  items={filteredStories}
                  loading={isLoading}
                  isFetching={isFetching}
                  errorMessage={isError ? (error?.message ?? "Failed to load data.") : null}
                  emptyMessage="No stories available"
                  deletingIds={deletingIds}
                  reviewingIds={reviewingIds}
                  canDelete={isSuperAdmin}
                  canReview={canReviewStories}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onDelete={async (id: string) => {
                    try {
                      setDeletingIds((prev) => new Set(prev).add(id));
                      const res = await fetch(`/api/alumni-stories/${id}`, { method: "DELETE" });
                      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
                      await queryClient.invalidateQueries({ queryKey: alumniStoriesKey, exact: false });
                      await queryClient.refetchQueries({ queryKey: alumniStoriesKey, exact: false });
                      setToast({ message: "Story deleted successfully", type: "success" });
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : "Failed to delete. Please try again.";
                      setToast({ message: msg, type: "error" });
                    } finally {
                      setDeletingIds((prev) => {
                        const next = new Set(prev);
                        next.delete(id);
                        return next;
                      });
                    }
                  }}
                />
              </div>
            )}

            {selected === "addStory" && (
              <div className="animate-fade-in-up">
                <div className="rounded-3xl border border-dashed border-gray-300/80 bg-gradient-to-b from-white to-gray-50/50 p-2 dark:border-white/[0.08] dark:from-gray-900 dark:to-gray-900/50">
                  <div className="rounded-2xl bg-white/80 p-8 shadow-sm dark:bg-gray-800/50">
                    <div className="mb-8">
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Share an Alumni Story</h2>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Fill in the details below to add a new inspiring story to our collection.</p>
                    </div>
                    <AlumniSuccessForm
                      mode="admin"
                      onSuccess={() => setToast({ message: "Story published successfully!", type: "success" })}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ComponentCard>
      </div>
    </div>
  );
}

function safeImageSrc(input?: string): string {
  const u = String(input || "").trim();
  if (!u || u === "null") return "https://via.placeholder.com/64";
  try {
    if (/^https?:\/\//i.test(u)) {
      const parsed = new URL(u);
      if (parsed.protocol === "http:") parsed.protocol = "https:";
      return parsed.toString();
    }
    if (u.startsWith('/')) return u;
    return `/images/${u}`;
  } catch {
    return "https://via.placeholder.com/64";
  }
}

export default function AlumniPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600 dark:border-blue-900 dark:border-t-blue-400" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    }>
      <AlumniPageInner />
    </Suspense>
  );
}
