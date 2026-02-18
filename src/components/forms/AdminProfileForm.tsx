"use client";
import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Image from "next/image";
import toast from "react-hot-toast";
import { currentUserImageKey } from "@/app/queries/alumni-profile";
import Badge from "@/components/ui/badge/Badge";

type UserData = {
  userid: number;
  email: string | null;
  firstname: string | null;
  lastname: string | null;
  department: string | null;
  type: string | null;
  blocked: boolean | null;
  lastlogindatetime: string | null;
  user_image: string | null;
  password?: string | null;
};

type AccessAssignmentsResponse = {
  isSuperAdmin: boolean;
  isAlumni: boolean;
  faculties: string[];
  departments: string[];
  programs: string[];
};

export default function AdminProfileForm() {
  const { data: session, update: updateSession } = useSession();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    currentPassword: "",
    newPassword: "",
    firstname: "",
    lastname: "",
    department: "",
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const currentUserQuery = useQuery<{ user: UserData }, Error>({
    queryKey: ["users", "current"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/users/current", { signal, headers: { accept: "application/json" } });
      if (!res.ok) {
        const error = await res.json().catch(() => ({} as any));
        throw new Error((error as any)?.error || "Failed to fetch user data");
      }
      return (await res.json()) as { user: UserData };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,
  });

  const accessAssignmentsQuery = useQuery({
    queryKey: ["users", "current", "access-assignments"],
    enabled: !!userData,
    queryFn: async () => {
      const res = await fetch("/api/users/current/access-assignments");
      if (!res.ok) {
        throw new Error("Failed to fetch access assignments");
      }
      return (await res.json()) as AccessAssignmentsResponse;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,
  });

  useEffect(() => {
    setLoading(currentUserQuery.isLoading);
    if (currentUserQuery.isError) {
      toast.error("Failed to load profile data");
      return;
    }
    const user = currentUserQuery.data?.user;
    if (!user) return;

    setUserData(user);
    setFormData({
      email: user.email || "",
      currentPassword: user.password || "",
      newPassword: "",
      firstname: user.firstname || "",
      lastname: user.lastname || "",
      department: user.department || "",
    });

    if (user.user_image) {
      setImagePreview(`/images/${user.user_image}`);
    }
  }, [currentUserQuery.data, currentUserQuery.isError, currentUserQuery.isLoading]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        setErrors((prev) => ({ ...prev, image: "Please select an image file" }));
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, image: "Image size must be less than 5MB" }));
        return;
      }
      
      setImageFile(file);
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.image;
        return newErrors;
      });
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    const newErrors: Record<string, string> = {};
    if (!isRestrictedStaff) {
      if (!formData.email || !formData.email.includes("@")) {
        newErrors.email = "Valid email is required";
      }
    }
    if (formData.newPassword && formData.newPassword.length < 8) {
      newErrors.newPassword = "New password must be at least 8 characters";
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    try {
      setSaving(true);
      
      // Create FormData for file upload
      const formDataToSend = new FormData();
      if (!isRestrictedStaff) {
        formDataToSend.append("email", formData.email);
        formDataToSend.append("firstname", formData.firstname);
        formDataToSend.append("lastname", formData.lastname);
        if (formData.department) {
          formDataToSend.append("department", formData.department);
        }
      }
      // Only send new password if provided and not empty
      if (formData.newPassword && formData.newPassword.trim().length > 0) {
        formDataToSend.append("newPassword", formData.newPassword.trim());

      } else {

      }
      if (imageFile) {
        formDataToSend.append("image", imageFile);
      }
      
      const res = await fetch("/api/users/current", {
        method: "PUT",
        body: formDataToSend,
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update profile");
      }
      
      const data = await res.json();
      toast.success("Profile updated successfully");
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: currentUserImageKey() });
      queryClient.invalidateQueries({ queryKey: ["users", "list"] });
      
      // Update image preview immediately if image was uploaded
      if (data.user?.user_image) {
        setImagePreview(`/images/${data.user.user_image}`);
      }
      
      // Update session if email or name changed
      if (data.user) {
        await updateSession({
          ...session,
          user: {
            ...session?.user,
            email: data.user.email,
            name: `${data.user.firstname || ""} ${data.user.lastname || ""}`.trim() || data.user.email,
          },
        });
      }
      
      // Update form data immediately with the response, especially password
      if (data.user) {
        setUserData((prev) => prev ? { ...prev, ...data.user } : data.user);
        setFormData((prev) => ({
          ...prev,
          email: data.user.email || prev.email,
          firstname: data.user.firstname || prev.firstname,
          lastname: data.user.lastname || prev.lastname,
          department: data.user.department || prev.department,
          // Update current password if new password was provided
          currentPassword: formData.newPassword && formData.newPassword.trim().length > 0 
            ? formData.newPassword.trim() 
            : (data.user.password || prev.currentPassword),
          newPassword: "", // Clear new password field
        }));
      } else {
        // Fallback: refresh user data if response doesn't include user
        await currentUserQuery.refetch();
        setFormData((prev) => ({ ...prev, newPassword: "" }));
      }
      
      setImageFile(null);
    } catch (error) {

      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
        Failed to load profile data
      </div>
    );
  }

  const normalizedType = userData.type ? String(userData.type).toLowerCase().trim() : "";
  const isSuperAdmin = normalizedType === "superadmin";
  const isRestrictedStaff = !isSuperAdmin;

  const roleLabel = userData.type || "N/A";
  const statusLabel = userData.blocked ? "Blocked" : "Active";

  const displayName = `${userData.firstname ?? ""} ${userData.lastname ?? ""}`.trim() || userData.email || "User";
  const lastLoginLabel = userData.lastlogindatetime
    ? new Date(userData.lastlogindatetime).toLocaleString()
    : "-";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-brand-50/50 via-transparent to-blue-50/50 dark:from-brand-500/10 dark:to-blue-500/10" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
              {imagePreview ? (
                <Image src={imagePreview} alt="Profile preview" width={96} height={96} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gray-100 dark:bg-gray-800">
                  <span className="text-2xl font-semibold text-gray-500 dark:text-gray-300">
                    {userData.firstname?.[0]?.toUpperCase() || userData.email?.[0]?.toUpperCase() || "U"}
                  </span>
                </div>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white/90">{displayName}</h3>
                <Badge variant={isSuperAdmin ? "solid" : "light"} color={isSuperAdmin ? "primary" : "light"} size="sm">
                  {roleLabel}
                </Badge>
                <Badge variant="light" color={userData.blocked ? "error" : "success"} size="sm">
                  {statusLabel}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-gray-400">{userData.email || "-"}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-gray-500">Last login: {lastLoginLabel}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="block w-full text-sm text-gray-500 dark:text-gray-400
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-brand-50 file:text-brand-600
                  hover:file:bg-brand-100
                  dark:file:bg-brand-500/15 dark:file:text-brand-300"
              />
              {errors.image && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.image}</p>}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Optional. Max 5MB. JPG, PNG, or GIF.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold text-slate-900 dark:text-white/90">Access Assignments</h4>
          {accessAssignmentsQuery.data?.isSuperAdmin ? (
            <Badge variant="light" color="primary" size="sm">Full access</Badge>
          ) : null}
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 bg-gradient-to-r from-brand-50/70 via-white to-blue-50/70 p-4 dark:border-gray-800 dark:from-brand-500/10 dark:via-white/[0.03] dark:to-blue-500/10">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl bg-white/80 p-4 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900/30 dark:ring-white/5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900 dark:text-white/90">Faculties</p>
                <Badge variant="light" color="info" size="sm">
                  {accessAssignmentsQuery.isLoading
                    ? "…"
                    : (accessAssignmentsQuery.data?.isSuperAdmin ? "All" : (accessAssignmentsQuery.data?.faculties?.length ?? 0))}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {!accessAssignmentsQuery.isLoading && accessAssignmentsQuery.data?.isSuperAdmin ? (
                  <Badge variant="light" color="light" size="sm">All</Badge>
                ) : null}
                {(accessAssignmentsQuery.data?.faculties ?? []).map((f) => (
                  <Badge key={f} variant="light" color="primary" size="sm">{f}</Badge>
                ))}
                {!accessAssignmentsQuery.isLoading && !accessAssignmentsQuery.data?.isSuperAdmin && (accessAssignmentsQuery.data?.faculties?.length ?? 0) === 0 ? (
                  <span className="text-xs text-slate-500 dark:text-gray-500">No assigned faculties</span>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl bg-white/80 p-4 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900/30 dark:ring-white/5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900 dark:text-white/90">Departments</p>
                <Badge variant="light" color="info" size="sm">
                  {accessAssignmentsQuery.isLoading
                    ? "…"
                    : (accessAssignmentsQuery.data?.isSuperAdmin ? "All" : (accessAssignmentsQuery.data?.departments?.length ?? 0))}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {!accessAssignmentsQuery.isLoading && accessAssignmentsQuery.data?.isSuperAdmin ? (
                  <Badge variant="light" color="light" size="sm">All</Badge>
                ) : null}
                {(accessAssignmentsQuery.data?.departments ?? []).map((d) => (
                  <Badge key={d} variant="light" color="primary" size="sm">{d}</Badge>
                ))}
                {!accessAssignmentsQuery.isLoading && !accessAssignmentsQuery.data?.isSuperAdmin && (accessAssignmentsQuery.data?.departments?.length ?? 0) === 0 ? (
                  <span className="text-xs text-slate-500 dark:text-gray-500">No assigned departments</span>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl bg-white/80 p-4 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900/30 dark:ring-white/5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900 dark:text-white/90">Programs</p>
                <Badge variant="light" color="info" size="sm">
                  {accessAssignmentsQuery.isLoading
                    ? "…"
                    : (accessAssignmentsQuery.data?.isSuperAdmin ? "All" : (accessAssignmentsQuery.data?.programs?.length ?? 0))}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {!accessAssignmentsQuery.isLoading && accessAssignmentsQuery.data?.isSuperAdmin ? (
                  <Badge variant="light" color="light" size="sm">All</Badge>
                ) : null}
                {(accessAssignmentsQuery.data?.programs ?? []).map((p) => (
                  <Badge key={p} variant="light" color="primary" size="sm">{p}</Badge>
                ))}
                {!accessAssignmentsQuery.isLoading && !accessAssignmentsQuery.data?.isSuperAdmin && (accessAssignmentsQuery.data?.programs?.length ?? 0) === 0 ? (
                  <span className="text-xs text-slate-500 dark:text-gray-500">No assigned programs</span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
          <h4 className="text-lg font-semibold text-slate-900 dark:text-white/90">Account</h4>
          <div className="mt-5 grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                required
                readOnly={isRestrictedStaff}
                className={`${errors.email ? "border-red-500" : ""} ${isRestrictedStaff ? "bg-gray-50 dark:bg-gray-800 cursor-not-allowed" : ""}`}
              />
              {errors.email && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.email}</p>}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="firstname">First Name</Label>
                <Input
                  id="firstname"
                  type="text"
                  value={formData.firstname}
                  onChange={(e) => handleInputChange("firstname", e.target.value)}
                  readOnly={isRestrictedStaff}
                  className={isRestrictedStaff ? "bg-gray-50 dark:bg-gray-800 cursor-not-allowed" : ""}
                />
              </div>

              <div>
                <Label htmlFor="lastname">Last Name</Label>
                <Input
                  id="lastname"
                  type="text"
                  value={formData.lastname}
                  onChange={(e) => handleInputChange("lastname", e.target.value)}
                  readOnly={isRestrictedStaff}
                  className={isRestrictedStaff ? "bg-gray-50 dark:bg-gray-800 cursor-not-allowed" : ""}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                type="text"
                value={formData.department}
                onChange={(e) => handleInputChange("department", e.target.value)}
                readOnly={!isSuperAdmin}
                className={!isSuperAdmin ? "bg-gray-50 dark:bg-gray-800 cursor-not-allowed" : ""}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
          <h4 className="text-lg font-semibold text-slate-900 dark:text-white/90">Security</h4>
          <div className="mt-5 grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="text"
                value={formData.currentPassword || "-"}
                readOnly
                className="bg-gray-50 dark:bg-gray-800 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {"Your current password from the database (plain text)."}
              </p>
            </div>

            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={formData.newPassword}
                onChange={(e) => handleInputChange("newPassword", e.target.value)}
                placeholder="Enter new password to change"
                className={errors.newPassword ? "border-red-500" : ""}
              />
              {errors.newPassword && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.newPassword}</p>}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Leave blank to keep your current password. Minimum 8 characters.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>User Type</Label>
            <Input type="text" value={userData.type || "N/A"} readOnly className="bg-gray-50 dark:bg-gray-800 cursor-not-allowed" />
          </div>
          <div>
            <Label>Status</Label>
            <Input type="text" value={userData.blocked ? "Blocked" : "Active"} readOnly className="bg-gray-50 dark:bg-gray-800 cursor-not-allowed" />
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button type="button" variant="outline" onClick={() => currentUserQuery.refetch()} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
