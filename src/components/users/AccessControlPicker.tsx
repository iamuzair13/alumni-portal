"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";

export type AccessAssignmentsValue = {
  faculties: string[];
  departments: string[];
  programs: string[];
};

type FacultyRow = {
  id: number;
  faculty_name: string | null;
};

type DepartmentRow = {
  id: number;
  department_name: string | null;
  faculty_id: number | null;
  faculty_name: string | null;
};

type ProgramRow = {
  id: number;
  program_name: string | null;
  department_id: number | null;
  department_name: string | null;
  faculty_id: number | null;
  faculty_name: string | null;
};

type Mode = "faculty" | "department" | "program";

type Props = {
  value: AccessAssignmentsValue;
  onChange: (next: AccessAssignmentsValue) => void;
  disabled?: boolean;
};

function norm(v: string) {
  return v.toLowerCase().trim();
}

function uniqTrim(values: string[]) {
  const m = new Map<string, string>();
  for (const raw of values) {
    const t = String(raw ?? "").trim();
    if (!t) continue;
    const k = norm(t);
    if (!m.has(k)) m.set(k, t);
  }
  return Array.from(m.values());
}

function pickInitialMode(v: AccessAssignmentsValue): Mode {
  if (v.programs?.length) return "program";
  if (v.departments?.length) return "department";
  return "faculty";
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "GET" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.error === "string" ? data.error : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export default function AccessControlPicker({ value, onChange, disabled }: Props) {
  const [mode, setMode] = useState<Mode>(() => pickInitialMode(value));
  const [search, setSearch] = useState("");

  // When loading existing user, infer a reasonable mode from saved values.
  useEffect(() => {
    setMode(pickInitialMode(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.faculties.join("|"), value.departments.join("|"), value.programs.join("|")]);

  const facultiesQuery = useQuery({
    queryKey: ["org", "faculties"],
    queryFn: () =>
      fetchJson<{ success: boolean; faculties: FacultyRow[] }>("/api/organization/faculties"),
  });

  const departmentsQuery = useQuery({
    queryKey: ["org", "departments"],
    queryFn: () =>
      fetchJson<{ success: boolean; departments: DepartmentRow[] }>("/api/organization/departments"),
  });

  const programsQuery = useQuery({
    queryKey: ["org", "programs"],
    queryFn: () =>
      fetchJson<{ success: boolean; programs: ProgramRow[] }>("/api/organization/programs"),
  });

  const faculties = useMemo(() => {
    const rows = facultiesQuery.data?.faculties ?? [];
    return rows
      .map((r) => String(r.faculty_name ?? "").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [facultiesQuery.data]);

  const departments = useMemo(() => {
    const rows = departmentsQuery.data?.departments ?? [];
    return rows
      .filter((r) => r.department_name && r.faculty_name)
      .map((r) => ({
        id: Number(r.id),
        department: String(r.department_name ?? "").trim(),
        faculty: String(r.faculty_name ?? "").trim(),
      }))
      .filter((r) => r.department && r.faculty)
      .sort((a, b) => a.department.localeCompare(b.department));
  }, [departmentsQuery.data]);

  const programs = useMemo(() => {
    const rows = programsQuery.data?.programs ?? [];
    return rows
      .filter((r) => r.program_name && r.department_name && r.faculty_name)
      .map((r) => ({
        id: Number(r.id),
        program: String(r.program_name ?? "").trim(),
        department: String(r.department_name ?? "").trim(),
        faculty: String(r.faculty_name ?? "").trim(),
      }))
      .filter((r) => r.program && r.department && r.faculty)
      .sort((a, b) => a.program.localeCompare(b.program));
  }, [programsQuery.data]);

  const selectedFacultyNorm = useMemo(() => new Set(uniqTrim(value.faculties).map(norm)), [value.faculties]);
  const selectedDeptNorm = useMemo(() => new Set(uniqTrim(value.departments).map(norm)), [value.departments]);
  const selectedProgNorm = useMemo(() => new Set(uniqTrim(value.programs).map(norm)), [value.programs]);

  const visibleFaculties = useMemo(() => {
    const q = norm(search);
    if (!q) return faculties;
    return faculties.filter((f) => norm(f).includes(q));
  }, [faculties, search]);

  const visibleDepartments = useMemo(() => {
    const q = norm(search);
    const inSelectedFaculties = departments.filter((d) => selectedFacultyNorm.has(norm(d.faculty)));
    if (!q) return inSelectedFaculties;
    return inSelectedFaculties.filter((d) => norm(d.department).includes(q) || norm(d.faculty).includes(q));
  }, [departments, search, selectedFacultyNorm]);

  const visiblePrograms = useMemo(() => {
    const q = norm(search);
    const inSelectedDepartments = programs.filter((p) => selectedDeptNorm.has(norm(p.department)));
    if (!q) return inSelectedDepartments;
    return inSelectedDepartments.filter(
      (p) => norm(p.program).includes(q) || norm(p.department).includes(q) || norm(p.faculty).includes(q)
    );
  }, [programs, search, selectedDeptNorm]);

  const isLoading = facultiesQuery.isLoading || departmentsQuery.isLoading || programsQuery.isLoading;
  const loadError = facultiesQuery.error || departmentsQuery.error || programsQuery.error;

  const setModeSafe = (nextMode: Mode) => {
    setMode(nextMode);
    if (nextMode === "faculty") {
      onChange({ faculties: uniqTrim(value.faculties), departments: [], programs: [] });
    } else if (nextMode === "department") {
      onChange({ faculties: uniqTrim(value.faculties), departments: uniqTrim(value.departments), programs: [] });
    }
  };

  const toggleFaculty = (faculty: string) => {
    const key = norm(faculty);
    const nextFaculties = new Set(selectedFacultyNorm);
    if (nextFaculties.has(key)) nextFaculties.delete(key);
    else nextFaculties.add(key);

    const canonicalFaculties = faculties.filter((f) => nextFaculties.has(norm(f)));

    // prune departments/programs that are no longer in selected faculties
    const allowedDeptNorm = new Set(
      departments.filter((d) => nextFaculties.has(norm(d.faculty))).map((d) => norm(d.department))
    );
    const nextDepartments = uniqTrim(value.departments).filter((d) => allowedDeptNorm.has(norm(d)));

    const allowedProgNorm = new Set(
      programs.filter((p) => allowedDeptNorm.has(norm(p.department))).map((p) => norm(p.program))
    );
    const nextPrograms = uniqTrim(value.programs).filter((p) => allowedProgNorm.has(norm(p)));

    onChange({
      faculties: canonicalFaculties,
      departments: mode === "faculty" ? [] : nextDepartments,
      programs: mode === "program" ? nextPrograms : [],
    });
  };

  const toggleDepartment = (department: string) => {
    const deptKey = norm(department);
    const nextDepts = new Set(selectedDeptNorm);
    if (nextDepts.has(deptKey)) nextDepts.delete(deptKey);
    else nextDepts.add(deptKey);

    // auto-include the parent faculty for selected departments
    const parentFaculties = new Set<string>();
    for (const d of departments) {
      if (nextDepts.has(norm(d.department))) parentFaculties.add(norm(d.faculty));
    }

    const nextFaculties = new Set(selectedFacultyNorm);
    for (const f of parentFaculties) nextFaculties.add(f);

    const canonicalFaculties = faculties.filter((f) => nextFaculties.has(norm(f)));
    const canonicalDepts = departments
      .filter((d) => nextDepts.has(norm(d.department)) && nextFaculties.has(norm(d.faculty)))
      .map((d) => d.department);

    const allowedProgNorm = new Set(
      programs.filter((p) => nextDepts.has(norm(p.department))).map((p) => norm(p.program))
    );
    const nextPrograms = uniqTrim(value.programs).filter((p) => allowedProgNorm.has(norm(p)));

    onChange({
      faculties: canonicalFaculties,
      departments: mode === "faculty" ? [] : canonicalDepts,
      programs: mode === "program" ? nextPrograms : [],
    });
  };

  const toggleProgram = (programName: string) => {
    const progKey = norm(programName);
    const nextProgs = new Set(selectedProgNorm);
    if (nextProgs.has(progKey)) nextProgs.delete(progKey);
    else nextProgs.add(progKey);

    // auto-include parent dept + faculty for selected programs
    const parentDeptNorm = new Set<string>();
    const parentFacultyNorm = new Set<string>();
    for (const p of programs) {
      if (nextProgs.has(norm(p.program))) {
        parentDeptNorm.add(norm(p.department));
        parentFacultyNorm.add(norm(p.faculty));
      }
    }

    const nextFaculties = new Set(selectedFacultyNorm);
    for (const f of parentFacultyNorm) nextFaculties.add(f);

    const nextDepts = new Set(selectedDeptNorm);
    for (const d of parentDeptNorm) nextDepts.add(d);

    const canonicalFaculties = faculties.filter((f) => nextFaculties.has(norm(f)));
    const canonicalDepts = departments
      .filter((d) => nextDepts.has(norm(d.department)) && nextFaculties.has(norm(d.faculty)))
      .map((d) => d.department);
    const canonicalProgs = programs.filter((p) => nextProgs.has(norm(p.program))).map((p) => p.program);

    onChange({
      faculties: canonicalFaculties,
      departments: canonicalDepts,
      programs: canonicalProgs,
    });
  };

  const selectAllVisible = () => {
    if (mode === "faculty") {
      onChange({ faculties: visibleFaculties, departments: [], programs: [] });
      return;
    }
    if (mode === "department") {
      // select all departments under selected faculties (and visible by search)
      const depts = visibleDepartments.map((d) => d.department);
      onChange({ faculties: uniqTrim(value.faculties), departments: uniqTrim(depts), programs: [] });
      return;
    }
    // program
    const progs = visiblePrograms.map((p) => p.program);
    onChange({ faculties: uniqTrim(value.faculties), departments: uniqTrim(value.departments), programs: uniqTrim(progs) });
  };

  const clearAll = () => onChange({ faculties: [], departments: [], programs: [] });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Label>Scope</Label>
          <div className="mt-2 inline-flex w-full flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setModeSafe("faculty")}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                mode === "faculty"
                  ? "border-blue-300 bg-white text-blue-700 dark:border-blue-700 dark:bg-gray-900 dark:text-blue-300"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              }`}
            >
              Faculty
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setModeSafe("department")}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                mode === "department"
                  ? "border-blue-300 bg-white text-blue-700 dark:border-blue-700 dark:bg-gray-900 dark:text-blue-300"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              }`}
            >
              Department
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setModeSafe("program")}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                mode === "program"
                  ? "border-blue-300 bg-white text-blue-700 dark:border-blue-700 dark:bg-gray-900 dark:text-blue-300"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              }`}
            >
              Program
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            Faculty = all departments/programs in selected faculties. Department = all programs in selected departments. Program = only selected programs.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-[240px]">
            <Label htmlFor="access-search">Search</Label>
            <Input
              id="access-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search faculty / department / program..."
              className="w-full"
              disabled={disabled}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={disabled || isLoading}
              onClick={selectAllVisible}
              className="h-11 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Select all
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={clearAll}
              className="h-11 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {(isLoading || loadError) && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
          {isLoading ? "Loading faculties/departments/programs..." : `Failed to load organization data: ${(loadError as Error)?.message}`}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Faculties */}
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">Faculties</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{value.faculties.length} selected</div>
            </div>
          </div>
          <div className="max-h-[320px] overflow-auto p-2">
            {visibleFaculties.length === 0 ? (
              <div className="p-3 text-sm text-gray-500 dark:text-gray-400">No faculties found.</div>
            ) : (
              visibleFaculties.map((f) => {
                const checked = selectedFacultyNorm.has(norm(f));
                return (
                  <label
                    key={f}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-700"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleFaculty(f)}
                    />
                    <span className="min-w-0 flex-1 truncate text-gray-800 dark:text-gray-200">{f}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Departments */}
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">Departments</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{value.departments.length} selected</div>
            </div>
            {mode === "faculty" && (
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Select “Department” scope to enable department selection.</div>
            )}
          </div>
          <div className={`max-h-[320px] overflow-auto p-2 ${mode === "faculty" ? "opacity-50" : ""}`}>
            {mode === "faculty" ? (
              <div className="p-3 text-sm text-gray-500 dark:text-gray-400">Disabled in Faculty scope.</div>
            ) : selectedFacultyNorm.size === 0 ? (
              <div className="p-3 text-sm text-gray-500 dark:text-gray-400">Select at least one faculty.</div>
            ) : visibleDepartments.length === 0 ? (
              <div className="p-3 text-sm text-gray-500 dark:text-gray-400">No departments for selected faculties.</div>
            ) : (
              visibleDepartments.map((d) => {
                const checked = selectedDeptNorm.has(norm(d.department));
                return (
                  <label
                    key={`${d.faculty}::${d.department}`}
                    className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-700"
                      checked={checked}
                      disabled={disabled || mode === "faculty"}
                      onChange={() => toggleDepartment(d.department)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-gray-800 dark:text-gray-200">{d.department}</div>
                      <div className="truncate text-xs text-gray-500 dark:text-gray-400">{d.faculty}</div>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Programs */}
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">Programs</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{value.programs.length} selected</div>
            </div>
            {mode !== "program" && (
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Select “Program” scope to enable program selection.</div>
            )}
          </div>
          <div className={`max-h-[320px] overflow-auto p-2 ${mode !== "program" ? "opacity-50" : ""}`}>
            {mode !== "program" ? (
              <div className="p-3 text-sm text-gray-500 dark:text-gray-400">Disabled unless Program scope is selected.</div>
            ) : selectedDeptNorm.size === 0 ? (
              <div className="p-3 text-sm text-gray-500 dark:text-gray-400">Select at least one department.</div>
            ) : visiblePrograms.length === 0 ? (
              <div className="p-3 text-sm text-gray-500 dark:text-gray-400">No programs for selected departments.</div>
            ) : (
              visiblePrograms.map((p) => {
                const checked = selectedProgNorm.has(norm(p.program));
                return (
                  <label
                    key={`${p.department}::${p.program}`}
                    className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-700"
                      checked={checked}
                      disabled={disabled || mode !== "program"}
                      onChange={() => toggleProgram(p.program)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-gray-800 dark:text-gray-200">{p.program}</div>
                      <div className="truncate text-xs text-gray-500 dark:text-gray-400">{p.department}</div>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
        <div className="flex flex-wrap gap-2">
          <span className="font-semibold">Selected:</span>
          <span className="text-gray-600 dark:text-gray-400">
            {value.faculties.length} faculties • {value.departments.length} departments • {value.programs.length} programs
          </span>
        </div>
      </div>
    </div>
  );
}


