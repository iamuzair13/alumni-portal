"use client";

import { useCallback, useEffect, useState } from "react";

export type OrgFaculty = { id: number; name: string };
export type OrgDepartment = { id: number; name: string; facultyId: number };

type OrgDatasetsResponse = {
  success?: boolean;
  faculties?: Array<{ id: number; faculty_name?: string }>;
  departments?: Array<{ id: number; department_name?: string; faculty_id?: number | null }>;
};

export function useOrgDatasets(enabled = true) {
  const [faculties, setFaculties] = useState<OrgFaculty[]>([]);
  const [departments, setDepartments] = useState<OrgDepartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/public/org-datasets", { headers: { accept: "application/json" } });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(txt || `Failed to load faculties and departments (${res.status})`);
        }
        const data = (await res.json()) as OrgDatasetsResponse;

        const mappedFaculties = (data.faculties ?? [])
          .map((f) => ({ id: Number(f.id), name: String(f.faculty_name ?? "").trim() }))
          .filter((f) => Number.isFinite(f.id) && f.id > 0 && f.name);

        const mappedDepartments = (data.departments ?? [])
          .map((d) => ({
            id: Number(d.id),
            name: String(d.department_name ?? "").trim(),
            facultyId: Number(d.faculty_id),
          }))
          .filter((d) => Number.isFinite(d.id) && d.id > 0 && d.name && Number.isFinite(d.facultyId) && d.facultyId > 0);

        if (!cancelled) {
          setFaculties(mappedFaculties);
          setDepartments(mappedDepartments);
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Failed to load faculties and departments";
          setError(msg);
          setFaculties([]);
          setDepartments([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const departmentsForFaculty = useCallback(
    (facultyId: number | null | undefined) => {
      if (!facultyId || !Number.isFinite(facultyId)) return [];
      return departments.filter((d) => d.facultyId === facultyId);
    },
    [departments]
  );

  const findFacultyByName = useCallback(
    (name: string) => {
      const normalized = name.trim().toLowerCase();
      if (!normalized) return undefined;
      return faculties.find((f) => f.name.toLowerCase() === normalized);
    },
    [faculties]
  );

  const findDepartmentByName = useCallback(
    (facultyId: number, name: string) => {
      const normalized = name.trim().toLowerCase();
      if (!normalized) return undefined;
      return departmentsForFaculty(facultyId).find((d) => d.name.toLowerCase() === normalized);
    },
    [departmentsForFaculty]
  );

  return {
    faculties,
    departments,
    departmentsForFaculty,
    findFacultyByName,
    findDepartmentByName,
    loading,
    error,
  };
}
