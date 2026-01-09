"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { canModify } from "@/lib/alumniProfile";

interface DistinguishedAlumni {
  id?: number;
  slug: string;
  name: string;
  image: string;
  role: string;
  summary: string;
  headline?: string | null;
  quote?: string | null;
  quote_by?: string | null;
  tags?: any[] | null;
  stats?: any[] | null;
  achievements?: any[] | null;
  story?: any[] | null;
  created_at?: string;
  updated_at?: string;
}

interface DistinguishedAlumniFormProps {
  isOpen: boolean;
  onClose: () => void;
  editingItem?: DistinguishedAlumni | null;
}

export const DistinguishedAlumniForm: React.FC<DistinguishedAlumniFormProps> = ({
  isOpen,
  onClose,
  editingItem
}) => {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm<DistinguishedAlumni>({
    defaultValues: {
      slug: "",
      name: "",
      image: "",
      role: "",
      summary: "",
      headline: "",
      quote: "",
      quote_by: "",
      tags: [],
      stats: [],
      achievements: [],
      story: []
    }
  });

  // Reset form when editingItem changes
  useEffect(() => {
    if (editingItem) {
      reset({
        slug: editingItem.slug || "",
        name: editingItem.name || "",
        image: editingItem.image || "",
        role: editingItem.role || "",
        summary: editingItem.summary || "",
        headline: editingItem.headline || "",
        quote: editingItem.quote || "",
        quote_by: editingItem.quote_by || "",
        tags: editingItem.tags || [],
        stats: editingItem.stats || [],
        achievements: editingItem.achievements || [],
        story: editingItem.story || []
      });
      if (editingItem.image) {
        setImagePreview(editingItem.image);
      }
    } else {
      reset({
        slug: "",
        name: "",
        image: "",
        role: "",
        summary: "",
        headline: "",
        quote: "",
        quote_by: "",
        tags: [],
        stats: [],
        achievements: [],
        story: []
      });
      setImagePreview(null);
    }
    setImageFile(null);
  }, [editingItem, reset, isOpen]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size must be less than 5MB");
        return;
      }
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setValue("image", reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: DistinguishedAlumni) => {
    setIsSubmitting(true);
    try {
      const url = editingItem?.id
        ? `/api/distinguished-alumni/${editingItem.id}`
        : "/api/distinguished-alumni";
      
      const method = editingItem?.id ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save distinguished alumni");
      }

      const result = await response.json();
      toast.success(
        editingItem?.id
          ? "Distinguished alumni updated successfully"
          : "Distinguished alumni created successfully"
      );

      // Invalidate queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ["distinguished-alumni"] });

      onClose();
      reset();
      setImageFile(null);
      setImagePreview(null);
    } catch (error) {
      console.error("Error saving distinguished alumni:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save distinguished alumni"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      reset();
      setImageFile(null);
      setImagePreview(null);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      className="max-w-4xl mx-auto max-h-[90vh] overflow-y-auto"
      showCloseButton={true}
    >
      <div className="p-6 lg:p-8" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {editingItem?.id ? "Edit Distinguished Alumni" : "Add Distinguished Alumni"}
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Slug */}
            <div className="md:col-span-2">
              <Label htmlFor="slug">
                Slug <span className="text-red-500">*</span>
              </Label>
              <Input
                id="slug"
                type="text"
                placeholder="unique-slug-name"
                {...register("slug", {
                  required: "Slug is required",
                  pattern: {
                    value: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                    message: "Slug must be lowercase alphanumeric with hyphens only"
                  }
                })}
                className={errors.slug ? "border-red-500" : ""}
                disabled={isSubmitting}
              />
              {errors.slug && (
                <p className="mt-1 text-sm text-red-600">{errors.slug.message}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                URL-friendly identifier (e.g., john-doe-2024)
              </p>
            </div>

            {/* Name */}
            <div className="md:col-span-2">
              <Label htmlFor="name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Full Name"
                {...register("name", {
                  required: "Name is required",
                  maxLength: {
                    value: 500,
                    message: "Name must be less than 500 characters"
                  }
                })}
                className={errors.name ? "border-red-500" : ""}
                disabled={isSubmitting}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            {/* Image */}
            <div className="md:col-span-2">
              <Label htmlFor="image">
                Image URL <span className="text-red-500">*</span>
              </Label>
              <div className="space-y-2">
                <Input
                  id="image"
                  type="text"
                  placeholder="https://example.com/image.jpg"
                  {...register("image", {
                    required: "Image URL is required",
                    pattern: {
                      value: /^https?:\/\/.+/,
                      message: "Please enter a valid URL"
                    }
                  })}
                  className={errors.image ? "border-red-500" : ""}
                  disabled={isSubmitting}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                >
                  Upload Image
                </Button>
                {imagePreview && (
                  <div className="mt-2">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="h-32 w-32 object-cover rounded-lg border border-gray-300"
                    />
                  </div>
                )}
              </div>
              {errors.image && (
                <p className="mt-1 text-sm text-red-600">{errors.image.message}</p>
              )}
            </div>

            {/* Role */}
            <div className="md:col-span-2">
              <Label htmlFor="role">
                Role <span className="text-red-500">*</span>
              </Label>
              <Input
                id="role"
                type="text"
                placeholder="Current Position/Title"
                {...register("role", {
                  required: "Role is required"
                })}
                className={errors.role ? "border-red-500" : ""}
                disabled={isSubmitting}
              />
              {errors.role && (
                <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
              )}
            </div>

            {/* Summary */}
            <div className="md:col-span-2">
              <Label htmlFor="summary">
                Summary <span className="text-red-500">*</span>
              </Label>
              <textarea
                id="summary"
                rows={4}
                placeholder="Brief summary of achievements..."
                {...register("summary", {
                  required: "Summary is required"
                })}
                className={`w-full px-4 py-3 rounded-lg border ${
                  errors.summary ? "border-red-500" : "border-gray-300"
                } bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                disabled={isSubmitting}
              />
              {errors.summary && (
                <p className="mt-1 text-sm text-red-600">{errors.summary.message}</p>
              )}
            </div>

            {/* Headline */}
            <div className="md:col-span-2">
              <Label htmlFor="headline">Headline (Optional)</Label>
              <Input
                id="headline"
                type="text"
                placeholder="Catchy headline"
                {...register("headline")}
                disabled={isSubmitting}
              />
            </div>

            {/* Quote */}
            <div className="md:col-span-2">
              <Label htmlFor="quote">Quote (Optional)</Label>
              <textarea
                id="quote"
                rows={3}
                placeholder="Inspirational quote..."
                {...register("quote")}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSubmitting}
              />
            </div>

            {/* Quote By */}
            <div className="md:col-span-2">
              <Label htmlFor="quote_by">Quote By (Optional)</Label>
              <Input
                id="quote_by"
                type="text"
                placeholder="Author of the quote"
                {...register("quote_by")}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                editingItem?.id ? "Update" : "Create"
              )}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};