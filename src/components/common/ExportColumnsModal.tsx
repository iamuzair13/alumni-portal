"use client";

import React from "react";
import { Modal } from "@/components/ui/modal";
import type { ColumnOption } from "@/lib/excel-export";

export type ExportColumnsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  isExporting: boolean;
  columns: ColumnOption[];
  selectedColumns: Set<string>;
  onToggleColumn: (key: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onExport: () => void;
  title?: string;
  description?: string;
};

export const ExportColumnsModal: React.FC<ExportColumnsModalProps> = ({
  isOpen,
  onClose,
  isExporting,
  columns,
  selectedColumns,
  onToggleColumn,
  onSelectAll,
  onDeselectAll,
  onExport,
  title = "Select Columns to Export",
  description = "Choose which columns you want to include in the Excel export.",
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-2xl mx-auto"
      showCloseButton={true}
    >
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          {title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {description}
        </p>

        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onSelectAll}
            disabled={isExporting}
            className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={onDeselectAll}
            disabled={isExporting}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Deselect All
          </button>
          <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
            {selectedColumns.size} of {columns.length} selected
          </span>
        </div>

        <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4 bg-white dark:bg-gray-900">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {columns.map((column) => (
              <label
                key={column.key}
                className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedColumns.has(column.key)}
                  onChange={() => onToggleColumn(column.key)}
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
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onExport}
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
