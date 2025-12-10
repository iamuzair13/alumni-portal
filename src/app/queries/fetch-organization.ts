"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Types
export type Faculty = {
  id: number;
  faculty_name: string;
  created_at: Date;
};

export type Department = {
  id: number;
  department_name: string;
  faculty_id: number | null;
  faculty_name: string | null;
  created_at: Date;
};

export type Program = {
  id: number;
  program_name: string;
  department_id: number | null;
  department_name: string | null;
  faculty_id: number | null;
  faculty_name: string | null;
  created_at: Date;
};

// Fetch functions
async function fetchFaculties(): Promise<Faculty[]> {
  const res = await fetch("/api/organization/faculties", {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch faculties");
  }
  const data = (await res.json()) as { success: boolean; faculties: Faculty[] };
  return data.faculties ?? [];
}

async function fetchDepartments(facultyId?: number): Promise<Department[]> {
  const url = facultyId
    ? `/api/organization/departments?faculty_id=${facultyId}`
    : "/api/organization/departments";
  const res = await fetch(url, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch departments");
  }
  const data = (await res.json()) as { success: boolean; departments: Department[] };
  return data.departments ?? [];
}

async function fetchPrograms(departmentId?: number): Promise<Program[]> {
  const url = departmentId
    ? `/api/organization/programs?department_id=${departmentId}`
    : "/api/organization/programs";
  const res = await fetch(url, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch programs");
  }
  const data = (await res.json()) as { success: boolean; programs: Program[] };
  return data.programs ?? [];
}

// Mutation functions
async function createFaculty(faculty_name: string): Promise<Faculty> {
  const res = await fetch("/api/organization/faculties", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ faculty_name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to create faculty" }));
    throw new Error(err.error || "Failed to create faculty");
  }
  const data = (await res.json()) as { success: boolean; faculty: Faculty };
  return data.faculty;
}

async function updateFaculty(id: number, faculty_name: string): Promise<Faculty> {
  const res = await fetch("/api/organization/faculties", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, faculty_name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to update faculty" }));
    throw new Error(err.error || "Failed to update faculty");
  }
  const data = (await res.json()) as { success: boolean; faculty: Faculty };
  return data.faculty;
}

async function deleteFaculty(id: number): Promise<void> {
  const res = await fetch(`/api/organization/faculties?id=${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to delete faculty" }));
    throw new Error(err.error || "Failed to delete faculty");
  }
}

async function createDepartment(department_name: string, faculty_id: number): Promise<Department> {
  const res = await fetch("/api/organization/departments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ department_name, faculty_id }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to create department" }));
    throw new Error(err.error || "Failed to create department");
  }
  const data = (await res.json()) as { success: boolean; department: Department };
  return data.department;
}

async function updateDepartment(id: number, department_name: string, faculty_id: number): Promise<Department> {
  const res = await fetch("/api/organization/departments", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, department_name, faculty_id }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to update department" }));
    throw new Error(err.error || "Failed to update department");
  }
  const data = (await res.json()) as { success: boolean; department: Department };
  return data.department;
}

async function deleteDepartment(id: number): Promise<void> {
  const res = await fetch(`/api/organization/departments?id=${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to delete department" }));
    throw new Error(err.error || "Failed to delete department");
  }
}

async function createProgram(program_name: string, department_id: number): Promise<Program> {
  const res = await fetch("/api/organization/programs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ program_name, department_id }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to create program" }));
    throw new Error(err.error || "Failed to create program");
  }
  const data = (await res.json()) as { success: boolean; program: Program };
  return data.program;
}

async function updateProgram(id: number, program_name: string, department_id: number): Promise<Program> {
  const res = await fetch("/api/organization/programs", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, program_name, department_id }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to update program" }));
    throw new Error(err.error || "Failed to update program");
  }
  const data = (await res.json()) as { success: boolean; program: Program };
  return data.program;
}

async function deleteProgram(id: number): Promise<void> {
  const res = await fetch(`/api/organization/programs?id=${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to delete program" }));
    throw new Error(err.error || "Failed to delete program");
  }
}

// Query hooks
export const organizationKeys = {
  all: ["organization"] as const,
  faculties: () => [...organizationKeys.all, "faculties"] as const,
  departments: (facultyId?: number) => [...organizationKeys.all, "departments", facultyId] as const,
  programs: (departmentId?: number) => [...organizationKeys.all, "programs", departmentId] as const,
};

export function useFaculties() {
  return useQuery<Faculty[], Error>({
    queryKey: organizationKeys.faculties(),
    queryFn: fetchFaculties,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

export function useDepartments(facultyId?: number) {
  return useQuery<Department[], Error>({
    queryKey: organizationKeys.departments(facultyId),
    queryFn: () => fetchDepartments(facultyId),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

export function usePrograms(departmentId?: number) {
  return useQuery<Program[], Error>({
    queryKey: organizationKeys.programs(departmentId),
    queryFn: () => fetchPrograms(departmentId),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

// Mutation hooks
export function useCreateFaculty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createFaculty,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.faculties() });
    },
  });
}

export function useUpdateFaculty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, faculty_name }: { id: number; faculty_name: string }) =>
      updateFaculty(id, faculty_name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.faculties() });
      queryClient.invalidateQueries({ queryKey: organizationKeys.departments() });
    },
  });
}

export function useDeleteFaculty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteFaculty,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.faculties() });
      queryClient.invalidateQueries({ queryKey: organizationKeys.departments() });
    },
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ department_name, faculty_id }: { department_name: string; faculty_id: number }) =>
      createDepartment(department_name, faculty_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.departments() });
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, department_name, faculty_id }: { id: number; department_name: string; faculty_id: number }) =>
      updateDepartment(id, department_name, faculty_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.departments() });
      queryClient.invalidateQueries({ queryKey: organizationKeys.programs() });
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.departments() });
      queryClient.invalidateQueries({ queryKey: organizationKeys.programs() });
    },
  });
}

export function useCreateProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ program_name, department_id }: { program_name: string; department_id: number }) =>
      createProgram(program_name, department_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.programs() });
    },
  });
}

export function useUpdateProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, program_name, department_id }: { id: number; program_name: string; department_id: number }) =>
      updateProgram(id, program_name, department_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.programs() });
    },
  });
}

export function useDeleteProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteProgram,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.programs() });
    },
  });
}

