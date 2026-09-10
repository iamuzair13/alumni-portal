"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import { useUsersList } from "@/app/queries/fetch-users";
import { useFormTemplates } from "@/app/queries/fetch-form-templates";
import type { AlumniListItem } from "@/app/queries/fetch-alumni";
import type { AlumniFilterOption } from "@/app/queries/fetch-alumni-faculties";
import {
  bulkUploadColumns,
  buildMappingSuggestions,
  chunk,
  getColumnById,
  normalizeCellValue,
  normalizeSapValue,
  parseWorkbook,
  type BulkUploadDraft,
  type BulkUploadIssue,
  type BulkUploadMapping,
  type BulkUploadParsedWorkbook,
} from "@/lib/bulk-upload-staff";

type PreviewRow = {
  sap: string;
  name: string;
  isNew: boolean;
  sourceRowNumber: number;
  current: Record<string, string | number | boolean | null>;
  values: Record<string, string | number | boolean | null>;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  staffRows: AlumniListItem[];
  facultyOptions: AlumniFilterOption[];
  departmentOptions: AlumniFilterOption[];
  programOptions: AlumniFilterOption[];
  onSaved?: () => void | Promise<void>;
  inline?: boolean;
};

const steps = ["Import Excel", "Select Columns", "Map Headers", "Preview & Save"] as const;

function groupColumns(group: "Basic" | "Performance" | "Compensation") {
  return bulkUploadColumns.filter((column) => column.group === group && column.id !== "sapid");
}

function toSapLookup(rows: AlumniListItem[]) {
  const map = new Map<string, AlumniListItem>();
  rows.forEach((row) => {
    const sap = normalizeSapValue(row.sapid);
    if (sap && !map.has(sap)) {
      map.set(sap, row);
    }
  });
  return map;
}

function formatDateInput(value: string | number | boolean | null) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
}

