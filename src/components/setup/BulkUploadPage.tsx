"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "motion/react";
import Button from "@/components/ui/button/Button";

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = 0 | 1 | 2 | 3 | 4;

type ParsedData = {
  fileName: string;
  sheetName: string;
  headers: string[];
  totalRows: number;
  sampleRows: Array<Record<string, string>>;
  headerIssues: Array<{ header: string; issue: string }>;
  rows: Array<Record<string, unknown>>;
};

type ColumnDef = {
  dbColumn: string;
  label: string;
  type: string;
  required: boolean;
  maxLength?: number;
  aliases: string[];
  group: string;
  description?: string;
};

type Mapping = Record<string, string>; // header -> dbColumn | "__skip__"

type ValidationError = {
  rowNumber: number;
  sapid: string;
  name: string;
  field: string;
  message: string;
  originalValue: string;
};

type ValidationData = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  newRows: number;
  errors: ValidationError[];
  errorCount: number;
  duplicates: Array<{ rowNumber: number; sapid: string; name: string; reason: string }>;
  duplicateMappings: Array<{ target: string; sources: string[] }>;
};

type ImportData = {
  totalRows: number;
  inserted: number;
  skipped: number;
  failed: number;
  errors: Array<{ rowNumber: number; sapid: string; message: string }>;
  durationMs: number;
};

const STEPS = ["Upload File", "Preview", "Map Columns", "Validate", "Import"] as const;

// ─── Component ───────────────────────────────────────────────────────────────

