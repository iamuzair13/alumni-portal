"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { Modal } from "@/components/ui/modal";
import { PencilIcon, TrashBinIcon, PlusIcon, ArrowUpIcon, ArrowDownIcon } from "@/icons";
import {
  useFaculties,
  useDepartments,
  usePrograms,
  useCreateFaculty,
  useUpdateFaculty,
  useDeleteFaculty,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
  useCreateProgram,
  useUpdateProgram,
  useDeleteProgram,
  type Faculty,
  type Department,
  type Program,
} from "@/app/queries/fetch-organization";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";
import { isSuperAdminUser } from "@/lib/alumniProfile";

type TabKey = "faculties" | "departments" | "programs";

const TABS: { key: TabKey; label: string }[] = [
  { key: "faculties", label: "Faculties" },
  { key: "departments", label: "Departments" },
  { key: "programs", label: "Programs" },
];

export default function OrganizationComponent() {
  const { data: session } = useSession();
  const isSuperAdmin = isSuperAdminUser(session?.user);
  const [selectedTab, setSelectedTab] = useState<TabKey>("faculties");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Sorting state
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Modals state
  const [addFacultyOpen, setAddFacultyOpen] = useState(false);
  const [editFacultyId, setEditFacultyId] = useState<number | null>(null);
  const [deleteFacultyId, setDeleteFacultyId] = useState<number | null>(null);

  const [addDepartmentOpen, setAddDepartmentOpen] = useState(false);
  const [editDepartmentId, setEditDepartmentId] = useState<number | null>(null);
  const [deleteDepartmentId, setDeleteDepartmentId] = useState<number | null>(null);

  const [addProgramOpen, setAddProgramOpen] = useState(false);
  const [editProgramId, setEditProgramId] = useState<number | null>(null);
  const [deleteProgramId, setDeleteProgramId] = useState<number | null>(null);

  // Queries
  const { data: faculties = [], isLoading: facultiesLoading } = useFaculties();
  const { data: departments = [], isLoading: departmentsLoading } = useDepartments();
  const { data: programs = [], isLoading: programsLoading } = usePrograms();

  // Mutations
  const createFacultyMutation = useCreateFaculty();
  const updateFacultyMutation = useUpdateFaculty();
  const deleteFacultyMutation = useDeleteFaculty();

  const createDepartmentMutation = useCreateDepartment();
  const updateDepartmentMutation = useUpdateDepartment();
  const deleteDepartmentMutation = useDeleteDepartment();

  const createProgramMutation = useCreateProgram();
  const updateProgramMutation = useUpdateProgram();
  const deleteProgramMutation = useDeleteProgram();

  // Handle sorting
  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new field with ascending direction
      setSortField(field);
      setSortDirection("asc");
    }
  }, [sortField, sortDirection]);

  // Filtered and sorted data
  const filteredFaculties = useMemo(() => {
    let filtered = faculties;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((f) => f.faculty_name.toLowerCase().includes(q));
    }
    
    // Apply sorting
    if (sortField && selectedTab === "faculties") {
      const sorted = [...filtered].sort((a, b) => {
        let aValue: string | number = "";
        let bValue: string | number = "";
        
        switch (sortField) {
          case "id":
            // Always use numeric comparison for IDs
            const aNum = typeof a.id === "number" ? a.id : Number(a.id) || 0;
            const bNum = typeof b.id === "number" ? b.id : Number(b.id) || 0;
            return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
          case "name":
            aValue = (a.faculty_name || "").trim().toLowerCase();
            bValue = (b.faculty_name || "").trim().toLowerCase();
            break;
          default:
            return 0;
        }
        
        // String comparison for non-ID fields
        const aStr = String(aValue || "");
        const bStr = String(bValue || "");
        
        if (aStr < bStr) return sortDirection === "asc" ? -1 : 1;
        if (aStr > bStr) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
      return sorted;
    }
    
    return filtered;
  }, [faculties, searchQuery, sortField, sortDirection, selectedTab]);

  const filteredDepartments = useMemo(() => {
    let filtered = departments;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.department_name?.toLowerCase().includes(q) ||
          d.faculty_name?.toLowerCase().includes(q)
      );
    }
    
    // Apply sorting
    if (sortField && selectedTab === "departments") {
      const sorted = [...filtered].sort((a, b) => {
        let aValue: string | number = "";
        let bValue: string | number = "";
        
        switch (sortField) {
          case "id":
            // Always use numeric comparison for IDs
            const aNum = typeof a.id === "number" ? a.id : Number(a.id) || 0;
            const bNum = typeof b.id === "number" ? b.id : Number(b.id) || 0;
            return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
          case "name":
            aValue = (a.department_name || "").trim().toLowerCase();
            bValue = (b.department_name || "").trim().toLowerCase();
            break;
          case "faculty":
            aValue = (a.faculty_name || "").trim().toLowerCase();
            bValue = (b.faculty_name || "").trim().toLowerCase();
            break;
          default:
            return 0;
        }
        
        // String comparison for non-ID fields
        const aStr = String(aValue || "");
        const bStr = String(bValue || "");
        
        if (aStr < bStr) return sortDirection === "asc" ? -1 : 1;
        if (aStr > bStr) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
      return sorted;
    }
    
    return filtered;
  }, [departments, searchQuery, sortField, sortDirection, selectedTab]);

  const filteredPrograms = useMemo(() => {
    let filtered = programs;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.program_name.toLowerCase().includes(q) ||
          p.department_name?.toLowerCase().includes(q) ||
          p.faculty_name?.toLowerCase().includes(q)
      );
    }
    
    // Apply sorting
    if (sortField && selectedTab === "programs") {
      const sorted = [...filtered].sort((a, b) => {
        let aValue: string | number = "";
        let bValue: string | number = "";
        
        switch (sortField) {
          case "id":
            // Always use numeric comparison for IDs
            const aNum = typeof a.id === "number" ? a.id : Number(a.id) || 0;
            const bNum = typeof b.id === "number" ? b.id : Number(b.id) || 0;
            return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
          case "name":
            aValue = (a.program_name || "").trim().toLowerCase();
            bValue = (b.program_name || "").trim().toLowerCase();
            break;
          case "department":
            aValue = (a.department_name || "").trim().toLowerCase();
            bValue = (b.department_name || "").trim().toLowerCase();
            break;
          case "faculty":
            aValue = (a.faculty_name || "").trim().toLowerCase();
            bValue = (b.faculty_name || "").trim().toLowerCase();
            break;
          default:
            return 0;
        }
        
        // String comparison for non-ID fields
        const aStr = String(aValue || "");
        const bStr = String(bValue || "");
        
        if (aStr < bStr) return sortDirection === "asc" ? -1 : 1;
        if (aStr > bStr) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
      return sorted;
    }
    
    return filtered;
  }, [programs, searchQuery, sortField, sortDirection, selectedTab]);

  // Faculty handlers
  const handleCreateFaculty = async (faculty_name: string) => {
    try {
      await createFacultyMutation.mutateAsync(faculty_name);
      toast.success("Faculty created successfully");
      setAddFacultyOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create faculty");
    }
  };

  const handleUpdateFaculty = async (id: number, faculty_name: string) => {
    try {
      await updateFacultyMutation.mutateAsync({ id, faculty_name });
      toast.success("Faculty updated successfully");
      setEditFacultyId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update faculty");
    }
  };

  const handleDeleteFaculty = async (id: number) => {
    try {
      await deleteFacultyMutation.mutateAsync(id);
      toast.success("Faculty deleted successfully");
      setDeleteFacultyId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete faculty");
    }
  };

  // Department handlers
  const handleCreateDepartment = async (department_name: string, faculty_id: number) => {
    try {
      await createDepartmentMutation.mutateAsync({ department_name, faculty_id });
      toast.success("Department created successfully");
      setAddDepartmentOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create department");
    }
  };

  const handleUpdateDepartment = async (
    id: number,
    department_name: string,
    faculty_id: number
  ) => {
    try {
      await updateDepartmentMutation.mutateAsync({ id, department_name, faculty_id });
      toast.success("Department updated successfully");
      setEditDepartmentId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update department");
    }
  };

  const handleDeleteDepartment = async (id: number) => {
    try {
      await deleteDepartmentMutation.mutateAsync(id);
      toast.success("Department deleted successfully");
      setDeleteDepartmentId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete department");
    }
  };

  // Program handlers
  const handleCreateProgram = async (program_name: string, department_id: number) => {
    try {
      await createProgramMutation.mutateAsync({ program_name, department_id });
      toast.success("Program created successfully");
      setAddProgramOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create program");
    }
  };

  const handleUpdateProgram = async (
    id: number,
    program_name: string,
    department_id: number
  ) => {
    try {
      await updateProgramMutation.mutateAsync({ id, program_name, department_id });
      toast.success("Program updated successfully");
      setEditProgramId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update program");
    }
  };

  const handleDeleteProgram = async (id: number) => {
    try {
      await deleteProgramMutation.mutateAsync(id);
      toast.success("Program deleted successfully");
      setDeleteProgramId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete program");
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">
          You do not have permission to access this section.
        </p>
      </div>
    );
  }

  return (
    <div className="">
      {/* Counter Cards */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Faculties</p>
              <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1">
                {facultiesLoading ? "..." : faculties.length.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Departments</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
                {departmentsLoading ? "..." : departments.length.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Programs</p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">
                {programsLoading ? "..." : programs.length.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1" aria-label="Tabs">
          {TABS.map((tab) => {
            const count = tab.key === "faculties" 
              ? faculties.length 
              : tab.key === "departments" 
              ? departments.length 
              : programs.length;
            const loading = tab.key === "faculties"
              ? facultiesLoading
              : tab.key === "departments"
              ? departmentsLoading
              : programsLoading;
            
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setSelectedTab(tab.key);
                  setSearchQuery("");
                  setSortField(null); // Reset sorting when switching tabs
                  setSortDirection("asc");
                }}
                className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  selectedTab === tab.key
                    ? "border-brand-500 text-brand-600 dark:text-brand-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
              >
                <span className="flex items-center gap-2">
                  {tab.label}
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {loading ? "..." : count.toLocaleString()}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Search and Add Button */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="w-full sm:w-auto sm:flex-1 max-w-md">
          <Input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          startIcon={<PlusIcon />}
          onClick={() => {
            if (selectedTab === "faculties") setAddFacultyOpen(true);
            else if (selectedTab === "departments") setAddDepartmentOpen(true);
            else if (selectedTab === "programs") setAddProgramOpen(true);
          }}
        >
          Add {selectedTab === "faculties" ? "Faculty" : selectedTab === "departments" ? "Department" : "Program"}
        </Button>
      </div>

      {/* Faculties Table */}
      {selectedTab === "faculties" && (
        <FacultiesTable
          faculties={filteredFaculties}
          loading={facultiesLoading}
          onEdit={(id) => setEditFacultyId(id)}
          onDelete={(id) => setDeleteFacultyId(id)}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
        />
      )}

      {/* Departments Table */}
      {selectedTab === "departments" && (
        <DepartmentsTable
          departments={filteredDepartments}
          loading={departmentsLoading}
          onEdit={(id) => setEditDepartmentId(id)}
          onDelete={(id) => setDeleteDepartmentId(id)}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
        />
      )}

      {/* Programs Table */}
      {selectedTab === "programs" && (
        <ProgramsTable
          programs={filteredPrograms}
          loading={programsLoading}
          onEdit={(id) => setEditProgramId(id)}
          onDelete={(id) => setDeleteProgramId(id)}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
        />
      )}

      {/* Faculty Modals */}
      <FacultyModals
        addOpen={addFacultyOpen}
        onAddClose={() => setAddFacultyOpen(false)}
        editId={editFacultyId}
        onEditClose={() => setEditFacultyId(null)}
        deleteId={deleteFacultyId}
        onDeleteClose={() => setDeleteFacultyId(null)}
        faculties={faculties}
        onCreate={handleCreateFaculty}
        onUpdate={handleUpdateFaculty}
        onDelete={handleDeleteFaculty}
        creating={createFacultyMutation.isPending}
        updating={updateFacultyMutation.isPending}
        deleting={deleteFacultyMutation.isPending}
      />

      {/* Department Modals */}
      <DepartmentModals
        addOpen={addDepartmentOpen}
        onAddClose={() => setAddDepartmentOpen(false)}
        editId={editDepartmentId}
        onEditClose={() => setEditDepartmentId(null)}
        deleteId={deleteDepartmentId}
        onDeleteClose={() => setDeleteDepartmentId(null)}
        faculties={faculties}
        departments={departments}
        onCreate={handleCreateDepartment}
        onUpdate={handleUpdateDepartment}
        onDelete={handleDeleteDepartment}
        creating={createDepartmentMutation.isPending}
        updating={updateDepartmentMutation.isPending}
        deleting={deleteDepartmentMutation.isPending}
      />

      {/* Program Modals */}
      <ProgramModals
        addOpen={addProgramOpen}
        onAddClose={() => setAddProgramOpen(false)}
        editId={editProgramId}
        onEditClose={() => setEditProgramId(null)}
        deleteId={deleteProgramId}
        onDeleteClose={() => setDeleteProgramId(null)}
        faculties={faculties}
        departments={departments}
        programs={programs}
        onCreate={handleCreateProgram}
        onUpdate={handleUpdateProgram}
        onDelete={handleDeleteProgram}
        creating={createProgramMutation.isPending}
        updating={updateProgramMutation.isPending}
        deleting={deleteProgramMutation.isPending}
      />
    </div>
  );
}

// Faculties Table Component
function FacultiesTable({
  faculties,
  loading,
  onEdit,
  onDelete,
  sortField,
  sortDirection,
  onSort,
}: {
  faculties: Faculty[];
  loading: boolean;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  sortField: string | null;
  sortDirection: "asc" | "desc";
  onSort: (field: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-lg dark:border-gray-700/80 dark:bg-gray-800/50">
      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <Table className="min-w-full">
          <TableHeader className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-900/80 dark:to-gray-900/50">
            <TableRow className="border-b-2 border-gray-200 dark:border-gray-700">
              <TableCell 
                className="px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => onSort("id")}
              >
                <div className="flex items-center gap-2">
                  <span>ID</span>
                  <div className="flex flex-col">
                    <ArrowUpIcon className={`w-3 h-3 ${sortField === "id" && sortDirection === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                    <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortField === "id" && sortDirection === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                  </div>
                </div>
              </TableCell>
              <TableCell 
                className="px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => onSort("name")}
              >
                <div className="flex items-center gap-2">
                  <span>Faculty Name</span>
                  <div className="flex flex-col">
                    <ArrowUpIcon className={`w-3 h-3 ${sortField === "name" && sortDirection === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                    <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortField === "name" && sortDirection === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                  </div>
                </div>
              </TableCell>
              <TableCell className="px-6 py-4 text-right text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </TableCell>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-gray-100 dark:divide-gray-800/50">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`} className="bg-white dark:bg-gray-800/30">
                  <TableCell className="px-6 py-5">
                    <div className="h-5 w-12 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                  </TableCell>
                  <TableCell className="px-6 py-5">
                    <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                  </TableCell>
                  <TableCell className="px-6 py-5">
                    <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : faculties.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  No faculties found
                </TableCell>
              </TableRow>
            ) : (
              faculties.map((faculty) => (
                <TableRow key={faculty.id} className="bg-white dark:bg-gray-800/30 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <TableCell className="px-6 py-5 text-gray-700 dark:text-gray-300">{faculty.id}</TableCell>
                  <TableCell className="px-6 py-5 text-gray-700 dark:text-gray-300 font-medium">
                    {faculty.faculty_name}
                  </TableCell>
                  <TableCell className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        startIcon={<PencilIcon />}
                        onClick={() => onEdit(faculty.id)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        startIcon={<TrashBinIcon />}
                        onClick={() => onDelete(faculty.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// Departments Table Component
function DepartmentsTable({
  departments,
  loading,
  onEdit,
  onDelete,
  sortField,
  sortDirection,
  onSort,
}: {
  departments: Department[];
  loading: boolean;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  sortField: string | null;
  sortDirection: "asc" | "desc";
  onSort: (field: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-lg dark:border-gray-700/80 dark:bg-gray-800/50">
      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <Table className="min-w-full">
          <TableHeader className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-900/80 dark:to-gray-900/50">
            <TableRow className="border-b-2 border-gray-200 dark:border-gray-700">
              <TableCell 
                className="px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => onSort("id")}
              >
                <div className="flex items-center gap-2">
                  <span>ID</span>
                  <div className="flex flex-col">
                    <ArrowUpIcon className={`w-3 h-3 ${sortField === "id" && sortDirection === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                    <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortField === "id" && sortDirection === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                  </div>
                </div>
              </TableCell>
              <TableCell 
                className="px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => onSort("name")}
              >
                <div className="flex items-center gap-2">
                  <span>Department Name</span>
                  <div className="flex flex-col">
                    <ArrowUpIcon className={`w-3 h-3 ${sortField === "name" && sortDirection === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                    <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortField === "name" && sortDirection === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                  </div>
                </div>
              </TableCell>
              <TableCell 
                className="px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => onSort("faculty")}
              >
                <div className="flex items-center gap-2">
                  <span>Faculty</span>
                  <div className="flex flex-col">
                    <ArrowUpIcon className={`w-3 h-3 ${sortField === "faculty" && sortDirection === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                    <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortField === "faculty" && sortDirection === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                  </div>
                </div>
              </TableCell>
              <TableCell className="px-6 py-4 text-right text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </TableCell>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-gray-100 dark:divide-gray-800/50">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`} className="bg-white dark:bg-gray-800/30">
                  <TableCell className="px-6 py-5">
                    <div className="h-5 w-12 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                  </TableCell>
                  <TableCell className="px-6 py-5">
                    <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                  </TableCell>
                  <TableCell className="px-6 py-5">
                    <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                  </TableCell>
                  <TableCell className="px-6 py-5">
                    <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : departments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  No departments found
                </TableCell>
              </TableRow>
            ) : (
              departments.map((dept) => (
                <TableRow key={dept.id} className="bg-white dark:bg-gray-800/30 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <TableCell className="px-6 py-5 text-gray-700 dark:text-gray-300">{dept.id}</TableCell>
                  <TableCell className="px-6 py-5 text-gray-700 dark:text-gray-300 font-medium">
                    {dept.department_name}
                  </TableCell>
                  <TableCell className="px-6 py-5 text-gray-700 dark:text-gray-300">
                    {dept.faculty_name || "-"}
                  </TableCell>
                  <TableCell className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        startIcon={<PencilIcon />}
                        onClick={() => onEdit(dept.id)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        startIcon={<TrashBinIcon />}
                        onClick={() => onDelete(dept.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// Programs Table Component
function ProgramsTable({
  programs,
  loading,
  onEdit,
  onDelete,
  sortField,
  sortDirection,
  onSort,
}: {
  programs: Program[];
  loading: boolean;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  sortField: string | null;
  sortDirection: "asc" | "desc";
  onSort: (field: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-lg dark:border-gray-700/80 dark:bg-gray-800/50">
      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <Table className="min-w-full">
          <TableHeader className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-900/80 dark:to-gray-900/50">
            <TableRow className="border-b-2 border-gray-200 dark:border-gray-700">
              <TableCell 
                className="px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => onSort("id")}
              >
                <div className="flex items-center gap-2">
                  <span>ID</span>
                  <div className="flex flex-col">
                    <ArrowUpIcon className={`w-3 h-3 ${sortField === "id" && sortDirection === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                    <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortField === "id" && sortDirection === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                  </div>
                </div>
              </TableCell>
              <TableCell 
                className="px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => onSort("name")}
              >
                <div className="flex items-center gap-2">
                  <span>Program Name</span>
                  <div className="flex flex-col">
                    <ArrowUpIcon className={`w-3 h-3 ${sortField === "name" && sortDirection === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                    <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortField === "name" && sortDirection === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                  </div>
                </div>
              </TableCell>
              <TableCell 
                className="px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => onSort("department")}
              >
                <div className="flex items-center gap-2">
                  <span>Department</span>
                  <div className="flex flex-col">
                    <ArrowUpIcon className={`w-3 h-3 ${sortField === "department" && sortDirection === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                    <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortField === "department" && sortDirection === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                  </div>
                </div>
              </TableCell>
              <TableCell 
                className="px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => onSort("faculty")}
              >
                <div className="flex items-center gap-2">
                  <span>Faculty</span>
                  <div className="flex flex-col">
                    <ArrowUpIcon className={`w-3 h-3 ${sortField === "faculty" && sortDirection === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                    <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortField === "faculty" && sortDirection === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                  </div>
                </div>
              </TableCell>
              <TableCell className="px-6 py-4 text-right text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </TableCell>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-gray-100 dark:divide-gray-800/50">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`} className="bg-white dark:bg-gray-800/30">
                  <TableCell className="px-6 py-5">
                    <div className="h-5 w-12 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                  </TableCell>
                  <TableCell className="px-6 py-5">
                    <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                  </TableCell>
                  <TableCell className="px-6 py-5">
                    <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                  </TableCell>
                  <TableCell className="px-6 py-5">
                    <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                  </TableCell>
                  <TableCell className="px-6 py-5">
                    <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : programs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  No programs found
                </TableCell>
              </TableRow>
            ) : (
              programs.map((program) => (
                <TableRow key={program.id} className="bg-white dark:bg-gray-800/30 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <TableCell className="px-6 py-5 text-gray-700 dark:text-gray-300">{program.id}</TableCell>
                  <TableCell className="px-6 py-5 text-gray-700 dark:text-gray-300 font-medium">
                    {program.program_name}
                  </TableCell>
                  <TableCell className="px-6 py-5 text-gray-700 dark:text-gray-300">
                    {program.department_name || "-"}
                  </TableCell>
                  <TableCell className="px-6 py-5 text-gray-700 dark:text-gray-300">
                    {program.faculty_name || "-"}
                  </TableCell>
                  <TableCell className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        startIcon={<PencilIcon />}
                        onClick={() => onEdit(program.id)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        startIcon={<TrashBinIcon />}
                        onClick={() => onDelete(program.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// Faculty Modals Component
function FacultyModals({
  addOpen,
  onAddClose,
  editId,
  onEditClose,
  deleteId,
  onDeleteClose,
  faculties,
  onCreate,
  onUpdate,
  onDelete,
  creating,
  updating,
  deleting,
}: {
  addOpen: boolean;
  onAddClose: () => void;
  editId: number | null;
  onEditClose: () => void;
  deleteId: number | null;
  onDeleteClose: () => void;
  faculties: Faculty[];
  onCreate: (name: string) => Promise<void>;
  onUpdate: (id: number, name: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const editingFaculty = editId ? faculties.find((f) => f.id === editId) : null;
  const deletingFaculty = deleteId ? faculties.find((f) => f.id === deleteId) : null;

  React.useEffect(() => {
    if (editId && editingFaculty) {
      setName(editingFaculty.faculty_name);
      setError(null);
    } else if (addOpen) {
      setName("");
      setError(null);
    }
  }, [editId, editingFaculty, addOpen]);

  const handleSubmit = () => {
    if (!name.trim()) {
      setError("Faculty name is required");
      return;
    }
    setError(null);
    if (editId) {
      onUpdate(editId, name);
    } else {
      onCreate(name);
    }
  };

  return (
    <>
      {/* Add Faculty Modal */}
      <Modal isOpen={addOpen} onClose={onAddClose} className="max-w-[520px] p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Add Faculty</h2>
        {error && (
          <div className="mb-4 p-3 rounded-lg border border-error-500 bg-error-50 dark:border-error-500/30 dark:bg-error-500/15">
            <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
          </div>
        )}
        <div className="mb-6">
          <Label>Faculty Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter faculty name"
            disabled={creating}
          />
        </div>
        <div className="flex items-center justify-end gap-3">
          <Button size="sm" variant="outline" onClick={onAddClose} disabled={creating}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={creating}>
            {creating ? "Creating..." : "Create Faculty"}
          </Button>
        </div>
      </Modal>

      {/* Edit Faculty Modal */}
      <Modal isOpen={!!editId} onClose={onEditClose} className="max-w-[520px] p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Edit Faculty</h2>
        {error && (
          <div className="mb-4 p-3 rounded-lg border border-error-500 bg-error-50 dark:border-error-500/30 dark:bg-error-500/15">
            <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
          </div>
        )}
        <div className="mb-6">
          <Label>Faculty Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter faculty name"
            disabled={updating}
          />
        </div>
        <div className="flex items-center justify-end gap-3">
          <Button size="sm" variant="outline" onClick={onEditClose} disabled={updating}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={updating}>
            {updating ? "Updating..." : "Save Changes"}
          </Button>
        </div>
      </Modal>

      {/* Delete Faculty Modal */}
      <Modal isOpen={!!deleteId} onClose={onDeleteClose} className="max-w-[520px] p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Delete Faculty</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Are you sure you want to delete <strong>{deletingFaculty?.faculty_name}</strong>? This action cannot be undone.
        </p>
        <div className="flex items-center justify-end gap-3">
          <Button size="sm" variant="outline" onClick={onDeleteClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => deleteId && onDelete(deleteId)}
            disabled={deleting}
            className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </Modal>
    </>
  );
}

// Department Modals Component
function DepartmentModals({
  addOpen,
  onAddClose,
  editId,
  onEditClose,
  deleteId,
  onDeleteClose,
  faculties,
  departments,
  onCreate,
  onUpdate,
  onDelete,
  creating,
  updating,
  deleting,
}: {
  addOpen: boolean;
  onAddClose: () => void;
  editId: number | null;
  onEditClose: () => void;
  deleteId: number | null;
  onDeleteClose: () => void;
  faculties: Faculty[];
  departments: Department[];
  onCreate: (name: string, faculty_id: number) => Promise<void>;
  onUpdate: (id: number, name: string, faculty_id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
}) {
  const [name, setName] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const editingDepartment = editId ? departments.find((d) => d.id === editId) : null;
  const deletingDepartment = deleteId ? departments.find((d) => d.id === deleteId) : null;

  React.useEffect(() => {
    if (editId && editingDepartment) {
      setName(editingDepartment.department_name || "");
      setFacultyId(String(editingDepartment.faculty_id || ""));
      setError(null);
    } else if (addOpen) {
      setName("");
      setFacultyId("");
      setError(null);
    }
  }, [editId, editingDepartment, addOpen]);

  const handleSubmit = () => {
    if (!name.trim()) {
      setError("Department name is required");
      return;
    }
    if (!facultyId) {
      setError("Faculty is required");
      return;
    }
    setError(null);
    if (editId) {
      onUpdate(editId, name, Number(facultyId));
    } else {
      onCreate(name, Number(facultyId));
    }
  };

  const facultyOptions = faculties.map((f) => ({
    value: String(f.id),
    label: f.faculty_name,
  }));

  return (
    <>
      {/* Add Department Modal */}
      <Modal isOpen={addOpen} onClose={onAddClose} className="max-w-[520px] p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Add Department</h2>
        {error && (
          <div className="mb-4 p-3 rounded-lg border border-error-500 bg-error-50 dark:border-error-500/30 dark:bg-error-500/15">
            <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
          </div>
        )}
        <div className="mb-6 space-y-4">
          <div>
            <Label>Faculty</Label>
            <Select
              key={`dept-faculty-add-${addOpen}`}
              options={facultyOptions}
              placeholder="Select a faculty"
              onChange={setFacultyId}
              defaultValue={facultyId}
            />
          </div>
          <div>
            <Label>Department Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter department name"
              disabled={creating}
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          <Button size="sm" variant="outline" onClick={onAddClose} disabled={creating}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={creating}>
            {creating ? "Creating..." : "Create Department"}
          </Button>
        </div>
      </Modal>

      {/* Edit Department Modal */}
      <Modal isOpen={!!editId} onClose={onEditClose} className="max-w-[520px] p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Edit Department</h2>
        {error && (
          <div className="mb-4 p-3 rounded-lg border border-error-500 bg-error-50 dark:border-error-500/30 dark:bg-error-500/15">
            <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
          </div>
        )}
        <div className="mb-6 space-y-4">
          <div>
            <Label>Faculty</Label>
            <Select
              key={`dept-faculty-edit-${editId}`}
              options={facultyOptions}
              placeholder="Select a faculty"
              onChange={setFacultyId}
              defaultValue={facultyId}
            />
          </div>
          <div>
            <Label>Department Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter department name"
              disabled={updating}
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          <Button size="sm" variant="outline" onClick={onEditClose} disabled={updating}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={updating}>
            {updating ? "Updating..." : "Save Changes"}
          </Button>
        </div>
      </Modal>

      {/* Delete Department Modal */}
      <Modal isOpen={!!deleteId} onClose={onDeleteClose} className="max-w-[520px] p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Delete Department</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Are you sure you want to delete <strong>{deletingDepartment?.department_name}</strong>? This action cannot be undone.
        </p>
        <div className="flex items-center justify-end gap-3">
          <Button size="sm" variant="outline" onClick={onDeleteClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => deleteId && onDelete(deleteId)}
            disabled={deleting}
            className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </Modal>
    </>
  );
}

// Program Modals Component
function ProgramModals({
  addOpen,
  onAddClose,
  editId,
  onEditClose,
  deleteId,
  onDeleteClose,
  faculties,
  departments,
  programs,
  onCreate,
  onUpdate,
  onDelete,
  creating,
  updating,
  deleting,
}: {
  addOpen: boolean;
  onAddClose: () => void;
  editId: number | null;
  onEditClose: () => void;
  deleteId: number | null;
  onDeleteClose: () => void;
  faculties: Faculty[];
  departments: Department[];
  programs: Program[];
  onCreate: (name: string, department_id: number) => Promise<void>;
  onUpdate: (id: number, name: string, department_id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
}) {
  const [name, setName] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const editingProgram = editId ? programs.find((p) => p.id === editId) : null;
  const deletingProgram = deleteId ? programs.find((p) => p.id === deleteId) : null;

  // Filter departments based on selected faculty
  // Handle bigint serialization (PostgreSQL bigint may be string in JSON)
  const filteredDepartments = React.useMemo(() => {
    if (!facultyId) return [];
    const selectedFacultyId = String(facultyId); // Compare as strings to handle bigint
    const filtered = departments.filter((d) => {
      if (d.faculty_id === null || d.faculty_id === undefined) return false;
      // Convert to string for comparison to handle both number and bigint (string) types
      const deptFacultyId = String(d.faculty_id);
      return deptFacultyId === selectedFacultyId;
    });
    return filtered;
  }, [departments, facultyId]);

  React.useEffect(() => {
    if (editId && editingProgram) {
      setName(editingProgram.program_name);
      // Find the department to get its faculty_id
      const dept = departments.find((d) => d.id === editingProgram.department_id);
      if (dept && dept.faculty_id) {
        setFacultyId(String(dept.faculty_id));
        setDepartmentId(String(editingProgram.department_id || ""));
      } else {
        setFacultyId("");
        setDepartmentId(String(editingProgram.department_id || ""));
      }
      setError(null);
    } else if (addOpen) {
      setName("");
      setFacultyId("");
      setDepartmentId("");
      setError(null);
    }
  }, [editId, editingProgram, addOpen, departments]);

  // Reset department when faculty changes
  React.useEffect(() => {
    if (facultyId) {
      setDepartmentId("");
    }
  }, [facultyId]);

  const handleSubmit = () => {
    if (!name.trim()) {
      setError("Program name is required");
      return;
    }
    if (!facultyId) {
      setError("Faculty is required");
      return;
    }
    if (!departmentId) {
      setError("Department is required");
      return;
    }
    setError(null);
    if (editId) {
      onUpdate(editId, name, Number(departmentId));
    } else {
      onCreate(name, Number(departmentId));
    }
  };

  const facultyOptions = faculties.map((f) => ({
    value: String(f.id),
    label: f.faculty_name,
  }));

  const departmentOptions = filteredDepartments.map((d) => ({
    value: String(d.id),
    label: d.department_name || "Unnamed Department",
  }));

  return (
    <>
      {/* Add Program Modal */}
      <Modal isOpen={addOpen} onClose={onAddClose} className="max-w-[520px] p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Add Program</h2>
        {error && (
          <div className="mb-4 p-3 rounded-lg border border-error-500 bg-error-50 dark:border-error-500/30 dark:bg-error-500/15">
            <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
          </div>
        )}
        <div className="mb-6 space-y-4">
          {/* Step 1: Select Faculty */}
          <div>
            <Label>Step 1: Select Faculty *</Label>
            <Select
              key={`prog-faculty-add-${addOpen}`}
              options={facultyOptions}
              placeholder="Select a faculty"
              onChange={(value) => {
                setFacultyId(value);
                setDepartmentId(""); // Reset department when faculty changes
              }}
              defaultValue=""
            />
            {!facultyId && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Please select a faculty to proceed
              </p>
            )}
          </div>

          {/* Step 2: Select Department (only shown after faculty is selected) */}
          <div>
            <Label>Step 2: Select Department *</Label>
            {facultyId ? (
              <>
                <Select
                  key={`prog-dept-add-${facultyId}`}
                  options={departmentOptions}
                  placeholder={
                    departmentOptions.length > 0
                      ? "Select a department"
                      : "No departments available for this faculty"
                  }
                  onChange={setDepartmentId}
                  defaultValue=""
                />
                {departmentOptions.length === 0 ? (
                  <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                    No departments found for this faculty. Please create a department first in the Departments tab.
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {departmentOptions.length} department(s) available for this faculty
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex items-center px-4">
                  <span className="text-sm text-gray-400 dark:text-gray-500">
                    Select a faculty first
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Department selection will be available after selecting a faculty
                </p>
              </>
            )}
          </div>

          {/* Step 3: Enter Program Name */}
          <div>
            <Label>Step 3: Enter Program Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter program name"
              disabled={creating || !departmentId}
            />
            {!departmentId && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Please select a faculty and department first
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          <Button size="sm" variant="outline" onClick={onAddClose} disabled={creating}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={creating || !facultyId || !departmentId || !name.trim()}
          >
            {creating ? "Creating..." : "Create Program"}
          </Button>
        </div>
      </Modal>

      {/* Edit Program Modal */}
      <Modal isOpen={!!editId} onClose={onEditClose} className="max-w-[520px] p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Edit Program</h2>
        {error && (
          <div className="mb-4 p-3 rounded-lg border border-error-500 bg-error-50 dark:border-error-500/30 dark:bg-error-500/15">
            <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
          </div>
        )}
        <div className="mb-6 space-y-4">
          <div>
            <Label>Faculty</Label>
            <Select
              key={`prog-faculty-edit-${editId}`}
              options={facultyOptions}
              placeholder="Select a faculty"
              onChange={setFacultyId}
              defaultValue={facultyId}
            />
          </div>
          <div>
            <Label>Department</Label>
            {facultyId ? (
              <Select
                key={`prog-dept-edit-${facultyId}-${editId}`}
                options={departmentOptions}
                placeholder={departmentOptions.length > 0 ? "Select a department" : "No departments available"}
                onChange={setDepartmentId}
                defaultValue={departmentId}
              />
            ) : (
              <Select
                key="prog-dept-edit-disabled"
                options={[]}
                placeholder="Select a faculty first"
                onChange={() => {}}
                defaultValue=""
              />
            )}
            {facultyId && departmentOptions.length === 0 && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                No departments found for this faculty. Please create a department for this faculty first.
              </p>
            )}
            {facultyId && departmentOptions.length > 0 && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {departmentOptions.length} department(s) available
              </p>
            )}
          </div>
          <div>
            <Label>Program Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter program name"
              disabled={updating}
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          <Button size="sm" variant="outline" onClick={onEditClose} disabled={updating}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={updating}>
            {updating ? "Updating..." : "Save Changes"}
          </Button>
        </div>
      </Modal>

      {/* Delete Program Modal */}
      <Modal isOpen={!!deleteId} onClose={onDeleteClose} className="max-w-[520px] p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Delete Program</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Are you sure you want to delete <strong>{deletingProgram?.program_name}</strong>? This action cannot be undone.
        </p>
        <div className="flex items-center justify-end gap-3">
          <Button size="sm" variant="outline" onClick={onDeleteClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => deleteId && onDelete(deleteId)}
            disabled={deleting}
            className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </Modal>
    </>
  );
}

