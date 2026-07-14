"use client";
import React from "react";
import { Modal } from "@/components/ui/modal";

export type StoryCriterion = {
  id: number;
  label: string;
  description: string | null;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
};

export type StoryCriteriaDraft = {
  id?: number;
  label: string;
  description: string;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
};

type Props = {
  items: StoryCriterion[];
  loading: boolean;
  draft: StoryCriteriaDraft;
  setDraft: React.Dispatch<React.SetStateAction<StoryCriteriaDraft>>;
  editingId: number | null;
  setEditingId: React.Dispatch<React.SetStateAction<number | null>>;
  onCreate: (draft: StoryCriteriaDraft) => Promise<unknown>;
  onUpdate: (id: number, draft: StoryCriteriaDraft) => Promise<unknown>;
  onDelete: (id: number) => Promise<unknown>;
  pushToast: (type: "success" | "error", message: string) => void;
};

export default function StoriesCriteriaManager({
  items,
  loading,
  draft,
  setDraft,
  editingId,
  setEditingId,
  onCreate,
  onUpdate,
  onDelete,
  pushToast,
}: Props) {
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [criterionToDelete, setCriterionToDelete] = React.useState<{ id: number; label: string } | null>(null);
  const [processing, setProcessing] = React.useState(false);

  const sortedItems = React.useMemo(() => {
    return [...items].sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
  }, [items]);

  const resetDraft = React.useCallback(() => {
    setDraft({ label: "", description: "", isRequired: true, isActive: true, sortOrder: 0 });
    setEditingId(null);
  }, [setDraft, setEditingId]);

  const handleSave = async () => {
    const label = draft.label.trim();
    if (!label) {
      pushToast("error", "Question/label is required");
      return;
    }
    if (!/\?\s*$/.test(label) && !label.toLowerCase().includes("achievements")) {
      // Allow anything, just warn
    }

    setProcessing(true);
    try {
      if (editingId) {
        await onUpdate(editingId, draft);
        pushToast("success", "Criterion updated");
      } else {
        await onCreate(draft);
        pushToast("success", "Criterion created");
      }
      resetDraft();
    } catch (e) {
      pushToast("error", e instanceof Error ? e.message : "Failed to save criterion");
    } finally {
      setProcessing(false);
    }
  };

  const startEdit = (c: StoryCriterion) => {
    setEditingId(c.id);
    setDraft({
      id: c.id,
      label: c.label,
      description: c.description ?? "",
      isRequired: c.is_required,
      isActive: c.is_active,
      sortOrder: c.sort_order,
    });
  };

  const confirmDelete = (c: StoryCriterion) => {
    setCriterionToDelete({ id: c.id, label: c.label });
    setDeleteOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/50 p-4 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {editingId ? "Edit Criterion" : "Add Criterion"}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Each criterion appears as a one-line question on the success story submission form.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Question / Label *</label>
            <input
              value={draft.label}
              onChange={(e) => setDraft((p) => ({ ...p, label: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              placeholder="e.g., What makes your story unique?"
              disabled={processing}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Description / Help text</label>
            <input
              value={draft.description}
              onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              placeholder="Optional hint shown below the question"
              disabled={processing}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Sort Order</label>
            <input
              type="number"
              value={draft.sortOrder}
              onChange={(e) => setDraft((p) => ({ ...p, sortOrder: Number(e.target.value) }))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              disabled={processing}
            />
          </div>
          <div className="flex flex-wrap items-center gap-6 md:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.isRequired}
                onChange={(e) => setDraft((p) => ({ ...p, isRequired: e.target.checked }))}
                className="h-4 w-4 text-blue-600 rounded border-gray-300"
                disabled={processing}
              />
              Required
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(e) => setDraft((p) => ({ ...p, isActive: e.target.checked }))}
                className="h-4 w-4 text-blue-600 rounded border-gray-300"
                disabled={processing}
              />
              Active
            </label>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          {editingId ? (
            <button
              type="button"
              onClick={resetDraft}
              disabled={processing}
              className="rounded-lg px-4 py-2 text-sm font-semibold bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 disabled:opacity-60"
            >
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleSave}
            disabled={processing}
            className="rounded-lg px-4 py-2 text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {processing ? "Saving..." : editingId ? "Save" : "Add"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/50 overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Active Criteria</h3>
        </div>
        <div className="p-4 max-h-[420px] overflow-y-auto">
          {loading ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">Loading criteria...</p>
          ) : sortedItems.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">No criteria configured yet.</p>
          ) : (
            <div className="space-y-2">
              {sortedItems.map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{c.label}</div>
                        {c.is_required ? (
                          <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:border-rose-800/50 dark:bg-rose-900/20 dark:text-rose-300">
                            Required
                          </span>
                        ) : (
                          <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            Optional
                          </span>
                        )}
                        {!c.is_active ? (
                          <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                            Inactive
                          </span>
                        ) : null}
                      </div>
                      {c.description ? (
                        <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">{c.description}</div>
                      ) : null}
                      <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">Sort: {c.sort_order}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        disabled={processing}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmDelete(c)}
                        disabled={processing}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={deleteOpen}
        onClose={() => {
          if (processing) return;
          setDeleteOpen(false);
          setCriterionToDelete(null);
        }}
        className="max-w-[520px] w-[92vw] p-0"
        showCloseButton={!processing}
      >
        <div className="p-6">
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delete criterion?</div>
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {criterionToDelete?.label ? (
              <>
                You are about to delete{" "}
                <span className="font-semibold text-gray-900 dark:text-gray-100">{criterionToDelete.label}</span>.
                This action cannot be undone.
              </>
            ) : (
              "This action cannot be undone."
            )}
          </div>
          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={processing}
              onClick={() => {
                if (processing) return;
                setDeleteOpen(false);
                setCriterionToDelete(null);
              }}
              className="rounded-lg px-4 py-2 text-sm font-semibold border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={processing || !criterionToDelete}
              onClick={async () => {
                if (!criterionToDelete) return;
                setProcessing(true);
                try {
                  await onDelete(criterionToDelete.id);
                  pushToast("success", "Criterion deleted");
                  setDeleteOpen(false);
                  setCriterionToDelete(null);
                } catch (e) {
                  pushToast("error", e instanceof Error ? e.message : "Failed to delete");
                } finally {
                  setProcessing(false);
                }
              }}
              className="rounded-lg px-4 py-2 text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {processing ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
