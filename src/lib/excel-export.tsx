"use client";

import React, { useState, useCallback } from "react";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import toast from "react-hot-toast";

export type ColumnOption = {
  key: string;
  label: string;
  defaultSelected?: boolean;
};

export type ExcelExportOptions = {
  data: Record<string, unknown>[];
  columns: ColumnOption[];
  filename: string;
  sheetName?: string;
  onExport?: (selectedColumns: string[]) => void;
};

/**
 * Hook for Excel export with column selection modal
 */
export function useExcelExport() {
  const [isExporting, setIsExporting] = useState(false);
  const columnModal = useModal();
  const [exportConfig, setExportConfig] = useState<ExcelExportOptions | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());

  const openExportModal = useCallback((options: ExcelExportOptions) => {
    // Initialize selected columns based on defaultSelected flags
    const initialSelected = new Set<string>();
    options.columns.forEach(col => {
      if (col.defaultSelected !== false) {
        initialSelected.add(col.key);
      }
    });
    setSelectedColumns(initialSelected);
    setExportConfig(options);
    columnModal.openModal();
  }, [columnModal]);

  const toggleColumn = useCallback((key: string) => {
    setSelectedColumns(prev => {
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
    setSelectedColumns(new Set(exportConfig.columns.map(col => col.key)));
  }, [exportConfig]);

  const deselectAllColumns = useCallback(() => {
    setSelectedColumns(new Set());
  }, []);

  const handleExport = useCallback(async () => {
    if (!exportConfig || selectedColumns.size === 0) {
      toast.error("Please select at least one column to export");
      return;
    }

    setIsExporting(true);
    columnModal.closeModal();

    try {
      // Dynamically import xlsx to avoid server-side bundling issues
      const XLSX = await import("xlsx");

      // Filter data to only include selected columns
      const selectedColumnKeys = Array.from(selectedColumns);
      const filteredData = exportConfig.data.map(item => {
        const filtered: Record<string, unknown> = {};
        selectedColumnKeys.forEach(key => {
          filtered[key] = item[key] ?? "";
        });
        return filtered;
      });

      if (filteredData.length === 0) {
        toast.error("No data to export");
        setIsExporting(false);
        return;
      }

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(filteredData);

      // Set column widths
      const colWidths = selectedColumnKeys.map(() => ({ wch: 20 }));
      ws["!cols"] = colWidths;

      // Add worksheet to workbook
      const sheetName = exportConfig.sheetName || "Export";
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      // Generate filename with current date
      const dateStr = new Date().toISOString().split("T")[0];
      const filename = `${exportConfig.filename}_${dateStr}.xlsx`;

      // Write and download
      XLSX.writeFile(wb, filename);

      toast.success("Export completed successfully");

      // Call optional callback
      if (exportConfig.onExport) {
        exportConfig.onExport(selectedColumnKeys);
      }
    } catch (error) {
      console.error("Export error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to export data";
      toast.error(errorMessage);
    } finally {
      setIsExporting(false);
    }
  }, [exportConfig, selectedColumns, columnModal]);

  const ExportModal: React.FC = () => {
    if (!exportConfig) return null;

    return (
      <Modal
        isOpen={columnModal.isOpen}
        onClose={() => {
          if (!isExporting) {
            columnModal.closeModal();
          }
        }}
        className="max-w-2xl mx-auto"
        showCloseButton={true}
      >
        <div className="p-6" onClick={(e) => e.stopPropagation()}>
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
              className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={deselectAllColumns}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              Deselect All
            </button>
            <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
              {selectedColumns.size} of {exportConfig.columns.length} selected
            </span>
          </div>

          <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {exportConfig.columns.map((column) => (
                <label
                  key={column.key}
                  className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedColumns.has(column.key)}
                    onChange={() => toggleColumn(column.key)}
                    disabled={isExporting}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{column.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => columnModal.closeModal()}
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

