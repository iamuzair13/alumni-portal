"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function FixAccessAssignmentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{
    preview?: boolean;
    message?: string;
    assignments?: Array<{
      id: number;
      userid: number;
      faculty_name: string;
      department_name: string | null;
      program_name: string | null;
      correction?: { correct: string };
    }>;
  } | null>(null);
  const [result, setResult] = useState<{
    success?: boolean;
    message?: string;
    updated?: Array<{
      id: number;
      userid: number;
      faculty_name: string;
      department_name: string | null;
      program_name: string | null;
    }>;
    details?: {
      totalUnique: number;
      corrections: Array<{ from: string; to: string; updated: number }>;
    };
  } | null>(null);

  const handlePreview = async () => {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/fix-access-assignments");
      const data = await response.json();
      if (response.ok) {
        setPreview(data);
        toast.success(`Found ${data.assignments?.length || 0} assignment(s) to fix`);
      } else {
        toast.error(data.error || "Failed to preview");
      }
    } catch (error) {
      toast.error("Failed to preview assignments");

    } finally {
      setLoading(false);
    }
  };

  const handleFix = async () => {
    if (!preview || !preview.assignments || preview.assignments.length === 0) {
      toast.error("Please preview first");
      return;
    }

    if (!confirm(`Are you sure you want to update ${preview.assignments.length} assignment(s)?`)) {
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/fix-access-assignments", {
        method: "POST",
      });
      const data = await response.json();
      if (response.ok) {
        setResult(data);
        setPreview(null);
        toast.success(data.message || "Assignments updated successfully!");
        // Refresh after 2 seconds
        setTimeout(() => {
          router.refresh();
        }, 2000);
      } else {
        toast.error(data.error || "Failed to update assignments");
      }
    } catch (error) {
      toast.error("Failed to update assignments");

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Fix Access Assignments
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          This tool will fix all faculty name typos and inconsistencies in access assignments.
        </p>
        <div className="mt-3 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
            Corrections that will be applied:
          </p>
          <ul className="mt-2 space-y-1 text-xs text-blue-800 dark:text-blue-200">
            <li>• &quot;FIT&quot; → &quot;Faculty of Information Technology&quot;</li>
            <li>• &quot;Faculty of Alllied health sciences&quot; → &quot;Faculty of Allied Health Sciences&quot;</li>
            <li>• &quot;Faculty of language and literature&quot; → &quot;Faculty of Languages & Literature&quot;</li>
            <li>• &quot;Faculty of Mangement sciences&quot; → &quot;Faculty of Management Sciences&quot;</li>
            <li>• &quot;Faculty of medicine and Dentistry&quot; → &quot;Faculty of Medicine & Dentistry&quot;</li>
          </ul>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex gap-4">
            <button
              onClick={handlePreview}
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Preview Assignments"}
            </button>
            {preview && preview.assignments && preview.assignments.length > 0 && (
              <button
                onClick={handleFix}
                disabled={loading}
                className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? "Fixing..." : `Fix ${preview.assignments.length} Assignment(s)`}
              </button>
            )}
          </div>
        </div>

        {preview && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Preview
            </h2>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              {preview.message}
            </p>
            {preview.assignments && preview.assignments.length > 0 && (
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {preview.assignments.map((assignment, index: number) => (
                  <div
                    key={assignment.id || index}
                    className="rounded border border-gray-200 p-3 text-sm dark:border-gray-700"
                  >
                    <div className="font-medium text-gray-900 dark:text-white">
                      ID: {assignment.id} | User ID: {assignment.userid}
                    </div>
                    <div className="mt-1 text-gray-600 dark:text-gray-400">
                      <div>
                        <span className="text-red-600 dark:text-red-400">Old:</span>{" "}
                        {assignment.faculty_name}
                      </div>
                      <div>
                        <span className="text-green-600 dark:text-green-400">New:</span>{" "}
                        {assignment.correction?.correct || "Will be corrected"}
                      </div>
                      <div className="mt-1">
                        Department: {assignment.department_name || "N/A"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-6 shadow-sm dark:border-green-800 dark:bg-green-900/20">
            <h2 className="mb-4 text-lg font-semibold text-green-900 dark:text-green-100">
              Success!
            </h2>
            <p className="mb-4 text-sm text-green-800 dark:text-green-200">
              {result.message}
            </p>
            {result.details && (
              <div className="space-y-3 text-sm text-green-700 dark:text-green-300">
                <div className="font-semibold">
                  Total unique updates: {result.details.totalUnique}
                </div>
                {result.details.corrections && result.details.corrections.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="font-semibold">Corrections applied:</p>
                    {result.details.corrections
                      .filter((corr: { updated: number }) => corr.updated > 0)
                      .map((corr: { from: string; to: string; updated: number }, idx: number) => (
                        <div key={idx} className="rounded bg-green-100 p-2 text-xs dark:bg-green-900/30">
                          <div className="font-medium">{corr.from} → {corr.to}</div>
                          <div className="text-green-600 dark:text-green-400">
                            {corr.updated} assignment(s) updated
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
            {result.updated && result.updated.length > 0 && (
              <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
                {result.updated.map((assignment: { id: number; userid: number; faculty_name: string }, index: number) => (
                  <div
                    key={assignment.id || index}
                    className="rounded border border-green-300 bg-white p-2 text-xs dark:border-green-700 dark:bg-gray-800"
                  >
                    ID: {assignment.id} | User: {assignment.userid} | Faculty:{" "}
                    {assignment.faculty_name}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4">
              <button
                onClick={() => {
                  setResult(null);
                  setPreview(null);
                  router.push("/alumni-list");
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Go to Alumni List
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

