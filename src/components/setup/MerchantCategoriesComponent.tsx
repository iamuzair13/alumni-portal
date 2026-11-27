"use client";

import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { PencilIcon, TrashBinIcon } from "@/icons";
import toast from "react-hot-toast";
import type { MerchantCategory } from "@/app/api/merchant-categories/route";
import {
  DEFAULT_CATEGORY_COLOR,
  MERCHANT_CATEGORY_PALETTE,
  MerchantCategoryChip,
} from "@/components/common/MerchantCategoryChip";
import {
  MERCHANT_CATEGORIES_QUERY_KEY,
  createMerchantCategory,
  deleteMerchantCategory,
  fetchMerchantCategories,
  updateMerchantCategory,
} from "@/components/setup/merchantCategoryApi";
import { slugifyCategoryName } from "@/lib/merchantCategorySlug";

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

type CategoryFormDraft = { name: string; color: string };
const EMPTY_DRAFT: CategoryFormDraft = { name: "", color: DEFAULT_CATEGORY_COLOR };

function CategoryForm({
  mode,
  initial,
  onCancel,
  onSubmit,
  saving,
}: {
  mode: "add" | "edit";
  initial?: CategoryFormDraft;
  onCancel: () => void;
  onSubmit: (draft: CategoryFormDraft) => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState<CategoryFormDraft>(initial ?? EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);

  const slugPreview = draft.name.trim() ? slugifyCategoryName(draft.name) : "";

  const handleSubmit = () => {
    const name = draft.name.trim();
    if (name.length < 2) {
      setError("Category name must be at least 2 characters");
      return;
    }
    if (name.length > 100) {
      setError("Category name must be 100 characters or fewer");
      return;
    }
    onSubmit({ name, color: draft.color });
  };

  return (
    <div>
      <div className="space-y-5">
        <div>
          <Label>Category Name <span className="text-red-500">*</span></Label>
          <Input
            value={draft.name}
            onChange={(e) => {
              setDraft((d) => ({ ...d, name: e.target.value }));
              setError(null);
            }}
            placeholder="e.g., Food & Dining, Entertainment, Fitness"
            disabled={saving}
            maxLength={100}
          />
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
          {!error && slugPreview && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              External API slug: <span className="font-mono">{slugPreview}</span>
            </p>
          )}
        </div>

        <div>
          <Label>Chip Color</Label>
          <p className="mb-2.5 text-xs text-gray-500 dark:text-gray-400">
            Used for the category label in the portal and on the external website.
          </p>
          <div className="flex flex-wrap gap-2">
            {MERCHANT_CATEGORY_PALETTE.map((swatch) => {
              const selected = draft.color === swatch.hex;
              return (
                <button
                  key={swatch.hex}
                  type="button"
                  title={swatch.label}
                  aria-label={`${swatch.label} ${swatch.hex}`}
                  aria-pressed={selected}
                  disabled={saving}
                  onClick={() => setDraft((d) => ({ ...d, color: swatch.hex }))}
                  className={`h-9 w-9 rounded-full border-2 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent-500 dark:focus-visible:ring-offset-gray-900 ${
                    selected ? "scale-110 border-gray-900 dark:border-white" : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: swatch.hex }}
                >
                  {selected && (
                    <svg className="mx-auto h-4 w-4 text-white drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label>Preview</Label>
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/60">
            <MerchantCategoryChip
              category={{ name: draft.name.trim() || "Category name", color: draft.color }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={saving}>
          {saving ? "Saving..." : mode === "add" ? "Save Category" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

export default function MerchantCategoriesComponent({
  canModify,
}: {
  canModify: boolean;
}) {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MerchantCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MerchantCategory | null>(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: MERCHANT_CATEGORIES_QUERY_KEY,
    queryFn: fetchMerchantCategories,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: MERCHANT_CATEGORIES_QUERY_KEY }).then(() => {
      // Merchant rows embed their categories — keep both views fresh.
      queryClient.invalidateQueries({ queryKey: ["merchants"] });
      queryClient.invalidateQueries({ queryKey: ["merchants-public"] });
    });

  const createMutation = useMutation({
    mutationFn: createMerchantCategory,
    onSuccess: () => {
      invalidate();
      setAddOpen(false);
      toast.success("Category created");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, draft }: { id: number; draft: CategoryFormDraft }) =>
      updateMerchantCategory(id, draft),
    onSuccess: () => {
      invalidate();
      setEditTarget(null);
      toast.success("Category updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteMerchantCategory(id),
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast.success("Category deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    return categories.filter(
      (c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)
    );
  }, [categories, search]);

  const openAdd = () => setAddOpen(true);

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white py-2 pl-9 pr-8 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-accent-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {filtered.length} of {categories.length} {categories.length === 1 ? "category" : "categories"}
        </p>
        {canModify && (
          <Button size="sm" onClick={openAdd} className="whitespace-nowrap">
            + Add Category
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-gray-300 dark:border-gray-700 rounded-2xl">
          <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5.586a1 1 0 01.707.293l7.414 7.414a1 1 0 010 1.414l-5.586 5.586a1 1 0 01-1.414 0L5.293 10.293A1 1 0 015 9.586V4a1 1 0 011-1z" />
          </svg>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {search ? "No categories match your search" : "No categories yet"}
          </p>
          {!search && canModify && (
            <Button size="sm" className="mt-3" onClick={openAdd}>
              Create your first category
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="min-w-full" role="table" aria-label="Merchant categories table">
              <thead className="sticky top-0 z-10 whitespace-nowrap border-b border-gray-200 bg-gray-50 dark:border-white/[0.06] dark:bg-gray-800">
                <tr className="border-b border-gray-200 dark:border-white/[0.06]">
                  <th scope="col" className="px-4 py-3 text-left text-[13px] font-medium text-gray-600 dark:text-gray-300">Category</th>
                  <th scope="col" className="px-4 py-3 text-left text-[13px] font-medium text-gray-600 dark:text-gray-300">Slug</th>
                  <th scope="col" className="px-4 py-3 text-right text-[13px] font-medium text-gray-600 dark:text-gray-300">Merchants</th>
                  <th scope="col" className="px-4 py-3 text-left text-[13px] font-medium text-gray-600 dark:text-gray-300">Created</th>
                  <th scope="col" className="px-4 py-3 text-right text-[13px] font-medium text-gray-600 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="whitespace-nowrap divide-y divide-gray-200 dark:divide-white/[0.06]">
                {filtered.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-accent-50/60 dark:hover:bg-gray-800/70">
                    <td className="px-4 py-3">
                      <MerchantCategoryChip category={c} />
                    </td>
                    <td className="px-4 py-3 text-[13px] font-mono text-gray-600 dark:text-gray-400">
                      {c.slug}
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] tabular-nums text-gray-700 dark:text-gray-300">
                      <span className="font-semibold">{c.merchant_count}</span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-700 dark:text-gray-300">
                      {formatDate(c.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canModify && (
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => setEditTarget(c)}
                            aria-label={`Edit ${c.name}`}
                            title="Edit"
                            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-700 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                          >
                            <PencilIcon />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(c)}
                            aria-label={`Delete ${c.name}`}
                            title="Delete"
                            className="p-1.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                          >
                            <TrashBinIcon />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        className="max-w-[520px] p-5 lg:p-8 dark:text-gray-300 dark:bg-gray-900"
      >
        <div className="mb-5 pb-4 border-b border-gray-200 dark:border-gray-700">
          <h4 className="text-xl font-bold text-gray-900 dark:text-white">Add New Category</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Categories group merchants for filtering in the portal and on the external website.
          </p>
        </div>
        <CategoryForm
          mode="add"
          onCancel={() => setAddOpen(false)}
          onSubmit={(draft) => createMutation.mutate(draft)}
          saving={createMutation.isPending}
        />
      </Modal>

      {/* Edit Category Modal */}
      {editTarget && (
        <Modal
          isOpen={!!editTarget}
          onClose={() => setEditTarget(null)}
          className="max-w-[520px] p-5 lg:p-8 dark:text-gray-300 dark:bg-gray-900"
        >
          <div className="mb-5 pb-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-xl font-bold text-gray-900 dark:text-white">Edit Category</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Update <span className="font-medium">{editTarget.name}</span>. Renaming also updates its external API slug.
            </p>
          </div>
          <CategoryForm
            mode="edit"
            initial={{ name: editTarget.name, color: editTarget.color }}
            onCancel={() => setEditTarget(null)}
            onSubmit={(draft) => updateMutation.mutate({ id: editTarget.id, draft })}
            saving={updateMutation.isPending}
          />
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          className="max-w-[480px] p-5 lg:p-8 dark:text-gray-300 dark:bg-gray-900"
        >
          <div className="mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <TrashBinIcon />
              </div>
              <h4 className="text-lg font-bold text-gray-900 dark:text-white">Delete Category?</h4>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-6">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-gray-900 dark:text-white">{deleteTarget.name}</span>?
              {deleteTarget.merchant_count > 0 && (
                <>
                  {" "}It will be removed from{" "}
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {deleteTarget.merchant_count} {deleteTarget.merchant_count === 1 ? "merchant" : "merchants"}
                  </span>
                  .
                </>
              )}{" "}
              This action cannot be undone.
            </p>
          </div>
          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <button
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
