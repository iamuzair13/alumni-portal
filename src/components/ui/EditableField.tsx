"use client";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";

type EditableFieldProps = {
  label: string;
  value: unknown;
  fieldKey: string;
  onUpdate?: (key: string, value: unknown) => Promise<void>;
  onValueChange?: (key: string, value: unknown) => void;
  type?: "text" | "email" | "tel" | "number" | "textarea" | "select" | "checkbox" | "password" | "date";
  options?: Array<{ value: string; label: string }>;
  disabled?: boolean;
  batchMode?: boolean;
  datalistId?: string;
  placeholder?: string;
};

export default function EditableField({
  label,
  value,
  fieldKey,
  onUpdate,
  onValueChange,
  type = "text",
  options,
  disabled = false,
  batchMode = false,
  datalistId,
  placeholder,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>(() => {
    if (value === null || value === undefined) return "";
    if (typeof value === "boolean") return value ? "true" : "false";
    // For password fields, show the actual password value
    if (type === "password") {
      return String(value).trim();
    }
    return String(value);
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // Sync editValue when value prop changes (e.g., after save)
  useEffect(() => {
    if (!isEditing) {
      const newValue = value === null || value === undefined ? "" : (typeof value === "boolean" ? (value ? "true" : "false") : String(value));
      setEditValue(newValue);
    }
  }, [value, isEditing]);

  const convertValue = (val: string): unknown => {
    if (type === "checkbox") {
      return val === "true";
    } else if (type === "number") {
      return val === "" ? null : parseFloat(val);
    } else if (type === "text" || type === "textarea" || type === "email" || type === "tel" || type === "select" || type === "password" || type === "date") {
      // For textarea, preserve the value as-is (trimmed) even if it's empty string
      // This allows the validation to properly check if a required field is filled
      const trimmed = val.trim();
      return trimmed === "" ? null : trimmed;
    }
    return val.trim();
  };

  const handleSave = async () => {
    if (disabled || isUpdating) return;
    
    if (batchMode && onValueChange) {
      // In batch mode, just notify parent of the change
      const finalValue = convertValue(editValue);
      onValueChange(fieldKey, finalValue);
      setIsEditing(false);
      return;
    }

    if (!onUpdate) return;
    
    setIsUpdating(true);
    try {
      const finalValue = convertValue(editValue);
      await onUpdate(fieldKey, finalValue);
      setIsEditing(false);
      toast.success(`${label} updated successfully`, {
        duration: 3000,
        style: {
          background: '#d1fae5',
          color: '#065f46',
          padding: '12px',
          borderRadius: '8px',
        },
      });
    } catch {
      toast.error(`Failed to update ${label}`, {
        duration: 4000,
        style: {
          background: '#fee2e2',
          color: '#991b1b',
          padding: '12px',
          borderRadius: '8px',
        },
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value === null || value === undefined ? "" : (typeof value === "boolean" ? (value ? "true" : "false") : String(value)));
    setIsEditing(false);
    // In batch mode, notify parent to remove this field from pending changes
    if (batchMode && onValueChange) {
      onValueChange(fieldKey, undefined);
    }
  };

  const displayValue = (val: unknown): string => {
    if (val === null || val === undefined) return "Not provided";
    if (typeof val === "boolean") return val ? "Yes" : "No";
    // For password fields, show the actual password text
    if (type === "password") {
      const strVal = String(val).trim();
      return strVal === "" ? "Not provided" : strVal;
    }
    // For select fields, try to find the label from options
    if (type === "select" && options) {
      const option = options.find(opt => opt.value === String(val));
      if (option) return option.label;
    }
    // Special handling for "Not applicable" - show as "Not applicable" (not "Not application")
    const strVal = String(val).trim();
    if (strVal === "Not applicable") return "Not applicable";
    return strVal;
  };

  if (disabled) {
    return (
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-500 mb-1">{label}</span>
        <span className="text-base text-gray-900 break-words">{displayValue(value)}</span>
      </div>
    );
  }

  if (!isEditing) {
    return (
      <div className="flex flex-col group">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-500">{label}</span>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all duration-200"
            aria-label={`Edit ${label}`}
            title={`Edit ${label}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>
        <span className="text-base text-gray-900 break-words">{displayValue(value)}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <span className="text-sm font-medium text-gray-500 mb-1">{label}</span>
      <div className="flex flex-col gap-2">
        {type === "textarea" ? (
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full rounded border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            disabled={isUpdating}
          />
        ) : type === "select" ? (
          <select
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full rounded border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isUpdating}
          >
            <option value="">Select</option>
            {options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : type === "checkbox" ? (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={editValue === "true"}
              onChange={(e) => setEditValue(e.target.checked ? "true" : "false")}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              disabled={isUpdating}
            />
            <span className="text-sm text-gray-700">Show this information</span>
          </label>
        ) : (
          <input
            type={type}
            value={editValue}
            list={datalistId}
            placeholder={placeholder || `Enter ${label.toLowerCase()}`}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full rounded border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isUpdating}
          />
        )}
        {!batchMode && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isUpdating}
              className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdating ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isUpdating}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        )}
        {batchMode && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
              Cancel
            </button>
            <span className="text-xs text-gray-500">Save all changes together</span>
          </div>
        )}
      </div>
    </div>
  );
}

