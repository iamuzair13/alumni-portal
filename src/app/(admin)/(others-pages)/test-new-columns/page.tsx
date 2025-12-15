"use client";

import React, { useEffect, useState } from "react";
import ComponentCard from "@/components/common/ComponentCard";

type StatItem = {
  faculty_id?: number;
  department_id?: number;
  program_id?: number;
  faculty_name?: string | null;
  department_name?: string | null;
  program_name?: string | null;
  record_count: number;
};

type TestData = {
  faculties: StatItem[];
  departments: StatItem[];
  programs: StatItem[];
  nullCounts: {
    faculty: number;
    department: number;
    program: number;
  };
};

export default function TestNewColumnsPage() {
  const [data, setData] = useState<TestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/alumni/test-new-columns", {
          headers: { "accept": "application/json" },
        });
        
        if (!res.ok) {
          throw new Error(`Failed to fetch: ${res.status}`);
        }
        
        const result = await res.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <ComponentCard title="Test New Columns: Faculty, Department, Program" className="">
      <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
          Testing New Columns
        </h3>
        <p className="text-xs text-blue-700 dark:text-blue-300">
          This page displays unique values of <strong>faculty</strong>, <strong>department</strong>, and <strong>program</strong> 
          from the new foreign key columns in <code>tbl_alumni</code> with record counts showing how many alumni are assigned to each.
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-sm text-gray-600 dark:text-gray-400">Loading test data...</span>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          <p className="text-sm font-semibold">Error:</p>
          <p className="text-xs mt-1">{error}</p>
        </div>
      )}

      {!loading && !error && data && (
        <div className="space-y-6">
          {/* Faculties */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Faculties ({data.faculties.length} unique)
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b">
                      Faculty ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b">
                      Faculty Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b">
                      Record Count
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {data.faculties.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        No faculties found
                      </td>
                    </tr>
                  ) : (
                    <>
                      {data.faculties.map((item) => (
                        <tr key={item.faculty_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-3 text-xs text-gray-900 dark:text-gray-100 font-mono">
                            {item.faculty_id || "-"}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-900 dark:text-gray-100 font-semibold">
                            {item.faculty_name || <span className="text-gray-400 italic">NULL</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-900 dark:text-gray-100">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                              {item.record_count}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {data.nullCounts.faculty > 0 && (
                        <tr className="bg-yellow-50 dark:bg-yellow-900/20">
                          <td className="px-4 py-3 text-xs text-gray-900 dark:text-gray-100 font-mono">
                            NULL
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 italic">
                            No faculty assigned
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-900 dark:text-gray-100">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                              {data.nullCounts.faculty}
                            </span>
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Departments */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Departments ({data.departments.length} unique)
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b">
                      Department ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b">
                      Department Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b">
                      Record Count
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {data.departments.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        No departments found
                      </td>
                    </tr>
                  ) : (
                    <>
                      {data.departments.map((item) => (
                        <tr key={item.department_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-3 text-xs text-gray-900 dark:text-gray-100 font-mono">
                            {item.department_id || "-"}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-900 dark:text-gray-100 font-semibold">
                            {item.department_name || <span className="text-gray-400 italic">NULL</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-900 dark:text-gray-100">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                              {item.record_count}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {data.nullCounts.department > 0 && (
                        <tr className="bg-yellow-50 dark:bg-yellow-900/20">
                          <td className="px-4 py-3 text-xs text-gray-900 dark:text-gray-100 font-mono">
                            NULL
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 italic">
                            No department assigned
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-900 dark:text-gray-100">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                              {data.nullCounts.department}
                            </span>
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Programs */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Programs ({data.programs.length} unique)
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b">
                      Program ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b">
                      Program Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b">
                      Record Count
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {data.programs.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        No programs found
                      </td>
                    </tr>
                  ) : (
                    <>
                      {data.programs.map((item) => (
                        <tr key={item.program_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-3 text-xs text-gray-900 dark:text-gray-100 font-mono">
                            {item.program_id || "-"}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-900 dark:text-gray-100 font-semibold">
                            {item.program_name || <span className="text-gray-400 italic">NULL</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-900 dark:text-gray-100">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                              {item.record_count}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {data.nullCounts.program > 0 && (
                        <tr className="bg-yellow-50 dark:bg-yellow-900/20">
                          <td className="px-4 py-3 text-xs text-gray-900 dark:text-gray-100 font-mono">
                            NULL
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 italic">
                            No program assigned
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-900 dark:text-gray-100">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                              {data.nullCounts.program}
                            </span>
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </ComponentCard>
  );
}

