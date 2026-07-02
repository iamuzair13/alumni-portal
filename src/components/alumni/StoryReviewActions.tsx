"use client";

import React, { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import { CheckLineIcon, CloseLineIcon } from "@/icons";
import StoryStatusBadge from "@/components/alumni/StoryStatusBadge";
import { alumniStoriesKey } from "@/app/queries/fetch-alumni-stories";
import { normalizeStoryStatus } from "@/lib/alumniStories";

type Props = {
  storyId: string;
  status: string;
  rejectionReason?: string | null;
  onReviewed?: () => void;
  variant?: "bar" | "inline";
};

export default function StoryReviewActions({
  storyId,
  status,
  rejectionReason,
  onReviewed,
  variant = "bar",
}: Props) {
  const queryClient = useQueryClient();
  const rejectModal = useModal();
  const [rejectionText, setRejectionText] = useState("");
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);

  const normalized = normalizeStoryStatus(status);
  const isPending = normalized === "pending";
  const isRejected = normalized === "not-approved";

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: alumniStoriesKey });
    await queryClient.invalidateQueries({ queryKey: ["alumni-stories-counts"] });
    onReviewed?.();
  }, [queryClient, onReviewed]);

  const handleApprove = useCallback(async () => {
    setLoading("approve");
    try {
      const res = await fetch(`/api/alumni-stories/${encodeURIComponent(storyId)}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || "Failed to approve story");
      }
      toast.success("Story approved and published.");
      await invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve story");
    } finally {
      setLoading(null);
    }
  }, [storyId, invalidate]);

  const handleReject = useCallback(async () => {
    const reason = rejectionText.trim();
    if (!reason) {
      toast.error("Please provide a rejection reason.");
      return;
    }
    setLoading("reject");
    try {
      const res = await fetch(`/api/alumni-stories/${encodeURIComponent(storyId)}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ action: "reject", rejectionReason: reason }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || "Failed to reject story");
      }
      toast.success("Story marked as not approved.");
      rejectModal.closeModal();
      setRejectionText("");
      await invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject story");
    } finally {
      setLoading(null);
    }
  }, [storyId, rejectionText, rejectModal, invalidate]);

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {(isPending || isRejected) && (
        <button
          type="button"
          onClick={handleApprove}
          disabled={loading !== null}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <CheckLineIcon className="h-4 w-4" />
          {loading === "approve" ? "Approving..." : "Approve"}
        </button>
      )}
      {(isPending || normalized === "approved") && (
        <button
          type="button"
          onClick={() => rejectModal.openModal()}
          disabled={loading !== null}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-50 dark:bg-gray-800 dark:text-rose-300 dark:ring-rose-800"
        >
          <CloseLineIcon className="h-4 w-4" />
          Reject
        </button>
      )}
    </div>
  );

  if (variant === "inline") {
    return (
      <>
        {actions}
        <Modal isOpen={rejectModal.isOpen} onClose={rejectModal.closeModal} className="max-w-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Reject Story</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Please provide a reason so the alumni can revise and resubmit.
          </p>
          <textarea
            value={rejectionText}
            onChange={(e) => setRejectionText(e.target.value)}
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
              onClick={handleReject}
              disabled={loading === "reject"}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {loading === "reject" ? "Rejecting..." : "Confirm Rejection"}
            </button>
          </div>
        </Modal>
      </>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-800/50">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Review Status</span>
              <StoryStatusBadge status={status} />
            </div>
            {isRejected && rejectionReason && (
              <p className="text-sm text-rose-700 dark:text-rose-300">
                <span className="font-medium">Rejection reason:</span> {rejectionReason}
              </p>
            )}
          </div>
          {actions}
        </div>
      </div>

      <Modal isOpen={rejectModal.isOpen} onClose={rejectModal.closeModal} className="max-w-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Reject Story</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Please provide a reason so the alumni can revise and resubmit.
        </p>
        <textarea
          value={rejectionText}
          onChange={(e) => setRejectionText(e.target.value)}
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
            onClick={handleReject}
            disabled={loading === "reject"}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {loading === "reject" ? "Rejecting..." : "Confirm Rejection"}
          </button>
        </div>
      </Modal>
    </>
  );
}
