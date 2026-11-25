"use client";
/* eslint-disable @next/next/no-img-element */

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import ComponentCard from "@/components/common/ComponentCard";
import Pagination from "@/components/tables/Pagination";
import { EyeIcon, TrashBinIcon, CheckLineIcon, CloseLineIcon, PencilIcon } from "@/icons";
import { useQueryClient } from "@tanstack/react-query";
import { useAlumniStories, alumniStoriesKey, type AlumniStoryItem } from "@/app/queries/fetch-alumni-stories";
import AlumniSuccessForm from "@/components/forms/alumni-success";
import { canModify, isSuperAdminUser } from "@/lib/alumniProfile";
import { storyHtmlTextContent } from "@/lib/sanitizeStoryHtml";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import { normalizeStoryStatus } from "@/lib/alumniStories";
import { StoryActionEmailBlock } from "@/components/alumni/StoryActionEmailBlock";

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
  alumniId?: number;
  email?: string | null;
};

type StatusTabKey = "all" | "pending" | "approved" | "notApproved";

const STATUS_TABS: { key: StatusTabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Awaiting review" },
  { key: "approved", label: "Published" },
  { key: "notApproved", label: "Returned" },
];

// Tabs typing
type TabKey = "viewStories" | "addStory";

const TABS: { key: TabKey; label: string }[] = [
  { key: "viewStories", label: "Review desk" },
  { key: "addStory", label: "Add story" },
];

function submittedLabel(input: string | Date): string {
  try {
    const d = typeof input === "string" ? new Date(input) : input;
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

// Toast notification component
const Toast: React.FC<{ message: string; type: "success" | "error"; onClose: () => void }> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-6 right-6 z-50">
      <div className={`flex items-center gap-3 rounded-xl px-5 py-4 shadow-xl border ${
        type === "success"
          ? "bg-white border-emerald-200 text-emerald-800 dark:bg-gray-900 dark:border-emerald-800 dark:text-emerald-200"
          : "bg-white border-rose-200 text-rose-800 dark:bg-gray-900 dark:border-rose-800 dark:text-rose-200"
      }`}>
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-2 rounded-lg p-1 hover:bg-black/5 dark:hover:bg-white/10 transition-colors" aria-label="Dismiss">
          <svg className="h-4 w-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

const STORY_ACTIONS_MENU_WIDTH = 256;
const STORY_ACTIONS_MENU_MAX_HEIGHT = 360;

function StoryActionsDropdown({
  story,
  isOpen,
  onToggle,
  onClose,
  canReview,
  canDelete,
  isProcessing,
  onView,
  onEdit,
  onApprove,
  onReject,
  onDelete,
}: {
  story: Story;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  canReview: boolean;
  canDelete: boolean;
  isProcessing: boolean;
  onView: (story: Story) => void;
  onEdit: (story: Story) => void;
  onApprove: (story: Story) => void;
  onReject: (story: Story) => void;
  onDelete: (story: Story) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; maxHeight: number } | null>(null);

  const updateMenuPosition = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 8;
    const top = rect.bottom + gap;
    let left = rect.right - STORY_ACTIONS_MENU_WIDTH;
    if (left < 8) left = 8;
    if (left + STORY_ACTIONS_MENU_WIDTH > window.innerWidth - 8) {
      left = window.innerWidth - STORY_ACTIONS_MENU_WIDTH - 8;
    }
    const spaceBelow = window.innerHeight - top - 8;
    const maxHeight = Math.max(160, Math.min(STORY_ACTIONS_MENU_MAX_HEIGHT, spaceBelow));
    setMenuPosition({ top, left, maxHeight });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();
    const handleReposition = () => updateMenuPosition();
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isOpen, updateMenuPosition]);

  const normalized = normalizeStoryStatus(story.status);
  const canApprove = canReview && (normalized === "pending" || normalized === "not-approved");
  const canReject = canReview && (normalized === "pending" || normalized === "approved");

  const menu =
    isOpen && menuPosition && typeof document !== "undefined"
      ? createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" aria-hidden="true" onClick={onClose} />
            <div
              role="menu"
              className="fixed z-[9999] w-60 origin-top-right overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl py-1.5"
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
                maxHeight: menuPosition.maxHeight,
              }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onView(story);
                  onClose();
                }}
                className="group w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
              >
                <EyeIcon className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                Read story
              </button>

              {canReview && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onEdit(story);
                    onClose();
                  }}
                  className="group w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                >
                  <PencilIcon className="h-4 w-4 shrink-0 text-gray-400 group-hover:text-gray-600" />
                  Edit story
                </button>
              )}

              {canApprove && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onApprove(story);
                    onClose();
                  }}
                  className="group w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                >
                  <CheckLineIcon className="h-4 w-4 shrink-0 text-emerald-500" />
                  <span className="group-hover:text-emerald-700 dark:group-hover:text-emerald-300">Publish</span>
                </button>
              )}
              {canReject && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onReject(story);
                    onClose();
                  }}
                  className="group w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                >
                  <CloseLineIcon className="h-4 w-4 shrink-0 text-amber-500" />
                  <span className="group-hover:text-amber-700 dark:group-hover:text-amber-300">Return to author</span>
                </button>
              )}

              {canDelete && (
                <>
                  <div className="my-1.5 mx-3 border-t border-gray-100 dark:border-gray-800" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onDelete(story);
                      onClose();
                    }}
                    className="group w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <TrashBinIcon className="h-4 w-4" />
                    Delete
                  </button>
                </>
              )}
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <div className="relative ml-auto shrink-0">
      <button
        ref={buttonRef}
        type="button"
        disabled={isProcessing}
        onClick={() => {
          if (!isOpen) updateMenuPosition();
          onToggle();
        }}
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          isProcessing
            ? "text-gray-400 cursor-not-allowed"
            : "text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        }`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Actions for ${story.name}`}
      >
        {isProcessing ? (
          <span>Working…</span>
        ) : (
          <>
            <span>More</span>
            <svg
              className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>
      {menu}
    </div>
  );
}