export default function BulkUploadPage() {
  const [step, setStep] = useState<Step>(0);
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [validation, setValidation] = useState<ValidationData | null>(null);
  const [importResult, setImportResult] = useState<ImportData | null>(null);

  const [uploading, setUploading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch column definitions on mount
  useEffect(() => {
    fetch("/api/bulk-upload/columns")
      .then((res) => res.json())
      .then((data) => {
        if (data.columns) setColumns(data.columns);
      })
      .catch(() => {});
  }, []);

  const reset = useCallback(() => {
    setStep(0);
    setParsed(null);
    setMapping({});
    setValidation(null);
    setImportResult(null);
    setError(null);
    setUploading(false);
    setValidating(false);
    setImporting(false);
  }, []);

  // ─── Step 0: File Upload ───
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/bulk-upload/parse", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to parse file");
      }

      setParsed(data);

      // Auto-suggest mappings
      const suggestRes = await fetch("/api/bulk-upload/columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headers: data.headers }),
      });
      const suggestData = await suggestRes.json();

      if (suggestData.mapping) {
        setMapping(suggestData.mapping);
      }

      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
    multiple: false,
    disabled: uploading,
  });

  // ─── Step 3: Validate ───
  const runValidation = useCallback(async () => {
    if (!parsed) return;

    setValidating(true);
    setError(null);

    try {
      const res = await fetch("/api/bulk-upload/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: parsed.rows,
          fileName: parsed.fileName,
          mapping,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Validation failed");
      }

      setValidation(data);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed");
    } finally {
      setValidating(false);
    }
  }, [parsed, mapping]);

  // ─── Step 4: Import ───
  const runImport = useCallback(async () => {
    if (!parsed) return;

    setImporting(true);
    setError(null);

    try {
      const res = await fetch("/api/bulk-upload/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: parsed.rows,
          fileName: parsed.fileName,
          mapping,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Import failed");
      }

      setImportResult(data);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }, [parsed, mapping]);

  // ─── Mapping helpers ───
  const onTargetChange = useCallback((header: string, target: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      // Prevent duplicate mappings — clear any other header mapped to the same target
      for (const [h, t] of Object.entries(next)) {
        if (t === target && h !== header) {
          next[h] = "__skip__";
        }
      }
      next[header] = target;
      return next;
    });
  }, []);

  const mappedTargets = useMemo(() => {
    const targets = new Set<string>();
    for (const target of Object.values(mapping)) {
      if (target !== "__skip__") targets.add(target);
    }
    return targets;
  }, [mapping]);

  const requiredColumns = useMemo(
    () => columns.filter((c) => c.required),
    [columns]
  );

  const missingRequired = useMemo(
    () => requiredColumns.filter((c) => !mappedTargets.has(c.dbColumn)),
    [requiredColumns, mappedTargets]
  );

  // ─── Error report download ───
  const downloadErrorReport = useCallback(() => {
    if (!importResult || importResult.errors.length === 0) return;

    const headers = ["Row", "SAP ID", "Error"];
    const rows = importResult.errors.map((e) => [
      String(e.rowNumber),
      `"${e.sapid}"`,
      `"${e.message.replace(/"/g, '""')}"`,
    ]);

    // Prepend validation errors too if available
    let allRows = rows;
    if (validation && validation.errors.length > 0) {
      const valRows = validation.errors.map((e) => [
        String(e.rowNumber),
        `"${e.sapid}"`,
        `"${e.message.replace(/"/g, '""')}"`,
      ]);
      allRows = [...valRows, ...rows];
    }

    const csv = [headers.join(","), ...allRows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bulk-upload-errors-${parsed?.fileName ?? "report"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [importResult, validation, parsed]);

  // ─── Grouped columns for mapping UI ───
  const groupedColumns = useMemo(() => {
    const groups: Record<string, ColumnDef[]> = {};
    for (const col of columns) {
      if (!groups[col.group]) groups[col.group] = [];
      groups[col.group].push(col);
    }
    return groups;
  }, [columns]);

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex w-full flex-col bg-white dark:bg-gray-950">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Bulk Upload
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {parsed?.fileName
              ? parsed.fileName
              : "Import alumni data from Excel or CSV. Map columns, validate, then import."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={reset} aria-label="Reset bulk upload">
            Reset
          </Button>
        </div>
      </div>

      {/* Step indicator */}
      <div className="border-b border-gray-200 px-6 py-3 dark:border-gray-800">
        <div className="flex flex-wrap gap-2">
          {STEPS.map((label, index) => (
            <div
              key={label}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                index === step
                  ? "bg-blue-600 text-white"
                  : index < step
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
              }`}
            >
              {index + 1}. {label}
            </div>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {/* ─── Step 0: Upload ─── */}
        {step === 0 && (
          <div
            {...getRootProps()}
            className={`flex min-h-[400px] cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed ${
              isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50"
            } dark:border-gray-700 dark:bg-gray-900/40`}
          >
            <input {...getInputProps()} />
            <div className="text-center">
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">Parsing file...</p>
                </div>
              ) : (
                <>
                  <svg
                    className="mx-auto mb-4 h-12 w-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {isDragActive ? "Drop file here" : "Drag and drop Excel or CSV here"}
                  </p>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Or click to browse .xlsx, .xls, or .csv files
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                    Max file size: 50 MB · Max rows: 50,000
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                    <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.7-3L13.7 4a2 2 0 00-3.4 0L3.3 16A2 2 0 005 19z" />
                    </svg>
                    <span>All imported records will be set to <strong>Under Approval</strong> status and must be verified by an admin before activation.</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ─── Step 1: Preview ─── */}
        {step === 1 && parsed && (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    File Summary
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Sheet: {parsed.sheetName} · Total rows: {parsed.totalRows} · Columns:{" "}
                    {parsed.headers.length}
                  </p>
                </div>
                <Button onClick={() => setStep(2)}>Next: Map Columns</Button>
              </div>
            </div>

            {/* Header issues */}
            {parsed.headerIssues.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                <p className="mb-1 font-semibold">Header Issues ({parsed.headerIssues.length})</p>
                <ul className="list-disc space-y-1 pl-5">
                  {parsed.headerIssues.map((issue, i) => (
                    <li key={i}>
                      <strong>{issue.header}</strong>: {issue.issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Sample rows */}
            <div className="overflow-auto rounded-xl border border-gray-200 dark:border-gray-800">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left">#</th>
                    {parsed.headers.map((header) => (
                      <th key={header} className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.sampleRows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="border-t border-gray-200 dark:border-gray-800">
                      <td className="px-4 py-2 text-gray-500">{rowIdx + 1}</td>
                      {parsed.headers.map((header) => (
                        <td key={header} className="px-4 py-2 text-gray-700 dark:text-gray-300">
                          {row[header] || "-"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500">
              Showing first {parsed.sampleRows.length} of {parsed.totalRows} rows
            </p>
          </div>
        )}

        {/* ─── Step 2: Mapping ─── */}
        {step === 2 && parsed && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Map uploaded columns to database fields. Auto-suggestions are shown where matched.
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  onClick={runValidation}
                  disabled={validating || missingRequired.length > 0}
                >
                  {validating ? "Validating..." : "Validate Data"}
                </Button>
              </div>
            </div>

            {/* Missing required fields warning */}
            {missingRequired.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-200">
                <p className="mb-1 font-semibold">Missing required field mappings:</p>
                <ul className="list-disc space-y-1 pl-5">
                  {missingRequired.map((col) => (
                    <li key={col.dbColumn}>
                      {col.label} ({col.dbColumn}) — {col.description ?? "Required"}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Mapping table */}
            <div className="overflow-auto rounded-xl border border-gray-200 dark:border-gray-800">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left">Uploaded Column</th>
                    <th className="px-4 py-3 text-left">Database Column</th>
                    <th className="px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.headers.map((header) => {
                    const target = mapping[header] ?? "__skip__";
                    const isMapped = target !== "__skip__";
                    const isSuggested = isMapped && suggestTargetForHeader(header, columns) === target;

                    return (
                      <tr key={header} className="border-t border-gray-200 dark:border-gray-800">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                          {header}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={target}
                            onChange={(e) => onTargetChange(header, e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
                          >
                            <option value="__skip__">Not mapped</option>
                            {Object.entries(groupedColumns).map(([group, cols]) => (
                              <optgroup key={group} label={group}>
                                {cols.map((col) => (
                                  <option key={col.dbColumn} value={col.dbColumn}>
                                    {col.label}
                                    {col.required ? " *" : ""}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          {isMapped ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                                isSuggested
                                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                  : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                              }`}
                            >
                              {isSuggested ? "✓ Auto-matched" : "Mapped"}
                            </span>
                          ) : (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                              Not mapped
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Required fields legend */}
            <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600 dark:bg-gray-900 dark:text-gray-400">
              <p>
                <strong>* Required fields:</strong>{" "}
                {requiredColumns.map((c) => c.label).join(", ")}
              </p>
              <p className="mt-1">
                <strong>File reference columns</strong> (image1, image2, cv) accept filenames that
                must exist in the <code>public/images/</code> directory.
              </p>
            </div>
          </div>
        )}

        {/* ─── Step 3: Validation ─── */}
        {step === 3 && validation && (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryCard label="Total Rows" value={validation.totalRows} color="gray" />
              <SummaryCard label="Valid" value={validation.validRows} color="green" />
              <SummaryCard label="Invalid" value={validation.invalidRows} color="red" />
              <SummaryCard label="Duplicates" value={validation.duplicateRows} color="amber" />
            </div>

            {/* Duplicate mapping warnings */}
            {validation.duplicateMappings.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                <p className="mb-1 font-semibold">Duplicate column mappings detected:</p>
                <ul className="list-disc space-y-1 pl-5">
                  {validation.duplicateMappings.map((dm, i) => (
                    <li key={i}>
                      <strong>{dm.target}</strong> is mapped from: {dm.sources.join(", ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Errors table */}
            {validation.errors.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Validation Errors ({validation.errorCount} total
                  {validation.errorCount > validation.errors.length
                    ? `, showing first ${validation.errors.length}`
                    : ""}
                  )
                </p>
                <div className="max-h-[400px] overflow-auto rounded-xl border border-gray-200 dark:border-gray-800">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-3 text-left">Row</th>
                        <th className="px-4 py-3 text-left">SAP ID</th>
                        <th className="px-4 py-3 text-left">Name</th>
                        <th className="px-4 py-3 text-left">Field</th>
                        <th className="px-4 py-3 text-left">Error</th>
                        <th className="px-4 py-3 text-left">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validation.errors.map((err, i) => (
                        <tr key={i} className="border-t border-gray-200 dark:border-gray-800">
                          <td className="px-4 py-2 text-gray-500">{err.rowNumber}</td>
                          <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                            {err.sapid || "-"}
                          </td>
                          <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{err.name || "-"}</td>
                          <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{err.field}</td>
                          <td className="px-4 py-2 text-red-600 dark:text-red-400">{err.message}</td>
                          <td className="px-4 py-2 text-gray-500">{err.originalValue || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Duplicates table */}
            {validation.duplicates.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Duplicate Records ({validation.duplicates.length})
                </p>
                <div className="max-h-[200px] overflow-auto rounded-xl border border-gray-200 dark:border-gray-800">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-3 text-left">Row</th>
                        <th className="px-4 py-3 text-left">SAP ID</th>
                        <th className="px-4 py-3 text-left">Name</th>
                        <th className="px-4 py-3 text-left">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validation.duplicates.map((dup, i) => (
                        <tr key={i} className="border-t border-gray-200 dark:border-gray-800">
                          <td className="px-4 py-2 text-gray-500">{dup.rowNumber}</td>
                          <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                            {dup.sapid}
                          </td>
                          <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{dup.name || "-"}</td>
                          <td className="px-4 py-2 text-amber-600 dark:text-amber-400">{dup.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Confirmation */}
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                Import Confirmation
              </p>
              <div className="mt-2 space-y-1 text-sm text-blue-700 dark:text-blue-300">
                <p>
                  <strong>Source file:</strong> {parsed?.fileName}
                </p>
                <p>
                  <strong>Records to insert:</strong> {validation.validRows}
                </p>
                <p>
                  <strong>Records skipped:</strong>{" "}
                  {validation.invalidRows + validation.duplicateRows}
                </p>
                <p>
                  <strong>Mapped fields:</strong> {Object.values(mapping).filter((v) => v !== "__skip__").length}
                </p>
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.7-3L13.7 4a2 2 0 00-3.4 0L3.3 16A2 2 0 005 19z" />
                </svg>
                <div>
                  <p className="font-semibold">All {validation.validRows} records will be imported with status <span className="underline">Under Approval</span>.</p>
                  <p className="mt-1 text-xs">Each record must be reviewed and verified by an admin before it becomes active in the system.</p>
                </div>
              </div>
              {validation.validRows === 0 ? (
                <p className="mt-3 text-sm font-semibold text-red-600">
                  No valid records to import. Please fix the errors and re-validate.
                </p>
              ) : (
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setStep(2)}>
                    Back to Mapping
                  </Button>
                  <Button onClick={runImport} disabled={importing}>
                    {importing ? "Importing..." : `Confirm Import (${validation.validRows} records)`}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Step 4: Import Result ─── */}
        {step === 4 && importResult && (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 p-6 text-center dark:border-gray-800">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Bulk Upload Completed
              </h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Completed in {(importResult.durationMs / 1000).toFixed(2)}s
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryCard label="Total Rows" value={importResult.totalRows} color="gray" />
              <SummaryCard label="Successfully Added" value={importResult.inserted} color="green" />
              <SummaryCard label="Skipped" value={importResult.skipped} color="amber" />
              <SummaryCard label="Failed" value={importResult.failed} color="red" />
            </div>

            {importResult.inserted > 0 && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-semibold">{importResult.inserted} record(s) imported with <span className="underline">Under Approval</span> status.</p>
                  <p className="mt-1 text-xs">Navigate to the alumni dashboard to review and verify these records before they become active.</p>
                </div>
              </div>
            )}

            {importResult.errors.length > 0 && (
              <div>
                <div className="flex items-center justify-between">
                  <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Import Errors ({importResult.errors.length})
                  </p>
                  <Button size="sm" variant="outline" onClick={downloadErrorReport}>
                    Download Error Report (CSV)
                  </Button>
                </div>
                <div className="max-h-[300px] overflow-auto rounded-xl border border-gray-200 dark:border-gray-800">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-3 text-left">Row</th>
                        <th className="px-4 py-3 text-left">SAP ID</th>
                        <th className="px-4 py-3 text-left">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.errors.map((err, i) => (
                        <tr key={i} className="border-t border-gray-200 dark:border-gray-800">
                          <td className="px-4 py-2 text-gray-500">{err.rowNumber}</td>
                          <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                            {err.sapid || "-"}
                          </td>
                          <td className="px-4 py-2 text-red-600 dark:text-red-400">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-center gap-2">
              <Button onClick={reset}>Start New Upload</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helper Components ────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "gray" | "green" | "red" | "amber";
}) {
  const colorClasses = {
    gray: "bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100",
    green: "bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-200",
    red: "bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-200",
    amber: "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  };

  return (
    <div className={`rounded-xl border border-gray-200 p-4 dark:border-gray-800 ${colorClasses[color]}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value.toLocaleString()}</p>
    </div>
  );
}

function suggestTargetForHeader(header: string, columns: ColumnDef[]): string | "__skip__" {
  const normalized = String(header ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "__skip__";
  const match = columns.find((col) =>
    col.aliases.some((alias) => {
      const aliasNorm = alias
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return aliasNorm === normalized;
    })
  );
  return match?.dbColumn ?? "__skip__";
}
