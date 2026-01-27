"use client";

import React, { useState, useCallback, useMemo, useRef } from "react";
import toast from "react-hot-toast";
import { ExportColumnsModal } from "@/components/common/ExportColumnsModal";

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

  const exportConfigRef = useRef<ExcelExportOptions | null>(null);
  const isOpenRef = useRef(false);
  const isExportingRef = useRef(false);
  const memoizedColumnsRef = useRef<ColumnOption[]>([]);
  const selectedColumnsRef = useRef<Set<string>>(new Set());

  const closeExportModalRef = useRef<() => void>(() => undefined);
  const toggleColumnRef = useRef<(key: string) => void>(() => undefined);
  const selectAllColumnsRef = useRef<() => void>(() => undefined);
  const deselectAllColumnsRef = useRef<() => void>(() => undefined);
  const handleExportRef = useRef<() => void>(() => undefined);

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

  exportConfigRef.current = exportConfig;
  isOpenRef.current = isOpen;
  isExportingRef.current = isExporting;
  memoizedColumnsRef.current = memoizedColumns;
  selectedColumnsRef.current = selectedColumns;

  closeExportModalRef.current = closeExportModal;
  toggleColumnRef.current = toggleColumn;
  selectAllColumnsRef.current = selectAllColumns;
  deselectAllColumnsRef.current = deselectAllColumns;
  handleExportRef.current = handleExport;

  const ExportModalRef = useRef<React.FC | null>(null);
  if (ExportModalRef.current === null) {
    ExportModalRef.current = () => {
      if (!exportConfigRef.current) return null;

      return (
        <ExportColumnsModal
          isOpen={isOpenRef.current}
          onClose={closeExportModalRef.current}
          isExporting={isExportingRef.current}
          columns={memoizedColumnsRef.current}
          selectedColumns={selectedColumnsRef.current}
          onToggleColumn={toggleColumnRef.current}
          onSelectAll={selectAllColumnsRef.current}
          onDeselectAll={deselectAllColumnsRef.current}
          onExport={handleExportRef.current}
        />
      );
    };
  }

  return {
    isExporting,
    openExportModal,
    ExportModal: ExportModalRef.current,
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
