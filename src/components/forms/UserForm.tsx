"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import AccessControlPicker, { type AccessAssignmentsValue } from "@/components/users/AccessControlPicker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { USER_ROLES, type UserRole } from "@/lib/rbac-constants";
import { useSession } from "next-auth/react";
import { isSuperAdminUser, isAdminUser, isViewerUser } from "@/lib/alumniProfile";

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

/**
 * Validate if a role string is a valid UserRole
 */
function isValidRole(role: string): role is UserRole {
  const normalized = role.toLowerCase().trim();
  return Object.values(USER_ROLES).includes(normalized as UserRole);
}

export default function UserForm({ userId, initialData, onSuccess }: UserFormProps = {}) {
  const { data: session } = useSession();
  const isEditMode = !!userId;
  const queryClient = useQueryClient();
  const isSuperAdmin = isSuperAdminUser(session?.user);
  const isAdmin = isAdminUser(session?.user);
  const isViewer = isViewerUser(session?.user);
  const currentUserId = (session?.user as { userId?: number })?.userId;
  const canOnlyEditPasswordAndImage =
    !isSuperAdmin &&
    (isAdmin || isViewer) &&
    isEditMode &&
    !!userId &&
    !!currentUserId &&
    Number(currentUserId) === Number(userId);
  
  // Check if user can view/edit password
  const canViewPassword = isSuperAdmin || (userId && currentUserId && Number(currentUserId) === Number(userId));
  const canEditPassword = isSuperAdmin || (userId && currentUserId && Number(currentUserId) === Number(userId));
  const [values, setValues] = useState<UserFormValues>({
    email: "",
    password: "",
    firstname: "",
    lastname: "",
    department: "",
    type: USER_ROLES.ADMIN,
    blocked: false,
    csrf: "",
    accessAssignments: { faculties: [], departments: [], programs: [] },
  });

  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEditMode);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const userDetailsQuery = useQuery<any, Error>({
    queryKey: ["users", "detail", userId],
    enabled: !!(isEditMode && userId),
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/users/${userId}`, { signal, headers: { accept: "application/json" } });
      if (!res.ok) {
        throw new Error("Failed to fetch user data");
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,
  });

  // Access control state (DB-backed via organization APIs)
  const [accessAssignmentsState, setAccessAssignmentsState] = useState<AccessAssignmentsValue>({
    faculties: [],
    departments: [],
    programs: [],
  });

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
      setLoading(userDetailsQuery.isLoading);
      if (userDetailsQuery.isError) {
        setError(userDetailsQuery.error?.message || "Failed to load user data");
        toast.error("Failed to load user data");
        return;
      }

      const user = (userDetailsQuery.data as any)?.item;
      if (user) {
        setValues({
          email: user.email || "",
          password: "", // Don't pre-fill password
          firstname: user.firstname || "",
          lastname: user.lastname || "",
          department: user.department || "",
          type: user.type || USER_ROLES.ADMIN,
          blocked: user.blocked || false,
          csrf: values.csrf || "",
          accessAssignments: user.accessAssignments || { faculties: [], departments: [], programs: [] },
        });

        const access = (user.accessAssignments ?? { faculties: [], departments: [], programs: [] }) as AccessAssignmentsValue;
        setAccessAssignmentsState(access);
        setLoading(false);
      }
    } else if (initialData) {
      // Use provided initial data
      setValues({
        email: initialData.email || "",
        password: "",
        firstname: initialData.firstname || "",
        lastname: initialData.lastname || "",
        department: initialData.department || "",
        type: initialData.type || USER_ROLES.ADMIN,
        blocked: initialData.blocked || false,
        csrf: values.csrf || "",
        accessAssignments: initialData.accessAssignments || { faculties: [], departments: [], programs: [] },
      });
      
      if (initialData.accessAssignments) {
        const access = (initialData.accessAssignments ?? { faculties: [], departments: [], programs: [] }) as AccessAssignmentsValue;
        setAccessAssignmentsState(access);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isEditMode, userDetailsQuery.data, userDetailsQuery.error, userDetailsQuery.isError, userDetailsQuery.isLoading]);

  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()), [values.email]);
  const passwordValid = useMemo(() => values.password.length >= 8, [values.password]);

  const resetForm = useCallback(() => {
    setValues({
      email: "",
      password: "",
      firstname: "",
      lastname: "",
      department: "",
      type: USER_ROLES.ADMIN,
      blocked: false,
      csrf: values.csrf,
      accessAssignments: { faculties: [], departments: [], programs: [] },
    });
    setAccessAssignmentsState({ faculties: [], departments: [], programs: [] });
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
    // Only superadmin can create new users
    if (!isEditMode && !isSuperAdmin) {
      setError("Only Super Admin can create new users");
      toast.error("Only Super Admin can create new users");
      return;
    }
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

    if (canOnlyEditPasswordAndImage) {
      try {
        setSubmitting(true);

        const fd = new FormData();
        if (values.password && values.password.trim().length > 0) {
          fd.append("newPassword", values.password.trim());
        }
        if (imageFile) {
          fd.append("image", imageFile);
        }

        const res = await fetch("/api/users/current", {
          method: "PUT",
          body: fd,
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Failed to update profile");

        setMessage(`User updated successfully!`);
        toast.success(`User updated successfully!`);
        setValues((v) => ({ ...v, password: "" }));
        setImageFile(null);

        if (onSuccess) {
          onSuccess();
        }

        try {
          await queryClient.invalidateQueries({ queryKey: ["users", "list"] });
        } catch {}
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        toast.error(msg);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Validate role
    if (!isValidRole(values.type)) {
      setError(`Invalid role. Must be one of: ${Object.values(USER_ROLES).join(", ")}`);
      toast.error("Invalid role selected");
      return;
    }

    const userType = values.type.toLowerCase().trim() as UserRole;
    const needsAccessControl = userType === USER_ROLES.ADMIN || userType === USER_ROLES.VIEWER;

    if (needsAccessControl && accessAssignmentsState.faculties.length === 0) {
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

      const accessAssignments = needsAccessControl
        ? {
            faculties: accessAssignmentsState.faculties,
            departments: accessAssignmentsState.departments,
            programs: accessAssignmentsState.programs,
          }
        : undefined;

      const accessAssignmentsPayload: { faculties: string[]; departments: string[]; programs: string[] } | null | undefined =
        needsAccessControl ? accessAssignments ?? { faculties: [], departments: [], programs: [] } : (userType === USER_ROLES.SUPERADMIN ? null : undefined);

      if (isEditMode && userId) {
        // Update existing user
        const updatePayload: {
          email: string;
          firstname?: string | null;
          lastname?: string | null;
          department?: string | null;
          type: string;
          blocked: boolean;
          accessAssignments?: { faculties: string[]; departments: string[]; programs: string[] } | null;
          password?: string;
        } = {
          email: values.email,
          firstname: values.firstname || null,
          lastname: values.lastname || null,
          department: values.department || null,
          type: values.type,
          blocked: values.blocked || false,
          accessAssignments: accessAssignmentsPayload,
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
            accessAssignments: accessAssignmentsPayload ?? undefined,
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

  const userTypeNormalized = values.type.toLowerCase().trim() as UserRole;
  const showAccessControl = userTypeNormalized === USER_ROLES.ADMIN || userTypeNormalized === USER_ROLES.VIEWER;

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
                  disabled={canOnlyEditPasswordAndImage}
                />
                {values.email && !emailValid && (
                  <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">Please enter a valid email address</p>
                )}
        </div>

              {/* Password - Only show for superadmin or own account */}
              {canViewPassword && (
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
                  disabled={!canEditPassword}
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
              )}

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
                  disabled={canOnlyEditPasswordAndImage}
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
                  disabled={canOnlyEditPasswordAndImage}
                />
        </div>

              {canOnlyEditPasswordAndImage && (
                <div className="lg:col-span-2">
                  <Label htmlFor="image">Profile Image</Label>
                  <input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setImageFile(f);
                    }}
                    className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/20 dark:file:text-blue-300"
                  />
                </div>
              )}

              {/* Department - Only superadmin can edit */}
              {isSuperAdmin && (
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
              )}

              {/* Role - Only superadmin can edit */}
              {isSuperAdmin && (
        <div>
                <Label htmlFor="type">
                  Role <span className="text-red-500">*</span>
                </Label>
                <select
                  id="type"
                  className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm shadow-theme-xs text-gray-800 placeholder:text-gray-400 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 focus:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                  value={values.type}
                  onChange={(e) => {
                    const newType = e.target.value.toLowerCase().trim() as UserRole;
                    setValues((v) => ({ ...v, type: newType }));
                    // Clear access assignments when switching to superadmin
                    if (newType === USER_ROLES.SUPERADMIN) {
                      setAccessAssignmentsState({ faculties: [], departments: [], programs: [] });
                    }
                  }}
                  required
                >
            <option value={USER_ROLES.SUPERADMIN}>Super Admin</option>
            <option value={USER_ROLES.ADMIN}>Admin</option>
            <option value={USER_ROLES.VIEWER}>Viewer</option>
          </select>
          {userTypeNormalized === USER_ROLES.SUPERADMIN && (
                  <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                    ⚠️ Note: Super Admin has full system access and does not require access control assignments.
                  </p>
                )}
              </div>
              )}
            </div>

            {/* Blocked Checkbox - Only superadmin can edit */}
            {isSuperAdmin && (
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
            )}
          </div>

          {/* Access Control Section - Only for Admin and Viewer roles, and only superadmin can edit */}
          {showAccessControl && isSuperAdmin && (
            <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 dark:border-blue-800 dark:from-gray-800/50 dark:to-gray-900/50">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Access Control
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Limit user access to specific Faculties and Departments. The user will only be able to access data for the assigned areas. Access is enforced using ID-based filtering at the database level.
                </p>
              </div>

              <div className="space-y-4">
                <AccessControlPicker
                  value={accessAssignmentsState}
                  onChange={setAccessAssignmentsState}
                  disabled={submitting}
                />
                {accessAssignmentsState.faculties.length === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    ⚠️ At least one faculty must be selected
                  </p>
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
