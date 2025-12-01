"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import MultiSelect from "@/components/form/MultiSelect";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { 
  getFaculties, 
  getDepartmentsByFaculty, 
  getProgramsByFacultyAndDepartment
} from "@/data/programs-departments";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

type UserFormValues = {
  email: string;
  password: string;
  firstname?: string;
  lastname?: string;
  department?: string;
  type: string;
  blocked?: boolean;
  csrf: string;
  accessAssignments?: {
    faculties: string[];
    departments: string[];
    programs: string[];
  };
};

type UserFormProps = {
  userId?: number;
  initialData?: {
    email: string | null;
    firstname?: string | null;
    lastname?: string | null;
    department?: string | null;
    type: string | null;
    blocked?: boolean | null;
    accessAssignments?: {
      faculties: string[];
      departments: string[];
      programs: string[];
    };
  };
  onSuccess?: () => void;
};

function genToken(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function UserForm({ userId, initialData, onSuccess }: UserFormProps = {}) {
  const isEditMode = !!userId;
  const queryClient = useQueryClient();
  const [values, setValues] = useState<UserFormValues>({
    email: "",
    password: "",
    firstname: "",
    lastname: "",
    department: "",
    type: "admin",
    blocked: false,
    csrf: "",
    accessAssignments: { faculties: [], departments: [], programs: [] },
  });

  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEditMode);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Access control state
  const [selectedFaculties, setSelectedFaculties] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [availablePrograms, setAvailablePrograms] = useState<string[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  
  // Special constants for "All" selections
  const ALL_FACULTIES = "__ALL_FACULTIES__";
  const ALL_DEPARTMENTS = "__ALL_DEPARTMENTS__";
  const ALL_PROGRAMS = "__ALL_PROGRAMS__";
  
  // Track if "All" is selected for each dropdown
  const [allFacultiesSelected, setAllFacultiesSelected] = useState(false);
  const [allDepartmentsSelected, setAllDepartmentsSelected] = useState(false);
  const [allProgramsSelected, setAllProgramsSelected] = useState(false);
  
  // Store loaded access assignments to restore after available lists are computed
  const [loadedDepartments, setLoadedDepartments] = useState<string[]>([]);
  const [loadedPrograms, setLoadedPrograms] = useState<string[]>([]);

  // Initialize CSRF token
  useEffect(() => {
    const token = genToken();
    try {
      document.cookie = `csrf_token=${token}; SameSite=Lax; Path=/`;
    } catch {}
    setValues((v) => ({ ...v, csrf: token }));
  }, []);

  // Load user data for edit mode
  useEffect(() => {
    if (isEditMode && userId) {
      const loadUserData = async () => {
        try {
          setLoading(true);
          const res = await fetch(`/api/users/${userId}`);
          if (!res.ok) {
            throw new Error("Failed to fetch user data");
          }
          const data = await res.json();
          const user = data.item;
          
          if (user) {
            // Populate form with existing data
            setValues({
              email: user.email || "",
              password: "", // Don't pre-fill password
              firstname: user.firstname || "",
              lastname: user.lastname || "",
              department: user.department || "",
              type: user.type || "admin",
              blocked: user.blocked || false,
              csrf: values.csrf || "",
              accessAssignments: user.accessAssignments || { faculties: [], departments: [], programs: [] },
            });
            
            // Set access assignments if available
            if (user.accessAssignments) {
              const { faculties, departments, programs } = user.accessAssignments;
              if (faculties && faculties.length > 0) {
                setSelectedFaculties(faculties);
                // Check if all faculties are selected
                const allFacs = getFaculties();
                if (faculties.length === allFacs.length && allFacs.every(f => faculties.includes(f))) {
                  setAllFacultiesSelected(true);
                }
              }
              // Store departments and programs to restore after available lists are computed
              if (departments && departments.length > 0) {
                setLoadedDepartments(departments);
              }
              if (programs && programs.length > 0) {
                setLoadedPrograms(programs);
              }
            }
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to load user data");
          toast.error("Failed to load user data");
        } finally {
          setLoading(false);
        }
      };
      
      loadUserData();
    } else if (initialData) {
      // Use provided initial data
      setValues({
        email: initialData.email || "",
        password: "",
        firstname: initialData.firstname || "",
        lastname: initialData.lastname || "",
        department: initialData.department || "",
        type: initialData.type || "admin",
        blocked: initialData.blocked || false,
        csrf: values.csrf || "",
        accessAssignments: initialData.accessAssignments || { faculties: [], departments: [], programs: [] },
      });
      
      if (initialData.accessAssignments) {
        const { faculties, departments, programs } = initialData.accessAssignments;
        if (faculties && faculties.length > 0) {
          setSelectedFaculties(faculties);
          const allFacs = getFaculties();
          if (faculties.length === allFacs.length && allFacs.every(f => faculties.includes(f))) {
            setAllFacultiesSelected(true);
          }
        }
        if (departments && departments.length > 0) {
          setSelectedDepartments(departments);
        }
        if (programs && programs.length > 0) {
          setSelectedPrograms(programs);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isEditMode]);

  // Handle "All Faculties" selection
  const handleFacultiesChange = useCallback((selected: string[]) => {
    // Remove "All" marker from selection
    const filtered = selected.filter(f => f !== ALL_FACULTIES);
    const allFacs = getFaculties();
    
    // Check if "All" was just selected
    const hasAll = selected.includes(ALL_FACULTIES);
    const wasAllSelected = allFacultiesSelected;
    
    if (hasAll && !wasAllSelected) {
      // "All" was just selected - select all faculties
      setSelectedFaculties(allFacs);
      setAllFacultiesSelected(true);
    } else if (!hasAll && filtered.length === allFacs.length && allFacs.every(f => filtered.includes(f))) {
      // All faculties are manually selected - mark "All" as selected
      setSelectedFaculties(allFacs);
      setAllFacultiesSelected(true);
    } else if (!hasAll) {
      // Individual faculties selected - clear "All" flag
      setSelectedFaculties(filtered);
      setAllFacultiesSelected(false);
    }
  }, [allFacultiesSelected]);

  // Update available departments when faculties change
  useEffect(() => {
    if (selectedFaculties.length === 0) {
      setAvailableDepartments([]);
      setSelectedDepartments([]);
      setSelectedPrograms([]);
      setAllDepartmentsSelected(false);
      setAllProgramsSelected(false);
      return;
    }

    const depts = new Set<string>();
    selectedFaculties.forEach((faculty) => {
      const deptsForFaculty = getDepartmentsByFaculty(faculty);
      deptsForFaculty.forEach((dept) => depts.add(dept));
    });

    const deptsArray = Array.from(depts).sort();
    setAvailableDepartments(deptsArray);
    
    // Restore loaded departments if in edit mode, otherwise filter
    if (isEditMode && loadedDepartments.length > 0) {
      const validDepts = loadedDepartments.filter(d => depts.has(d));
      setSelectedDepartments(validDepts);
      // Check if all departments should be marked as "All"
      if (validDepts.length === deptsArray.length && deptsArray.length > 0 && deptsArray.every(d => validDepts.includes(d))) {
        setAllDepartmentsSelected(true);
      }
      // Clear loaded departments after restoring
      setLoadedDepartments([]);
    } else {
      setSelectedDepartments((prev) => prev.filter((dept) => depts.has(dept)));
      
      // If all departments were selected, maintain "All" selection
      if (allDepartmentsSelected && deptsArray.length > 0) {
        setSelectedDepartments(deptsArray);
      }
    }
  }, [selectedFaculties, allDepartmentsSelected, isEditMode, loadedDepartments]);

  // Handle "All Departments" selection
  const handleDepartmentsChange = useCallback((selected: string[]) => {
    // Remove "All" marker from selection
    const filtered = selected.filter(d => d !== ALL_DEPARTMENTS);
    const allDepts = availableDepartments.filter(d => d !== ALL_DEPARTMENTS);
    
    // Check if "All" was just selected
    const hasAll = selected.includes(ALL_DEPARTMENTS);
    const wasAllSelected = allDepartmentsSelected;
    
    if (hasAll && !wasAllSelected) {
      // "All" was just selected - select all departments
      setSelectedDepartments(allDepts);
      setAllDepartmentsSelected(true);
      // Automatically set programs to "All" when "All Departments" is selected
      // (programs depend on departments, so all departments = all programs)
      setAllProgramsSelected(true);
    } else if (!hasAll && allDepts.length > 0 && filtered.length === allDepts.length && allDepts.every(d => filtered.includes(d))) {
      // All departments are manually selected - mark "All" as selected
      setSelectedDepartments(allDepts);
      setAllDepartmentsSelected(true);
      // Automatically set programs to "All" when all departments are selected
      setAllProgramsSelected(true);
    } else if (!hasAll) {
      // Individual departments selected - clear "All" flag
      setSelectedDepartments(filtered);
      setAllDepartmentsSelected(false);
      // Don't automatically change programs - user can select "All" or specific programs for these departments
    }
  }, [availableDepartments, allDepartmentsSelected]);

  // Fetch programs when departments change
  useEffect(() => {
    if (selectedDepartments.length === 0) {
      setAvailablePrograms([]);
      setSelectedPrograms([]);
      setAllProgramsSelected(false);
      return;
    }

    // Get programs directly from data instead of API call
    const getProgramsForDepartments = () => {
      const programsSet = new Set<string>();

      // Find which faculty each department belongs to and get its programs
      for (const dept of selectedDepartments) {
        for (const faculty of selectedFaculties) {
          const programs = getProgramsByFacultyAndDepartment(faculty, dept);
          programs.forEach(p => programsSet.add(p));
        }
      }

      return Array.from(programsSet).sort();
    };

    const fetchPrograms = async () => {
      setLoadingPrograms(true);
      try {
        const programsArray = getProgramsForDepartments();
        setAvailablePrograms(programsArray);
        
        // Restore loaded programs if in edit mode, otherwise filter
        // Use case-insensitive matching for better compatibility
        if (isEditMode && loadedPrograms.length > 0) {
          const programsSet = new Set(programsArray.map(p => p.toLowerCase().trim()));
          const validProgs = loadedPrograms.filter(p => {
            const normalized = p.toLowerCase().trim();
            return Array.from(programsSet).some(prog => prog === normalized);
          }).map(p => {
            // Find the exact match from programsArray (preserve original casing)
            const normalized = p.toLowerCase().trim();
            return programsArray.find(prog => prog.toLowerCase().trim() === normalized) || p;
          });
          setSelectedPrograms(validProgs);
          // Check if all programs should be marked as "All"
          if (validProgs.length === programsArray.length && programsArray.length > 0 && programsArray.every(p => validProgs.includes(p))) {
            setAllProgramsSelected(true);
          }
          // Clear loaded programs after restoring
          setLoadedPrograms([]);
        } else {
          // Use case-insensitive matching
          const programsSet = new Set(programsArray.map(p => p.toLowerCase().trim()));
          setSelectedPrograms((prev) => prev.filter((prog) => {
            const normalized = prog.toLowerCase().trim();
            return Array.from(programsSet).some(p => p === normalized);
          }).map(prog => {
            // Find the exact match from programsArray (preserve original casing)
            const normalized = prog.toLowerCase().trim();
            return programsArray.find(p => p.toLowerCase().trim() === normalized) || prog;
          }));
          
          // If all departments are selected, automatically set all programs
          if (allDepartmentsSelected && programsArray.length > 0) {
            setSelectedPrograms(programsArray);
            setAllProgramsSelected(true);
          } else if (allProgramsSelected && programsArray.length > 0) {
            // If all programs were selected previously, maintain "All" selection
            setSelectedPrograms(programsArray);
          }
        }
      } catch (err) {
        console.error("Failed to fetch programs:", err);
      } finally {
        setLoadingPrograms(false);
      }
    };

    fetchPrograms();
  }, [selectedDepartments, selectedFaculties, allProgramsSelected, allDepartmentsSelected, isEditMode, loadedPrograms]);

  // Handle "All Programs" selection
  const handleProgramsChange = useCallback((selected: string[]) => {
    // Remove "All" marker from selection
    const filtered = selected.filter(p => p !== ALL_PROGRAMS);
    const allProgs = availablePrograms.filter(p => p !== ALL_PROGRAMS);
    
    // Check if "All" was just selected
    const hasAll = selected.includes(ALL_PROGRAMS);
    const wasAllSelected = allProgramsSelected;
    
    if (hasAll && !wasAllSelected) {
      // "All" was just selected - select all programs
      setSelectedPrograms(allProgs);
      setAllProgramsSelected(true);
    } else if (!hasAll && allProgs.length > 0 && filtered.length === allProgs.length && allProgs.every(p => filtered.includes(p))) {
      // All programs are manually selected - mark "All" as selected
      setSelectedPrograms(allProgs);
      setAllProgramsSelected(true);
    } else if (!hasAll) {
      // Individual programs selected - clear "All" flag
      setSelectedPrograms(filtered);
      setAllProgramsSelected(false);
    }
  }, [availablePrograms, allProgramsSelected]);

  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()), [values.email]);
  const passwordValid = useMemo(() => values.password.length >= 8, [values.password]);

  const resetForm = useCallback(() => {
    setValues({
      email: "",
      password: "",
      firstname: "",
      lastname: "",
      department: "",
      type: "admin",
      blocked: false,
      csrf: values.csrf,
      accessAssignments: { faculties: [], departments: [], programs: [] },
    });
    setSelectedFaculties([]);
    setSelectedDepartments([]);
    setSelectedPrograms([]);
    setAllFacultiesSelected(false);
    setAllDepartmentsSelected(false);
    setAllProgramsSelected(false);
    setMessage(null);
    setError(null);
  }, [values.csrf]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (!emailValid) {
      setError("Invalid email format");
      toast.error("Invalid email format");
      return;
    }

    // Only validate password if provided (required for new users, optional for edit)
    if (!isEditMode && !passwordValid) {
      setError("Password must be at least 8 characters");
      toast.error("Password must be at least 8 characters");
      return;
    }
    
    if (isEditMode && values.password && !passwordValid) {
      setError("Password must be at least 8 characters if changing");
      toast.error("Password must be at least 8 characters if changing");
      return;
    }

    const userType = values.type.toLowerCase();
    if ((userType === "admin" || userType === "viewer") && selectedFaculties.length === 0 && !allFacultiesSelected) {
      setError("Please select at least one Faculty for access control.");
      toast.error("Please select at least one Faculty for access control.");
      return;
    }

    if (process.env.NODE_ENV === "production" && typeof window !== "undefined" && window.location.protocol !== "https:") {
      setError("Insecure connection. Use HTTPS.");
      return;
    }

    try {
      setSubmitting(true);

      // Build access assignments according to API logic:
      // - Empty departments array = faculty-level access (all departments/programs in those faculties)
      // - Empty programs array with departments = department-level access (all programs in those departments)
      // - Both arrays with values = program-level access (specific programs)
      const accessAssignments =
        userType === "admin" || userType === "viewer"
          ? (() => {
              // Case 1: "All Faculties" selected → send empty departments/programs for faculty-level access (all departments/programs)
              if (allFacultiesSelected) {
                return {
                  faculties: selectedFaculties,
                  departments: [], // Empty = faculty-level access to ALL departments and programs
                  programs: [],
                };
              }
              
              // Case 2: "All Departments" selected → send all departments with empty programs for department-level access
              if (allDepartmentsSelected && selectedDepartments.length > 0) {
                return {
                  faculties: selectedFaculties,
                  departments: selectedDepartments, // All departments from selected faculties
                  programs: [], // Empty = department-level access to ALL programs in those departments
                };
              }
              
              // Case 3: "All Programs" selected → send departments with empty programs for department-level access (all programs)
              if (allProgramsSelected && selectedDepartments.length > 0) {
                return {
                  faculties: selectedFaculties,
                  departments: selectedDepartments, // All departments from selected faculties
                  programs: [], // Empty = department-level access to ALL programs in those departments
                };
              }
              
              // Case 4: Specific selections (some faculties/departments/programs)
              // When programs are selected, we need to ensure they're properly associated with their departments
              // Filter programs to only include those that belong to selected departments
              const validPrograms: string[] = [];
              if (selectedPrograms.length > 0 && selectedDepartments.length > 0) {
                for (const program of selectedPrograms) {
                  // Check if this program belongs to any of the selected departments
                  let programFound = false;
                  for (const dept of selectedDepartments) {
                    for (const faculty of selectedFaculties) {
                      const deptPrograms = getProgramsByFacultyAndDepartment(faculty, dept);
                      // Use case-insensitive matching
                      const normalizedProgram = program.toLowerCase().trim();
                      if (deptPrograms.some(p => p.toLowerCase().trim() === normalizedProgram)) {
                        programFound = true;
                        break;
                      }
                    }
                    if (programFound) break;
                  }
                  if (programFound) {
                    validPrograms.push(program);
                  }
                }
              }
              
              return {
                faculties: selectedFaculties,
                departments: selectedDepartments.length > 0 ? selectedDepartments : [],
                programs: validPrograms.length > 0 ? validPrograms : (selectedPrograms.length > 0 ? selectedPrograms : []),
              };
            })()
          : undefined;

      if (isEditMode && userId) {
        // Update existing user
        const updatePayload: {
          email: string;
          firstname?: string | null;
          lastname?: string | null;
          department?: string | null;
          type: string;
          blocked: boolean;
          accessAssignments?: { faculties: string[]; departments: string[]; programs: string[] };
          password?: string;
        } = {
          email: values.email,
          firstname: values.firstname || null,
          lastname: values.lastname || null,
          department: values.department || null,
          type: values.type,
          blocked: values.blocked || false,
          accessAssignments,
        };
        
        // Only include password if it's provided
        if (values.password && values.password.length >= 8) {
          updatePayload.password = values.password;
        }
        
        const res = await fetch(`/api/users/${userId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatePayload),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to update user");

        setMessage(`User updated successfully!`);
        toast.success(`User updated successfully!`);
        
        if (onSuccess) {
          onSuccess();
        }

        try {
          await queryClient.invalidateQueries({ queryKey: ["users", "list"] });
        } catch {}
      } else {
        // Create new user
      const res = await fetch("/api/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...values,
            accessAssignments,
          }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save user");

        setMessage(`User created successfully! User ID: ${data.userid}`);
        toast.success(`User created successfully! User ID: ${data.userid}`);
        
        resetForm();

      try {
        await queryClient.invalidateQueries({ queryKey: ["users", "list"] });
      } catch {}
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const showAccessControl = values.type.toLowerCase() === "admin" || values.type.toLowerCase() === "viewer";

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-12">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <div className="h-5 w-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading user data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <form onSubmit={onSubmit} className="w-full" aria-label={isEditMode ? "Edit user form" : "Add user form"}>
        {/* Status Messages */}
      {(message || error || submitting) && (
          <div className="mb-6 rounded-lg border p-4" aria-live="polite" aria-atomic="true">
            {submitting && (
              <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span>Creating user...</span>
              </div>
            )}
            {message && (
              <div role="status" className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                {message}
              </div>
            )}
            {error && (
              <div role="alert" className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-200 dark:border-red-800">
                {error}
              </div>
            )}
        </div>
      )}

      <input type="hidden" name="csrf" value={values.csrf} />

        {/* Main Form Fields */}
        <div className="space-y-6">
          {/* Basic Information Section */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800/50">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 pb-3 border-b border-gray-200 dark:border-gray-700">
              Basic Information
            </h3>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Email */}
              <div className="lg:col-span-2">
                <Label htmlFor="email">
                  Email Address <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={values.email}
                  onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
                  error={!!(values.email && !emailValid)}
                  placeholder="user@example.com"
                  className="w-full"
                />
                {values.email && !emailValid && (
                  <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">Please enter a valid email address</p>
                )}
        </div>

              {/* Password */}
              <div className="lg:col-span-2">
                <Label htmlFor="password">
                  Password <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={values.password}
                  onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
                  error={!!(values.password && !passwordValid)}
                  placeholder={isEditMode ? "Leave empty to keep existing password" : "Minimum 8 characters"}
                  className="w-full"
                />
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  {isEditMode 
                    ? "Leave empty to keep existing password. Minimum 8 characters if changing." 
                    : "Minimum 8 characters required. Password is stored encrypted."}
                </p>
                {values.password && !passwordValid && (
                  <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">Password must be at least 8 characters</p>
                )}
        </div>

              {/* First Name */}
        <div>
                <Label htmlFor="firstname">First Name</Label>
                <Input
                  id="firstname"
                  type="text"
                  value={values.firstname ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, firstname: e.target.value }))}
                  placeholder="Enter first name"
                  className="w-full"
                />
        </div>

              {/* Last Name */}
        <div>
                <Label htmlFor="lastname">Last Name</Label>
                <Input
                  id="lastname"
                  type="text"
                  value={values.lastname ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, lastname: e.target.value }))}
                  placeholder="Enter last name"
                  className="w-full"
                />
        </div>

              {/* Department */}
        <div>
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  type="text"
                  value={values.department ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, department: e.target.value }))}
                  placeholder="Enter department"
                  className="w-full"
                />
        </div>

              {/* Role */}
        <div>
                <Label htmlFor="type">
                  Role <span className="text-red-500">*</span>
                </Label>
                <select
                  id="type"
                  className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm shadow-theme-xs text-gray-800 placeholder:text-gray-400 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 focus:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                  value={values.type}
                  onChange={(e) => setValues((v) => ({ ...v, type: e.target.value }))}
                  required
                >
            <option value="superadmin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="viewer">Viewer</option>
          </select>
          {values.type === "superadmin" && (
                  <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                    ⚠️ Note: Only one Super Admin can exist. If one already exists, creation will fail.
                  </p>
                )}
              </div>
            </div>

            {/* Blocked Checkbox */}
            <div className="mt-6 flex items-center gap-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
              <input
                id="blocked"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900"
                checked={!!values.blocked}
                onChange={(e) => setValues((v) => ({ ...v, blocked: e.target.checked }))}
              />
              <label htmlFor="blocked" className="text-sm font-medium text-gray-700 cursor-pointer dark:text-gray-400">
                Block this user from accessing the system
              </label>
            </div>
          </div>

          {/* Access Control Section - Only for Admin and Viewer roles */}
          {showAccessControl && (
            <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 dark:border-blue-800 dark:from-gray-800/50 dark:to-gray-900/50">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Access Control
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Limit user access to specific Faculties, Departments, and Programs. The user will only be able to access data for the assigned areas.
                </p>
              </div>

              <div className="space-y-6">
                {/* Faculty Selection */}
                <div>
                  <Label>
                    Faculties <span className="text-red-500">*</span>
                  </Label>
                  <MultiSelect
                    key={`faculties-${allFacultiesSelected ? 'all' : selectedFaculties.join(',')}`}
                    label="Faculties"
                    options={[
                      { value: ALL_FACULTIES, text: "All Faculties", selected: allFacultiesSelected },
                      ...getFaculties().map((f) => ({ value: f, text: f, selected: selectedFaculties.includes(f) })),
                    ]}
                    defaultSelected={allFacultiesSelected ? [ALL_FACULTIES, ...selectedFaculties] : selectedFaculties}
                    onChange={(selected) => {
                      handleFacultiesChange(selected);
                    }}
                    disabled={submitting}
                  />
                  <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                    Select &quot;All Faculties&quot; to grant access to all faculties, or select specific ones. This is required for Admin and Viewer roles.
                  </p>
                  {showAccessControl && selectedFaculties.length === 0 && !allFacultiesSelected && (
                    <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                      ⚠️ At least one faculty must be selected
                    </p>
                  )}
                </div>

                {/* Department Selection */}
                {(selectedFaculties.length > 0 || allFacultiesSelected) && (
                  <div>
                    <MultiSelect
                      key={`departments-${allDepartmentsSelected ? 'all' : selectedDepartments.join(',')}`}
                      label="Departments (Optional)"
                      options={[
                        { value: ALL_DEPARTMENTS, text: "All Departments", selected: allDepartmentsSelected },
                        ...availableDepartments.map((d) => ({ value: d, text: d, selected: selectedDepartments.includes(d) })),
                      ]}
                      defaultSelected={allDepartmentsSelected ? [ALL_DEPARTMENTS, ...selectedDepartments] : selectedDepartments}
                      onChange={(selected) => {
                        handleDepartmentsChange(selected);
                      }}
                      disabled={submitting}
                    />
                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                      Select &quot;All Departments&quot; to grant access to all departments in selected faculties (programs will automatically be set to &quot;All&quot;), or select specific departments to customize access. If none selected, all departments will be accessible.
                    </p>
                  </div>
                )}

                {/* Program Selection */}
                {selectedDepartments.length > 0 && (
                  <div>
                    {loadingPrograms ? (
                      <div>
                        <Label>Programs (Optional)</Label>
                        <div className="mt-2 rounded-lg border border-gray-300 bg-white p-4 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                          <div className="inline-flex items-center gap-2">
                            <div className="h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                            <span>Loading programs...</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {availablePrograms.length > 0 ? (
                          <MultiSelect
                            key={`programs-${allProgramsSelected ? 'all' : selectedPrograms.join(',')}`}
                            label="Programs (Optional)"
                            options={[
                              { value: ALL_PROGRAMS, text: "All Programs", selected: allProgramsSelected },
                              ...availablePrograms.map((p) => ({ value: p, text: p, selected: selectedPrograms.includes(p) })),
                            ]}
                            defaultSelected={allProgramsSelected ? [ALL_PROGRAMS, ...selectedPrograms] : selectedPrograms}
                            onChange={(selected) => {
                              handleProgramsChange(selected);
                            }}
                            disabled={submitting}
                          />
                        ) : (
                          <div>
                            <Label>Programs (Optional)</Label>
                            <div className="mt-2 rounded-lg border border-gray-300 bg-white p-4 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                              No programs found for selected departments. Programs can be added later.
                            </div>
                          </div>
                        )}
                        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                          {allDepartmentsSelected 
                            ? "Programs are automatically set to 'All' when 'All Departments' is selected. You can still select specific programs if needed."
                            : "Select 'All Programs' to grant access to all programs in selected departments, or select specific ones. If none selected, all programs will be accessible."}
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Form Actions */}
        <div className="mt-8 flex items-center justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            disabled={submitting}
            onClick={resetForm}
            className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm hover:shadow-md dark:bg-brand-500 dark:hover:bg-brand-600"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Creating...
              </span>
            ) : (
              isEditMode ? "Update User" : "Create User"
            )}
          </button>
        </div>
      </form>
      </div>
  );
}
