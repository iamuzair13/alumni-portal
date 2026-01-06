"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Modal } from "@/components/ui/modal";
import toast from "react-hot-toast";

export type ColumnOption = {
  key: string;
  label: string;
  defaultSelected?: boolean;
};

export type ExcelExportOptions = {
  // Either: ready data array, or a function that returns data when called
  data: Record<string, unknown>[] | (() => Promise<Record<string, unknown>[]>);
  columns: ColumnOption[];
  filename: string;
  sheetName?: string;
  onExport?: (selectedColumns: string[]) => void;
};

/**
 * Simple reusable Excel export hook with column-selection modal.
 * - Modal opens instantly.
 * - Data is only fetched when "Export" is clicked.
 */
export function useExcelExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [exportConfig, setExportConfig] = useState<ExcelExportOptions | null>(
    null
  );
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set()
  );

  const openExportModal = useCallback((options: ExcelExportOptions) => {
    const initialSelected = new Set<string>();
    options.columns.forEach((col) => {
      if (col.defaultSelected !== false) {
        initialSelected.add(col.key);
      }
    });

    setExportConfig(options);
    setSelectedColumns(initialSelected);
    setIsOpen(true);
  }, []);

  const closeExportModal = useCallback(() => {
    if (isExporting) return;
    setIsOpen(false);
  }, [isExporting]);

  const toggleColumn = useCallback((key: string) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const selectAllColumns = useCallback(() => {
    if (!exportConfig) return;
    setSelectedColumns(new Set(exportConfig.columns.map((c) => c.key)));
  }, [exportConfig]);

  const deselectAllColumns = useCallback(() => {
    setSelectedColumns(new Set());
  }, []);

  const memoizedColumns = useMemo(
    () => exportConfig?.columns ?? [],
    [exportConfig]
  );

  const handleExport = useCallback(async () => {
    if (!exportConfig) return;
    if (selectedColumns.size === 0) {
      toast.error("Please select at least one column to export");
      return;
    }

    setIsExporting(true);
    setIsOpen(false);

    try {
      let data: Record<string, unknown>[];

      if (Array.isArray(exportConfig.data)) {
        data = exportConfig.data;
      } else if (typeof exportConfig.data === "function") {
        const loadingToast = toast.loading("Preparing export data...");
        try {
          data = await exportConfig.data();
          toast.dismiss(loadingToast);
        } catch (err) {
          toast.dismiss(loadingToast);
          throw err;
        }
      } else {
        throw new Error("Invalid data format for export");
      }

      const selectedKeys = Array.from(selectedColumns);
      const filteredData = data.map((row) => {
        const out: Record<string, unknown> = {};
        selectedKeys.forEach((key) => {
          out[key] = row[key] ?? "";
        });
        return out;
      });

      if (!filteredData.length) {
        toast.error("No data to export with the current filters");
        return;
      }

      const XLSX = await import("xlsx");

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(filteredData);
      ws["!cols"] = selectedKeys.map(() => ({ wch: 20 }));

      const sheetName = exportConfig.sheetName || "Export";
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      const dateStr = new Date().toISOString().split("T")[0];
      const filename = `${exportConfig.filename}_${dateStr}.xlsx`;

      XLSX.writeFile(wb, filename);
      toast.success("Export completed successfully");

      if (exportConfig.onExport) {
        exportConfig.onExport(selectedKeys);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to export data";
      toast.error(message);
    } finally {
      setIsExporting(false);
    }
  }, [exportConfig, selectedColumns]);

  const ExportModal: React.FC = () => {
    if (!exportConfig) return null;

    return (
      <Modal
        isOpen={isOpen}
        onClose={closeExportModal}
        className="max-w-2xl mx-auto"
        showCloseButton={true}
      >
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Select Columns to Export
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Choose which columns you want to include in the Excel export.
          </p>

          <div className="mb-4 flex items-center gap-2">
            <button
              type="button"
              onClick={selectAllColumns}
              disabled={isExporting}
              className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={deselectAllColumns}
              disabled={isExporting}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Deselect All
            </button>
            <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
              {selectedColumns.size} of {memoizedColumns.length} selected
            </span>
          </div>

          <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4 bg-white dark:bg-gray-900">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {memoizedColumns.map((column) => (
                <label
                  key={column.key}
                  className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedColumns.has(column.key)}
                    onChange={() => toggleColumn(column.key)}
                    disabled={isExporting}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer disabled:cursor-not-allowed"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 select-none">
                    {column.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={closeExportModal}
              disabled={isExporting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || selectedColumns.size === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? "Exporting..." : "Export"}
            </button>
          </div>
        </div>
      </Modal>
    );
  };

  return {
    isExporting,
    openExportModal,
    ExportModal,
  };
}

// Simple helper to export data to Excel without any modal UI.
// `data` should already be filtered/limited; `columns` controls which keys are included.
export async function exportJsonToExcel(options: {
  data: Record<string, unknown>[];
  columns: ColumnOption[];
  filename: string;
  sheetName?: string;
}) {
  const { data, columns, filename, sheetName } = options;

  if (!data || data.length === 0) {
    toast.error("No data to export");
    return;
  }

  const selectedKeys = columns.map((c) => c.key);
  const filteredData = data.map((row) => {
    const out: Record<string, unknown> = {};
    selectedKeys.forEach((key) => {
      out[key] = row[key] ?? "";
    });
    return out;
  });

  try {
    const XLSX = await import("xlsx");

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(filteredData);
    ws["!cols"] = selectedKeys.map(() => ({ wch: 20 }));

    const sheet = sheetName || "Export";
    XLSX.utils.book_append_sheet(wb, ws, sheet);

    const dateStr = new Date().toISOString().split("T")[0];
    const finalName = `${filename}_${dateStr}.xlsx`;

    XLSX.writeFile(wb, finalName);
    toast.success("Export completed successfully");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to export data";
    toast.error(message);
  }
}
