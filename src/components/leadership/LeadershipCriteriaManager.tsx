"use client";
import React from "react";
import { jsPDF } from "jspdf";
import { Modal } from "@/components/ui/modal";

type LeadershipType = "chapter" | "association";
type LeadershipRoleName = "president" | "vice_president" | "coordinator";

type RoleCriterion = {
  id: number;
  label: string;
  description: string | null;
  is_mandatory: boolean;
  has_textbox?: boolean;
  textbox_label?: string | null;
  is_textbox_required?: boolean;
  sort_order: number;
  criterion_score?: number | null;
};

type CriteriaDraft = {
  id?: number;
  label: string;
  description: string;
  isMandatory: boolean;
  hasTextbox: boolean;
  textboxLabel: string;
  isTextboxRequired: boolean;
  sortOrder: number;
  criterionScore: number;
};

export default function LeadershipCriteriaManager(props: {
  criteriaType: LeadershipType;
  criteriaRole: LeadershipRoleName;
  typeLabel: (t: LeadershipType) => string;
  roleLabel: (role: LeadershipRoleName) => string;

  criteriaAdminLoading: boolean;
  criteriaAdminItems: RoleCriterion[];

  criteriaEditingId: number | null;
  setCriteriaEditingId: React.Dispatch<React.SetStateAction<number | null>>;

  criteriaDraft: CriteriaDraft;
  setCriteriaDraft: React.Dispatch<React.SetStateAction<CriteriaDraft>>;

  createLeadershipCriterion: (input: { type: LeadershipType; role: LeadershipRoleName } & CriteriaDraft) => Promise<unknown>;
  updateLeadershipCriterion: (input: CriteriaDraft) => Promise<unknown>;
  deleteLeadershipCriterion: (id: number) => Promise<unknown>;

  invalidateCriteriaQueries: () => void;
  pushToast: (type: "success" | "error", message: string) => void;
}) {
  const {
    criteriaType,
    criteriaRole,
    typeLabel,
    roleLabel,
    criteriaAdminLoading,
    criteriaAdminItems,
    criteriaEditingId,
    setCriteriaEditingId,
    criteriaDraft,
    setCriteriaDraft,
    createLeadershipCriterion,
    updateLeadershipCriterion,
    deleteLeadershipCriterion,
    invalidateCriteriaQueries,
    pushToast,
  } = props;

  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [criterionToDelete, setCriterionToDelete] = React.useState<{ id: number; label: string } | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const sortedCriteria = React.useMemo(() => {
    return [...criteriaAdminItems].sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
  }, [criteriaAdminItems]);

  const downloadCriteriaPdf = async () => {
    try {
      if (!sortedCriteria.length) {
        pushToast("error", "No criteria to export");
        return;
      }

      setDownloading(true);

      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 48;
      const marginTop = 56;
      const marginBottom = 56;
      const maxWidth = pageWidth - marginX * 2;

      let y = marginTop;

      const addWrappedText = (text: string, opts?: { fontSize?: number; bold?: boolean; spacing?: number }) => {
        const fontSize = opts?.fontSize ?? 11;
        const bold = opts?.bold ?? false;
        const spacing = opts?.spacing ?? 10;

        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setFontSize(fontSize);

        const lines = doc.splitTextToSize(String(text || ""), maxWidth);
        const lineHeight = fontSize * 1.25;

        for (const line of lines) {
          if (y + lineHeight > pageHeight - marginBottom) {
            doc.addPage();
            y = marginTop;
          }
          doc.text(line, marginX, y);
          y += lineHeight;
        }
        y += spacing;
      };

      addWrappedText("Leadership Criteria", { fontSize: 18, bold: true, spacing: 14 });
      addWrappedText(`Type: ${typeLabel(criteriaType)}    Role: ${roleLabel(criteriaRole)}`, { fontSize: 11, spacing: 12 });

      sortedCriteria.forEach((c, idx) => {
        const mandatoryLabel = c.is_mandatory ? "Mandatory" : "Optional";
        const marksLabel = Number.isFinite(Number(c.criterion_score)) ? String(Math.trunc(Number(c.criterion_score))) : "N/A";
        addWrappedText(
          `${idx + 1}. ${c.label} (${mandatoryLabel}) [Sort: ${c.sort_order}] [Marks: ${marksLabel}]`,
          { fontSize: 12, bold: true, spacing: 4 }
        );
        if (c.description) {
          addWrappedText(String(c.description), { fontSize: 11, bold: false, spacing: 10 });
        } else {
          y += 6;
        }
      });

      doc.save(`criteria-${criteriaType}-${criteriaRole}.pdf`);
      pushToast("success", "PDF downloaded");
    } catch (e) {
      pushToast("error", e instanceof Error ? e.message : "Failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden overflow-y-auto">
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/30 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Criteria List ({typeLabel(criteriaType)} / {roleLabel(criteriaRole)})
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              disabled={criteriaAdminLoading}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
            >
              Preview
            </button>
            <button
              type="button"
              onClick={downloadCriteriaPdf}
              disabled={criteriaAdminLoading || downloading || sortedCriteria.length === 0}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              {downloading ? "Downloading..." : "Download PDF"}
            </button>
          </div>
        </div>
        <div className="p-4 max-h-[420px] overflow-y-auto">
          {criteriaAdminLoading ? (
            <div className="text-sm text-gray-600 dark:text-gray-400">Loading...</div>
          ) : criteriaAdminItems.length === 0 ? (
            <div className="text-sm text-gray-600 dark:text-gray-400">No criteria yet.</div>
          ) : (
            <div className="space-y-2">
              {sortedCriteria.map((c) => (
                <div key={c.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{c.label}</div>
                        {c.is_mandatory ? (
                          <span className="rounded-full bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 text-[10px] font-semibold">Mandatory</span>
                        ) : (
                          <span className="rounded-full bg-gray-100 text-gray-700 border border-gray-200 px-2 py-0.5 text-[10px] font-semibold">Optional</span>
                        )}
                      </div>
                      {c.description ? <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">{c.description}</div> : null}
                      <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                        Sort: {c.sort_order} | Marks: {Number.isFinite(Number(c.criterion_score)) ? String(Number(c.criterion_score)) : "N/A"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCriteriaEditingId(Number(c.id));
                          setCriteriaDraft({
                            id: Number(c.id),
                            label: String(c.label ?? ""),
                            description: String(c.description ?? ""),
                            isMandatory: Boolean(c.is_mandatory),
                            hasTextbox: Boolean((c as any).has_textbox),
                            textboxLabel: String((c as any).textbox_label ?? "Explanation") || "Explanation",
                            isTextboxRequired: Boolean((c as any).is_textbox_required),
                            sortOrder: Number(c.sort_order ?? 0),
                            criterionScore: Number.isFinite(Number((c as any).criterion_score)) ? Math.trunc(Number((c as any).criterion_score)) : 1,
                          });
                        }}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700"
                      >
                        Edit
                      </button>
                      {!c.has_textbox ? (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await updateLeadershipCriterion({
                                id: Number(c.id),
                                label: String(c.label ?? ""),
                                description: String(c.description ?? ""),
                                isMandatory: Boolean(c.is_mandatory),
                                hasTextbox: true,
                                textboxLabel: String((c as any).textbox_label ?? "Explanation") || "Explanation",
                                isTextboxRequired: Boolean((c as any).is_textbox_required ?? false),
                                sortOrder: Number(c.sort_order ?? 0),
                                criterionScore: Number.isFinite(Number((c as any).criterion_score))
                                  ? Math.trunc(Number((c as any).criterion_score))
                                  : 1,
                              });
                              pushToast("success", "Textbox added");
                              invalidateCriteriaQueries();
                            } catch (e) {
                              pushToast("error", e instanceof Error ? e.message : "Failed");
                            }
                          }}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
                        >
                          Add Textbox
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setCriterionToDelete({ id: Number(c.id), label: String(c.label ?? "") });
                          setDeleteConfirmOpen(true);
                        }}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700"
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

      <Modal isOpen={previewOpen} onClose={() => setPreviewOpen(false)} className="max-w-[900px] w-[92vw] p-0">
        <div className="p-6">
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">Criteria List Preview</div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {typeLabel(criteriaType)} / {roleLabel(criteriaRole)}
          </div>

          <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 max-h-[70vh] overflow-y-auto">
            <div className="p-5">
              {criteriaAdminLoading ? (
                <div className="text-sm text-gray-600 dark:text-gray-400">Loading...</div>
              ) : sortedCriteria.length === 0 ? (
                <div className="text-sm text-gray-600 dark:text-gray-400">No criteria yet.</div>
              ) : (
                <div className="space-y-3">
                  {sortedCriteria.map((c) => (
                    <div key={c.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{c.label}</div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Sort: {c.sort_order}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">Marks: {Number.isFinite(Number(c.criterion_score)) ? String(Number(c.criterion_score)) : "N/A"}</span>
                          {c.is_mandatory ? (
                            <span className="rounded-full bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 text-[10px] font-semibold">Mandatory</span>
                          ) : (
                            <span className="rounded-full bg-gray-100 text-gray-700 border border-gray-200 px-2 py-0.5 text-[10px] font-semibold">Optional</span>
                          )}
                        </div>
                      </div>
                      {c.description ? (
                        <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{c.description}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="rounded-lg px-4 py-2 text-sm font-semibold border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Close
            </button>
            <button
              type="button"
              onClick={downloadCriteriaPdf}
              disabled={criteriaAdminLoading || downloading || sortedCriteria.length === 0}
              className="rounded-lg px-4 py-2 text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {downloading ? "Downloading..." : "Download PDF"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={deleteConfirmOpen}
        onClose={() => {
          if (deleting) return;
          setDeleteConfirmOpen(false);
          setCriterionToDelete(null);
        }}
        className="max-w-[520px] w-[92vw] p-0"
        showCloseButton={!deleting}
      >
        <div className="p-6">
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delete criterion?</div>
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {criterionToDelete?.label ? (
              <>
                You are about to delete{" "}
                <span className="font-semibold text-gray-900 dark:text-gray-100">{criterionToDelete.label}</span>. This action can&apos;t be undone.
              </>
            ) : (
              "This action can&apos;t be undone."
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-lg px-4 py-2 text-sm font-semibold border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
              disabled={deleting}
              onClick={() => {
                if (deleting) return;
                setDeleteConfirmOpen(false);
                setCriterionToDelete(null);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg px-4 py-2 text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60"
              disabled={deleting || !criterionToDelete}
              onClick={async () => {
                if (!criterionToDelete) return;
                setDeleting(true);
                try {
                  await deleteLeadershipCriterion(criterionToDelete.id);
                  pushToast("success", "Deleted");
                  invalidateCriteriaQueries();
                  setDeleteConfirmOpen(false);
                  setCriterionToDelete(null);
                } catch (e) {
                  pushToast("error", e instanceof Error ? e.message : "Failed");
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </Modal>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/30 text-sm font-semibold text-gray-700 dark:text-gray-300">
          {criteriaEditingId ? "Edit Criterion" : "Add Criterion"}
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Label *</label>
            <input
              value={criteriaDraft.label}
              onChange={(e) => setCriteriaDraft((p) => ({ ...p, label: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              placeholder="e.g., Minimum 5 years experience"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              value={criteriaDraft.description}
              onChange={(e) => setCriteriaDraft((p) => ({ ...p, description: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              rows={3}
              placeholder="Optional help text"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Sort Order</label>
              <input
                type="number"
                value={criteriaDraft.sortOrder}
                onChange={(e) => setCriteriaDraft((p) => ({ ...p, sortOrder: Number(e.target.value) }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Criterion Score *</label>
              <input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={criteriaDraft.criterionScore}
                onChange={(e) => {
                  const v = e.target.value;
                  const n = Number(v);
                  setCriteriaDraft((p) => ({ ...p, criterionScore: Number.isFinite(n) ? Math.trunc(n) : 0 }));
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                placeholder="Enter marks (e.g., 20)"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                id="criteria-mandatory"
                type="checkbox"
                checked={criteriaDraft.isMandatory}
                onChange={(e) => setCriteriaDraft((p) => ({ ...p, isMandatory: e.target.checked }))}
                className="h-4 w-4 text-blue-600"
              />
              <label htmlFor="criteria-mandatory" className="text-sm font-medium text-gray-900 dark:text-gray-100">Mandatory</label>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                id="criteria-has-textbox"
                type="checkbox"
                checked={criteriaDraft.hasTextbox}
                onChange={(e) => setCriteriaDraft((p) => ({ ...p, hasTextbox: e.target.checked }))}
                className="h-4 w-4 text-blue-600"
              />
              <label htmlFor="criteria-has-textbox" className="text-sm font-medium text-gray-900 dark:text-gray-100">Has Textbox</label>
            </div>
          </div>

          {criteriaDraft.hasTextbox ? (
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Textbox Label</label>
                <input
                  value={criteriaDraft.textboxLabel}
                  onChange={(e) => setCriteriaDraft((p) => ({ ...p, textboxLabel: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  placeholder="e.g., Explanation"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="criteria-textbox-required"
                  type="checkbox"
                  checked={criteriaDraft.isTextboxRequired}
                  onChange={(e) => setCriteriaDraft((p) => ({ ...p, isTextboxRequired: e.target.checked }))}
                  className="h-4 w-4 text-blue-600"
                />
                <label htmlFor="criteria-textbox-required" className="text-sm font-medium text-gray-900 dark:text-gray-100">Required</label>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-2">
            {criteriaEditingId ? (
              <button
                type="button"
                onClick={() => {
                  setCriteriaEditingId(null);
                  setCriteriaDraft({
                    label: "",
                    description: "",
                    isMandatory: false,
                    hasTextbox: false,
                    textboxLabel: "Explanation",
                    isTextboxRequired: false,
                    sortOrder: 0,
                    criterionScore: 1,
                  });
                }}
                className="rounded-lg px-4 py-2 text-sm font-semibold bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            ) : null}
            <button
              type="button"
              onClick={async () => {
                const label = String(criteriaDraft.label || "").trim();
                if (!label) {
                  pushToast("error", "Label is required");
                  return;
                }

                const scoreNum = Number(criteriaDraft.criterionScore);
                const score = Number.isFinite(scoreNum) ? Math.trunc(scoreNum) : NaN;
                if (!Number.isFinite(score) || score < 1) {
                  pushToast("error", "Criterion score is required and must be a positive integer");
                  return;
                }

                try {
                  if (criteriaEditingId) {
                    await updateLeadershipCriterion({
                      id: criteriaEditingId,
                      label,
                      description: criteriaDraft.description,
                      isMandatory: criteriaDraft.isMandatory,
                      hasTextbox: criteriaDraft.hasTextbox,
                      textboxLabel: criteriaDraft.textboxLabel,
                      isTextboxRequired: criteriaDraft.isTextboxRequired,
                      sortOrder: criteriaDraft.sortOrder,
                      criterionScore: score,
                    });
                    pushToast("success", "Updated");
                  } else {
                    await createLeadershipCriterion({
                      type: criteriaType,
                      role: criteriaRole,
                      label,
                      description: criteriaDraft.description,
                      isMandatory: criteriaDraft.isMandatory,
                      hasTextbox: criteriaDraft.hasTextbox,
                      textboxLabel: criteriaDraft.textboxLabel,
                      isTextboxRequired: criteriaDraft.isTextboxRequired,
                      sortOrder: criteriaDraft.sortOrder,
                      criterionScore: score,
                    });
                    pushToast("success", "Created");
                  }
                  setCriteriaEditingId(null);
                  setCriteriaDraft({
                    label: "",
                    description: "",
                    isMandatory: false,
                    hasTextbox: false,
                    textboxLabel: "Explanation",
                    isTextboxRequired: false,
                    sortOrder: 0,
                    criterionScore: 1,
                  });
                  invalidateCriteriaQueries();
                } catch (e) {
                  pushToast("error", e instanceof Error ? e.message : "Failed");
                }
              }}
              className="rounded-lg px-4 py-2 text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700"
            >
              {criteriaEditingId ? "Save" : "Add"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