/** Editorial status stamp — desk vocabulary, not database vocabulary. */
function StatusStamp({ status }: { status: string }) {
  const n = normalizeStoryStatus(status);
  const meta =
    n === "approved"
      ? { label: "Published", cls: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800" }
      : n === "not-approved"
        ? { label: "Returned to author", cls: "text-gray-600 bg-gray-100 border-gray-300 dark:text-gray-300 dark:bg-gray-800 dark:border-gray-600" }
        : { label: "Awaiting review", cls: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-800" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium ${meta.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

const StoryProofSkeleton: React.FC = () => (
  <div className="flex gap-5 border-b border-gray-100 py-6 last:border-0 dark:border-gray-800">
    <div className="aspect-[4/3] w-32 shrink-0 animate-pulse rounded-md bg-gray-100 sm:w-44 dark:bg-gray-800" />
    <div className="flex-1 space-y-2.5 pt-1">
      <div className="h-4 w-24 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
      <div className="h-6 w-2/3 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
      <div className="h-3 w-full animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
      <div className="h-3 w-4/5 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
    </div>
  </div>
);

// Editorial review desk — one proof sheet per story
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

const StoryDesk: React.FC<StoryListProps> = ({
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
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const rejectModal = useModal();
  const approveModal = useModal();
  const deleteModal = useModal();
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [approveTargetId, setApproveTargetId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
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
  const deleteTargetStory = deleteTargetId
    ? safeItems.find((story) => story.id === deleteTargetId)
    : undefined;
  const approveTargetStory = approveTargetId
    ? safeItems.find((story) => story.id === approveTargetId)
    : undefined;
  const rejectTargetStory = rejectTargetId
    ? safeItems.find((story) => story.id === rejectTargetId)
    : undefined;

  return (
    <div>
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        {(loading || isFetching) && (
          <div className="px-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <StoryProofSkeleton key={`skeleton-${i}`} />
            ))}
          </div>
        )}

        {!loading && !!errorMessage && (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{errorMessage}</p>
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !errorMessage && paged.length === 0 && (
          <div className="px-6 py-16 text-center">
            <p className="font-serif text-lg text-gray-700 dark:text-gray-200">{emptyMessage || "Nothing on the desk"}</p>
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
              Stories arrive here when alumni submit them for review.
            </p>
          </div>
        )}

        {!loading && !errorMessage && paged.map((story) => {
          const normalized = normalizeStoryStatus(story.status);
          const isPending = normalized === "pending";
          const isProcessing = Boolean(reviewingIds?.has(story.id) || deletingIds?.has(story.id));
          const byline = [story.program, story.session].filter(Boolean).join(" · ");
          const submitted = submittedLabel(story.date);
          const excerpt = storyHtmlTextContent(story.shortDescription);

          return (
            <article
              key={story.id}
              className={`flex flex-col gap-4 border-b border-gray-100 px-6 py-6 last:border-0 sm:flex-row sm:gap-5 dark:border-gray-800 ${isProcessing ? "opacity-60" : ""}`}
            >
              {/* Cover — the story's image is content, not a thumbnail */}
              <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-md bg-gray-100 sm:w-44 dark:bg-gray-800">
                <img
                  src={safeImageSrc(story.imageUrl)}
                  alt={story.title ? `Cover image for “${story.title}”` : `${story.name}'s story image`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={(e) => { e.currentTarget.src = "https://via.placeholder.com/176x132"; }}
                />
              </div>

              {/* Proof body */}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <StatusStamp status={story.status} />
                    <h3 className="mt-1.5 font-serif text-xl font-semibold leading-snug text-gray-900 dark:text-gray-50">
                      {story.title || "Untitled story"}
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      By <span className="font-medium text-gray-700 dark:text-gray-300">{story.name || "—"}</span>
                      {byline ? ` · ${byline}` : ""}
                    </p>
                  </div>
                  <StoryActionsDropdown
                    story={story}
                    isOpen={openActionMenuId === story.id}
                    onToggle={() => setOpenActionMenuId(openActionMenuId === story.id ? null : story.id)}
                    onClose={() => setOpenActionMenuId(null)}
                    canReview={canReview}
                    canDelete={canDelete}
                    isProcessing={isProcessing}
                    onView={(s) => router.push(`/alumni-stories/${s.id}`)}
                    onEdit={(s) => router.push(`/alumni-stories/${s.id}/edit`)}
                    onApprove={(s) => {
                      setApproveTargetId(s.id);
                      approveModal.openModal();
                    }}
                    onReject={(s) => {
                      setRejectTargetId(s.id);
                      setRejectionReason("");
                      rejectModal.openModal();
                    }}
                    onDelete={(s) => {
                      setDeleteTargetId(s.id);
                      deleteModal.openModal();
                    }}
                  />
                </div>

                <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  {excerpt.slice(0, 280) || "No excerpt provided."}
                </p>

                {normalized === "not-approved" && story.rejectionReason ? (
                  <p className="mt-2 border-l-2 border-amber-300 pl-3 text-xs text-gray-500 dark:border-amber-700 dark:text-gray-400">
                    <span className="font-medium text-amber-700 dark:text-amber-400">Returned:</span> {story.rejectionReason}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {submitted ? (
                    <span className="text-xs text-gray-400 dark:text-gray-500">Submitted {submitted}</span>
                  ) : null}
                  {isPending && canReview ? (
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => {
                          setApproveTargetId(story.id);
                          approveModal.openModal();
                        }}
                        className="rounded-md bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      >
                        Publish
                      </button>
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => {
                          setRejectTargetId(story.id);
                          setRejectionReason("");
                          rejectModal.openModal();
                        }}
                        className="rounded-md border border-gray-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        Return to author
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Footer */}
      {!loading && !errorMessage && safeItems.length > 0 ? (
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Showing {paged.length ? startIdx + 1 : 0}–{paged.length ? startIdx + paged.length : 0} of {safeItems.length} stories
          </span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500 dark:text-gray-400" htmlFor="page-size">Show</label>
              <select
                id="page-size"
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
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
      ) : null}

      <Modal
        isOpen={approveModal.isOpen}
        onClose={() => {
          approveModal.closeModal();
          setApproveTargetId(null);
        }}
        className="max-w-lg p-6"
      >
        <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Publish story</h3>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Publishing makes this story visible to the alumni community.
          {approveTargetStory ? (
            <> <span className="font-medium text-gray-900 dark:text-white">“{approveTargetStory.title || approveTargetStory.name}”</span></>
          ) : null}
        </p>
        {approveTargetStory && (
          <StoryActionEmailBlock
            action="approve"
            storyId={approveTargetStory.id}
            storyTitle={approveTargetStory.title}
            alumniName={approveTargetStory.name}
            alumniId={approveTargetStory.alumniId}
            recipientEmail={approveTargetStory.email}
            disabled={Boolean(approveTargetStory && reviewingIds?.has(approveTargetStory.id))}
          />
        )}
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
            Publish
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
        <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Return story to author</h3>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Tell the author what to change. They can revise and resubmit.
        </p>
        <textarea
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          placeholder="What needs revising?"
        />
        {rejectTargetStory && (
          <StoryActionEmailBlock
            action="reject"
            storyId={rejectTargetStory.id}
            storyTitle={rejectTargetStory.title}
            alumniName={rejectTargetStory.name}
            alumniId={rejectTargetStory.alumniId}
            recipientEmail={rejectTargetStory.email}
            rejectionReason={rejectionReason}
            disabled={Boolean(rejectTargetStory && (reviewingIds?.has(rejectTargetStory.id) || !rejectionReason.trim()))}
          />
        )}
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
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            Return to author
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => {
          deleteModal.closeModal();
          setDeleteTargetId(null);
        }}
        className="max-w-lg p-6"
      >
        <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Delete Story</h3>
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
          Are you sure you want to permanently delete
          {deleteTargetStory ? (
            <>
              {" "}
              <span className="font-medium text-gray-900 dark:text-white">
                {deleteTargetStory.title || deleteTargetStory.name}
              </span>
            </>
          ) : (
            " this story"
          )}
          ? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              deleteModal.closeModal();
              setDeleteTargetId(null);
            }}
            disabled={Boolean(deleteTargetId && deletingIds?.has(deleteTargetId))}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!deleteTargetId) return;
              await onDelete?.(deleteTargetId);
              deleteModal.closeModal();
              setDeleteTargetId(null);
            }}
            disabled={Boolean(deleteTargetId && deletingIds?.has(deleteTargetId))}
            className="rounded-lg bg-error-600 px-4 py-2 text-sm font-medium text-white hover:bg-error-700 disabled:opacity-50"
          >
            {deleteTargetId && deletingIds?.has(deleteTargetId) ? "Deleting..." : "Confirm Delete"}
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
      alumniId: s.alumniId,
      email: s.email,
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
      setToast({ message: "Story published", type: "success" });
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
      setToast({ message: "Story returned to author", type: "success" });
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Masthead */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b-2 border-gray-900 pb-5 dark:border-gray-100">
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              Alumni Stories
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Review submissions and publish success stories for the community.
            </p>
          </div>
          <div className="flex items-center gap-2" role="tablist" aria-label="Story sections">
            {TABS.map((tab, idx) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={selected === tab.key}
                tabIndex={selected === tab.key ? 0 : -1}
                onClick={() => handleTabChange(tab.key)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight") {
                    e.preventDefault();
                    handleTabChange(TABS[(idx + 1) % TABS.length].key);
                  } else if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    handleTabChange(TABS[(idx - 1 + TABS.length) % TABS.length].key);
                  }
                }}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 ${
                  selected === tab.key
                    ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                    : "text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className={`transition-all duration-300 ${isTabAnimating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}>
          {selected === "viewStories" && (
            <div className="space-y-5">
              {/* Desk toolbar */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by status">
                  {STATUS_TABS.map((tab) => {
                    const active = selectedStatus === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setSelectedStatus(tab.key)}
                        aria-pressed={active}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                          active
                            ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900"
                            : "border-gray-300 bg-white text-gray-600 hover:border-gray-400 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:text-gray-100"
                        }`}
                      >
                        {tab.label}
                        <span className={`tabular-nums ${active ? "opacity-70" : "text-gray-400 dark:text-gray-500"}`}>
                          {statusCounts[tab.key]}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      id="stories-search"
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search title, author, program…"
                      className="w-56 rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
                      aria-label="Search stories by title, author, or program"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        aria-label="Clear search"
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
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    aria-label="Refresh stories list"
                  >
                    <svg className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {isFetching ? "Syncing" : "Refresh"}
                  </button>
                </div>
              </div>

              <StoryDesk
                items={filteredStories}
                loading={isLoading}
                isFetching={isFetching}
                errorMessage={isError ? (error?.message ?? "Failed to load data.") : null}
                emptyMessage="Nothing on the desk"
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
                    setToast({ message: "Story deleted", type: "success" });
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
            <ComponentCard className="bg-white dark:bg-gray-900">
              <div className="p-2">
                <div className="mb-6">
                  <h2 className="font-serif text-2xl font-bold text-gray-900 dark:text-white">Share an Alumni Story</h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Fill in the details below to add a new story to the collection.</p>
                </div>
                <AlumniSuccessForm
                  mode="admin"
                  onSuccess={() => setToast({ message: "Story published", type: "success" })}
                />
              </div>
            </ComponentCard>
          )}
        </div>
      </div>
    </div>
  );
}

function safeImageSrc(input?: string): string {
  const u = String(input || "").trim();
  if (!u || u === "null") return "https://via.placeholder.com/176x132";
  try {
    if (/^https?:\/\//i.test(u)) {
      const parsed = new URL(u);
      if (parsed.protocol === "http:") parsed.protocol = "https:";
      return parsed.toString();
    }
    if (u.startsWith('/')) return u;
    return `/images/${u}`;
  } catch {
    return "https://via.placeholder.com/176x132";
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