export default function BulkUploadStaffModal({
  isOpen,
  onClose,
  staffRows,
  facultyOptions,
  departmentOptions,
  programOptions,
  onSaved,
  inline = false,
}: Props) {
  const queryClient = useQueryClient();
  const { data: users = [] } = useUsersList();
  const { data: formTemplates = [] } = useFormTemplates(isOpen);

  const staffLookup = useMemo(() => toSapLookup(staffRows), [staffRows]);
  const userLookup = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((user) => {
      const key = normalizeSapValue(String(user.userid));
      if (key) map.set(key, String(user.userid));
      const emailKey = normalizeSapValue(user.email);
      if (emailKey) map.set(emailKey, String(user.userid));
    });
    return map;
  }, [users]);

  const [stepIndex, setStepIndex] = useState(0);
  const [fileName, setFileName] = useState<string>("");
  const [parsed, setParsed] = useState<BulkUploadParsedWorkbook | null>(null);
  const [mapping, setMapping] = useState<BulkUploadMapping>({});
  const [selectedColumnIds, setSelectedColumnIds] = useState<string[]>([]);
  const [rowEdits, setRowEdits] = useState<Record<string, Record<string, string>>>({});
  const [issues, setIssues] = useState<BulkUploadIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingStage, setSavingStage] = useState<"collect" | "constraints" | "duplicates" | "confirm" | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({ Basic: false, Performance: false, Compensation: false });

  useEffect(() => {
    if (!isOpen) return;
    setStepIndex(0);
    setFileName("");
    setParsed(null);
    setMapping({});
    setSelectedColumnIds([]);
    setRowEdits({});
    setIssues([]);
    setSaving(false);
    setSavingStage(null);
    setServerError(null);
  }, [isOpen]);

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    const workbook = parseWorkbook(arrayBuffer, new Set(Array.from(staffLookup.keys())));
    setParsed(workbook);
    setFileName(file.name);
    setMapping(buildMappingSuggestions(workbook.headers));
    setStepIndex(1);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    multiple: false,
  });

  const selectedColumns = useMemo(
    () => bulkUploadColumns.filter((column) => selectedColumnIds.includes(column.id) && column.id !== "sapid"),
    [selectedColumnIds]
  );

  const headers = parsed?.headers ?? [];

  const previewRows = useMemo<PreviewRow[]>(() => {
    if (!parsed) return [];
    return parsed.rows.map((row) => {
      const current = staffLookup.get(normalizeSapValue(row.sap)) ?? null;
      const merged: Record<string, string | number | boolean | null> = {};
      selectedColumns.forEach((column) => {
        const header = Object.entries(mapping).find(([, target]) => target === column.id)?.[0];
        const raw = header ? row.raw[header] : "";
        const mapped = header ? normalizeCellValue(raw, column.fieldType) : null;
        const editValue = rowEdits[row.sap]?.[column.id];
        if (editValue !== undefined) {
          merged[column.id] = editValue;
        } else if (mapped !== null) {
          merged[column.id] = mapped;
        } else if (current && Object.prototype.hasOwnProperty.call(current, column.id)) {
          merged[column.id] = (current as Record<string, string | number | boolean | null>)[column.id];
        } else {
          merged[column.id] = null;
        }
      });

      return {
        sap: row.sap,
        name: String(merged.alumniname ?? current?.alumniname ?? "").trim(),
        isNew: !current,
        sourceRowNumber: row.rowNumber,
        current: current ?? {},
        values: merged,
      };
    });
  }, [parsed, staffLookup, selectedColumns, mapping, rowEdits]);

  const matchedCount = parsed?.matchedSap.length ?? 0;
  const unmatchedSap = parsed?.unmatchedSap ?? [];

  const selectedGroups = {
    Basic: groupColumns("Basic"),
    Performance: groupColumns("Performance"),
    Compensation: groupColumns("Compensation"),
  };

  const setGroupSelection = (group: keyof typeof selectedGroups, enabled: boolean) => {
    setSelectedColumnIds((prev) => {
      const ids = new Set(prev);
      selectedGroups[group].forEach((column) => {
        if (enabled) ids.add(column.id);
        else ids.delete(column.id);
      });
      return Array.from(ids);
    });
  };

  const onTargetChange = (header: string, nextTarget: string | "__skip__") => {
    setMapping((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (next[key] === nextTarget && key !== header) {
          next[key] = "__skip__";
        }
      });
      next[header] = nextTarget;
      return next;
    });
  };

  const buildFinalDrafts = () => {
    const issuesList: BulkUploadIssue[] = [];
    const drafts: BulkUploadDraft[] = [];
    const emailSeen = new Set<string>();
    const sapSeen = new Set<string>();

    previewRows.forEach((row) => {
      const current = staffLookup.get(normalizeSapValue(row.sap)) ?? null;
      const updates: Record<string, string | number | boolean | null> = {};

      selectedColumns.forEach((column) => {
        const value = row.values[column.id];
        if (value !== null && value !== undefined && String(value).trim() !== "") {
          updates[column.id] = value;
        }
      });

      const sap = normalizeSapValue(row.sap);
      if (!sap) {
        issuesList.push({ rowNumber: row.sourceRowNumber, sap: "", name: row.name, message: "Missing SAP" });
        return;
      }
      if (sapSeen.has(sap)) {
        issuesList.push({ rowNumber: row.sourceRowNumber, sap, name: row.name, message: "Duplicate SAP in sheet" });
        return;
      }
      sapSeen.add(sap);

      const email = String(updates.personalemail ?? updates.officialemail ?? current?.personalemail ?? current?.officialemail ?? "").trim();
      if (email) {
        const key = email.toLowerCase();
        if (emailSeen.has(key)) {
          issuesList.push({ rowNumber: row.sourceRowNumber, sap, name: row.name, message: "Duplicate email in sheet" });
          return;
        }
        emailSeen.add(key);
      }

      const manager1 = String(updates.managerSap ?? "").trim();
      const manager2 = String(updates.manager2Sap ?? "").trim();
      if (manager1 && !userLookup.has(normalizeSapValue(manager1))) {
        issuesList.push({ rowNumber: row.sourceRowNumber, sap, name: row.name, message: "Manager 1 does not exist" });
        return;
      }
      if (manager2 && !userLookup.has(normalizeSapValue(manager2))) {
        issuesList.push({ rowNumber: row.sourceRowNumber, sap, name: row.name, message: "Manager 2 does not exist" });
        return;
      }
      if (manager1 && manager2 && manager1 === manager2) {
        issuesList.push({ rowNumber: row.sourceRowNumber, sap, name: row.name, message: "Manager 1 and Manager 2 cannot be the same" });
        return;
      }
      if (manager1 && normalizeSapValue(manager1) === sap) {
        issuesList.push({ rowNumber: row.sourceRowNumber, sap, name: row.name, message: "Self-manager assignment is not allowed" });
        return;
      }
      if (manager2 && normalizeSapValue(manager2) === sap) {
        issuesList.push({ rowNumber: row.sourceRowNumber, sap, name: row.name, message: "Self-manager assignment is not allowed" });
        return;
      }

      if (!current && !updates.alumniname) {
        issuesList.push({ rowNumber: row.sourceRowNumber, sap, name: row.name, message: "New rows require an employee name" });
        return;
      }

      drafts.push({
        sap,
        name: row.name || String(updates.alumniname ?? ""),
        isNew: !current,
        updates,
        sourceRowNumber: row.sourceRowNumber,
      });
    });

    return { drafts, issuesList };
  };

  const save = async () => {
    setSaving(true);
    setServerError(null);
    setIssues([]);
    setSavingStage("collect");
    await new Promise((resolve) => setTimeout(resolve, 0));

    const { drafts, issuesList } = buildFinalDrafts();
    if (drafts.length === 0) {
      setIssues([{ rowNumber: 0, sap: "", name: "", message: "No changes" }]);
      setSaving(false);
      setSavingStage(null);
      return;
    }
    if (issuesList.length > 0) {
      setIssues(issuesList);
      setSaving(false);
      setSavingStage(null);
      return;
    }

    setSavingStage("constraints");
    await new Promise((resolve) => setTimeout(resolve, 0));
    setSavingStage("duplicates");
    await new Promise((resolve) => setTimeout(resolve, 0));
    setSavingStage("confirm");
    await new Promise((resolve) => setTimeout(resolve, 0));

    try {
      const existingDrafts = drafts.filter((draft) => !draft.isNew);
      const createDrafts = drafts.filter((draft) => draft.isNew);

      const groupedUpdates = new Map<string, BulkUploadDraft[]>();
      existingDrafts.forEach((draft) => {
        const key = JSON.stringify(draft.updates);
        const bucket = groupedUpdates.get(key) ?? [];
        bucket.push(draft);
        groupedUpdates.set(key, bucket);
      });

      for (const group of groupedUpdates.values()) {
        for (const batch of chunk(group, 500)) {
          const payload = {
            employeeIds: batch.map((draft) => draft.sap),
            updates: batch[0]?.updates ?? {},
          };
          const res = await fetch("/api/submissions/bulk-edit", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to update staff");
        }
      }

      for (const group of chunk(createDrafts, 500)) {
        const payload = {
          createDrafts: group.map((draft) => ({
            sapid: draft.sap,
            updates: draft.updates,
          })),
        };
        const res = await fetch("/api/submissions/bulk-edit", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to create staff");
      }

      await queryClient.invalidateQueries({ queryKey: ["alumnilist"] });
      await queryClient.invalidateQueries({ queryKey: ["users", "list"] });
      onSaved?.();
      onClose();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Bulk upload failed");
    } finally {
      setSaving(false);
      setSavingStage(null);
    }
  };

  const updateRowValue = (sap: string, fieldId: string, value: string) => {
    setRowEdits((prev) => ({
      ...prev,
      [sap]: {
        ...(prev[sap] ?? {}),
        [fieldId]: value,
        ...(fieldId === "facultyname" ? { departmentname: "" } : {}),
        ...(fieldId === "category" ? { subcategory: "" } : {}),
      },
    }));
  };

  const uniqueValues = (fieldId: string) => {
    const values = new Set<string>();
    previewRows.forEach((row) => {
      const next = String(row.values[fieldId] ?? row.current[fieldId] ?? "").trim();
      if (next) values.add(next);
    });
    staffRows.forEach((row) => {
      const next = String((row as Record<string, string | number | boolean | null>)[fieldId] ?? "").trim();
      if (next) values.add(next);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  };

  const renderField = (row: PreviewRow, columnId: string) => {
    const column = getColumnById(columnId);
    if (!column) return null;
    const value = String(row.values[columnId] ?? "");
    const original = String(row.current[columnId] ?? "");
    const dirty = value !== original;
    const baseClass = `w-full rounded-lg border px-2 py-1 text-sm ${dirty ? "border-amber-400 bg-amber-50" : "border-gray-300 bg-white"} dark:border-gray-700 dark:bg-gray-900`;

    if (column.id === "facultyname") {
      return (
        <select value={value} onChange={(e) => updateRowValue(row.sap, column.id, e.target.value)} className={baseClass}>
          <option value="">Select</option>
          {facultyOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (column.id === "departmentname") {
      return (
        <select value={value} onChange={(e) => updateRowValue(row.sap, column.id, e.target.value)} className={baseClass}>
          <option value="">Select</option>
          {departmentOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (column.id === "degreetitle") {
      return (
        <select value={value} onChange={(e) => updateRowValue(row.sap, column.id, e.target.value)} className={baseClass}>
          <option value="">Select</option>
          {programOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (column.id === "managerSap" || column.id === "manager2Sap") {
      return (
        <select value={value} onChange={(e) => updateRowValue(row.sap, column.id, e.target.value)} className={baseClass}>
          <option value="">Select</option>
          {users.map((user) => {
            const label = `${String(user.firstname ?? "").trim()} ${String(user.lastname ?? "").trim()}`.trim() || String(user.email ?? user.userid);
            return (
              <option key={user.userid} value={String(user.userid)}>
                {label}
              </option>
            );
          })}
        </select>
      );
    }

    if (column.id === "formTemplateId") {
      return (
        <select value={value} onChange={(e) => updateRowValue(row.sap, column.id, e.target.value)} className={baseClass}>
          <option value="">Don&apos;t import</option>
          {formTemplates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      );
    }

    if (column.fieldType === "number") {
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => updateRowValue(row.sap, column.id, e.target.value)}
          className={baseClass}
        />
      );
    }

    if (column.fieldType === "date") {
      return (
        <input
          type="date"
          value={formatDateInput(row.values[column.id])}
          onChange={(e) => updateRowValue(row.sap, column.id, e.target.value)}
          className={baseClass}
        />
      );
    }

    if (column.fieldType === "textarea") {
      return (
        <textarea
          value={value}
          onChange={(e) => updateRowValue(row.sap, column.id, e.target.value)}
          className={`${baseClass} min-h-[72px]`}
        />
      );
    }

    if (column.fieldType === "select") {
      return (
        <select value={value} onChange={(e) => updateRowValue(row.sap, column.id, e.target.value)} className={baseClass}>
          <option value="">Select</option>
          {uniqueValues(column.id).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        type="text"
        value={value}
        onChange={(e) => updateRowValue(row.sap, column.id, e.target.value)}
        className={baseClass}
      />
    );
  };

  const content = (
    <div role="dialog" aria-modal="true" aria-labelledby="bulk-upload-title" className={inline ? "flex w-full flex-col bg-white dark:bg-gray-950" : "flex h-screen w-screen flex-col bg-white dark:bg-gray-950"}>
      <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
        <div>
          <h2 id="bulk-upload-title" className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Bulk Upload
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {fileName ? fileName : "Import Excel, map columns, preview changes, then save in batches."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {inline ? (
            <Button variant="outline" onClick={() => { setStepIndex(0); setFileName(""); setParsed(null); setMapping({}); setSelectedColumnIds([]); setRowEdits({}); setIssues([]); setSaving(false); setSavingStage(null); setServerError(null); }} aria-label="Reset bulk upload">Reset</Button>
          ) : (
            <Button variant="outline" onClick={onClose} aria-label="Close bulk upload">Close</Button>
          )}
        </div>
      </div>

      <div className="border-b border-gray-200 px-6 py-3 dark:border-gray-800">
        <div className="flex flex-wrap gap-2">
          {steps.map((label, index) => (
            <div
              key={label}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                index === stepIndex ? "bg-blue-600 text-white" : index < stepIndex ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
              }`}
            >
              {index + 1}. {label}
            </div>
          ))}
        </div>
      </div>

      <div className={inline ? "flex-1 overflow-hidden px-6 py-4" : "flex-1 overflow-hidden px-6 py-4"}>
        {stepIndex === 0 && (
          <div
            {...getRootProps()}
            className={`flex ${inline ? "min-h-[400px]" : "h-full min-h-[320px]"} cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed ${
              isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50"
            } dark:border-gray-700 dark:bg-gray-900/40`}
          >
            <input {...getInputProps()} />
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {isDragActive ? "Drop file here" : "Drag and drop Excel here"}
              </p>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Or click to browse .xlsx / .xls</p>
            </div>
          </div>
        )}

          {stepIndex === 1 && parsed && (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Import summary</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Matched SAP: {matchedCount} · Unmatched SAP: {unmatchedSap.length}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setSelectedColumnIds([])}>Clear</Button>
                    <Button size="sm" variant="outline" onClick={() => setSelectedColumnIds(bulkUploadColumns.filter((c) => c.id !== "sapid" && c.persistable).map((c) => c.id))}>
                      Select all
                    </Button>
                  </div>
                </div>
                {!!unmatchedSap.length && (
                  <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                    Unmatched SAPs: {unmatchedSap.slice(0, 20).join(", ")}{unmatchedSap.length > 20 ? "..." : ""}
                  </div>
                )}
              </div>

              {(["Basic", "Performance", "Compensation"] as const).map((group) => {
                const isCollapsed = collapsedGroups[group];
                const groupColumnsList = selectedGroups[group];
                const selectedInGroup = groupColumnsList.filter((c) => selectedColumnIds.includes(c.id)).length;
                return (
                <div key={group} className="rounded-xl border border-gray-200 dark:border-gray-800">
                  <div
                    className="flex cursor-pointer items-center justify-between p-4"
                    onClick={() => setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }))}
                  >
                    <div className="flex items-center gap-2">
                      <svg
                        className={`text-gray-400 transition-transform duration-200 ${isCollapsed ? "" : "rotate-90"}`}
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{group}</h3>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        {selectedInGroup}/{groupColumnsList.length}
                      </span>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setGroupSelection(group, !groupColumnsList.every((column) => selectedColumnIds.includes(column.id)))}
                      >
                        Toggle group
                      </Button>
                    </div>
                  </div>
                  <AnimatePresence initial={false}>
                    {!isCollapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="grid gap-2 p-4 pt-0 sm:grid-cols-2 lg:grid-cols-3">
                          {groupColumnsList.map((column) => (
                            <label key={column.id} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700">
                              <input
                                type="checkbox"
                                checked={selectedColumnIds.includes(column.id)}
                                onChange={(e) => {
                                  setSelectedColumnIds((prev) =>
                                    e.target.checked ? Array.from(new Set([...prev, column.id])) : prev.filter((id) => id !== column.id)
                                  );
                                }}
                              />
                              <span className="text-sm text-gray-800 dark:text-gray-200">{column.label}</span>
                            </label>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                );
              })}

              <div className="flex justify-end gap-2">
                <Button onClick={() => setStepIndex(2)} disabled={selectedColumnIds.length === 0}>Next</Button>
              </div>
            </div>
          )}

          {stepIndex === 2 && parsed && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">Map Excel headers to internal fields.</p>
                <Button size="sm" variant="outline" onClick={() => setStepIndex(1)}>Back</Button>
              </div>
              <div className="overflow-auto rounded-xl border border-gray-200 dark:border-gray-800">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-4 py-3 text-left">Excel header</th>
                      <th className="px-4 py-3 text-left">Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headers.map((header) => (
                      <tr key={header} className="border-t border-gray-200 dark:border-gray-800">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{header}</td>
                        <td className="px-4 py-3">
                          <select
                            value={mapping[header] ?? "__skip__"}
                            onChange={(e) => onTargetChange(header, e.target.value as string | "__skip__")}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
                          >
                            <option value="__skip__">Don't import</option>
                            {selectedColumnIds.map((columnId) => {
                              const column = getColumnById(columnId);
                              if (!column) return null;
                              return (
                                <option key={column.id} value={column.id}>
                                  {column.label}
                                </option>
                              );
                            })}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStepIndex(1)}>Back</Button>
                <Button onClick={() => setStepIndex(3)}>Next</Button>
              </div>
            </div>
          )}

          {stepIndex === 3 && parsed && (
            <div className="flex h-full flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Preview {previewRows.length} row{previewRows.length === 1 ? "" : "s"} · edit cells before saving.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStepIndex(2)}>Back</Button>
                  <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
                </div>
              </div>

              {savingStage && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-200">
                  Running {savingStage} validation...
                </div>
              )}

              {serverError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-200">
                  {serverError}
                </div>
              )}

              {issues.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-200">
                  <p className="mb-2 font-semibold">Validation issues</p>
                  <ul className="list-disc space-y-1 pl-5">
                    {issues.map((issue, index) => (
                      <li key={`${issue.sap}-${issue.rowNumber}-${index}`}>
                        Row {issue.rowNumber || "-"} {issue.sap ? `(${issue.sap})` : ""} {issue.name ? `- ${issue.name}` : ""}: {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-gray-200 dark:border-gray-800">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-4 py-3 text-left">SAP</th>
                      <th className="px-4 py-3 text-left">Name</th>
                      {selectedColumns.map((column) => (
                        <th key={column.id} className="px-4 py-3 text-left">
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => (
                      <tr key={row.sap} className="border-t border-gray-200 dark:border-gray-800">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{row.sap}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.name || "-"}</td>
                        {selectedColumns.map((column) => (
                          <td key={column.id} className="px-3 py-2 align-top">{renderField(row, column.id)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
  );

  if (inline) {
    return content;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} isFullscreen showCloseButton={false}>
      {content}
    </Modal>
  );
}
