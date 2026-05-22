"use client";

import React, { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import type {
  ScholarshipCategoryWithTiers,
  ScholarshipCgpaDiscountTier,
  ScholarshipFlowType,
} from "@/lib/scholarshipDiscount";

type CategoryDraft = {
  id?: number;
  slug: string;
  label: string;
  flowType: ScholarshipFlowType;
  defaultApplyFor: string;
  sortOrder: number;
  isActive: boolean;
};

type TierDraft = {
  id?: number;
  cgpaMin: string;
  cgpaMax: string;
  discountPercent: string;
  sortOrder: number;
};

const emptyCategoryDraft: CategoryDraft = {
  slug: "",
  label: "",
  flowType: "fee_discount",
  defaultApplyFor: "",
  sortOrder: 0,
  isActive: true,
};

const emptyTierDraft: TierDraft = {
  cgpaMin: "",
  cgpaMax: "",
  discountPercent: "",
  sortOrder: 0,
};

export default function ScholarshipDiscountManager(props: {
  categories: ScholarshipCategoryWithTiers[];
  loading: boolean;
  selectedCategoryId: number | null;
  setSelectedCategoryId: React.Dispatch<React.SetStateAction<number | null>>;
  onRefresh: () => Promise<void>;
  pushToast: (type: "success" | "error", message: string) => void;
}) {
  const { categories, loading, selectedCategoryId, setSelectedCategoryId, onRefresh, pushToast } = props;

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>(emptyCategoryDraft);
  const [categorySaving, setCategorySaving] = useState(false);
  const [deleteCategoryId, setDeleteCategoryId] = useState<number | null>(null);
  const [deletingCategory, setDeletingCategory] = useState(false);

  const [tierEditingId, setTierEditingId] = useState<number | null>(null);
  const [tierDraft, setTierDraft] = useState<TierDraft>(emptyTierDraft);
  const [tierSaving, setTierSaving] = useState(false);
  const [deleteTierId, setDeleteTierId] = useState<number | null>(null);
  const [deletingTier, setDeletingTier] = useState(false);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.id - b.id),
    [categories],
  );

  const selectedCategory = useMemo(
    () => sortedCategories.find((c) => c.id === selectedCategoryId) ?? null,
    [sortedCategories, selectedCategoryId],
  );

  const sortedTiers = useMemo(() => {
    const tiers = selectedCategory?.tiers ?? [];
    return [...tiers].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.id - b.id);
  }, [selectedCategory]);

  const openNewCategory = () => {
    setCategoryDraft(emptyCategoryDraft);
    setCategoryModalOpen(true);
  };

  const openEditCategory = (c: ScholarshipCategoryWithTiers) => {
    setCategoryDraft({
      id: c.id,
      slug: c.slug,
      label: c.label,
      flowType: c.flow_type,
      defaultApplyFor: c.default_apply_for ?? "",
      sortOrder: c.sort_order,
      isActive: c.is_active,
    });
    setCategoryModalOpen(true);
  };

  const saveCategory = async () => {
    const label = categoryDraft.label.trim();
    const slug = categoryDraft.slug.trim().toLowerCase();
    if (!label) {
      pushToast("error", "Label is required");
      return;
    }
    if (!slug) {
      pushToast("error", "Slug is required");
      return;
    }
    setCategorySaving(true);
    try {
      const body = {
        ...(categoryDraft.id ? { id: categoryDraft.id } : {}),
        slug,
        label,
        flowType: categoryDraft.flowType,
        defaultApplyFor: categoryDraft.defaultApplyFor.trim() || null,
        sortOrder: categoryDraft.sortOrder,
        isActive: categoryDraft.isActive,
      };
      const res = await fetch("/api/scholarship/categories", {
        method: categoryDraft.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save category");
      pushToast("success", categoryDraft.id ? "Category updated" : "Category created");
      setCategoryModalOpen(false);
      await onRefresh();
      if (!categoryDraft.id && data.item?.id) {
        setSelectedCategoryId(Number(data.item.id));
      }
    } catch (e) {
      pushToast("error", e instanceof Error ? e.message : "Failed");
    } finally {
      setCategorySaving(false);
    }
  };

  const confirmDeleteCategory = async () => {
    if (!deleteCategoryId) return;
    setDeletingCategory(true);
    try {
      const res = await fetch(`/api/scholarship/categories?id=${deleteCategoryId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      pushToast("success", data.deactivated ? "Category deactivated (in use)" : "Category deleted");
      if (selectedCategoryId === deleteCategoryId) setSelectedCategoryId(null);
      setDeleteCategoryId(null);
      await onRefresh();
    } catch (e) {
      pushToast("error", e instanceof Error ? e.message : "Failed");
    } finally {
      setDeletingCategory(false);
    }
  };

  const resetTierForm = () => {
    setTierEditingId(null);
    setTierDraft(emptyTierDraft);
  };

  const openEditTier = (t: ScholarshipCgpaDiscountTier) => {
    setTierEditingId(t.id);
    setTierDraft({
      id: t.id,
      cgpaMin: String(t.cgpa_min),
      cgpaMax: String(t.cgpa_max),
      discountPercent: String(t.discount_percent),
      sortOrder: t.sort_order,
    });
  };

  const saveTier = async () => {
    if (!selectedCategory) {
      pushToast("error", "Select a category first");
      return;
    }
    const cgpaMin = Number(tierDraft.cgpaMin);
    const cgpaMax = Number(tierDraft.cgpaMax);
    const discountPercent = Number(tierDraft.discountPercent);
    if (!Number.isFinite(cgpaMin) || !Number.isFinite(cgpaMax) || !Number.isFinite(discountPercent)) {
      pushToast("error", "Enter valid CGPA range and discount percent");
      return;
    }
    setTierSaving(true);
    try {
      const body = tierEditingId
        ? {
            id: tierEditingId,
            cgpaMin,
            cgpaMax,
            discountPercent,
            sortOrder: tierDraft.sortOrder,
          }
        : {
            categoryId: selectedCategory.id,
            cgpaMin,
            cgpaMax,
            discountPercent,
            sortOrder: tierDraft.sortOrder,
          };
      const res = await fetch("/api/scholarship/cgpa-tiers", {
        method: tierEditingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save tier");
      pushToast("success", tierEditingId ? "Tier updated" : "Tier added");
      resetTierForm();
      await onRefresh();
    } catch (e) {
      pushToast("error", e instanceof Error ? e.message : "Failed");
    } finally {
      setTierSaving(false);
    }
  };

  const confirmDeleteTier = async () => {
    if (!deleteTierId) return;
    setDeletingTier(true);
    try {
      const res = await fetch(`/api/scholarship/cgpa-tiers?id=${deleteTierId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete tier");
      pushToast("success", "Tier deleted");
      if (tierEditingId === deleteTierId) resetTierForm();
      setDeleteTierId(null);
      await onRefresh();
    } catch (e) {
      pushToast("error", e instanceof Error ? e.message : "Failed");
    } finally {
      setDeletingTier(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/30 flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Discount Categories</div>
            <button
              type="button"
              onClick={openNewCategory}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700"
            >
              Add Category
            </button>
          </div>
          <div className="p-4 max-h-[480px] overflow-y-auto">
            {loading ? (
              <div className="text-sm text-gray-600 dark:text-gray-400">Loading...</div>
            ) : sortedCategories.length === 0 ? (
              <div className="text-sm text-gray-600 dark:text-gray-400">No categories yet.</div>
            ) : (
              <div className="space-y-2">
                {sortedCategories.map((c) => (
                  <div
                    key={c.id}
                    className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                      selectedCategoryId === c.id
                        ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40"
                    }`}
                    onClick={() => setSelectedCategoryId(c.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {c.label}
                        </div>
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {c.slug} · {c.flow_type.replace("_", " ")}
                          {!c.is_active ? " · Inactive" : ""}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {(c.tiers?.length ?? 0)} CGPA tier(s)
                          {c.default_apply_for ? ` · Applies to: ${c.default_apply_for}` : ""}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => openEditCategory(c)}
                          className="rounded px-2 py-1 text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteCategoryId(c.id)}
                          className="rounded px-2 py-1 text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700"
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

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/30">
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              CGPA Discount Tiers
              {selectedCategory ? ` — ${selectedCategory.label}` : ""}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Inclusive ranges (e.g. 3.50–3.80 → 50%). First matching tier by sort order applies.
            </p>
          </div>
          <div className="p-4">
            {!selectedCategory ? (
              <div className="text-sm text-gray-600 dark:text-gray-400">Select a category to manage tiers.</div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">CGPA min</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      max={4}
                      value={tierDraft.cgpaMin}
                      onChange={(e) => setTierDraft((d) => ({ ...d, cgpaMin: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">CGPA max</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      max={4}
                      value={tierDraft.cgpaMax}
                      onChange={(e) => setTierDraft((d) => ({ ...d, cgpaMax: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Discount %</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      max={100}
                      value={tierDraft.discountPercent}
                      onChange={(e) => setTierDraft((d) => ({ ...d, discountPercent: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Sort</label>
                    <input
                      type="number"
                      value={tierDraft.sortOrder}
                      onChange={(e) =>
                        setTierDraft((d) => ({ ...d, sortOrder: Number(e.target.value) || 0 }))
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mb-4">
                  <button
                    type="button"
                    onClick={saveTier}
                    disabled={tierSaving}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {tierSaving ? "Saving..." : tierEditingId ? "Update Tier" : "Add Tier"}
                  </button>
                  {tierEditingId ? (
                    <button
                      type="button"
                      onClick={resetTierForm}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold border border-gray-200 dark:border-gray-700"
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>

                <div className="max-h-[320px] overflow-y-auto space-y-2">
                  {sortedTiers.length === 0 ? (
                    <div className="text-sm text-gray-600 dark:text-gray-400">No tiers for this category.</div>
                  ) : (
                    sortedTiers.map((t) => (
                      <div
                        key={t.id}
                        className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex justify-between gap-2"
                      >
                        <div className="text-sm">
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {t.cgpa_min} – {t.cgpa_max}
                          </span>
                          <span className="text-gray-600 dark:text-gray-400"> → </span>
                          <span className="font-semibold text-green-700 dark:text-green-400">
                            {t.discount_percent}%
                          </span>
                          <span className="ml-2 text-xs text-gray-500">sort: {t.sort_order}</span>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditTier(t)}
                            className="rounded px-2 py-1 text-xs font-semibold bg-blue-600 text-white"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTierId(t.id)}
                            className="rounded px-2 py-1 text-xs font-semibold bg-rose-600 text-white"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <Modal isOpen={categoryModalOpen} onClose={() => setCategoryModalOpen(false)} className="max-w-lg w-[92vw] p-0">
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {categoryDraft.id ? "Edit Category" : "Add Category"}
          </h3>
          <div>
            <label className="text-xs font-medium">Label</label>
            <input
              value={categoryDraft.label}
              onChange={(e) => setCategoryDraft((d) => ({ ...d, label: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Slug (stored on applications)</label>
            <input
              value={categoryDraft.slug}
              onChange={(e) => setCategoryDraft((d) => ({ ...d, slug: e.target.value }))}
              disabled={!!categoryDraft.id}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 disabled:opacity-60"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Flow type</label>
            <select
              value={categoryDraft.flowType}
              onChange={(e) =>
                setCategoryDraft((d) => ({ ...d, flowType: e.target.value as ScholarshipFlowType }))
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            >
              <option value="fee_discount">Fee discount (admission / tuition)</option>
              <option value="kinship">Kinship</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Default apply for (optional)</label>
            <select
              value={categoryDraft.defaultApplyFor}
              onChange={(e) => setCategoryDraft((d) => ({ ...d, defaultApplyFor: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            >
              <option value="">— None (alumni chooses) —</option>
              <option value="Masters">Masters</option>
              <option value="PhD">PhD</option>
              <option value="BS">BS</option>
            </select>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs font-medium">Sort order</label>
              <input
                type="number"
                value={categoryDraft.sortOrder}
                onChange={(e) =>
                  setCategoryDraft((d) => ({ ...d, sortOrder: Number(e.target.value) || 0 }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              />
            </div>
            <label className="flex items-center gap-2 mt-6 text-sm">
              <input
                type="checkbox"
                checked={categoryDraft.isActive}
                onChange={(e) => setCategoryDraft((d) => ({ ...d, isActive: e.target.checked }))}
              />
              Active
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCategoryModalOpen(false)}
              className="rounded-lg px-4 py-2 text-sm border border-gray-200 dark:border-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveCategory}
              disabled={categorySaving}
              className="rounded-lg px-4 py-2 text-sm font-semibold bg-blue-600 text-white disabled:opacity-60"
            >
              {categorySaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={deleteCategoryId != null}
        onClose={() => setDeleteCategoryId(null)}
        className="max-w-md w-[92vw] p-0"
      >
        <div className="p-6">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Delete this category? If applications reference it, it will be deactivated instead.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteCategoryId(null)}
              className="rounded-lg px-4 py-2 text-sm border"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeleteCategory}
              disabled={deletingCategory}
              className="rounded-lg px-4 py-2 text-sm font-semibold bg-rose-600 text-white disabled:opacity-60"
            >
              {deletingCategory ? "..." : "Confirm"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={deleteTierId != null} onClose={() => setDeleteTierId(null)} className="max-w-md w-[92vw] p-0">
        <div className="p-6">
          <p className="text-sm text-gray-700 dark:text-gray-300">Delete this CGPA tier?</p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setDeleteTierId(null)} className="rounded-lg px-4 py-2 text-sm border">
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeleteTier}
              disabled={deletingTier}
              className="rounded-lg px-4 py-2 text-sm font-semibold bg-rose-600 text-white disabled:opacity-60"
            >
              {deletingTier ? "..." : "Confirm"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
