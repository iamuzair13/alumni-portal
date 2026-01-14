"use client";
import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Image from "next/image";
import toast from "react-hot-toast";
import { currentUserImageKey } from "@/app/queries/alumni-profile";

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

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/users/current");
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch user data");
      }
      const data = await res.json();
      const user = data.user as UserData;
      setUserData(user);
      setFormData({
        email: user.email || "",
        currentPassword: user.password || "",
        newPassword: "",
        firstname: user.firstname || "",
        lastname: user.lastname || "",
        department: user.department || "",
      });
      
      // Set image preview if user has an image
      if (user.user_image) {
        setImagePreview(`/images/${user.user_image}`);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      toast.error("Failed to load profile data");
    } finally {
      setLoading(false);
    }
  };

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
    if (!formData.email || !formData.email.includes("@")) {
      newErrors.email = "Valid email is required";
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
      formDataToSend.append("email", formData.email);
      // Only send new password if provided and not empty
      if (formData.newPassword && formData.newPassword.trim().length > 0) {
        formDataToSend.append("newPassword", formData.newPassword.trim());
        console.log("[Form] Sending new password to API");
      } else {
        console.log("[Form] No new password provided, skipping");
      }
      formDataToSend.append("firstname", formData.firstname);
      formDataToSend.append("lastname", formData.lastname);
      if (formData.department) {
        formDataToSend.append("department", formData.department);
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
        await fetchUserData();
        setFormData((prev) => ({ ...prev, newPassword: "" }));
      }
      
      setImageFile(null);
    } catch (error) {
      console.error("Error updating profile:", error);
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

  const isSuperAdmin = userData.type?.toLowerCase() === "superadmin";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Profile Image */}
      <div>
        <Label>Profile Image</Label>
        <div className="mt-2 flex items-center gap-4">
          <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700">
            {imagePreview ? (
              <Image
                src={imagePreview}
                alt="Profile preview"
                width={96}
                height={96}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <span className="text-2xl text-gray-500 dark:text-gray-400">
                  {userData.firstname?.[0]?.toUpperCase() || userData.email?.[0]?.toUpperCase() || "U"}
                </span>
              </div>
            )}
          </div>
          <div className="flex-1">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="block w-full text-sm text-gray-500 dark:text-gray-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                dark:file:bg-blue-900/20 dark:file:text-blue-300"
            />
            {errors.image && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.image}</p>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Optional. Max 5MB. JPG, PNG, or GIF.
            </p>
          </div>
        </div>
      </div>

      {/* Email */}
      <div>
        <Label htmlFor="email">Email Address *</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => handleInputChange("email", e.target.value)}
          required
          className={errors.email ? "border-red-500" : ""}
        />
        {errors.email && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.email}</p>
        )}
      </div>

      {/* Current Password */}
      <div>
        <Label htmlFor="currentPassword">Current Password</Label>
        <Input
          id="currentPassword"
          type="text"
          value={!formData.currentPassword || formData.currentPassword.startsWith("scrypt:") 
            ? "Password is hashed (cannot display)" 
            : formData.currentPassword}
          readOnly
          className="bg-gray-50 dark:bg-gray-800 cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {!formData.currentPassword || formData.currentPassword.startsWith("scrypt:") 
            ? "Password is hashed. Plain text password not available. Enter a new password to change it."
            : "Your current password from the database (plain text)."}
        </p>
      </div>

      {/* New Password */}
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
        {errors.newPassword && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.newPassword}</p>
        )}
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Leave blank to keep your current password. Minimum 8 characters. Password will be hashed before saving.
        </p>
      </div>

      {/* First Name */}
      <div>
        <Label htmlFor="firstname">First Name</Label>
        <Input
          id="firstname"
          type="text"
          value={formData.firstname}
          onChange={(e) => handleInputChange("firstname", e.target.value)}
        />
      </div>

      {/* Last Name */}
      <div>
        <Label htmlFor="lastname">Last Name</Label>
        <Input
          id="lastname"
          type="text"
          value={formData.lastname}
          onChange={(e) => handleInputChange("lastname", e.target.value)}
        />
      </div>

      {/* Department (only for superadmin) */}
      {isSuperAdmin && (
        <div>
          <Label htmlFor="department">Department</Label>
          <Input
            id="department"
            type="text"
            value={formData.department}
            onChange={(e) => handleInputChange("department", e.target.value)}
          />
        </div>
      )}

      {/* Read-only fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div>
          <Label>User Type</Label>
          <Input
            type="text"
            value={userData.type || "N/A"}
            readOnly
            className="bg-gray-50 dark:bg-gray-800 cursor-not-allowed"
          />
        </div>
        <div>
          <Label>Status</Label>
          <Input
            type="text"
            value={userData.blocked ? "Blocked" : "Active"}
            readOnly
            className="bg-gray-50 dark:bg-gray-800 cursor-not-allowed"
          />
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => fetchUserData()}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
