"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { canModify } from "@/lib/alumniProfile";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import DOMPurify from "dompurify";
import { useFaculties, useDepartments, usePrograms } from "@/app/queries/fetch-organization";

// Normalize image path - if it's not a full URL, assume it's in /images/
function normalizeImagePath(image: string | null | undefined): string {
  if (!image) return "/images/placeholder-avatar.webp";
  
  // If it's already a full URL (http/https), use it as-is
  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }
  
  // If it starts with /, use it as-is
  if (image.startsWith("/")) {
    return image;
  }
  
  // Otherwise, assume it's a filename in /images/
  return `/images/${image}`;
}

interface DistinguishedAlumni {
  id?: number;
  slug: string;
  name: string;
  image: string;
  role: string;
  summary: string;
  faculty_id?: number | null;
  department_id?: number | null;
  program_id?: number | null;
  headline?: string | null;
  quote?: string | null;
  quote_by?: string | null;
  tags?: any[] | null;
  stats?: any[] | Record<string, string> | null;
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
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [stats, setStats] = useState<Array<{ key: string; value: string }>>([]);
  const [achievementsHtml, setAchievementsHtml] = useState("");
  const [storyHtml, setStoryHtml] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors }
  } = useForm<DistinguishedAlumni>({
    defaultValues: {
      slug: "",
      name: "",
      role: "",
      summary: "",
      faculty_id: null,
      department_id: null,
      program_id: null,
      headline: "",
      quote: "",
      quote_by: "",
      tags: [],
      stats: [],
      achievements: [],
      story: []
    }
  });

  // TipTap editor for Role
  const roleEditor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    ],
    content: "",
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setValue("role", html, { shouldValidate: true });
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4",
      },
    },
    editable: true,
  });

  // TipTap editor for Achievements
  const achievementsEditor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    ],
    content: "",
    onUpdate: ({ editor }) => {
      setAchievementsHtml(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4",
      },
    },
    editable: true,
  });

  // TipTap editor for Story
  const storyEditor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    ],
    content: "",
    onUpdate: ({ editor }) => {
      setStoryHtml(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4",
      },
    },
    editable: true,
  });

  // TipTap editor for Summary
  const summaryEditor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    ],
    content: "",
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setValue("summary", html, { shouldValidate: true });
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4",
      },
    },
    editable: true,
  });

  // Reset form when editingItem changes
  useEffect(() => {
    if (editingItem) {
      const roleContent = editingItem.role || "";
      const summaryContent = editingItem.summary || "";
      const editingTags = Array.isArray(editingItem.tags) ? editingItem.tags : [];
      const editingStats = editingItem.stats && typeof editingItem.stats === 'object' && !Array.isArray(editingItem.stats)
        ? Object.entries(editingItem.stats).map(([key, value]) => ({ key, value: String(value) }))
        : [];
      
      reset({
        slug: editingItem.slug || "",
        name: editingItem.name || "",
        role: roleContent,
        summary: summaryContent,
        faculty_id: (editingItem as any).faculty_id ?? null,
        department_id: (editingItem as any).department_id ?? null,
        program_id: (editingItem as any).program_id ?? null,
        headline: editingItem.headline || "",
        quote: editingItem.quote || "",
        quote_by: editingItem.quote_by || "",
        tags: editingTags,
        stats: editingItem.stats || [],
        achievements: editingItem.achievements || [],
        story: editingItem.story || []
      });
      
      setTags(editingTags);
      setStats(editingStats);

      const firstAchievement = Array.isArray(editingItem.achievements) ? editingItem.achievements[0] : "";
      const firstStory = Array.isArray(editingItem.story) ? editingItem.story[0] : "";
      const achievementsContent = typeof firstAchievement === "string" ? firstAchievement : "";
      const storyContent = typeof firstStory === "string" ? firstStory : "";

      setAchievementsHtml(achievementsContent);
      setStoryHtml(storyContent);
      
      if (roleEditor && roleContent) {
        roleEditor.commands.setContent(roleContent);
      }
      if (summaryEditor && summaryContent) {
        summaryEditor.commands.setContent(summaryContent);
      }

      if (achievementsEditor) {
        achievementsEditor.commands.setContent(achievementsContent || "");
      }
      if (storyEditor) {
        storyEditor.commands.setContent(storyContent || "");
      }
      
      if (editingItem.image) {
        setImagePreview(normalizeImagePath(editingItem.image));
      }
    } else {
      reset({
        slug: "",
        name: "",
        role: "",
        summary: "",
        faculty_id: null,
        department_id: null,
        program_id: null,
        headline: "",
        quote: "",
        quote_by: "",
        tags: [],
        stats: [],
        achievements: [],
        story: []
      });
      setTags([]);
      setStats([]);
      setTagInput("");
      setAchievementsHtml("");
      setStoryHtml("");
      if (roleEditor) {
        roleEditor.commands.clearContent();
      }
      if (summaryEditor) {
        summaryEditor.commands.clearContent();
      }
      if (achievementsEditor) {
        achievementsEditor.commands.clearContent();
      }
      if (storyEditor) {
        storyEditor.commands.clearContent();
      }
      setImagePreview(null);
    }
    setImageFile(null);
  }, [editingItem, reset, isOpen, roleEditor, summaryEditor, achievementsEditor, storyEditor]);

  const selectedFacultyId = watch("faculty_id");
  const selectedDepartmentId = watch("department_id");
  const selectedProgramId = watch("program_id");

  const { onChange: facultyIdOnChange, ...facultyIdRegister } = register("faculty_id", {
    valueAsNumber: true,
  });

  const { onChange: departmentIdOnChange, ...departmentIdRegister } = register("department_id", {
    valueAsNumber: true,
  });

  const { onChange: programIdOnChange, ...programIdRegister } = register("program_id", {
    valueAsNumber: true,
  });

  // Fetch full mapping once and filter locally to avoid per-selection server calls
  const facultiesQuery = useFaculties();
  const departmentsQuery = useDepartments(undefined);
  const programsQuery = usePrograms(undefined);

  const filteredDepartments = useMemo(() => {
    const all = departmentsQuery.data ?? [];
    if (!(typeof selectedFacultyId === "number" && selectedFacultyId > 0)) return [];
    return all.filter((d) => Number(d.faculty_id) === Number(selectedFacultyId));
  }, [departmentsQuery.data, selectedFacultyId]);

  const filteredPrograms = useMemo(() => {
    const all = programsQuery.data ?? [];
    if (!(typeof selectedDepartmentId === "number" && selectedDepartmentId > 0)) return [];
    return all.filter((p) => Number(p.department_id) === Number(selectedDepartmentId));
  }, [programsQuery.data, selectedDepartmentId]);

  useEffect(() => {
    setValue("department_id", null);
    setValue("program_id", null);
  }, [selectedFacultyId, setValue]);

  useEffect(() => {
    setValue("program_id", null);
  }, [selectedDepartmentId, setValue]);

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
      };
      reader.readAsDataURL(file);
    }
  };

  // Tag management functions
  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      const newTags = [...tags, trimmed];
      setTags(newTags);
      setValue("tags", newTags);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const newTags = tags.filter(tag => tag !== tagToRemove);
    setTags(newTags);
    setValue("tags", newTags);
  };

  // Stats management functions
  const handleAddStat = () => {
    const newStats = [...stats, { key: "", value: "" }];
    setStats(newStats);
  };

  const handleUpdateStat = (index: number, field: "key" | "value", value: string) => {
    const newStats = [...stats];
    newStats[index] = { ...newStats[index], [field]: value };
    setStats(newStats);
    const statsObj = newStats.reduce((acc, stat) => {
      if (stat.key && stat.value) {
        acc[stat.key] = stat.value;
      }
      return acc;
    }, {} as Record<string, string>);
    setValue("stats", statsObj);
  };

  const handleRemoveStat = (index: number) => {
    const newStats = stats.filter((_, i) => i !== index);
    setStats(newStats);
    const statsObj = newStats.reduce((acc, stat) => {
      if (stat.key && stat.value) {
        acc[stat.key] = stat.value;
      }
      return acc;
    }, {} as Record<string, string>);
    setValue("stats", statsObj);
  };

  const onSubmit = async (data: DistinguishedAlumni) => {
    setIsSubmitting(true);
    try {
      // Get HTML from editors
      const roleHtml = roleEditor?.getHTML() || data.role || "";
      const summaryHtml = summaryEditor?.getHTML() || data.summary || "";

      // Sanitize HTML
      const sanitizedRole = DOMPurify.sanitize(roleHtml, {
        ALLOWED_TAGS: ["p", "br", "strong", "em", "u", "s", "ul", "ol", "li", "h1", "h2", "h3", "a", "div"],
        ALLOWED_ATTR: ["href", "target", "rel"],
      });
      const sanitizedSummary = DOMPurify.sanitize(summaryHtml, {
        ALLOWED_TAGS: ["p", "br", "strong", "em", "u", "s", "ul", "ol", "li", "h1", "h2", "h3", "a", "div"],
        ALLOWED_ATTR: ["href", "target", "rel"],
      });

      // Prepare stats object
      const statsObj = stats.reduce((acc, stat) => {
        if (stat.key && stat.value) {
          acc[stat.key] = stat.value;
        }
        return acc;
      }, {} as Record<string, string>);

      const achievementsHtmlRaw = achievementsEditor?.getHTML() || achievementsHtml || "";
      const storyHtmlRaw = storyEditor?.getHTML() || storyHtml || "";

      const sanitizedAchievements = DOMPurify.sanitize(achievementsHtmlRaw, {
        ALLOWED_TAGS: ["p", "br", "strong", "em", "u", "s", "ul", "ol", "li", "h1", "h2", "h3", "a", "div"],
        ALLOWED_ATTR: ["href", "target", "rel"],
      });
      const sanitizedStory = DOMPurify.sanitize(storyHtmlRaw, {
        ALLOWED_TAGS: ["p", "br", "strong", "em", "u", "s", "ul", "ol", "li", "h1", "h2", "h3", "a", "div"],
        ALLOWED_ATTR: ["href", "target", "rel"],
      });

      // Preserve existing JSONB shape: store HTML as a single element string array
      const parsedAchievements: any[] = sanitizedAchievements.trim() ? [sanitizedAchievements] : [];
      const parsedStory: any[] = sanitizedStory.trim() ? [sanitizedStory] : [];

      // Use FormData to handle image upload
      const formData = new FormData();
      formData.append("slug", data.slug);
      formData.append("name", data.name);
      formData.append("role", sanitizedRole);
      formData.append("summary", sanitizedSummary);
      if (typeof data.faculty_id === "number" && data.faculty_id > 0) {
        formData.append("faculty_id", String(data.faculty_id));
      }
      if (typeof data.department_id === "number" && data.department_id > 0) {
        formData.append("department_id", String(data.department_id));
      }
      if (typeof data.program_id === "number" && data.program_id > 0) {
        formData.append("program_id", String(data.program_id));
      }
      if (data.headline) formData.append("headline", data.headline);
      if (data.quote) formData.append("quote", data.quote);
      if (data.quote_by) formData.append("quote_by", data.quote_by);
      formData.append("tags", JSON.stringify(tags));
      formData.append("stats", JSON.stringify(statsObj));
      formData.append("achievements", JSON.stringify(parsedAchievements));
      formData.append("story", JSON.stringify(parsedStory));

      // Only append image if it's a new file (not when editing with existing image)
      if (imageFile) {
        formData.append("image", imageFile);
      } else if (!editingItem?.id && !data.image) {
        // For new records, image is required
        toast.error("Please upload an image");
        setIsSubmitting(false);
        return;
      }

      const url = editingItem?.id
        ? `/api/distinguished-alumni/${editingItem.id}`
        : "/api/distinguished-alumni";
      
      const method = editingItem?.id ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        body: formData
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
              <p className="mt-1 text-xs text-gray-500">Slug must be unique</p>
            </div>

            {/* Faculty */}
            <div>
              <Label htmlFor="faculty_id">Faculty</Label>
              <select
                id="faculty_id"
                className={`w-full rounded-md border px-3 py-2 text-sm ${errors.faculty_id ? "border-red-500" : "border-gray-300"}`}
                disabled={isSubmitting || facultiesQuery.isLoading}
                value={typeof selectedFacultyId === "number" ? String(selectedFacultyId) : ""}
                {...facultyIdRegister}
                onChange={(e) => {
                  facultyIdOnChange(e);
                  const v = String(e.target.value || "");
                  const n = Number(v);
                  setValue("faculty_id", Number.isFinite(n) && n > 0 ? Math.floor(n) : null, { shouldValidate: true });
                }}
              >
                <option value="">Select</option>
                {(facultiesQuery.data ?? []).map((f) => (
                  <option key={f.id} value={String(f.id)}>
                    {f.faculty_name}
                  </option>
                ))}
              </select>
              {errors.faculty_id && <p className="mt-1 text-sm text-red-600">{String(errors.faculty_id.message || "Faculty is required")}</p>}
            </div>

            {/* Department */}
            <div>
              <Label htmlFor="department_id">Department</Label>
              <select
                id="department_id"
                className={`w-full rounded-md border px-3 py-2 text-sm ${errors.department_id ? "border-red-500" : "border-gray-300"}`}
                disabled={isSubmitting || departmentsQuery.isLoading || !(typeof selectedFacultyId === "number" && selectedFacultyId > 0)}
                value={typeof selectedDepartmentId === "number" ? String(selectedDepartmentId) : ""}
                {...departmentIdRegister}
                onChange={(e) => {
                  departmentIdOnChange(e);
                  const v = String(e.target.value || "");
                  const n = Number(v);
                  setValue("department_id", Number.isFinite(n) && n > 0 ? Math.floor(n) : null, { shouldValidate: true });
                }}
              >
                <option value="">Select</option>
                {filteredDepartments.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.department_name}
                  </option>
                ))}
              </select>
              {!(typeof selectedFacultyId === "number" && selectedFacultyId > 0) && (
                <p className="mt-1 text-xs text-gray-500">Select faculty first</p>
              )}
              {errors.department_id && <p className="mt-1 text-sm text-red-600">{String(errors.department_id.message || "Department is required")}</p>}
            </div>

            {/* Program */}
            <div className="md:col-span-2">
              <Label htmlFor="program_id">Program</Label>
              <select
                id="program_id"
                className={`w-full rounded-md border px-3 py-2 text-sm ${errors.program_id ? "border-red-500" : "border-gray-300"}`}
                disabled={isSubmitting || programsQuery.isLoading || !(typeof selectedDepartmentId === "number" && selectedDepartmentId > 0)}
                value={typeof selectedProgramId === "number" ? String(selectedProgramId) : ""}
                {...programIdRegister}
                onChange={(e) => {
                  programIdOnChange(e);
                  const v = String(e.target.value || "");
                  const n = Number(v);
                  setValue("program_id", Number.isFinite(n) && n > 0 ? Math.floor(n) : null, { shouldValidate: true });
                }}
              >
                <option value="">Select</option>
                {filteredPrograms.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.program_name}
                  </option>
                ))}
              </select>
              {!(typeof selectedDepartmentId === "number" && selectedDepartmentId > 0) && (
                <p className="mt-1 text-xs text-gray-500">Select department first</p>
              )}
              {errors.program_id && <p className="mt-1 text-sm text-red-600">{String(errors.program_id.message || "Invalid program")}</p>}
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

            {/* Image Upload */}
            <div className="md:col-span-2">
              <Label htmlFor="image">
                Image {!editingItem?.id && <span className="text-red-500">*</span>}
                {editingItem?.id && editingItem.image && (
                  <span className="text-gray-500 text-sm font-normal ml-2">(Optional - current image will be kept if not changed)</span>
                )}
              </Label>
              <div className="space-y-2">
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
                  {imageFile ? "Change Image" : "Upload Image"}
                </Button>
                {(imagePreview || (editingItem?.image && !imageFile)) && (
                  <div className="mt-2">
                    <img
                      src={imagePreview || (editingItem?.image ? normalizeImagePath(editingItem.image) : "")}
                      alt="Preview"
                      className="h-32 w-32 object-cover rounded-lg border border-gray-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/images/placeholder-avatar.webp";
                      }}
                    />
                    {imageFile && (
                      <p className="mt-1 text-xs text-gray-500">New image selected: {imageFile.name}</p>
                    )}
                    {editingItem?.image && !imageFile && (
                      <p className="mt-1 text-xs text-gray-500">Current image: {editingItem.image}</p>
                    )}
                  </div>
                )}
              </div>
              {!editingItem?.id && !imageFile && (
                <p className="mt-1 text-sm text-red-600">Image is required for new records</p>
              )}
            </div>

            {/* Role - HTML Editor */}
            <div className="md:col-span-2">
              <Label htmlFor="role">
                Role <span className="text-red-500">*</span>
              </Label>
              <Controller
                name="role"
                control={control}
                rules={{ required: "Role is required" }}
                render={({ field }) => (
                  <div className="bg-white border border-gray-300 rounded-md overflow-hidden">
                    {roleEditor && (
                      <div className="border-b border-gray-200 bg-gray-50 p-2 flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => roleEditor.chain().focus().toggleHeading({ level: 1 }).run()}
                          className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors ${
                            roleEditor.isActive("heading", { level: 1 }) ? "bg-gray-300" : ""
                          }`}
                          title="Heading 1"
                        >
                          H1
                        </button>
                        <button
                          type="button"
                          onClick={() => roleEditor.chain().focus().toggleHeading({ level: 2 }).run()}
                          className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors ${
                            roleEditor.isActive("heading", { level: 2 }) ? "bg-gray-300" : ""
                          }`}
                          title="Heading 2"
                        >
                          H2
                        </button>
                        <button
                          type="button"
                          onClick={() => roleEditor.chain().focus().toggleHeading({ level: 3 }).run()}
                          className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors ${
                            roleEditor.isActive("heading", { level: 3 }) ? "bg-gray-300" : ""
                          }`}
                          title="Heading 3"
                        >
                          H3
                        </button>
                        <div className="w-px h-6 bg-gray-300 mx-1" />
                        <button
                          type="button"
                          onClick={() => roleEditor.chain().focus().toggleBold().run()}
                          className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 font-bold transition-colors ${
                            roleEditor.isActive("bold") ? "bg-gray-300" : ""
                          }`}
                          title="Bold"
                        >
                          <strong>B</strong>
                        </button>
                        <button
                          type="button"
                          onClick={() => roleEditor.chain().focus().toggleItalic().run()}
                          className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 italic transition-colors ${
                            roleEditor.isActive("italic") ? "bg-gray-300" : ""
                          }`}
                          title="Italic"
                        >
                          <em>I</em>
                        </button>
                        <button
                          type="button"
                          onClick={() => roleEditor.chain().focus().toggleUnderline().run()}
                          className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 underline transition-colors ${
                            roleEditor.isActive("underline") ? "bg-gray-300" : ""
                          }`}
                          title="Underline"
                        >
                          <u>U</u>
                        </button>
                        <div className="w-px h-6 bg-gray-300 mx-1" />
                        <button
                          type="button"
                          onClick={() => roleEditor.chain().focus().toggleBulletList().run()}
                          className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors ${
                            roleEditor.isActive("bulletList") ? "bg-gray-300" : ""
                          }`}
                          title="Bullet List"
                        >
                          •
                        </button>
                        <button
                          type="button"
                          onClick={() => roleEditor.chain().focus().toggleOrderedList().run()}
                          className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors ${
                            roleEditor.isActive("orderedList") ? "bg-gray-300" : ""
                          }`}
                          title="Numbered List"
                        >
                          1.
                        </button>
                        <div className="w-px h-6 bg-gray-300 mx-1" />
                        <button
                          type="button"
                          onClick={() => {
                            const url = window.prompt("Enter URL:");
                            if (url && url.trim()) {
                              roleEditor.chain().focus().setLink({ href: url.trim() }).run();
                            }
                          }}
                          className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors ${
                            roleEditor.isActive("link") ? "bg-gray-300" : ""
                          }`}
                          title="Insert Link"
                        >
                          🔗
                        </button>
                        <button
                          type="button"
                          onClick={() => roleEditor.chain().focus().unsetLink().run()}
                          className="px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Remove Link"
                          disabled={!roleEditor.isActive("link")}
                        >
                          Unlink
                        </button>
                      </div>
                    )}
                    <div className="min-h-[200px] max-h-[400px] overflow-y-auto">
                      {roleEditor ? (
                        <EditorContent editor={roleEditor} />
                      ) : (
                        <div className="min-h-[200px] p-4 flex items-center justify-center text-gray-400">
                          <p>Loading editor...</p>
                        </div>
                      )}
                    </div>
                    <input type="hidden" {...field} value={field.value || ""} />
                  </div>
                )}
              />
              {errors.role && (
                <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">You can format the role with headings, bold, italic, lists, and links.</p>
            </div>

            {/* Summary - HTML Editor */}
            <div className="md:col-span-2">
              <Label htmlFor="summary">
                Summary <span className="text-red-500">*</span>
              </Label>
              <Controller
                name="summary"
                control={control}
                rules={{ required: "Summary is required" }}
                render={({ field }) => (
                  <div className="bg-white border border-gray-300 rounded-md overflow-hidden">
                    {summaryEditor && (
                      <div className="border-b border-gray-200 bg-gray-50 p-2 flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => summaryEditor.chain().focus().toggleHeading({ level: 1 }).run()}
                          className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors ${
                            summaryEditor.isActive("heading", { level: 1 }) ? "bg-gray-300" : ""
                          }`}
                          title="Heading 1"
                        >
                          H1
                        </button>
                        <button
                          type="button"
                          onClick={() => summaryEditor.chain().focus().toggleHeading({ level: 2 }).run()}
                          className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors ${
                            summaryEditor.isActive("heading", { level: 2 }) ? "bg-gray-300" : ""
                          }`}
                          title="Heading 2"
                        >
                          H2
                        </button>
                        <button
                          type="button"
                          onClick={() => summaryEditor.chain().focus().toggleHeading({ level: 3 }).run()}
                          className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors ${
                            summaryEditor.isActive("heading", { level: 3 }) ? "bg-gray-300" : ""
                          }`}
                          title="Heading 3"
                        >
                          H3
                        </button>
                        <div className="w-px h-6 bg-gray-300 mx-1" />
                        <button
                          type="button"
                          onClick={() => summaryEditor.chain().focus().toggleBold().run()}
                          className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 font-bold transition-colors ${
                            summaryEditor.isActive("bold") ? "bg-gray-300" : ""
                          }`}
                          title="Bold"
                        >
                          <strong>B</strong>
                        </button>
                        <button
                          type="button"
                          onClick={() => summaryEditor.chain().focus().toggleItalic().run()}
                          className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 italic transition-colors ${
                            summaryEditor.isActive("italic") ? "bg-gray-300" : ""
                          }`}
                          title="Italic"
                        >
                          <em>I</em>
                        </button>
                        <button
                          type="button"
                          onClick={() => summaryEditor.chain().focus().toggleUnderline().run()}
                          className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 underline transition-colors ${
                            summaryEditor.isActive("underline") ? "bg-gray-300" : ""
                          }`}
                          title="Underline"
                        >
                          <u>U</u>
                        </button>
                        <div className="w-px h-6 bg-gray-300 mx-1" />
                        <button
                          type="button"
                          onClick={() => summaryEditor.chain().focus().toggleBulletList().run()}
                          className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors ${
                            summaryEditor.isActive("bulletList") ? "bg-gray-300" : ""
                          }`}
                          title="Bullet List"
                        >
                          •
                        </button>
                        <button
                          type="button"
                          onClick={() => summaryEditor.chain().focus().toggleOrderedList().run()}
                          className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors ${
                            summaryEditor.isActive("orderedList") ? "bg-gray-300" : ""
                          }`}
                          title="Numbered List"
                        >
                          1.
                        </button>
                        <div className="w-px h-6 bg-gray-300 mx-1" />
                        <button
                          type="button"
                          onClick={() => {
                            const url = window.prompt("Enter URL:");
                            if (url && url.trim()) {
                              summaryEditor.chain().focus().setLink({ href: url.trim() }).run();
                            }
                          }}
                          className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors ${
                            summaryEditor.isActive("link") ? "bg-gray-300" : ""
                          }`}
                          title="Insert Link"
                        >
                          🔗
                        </button>
                        <button
                          type="button"
                          onClick={() => summaryEditor.chain().focus().unsetLink().run()}
                          className="px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Remove Link"
                          disabled={!summaryEditor.isActive("link")}
                        >
                          Unlink
                        </button>
                      </div>
                    )}
                    <div className="min-h-[300px] max-h-[500px] overflow-y-auto">
                      {summaryEditor ? (
                        <EditorContent editor={summaryEditor} />
                      ) : (
                        <div className="min-h-[300px] p-4 flex items-center justify-center text-gray-400">
                          <p>Loading editor...</p>
                        </div>
                      )}
                    </div>
                    <input type="hidden" {...field} value={field.value || ""} />
                  </div>
                )}
              />
              {errors.summary && (
                <p className="mt-1 text-sm text-red-600">{errors.summary.message}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">You can format the summary with headings, bold, italic, lists, and links.</p>
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

            {/* Tags */}
            <div className="md:col-span-2">
              <Label htmlFor="tags">Tags (Optional)</Label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    id="tag-input"
                    type="text"
                    placeholder="Enter a tag and press Enter or click Add"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    disabled={isSubmitting}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddTag}
                    disabled={isSubmitting || !tagInput.trim()}
                  >
                    Add
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full text-sm"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                          disabled={isSubmitting}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">Add tags to categorize this distinguished alumni (e.g., "Technology", "Leadership", "Innovation")</p>
            </div>

            {/* Stats */}
            <div className="md:col-span-2">
              <Label>Stats (Optional)</Label>
              <div className="space-y-2">
                {stats.map((stat, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Key (e.g., Years of Experience)"
                      value={stat.key}
                      onChange={(e) => handleUpdateStat(index, "key", e.target.value)}
                      disabled={isSubmitting}
                      className="flex-1"
                    />
                    <Input
                      type="text"
                      placeholder="Value (e.g., 15)"
                      value={stat.value}
                      onChange={(e) => handleUpdateStat(index, "value", e.target.value)}
                      disabled={isSubmitting}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleRemoveStat(index)}
                      disabled={isSubmitting}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddStat}
                  disabled={isSubmitting}
                >
                  + Add Stat
                </Button>
              </div>
              <p className="mt-1 text-xs text-gray-500">Add key-value pairs for statistics (e.g., "Awards": "5", "Publications": "20")</p>
            </div>

            {/* Achievements - HTML Editor */}
            <div className="md:col-span-2">
              <Label htmlFor="achievements">Achievements (Optional)</Label>
              <div className="bg-white border border-gray-300 rounded-md overflow-hidden">
                {achievementsEditor && (
                  <div className="border-b border-gray-200 bg-gray-50 p-2 flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => achievementsEditor.chain().focus().toggleHeading({ level: 1 }).run()}
                      className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors ${
                        achievementsEditor.isActive("heading", { level: 1 }) ? "bg-gray-300" : ""
                      }`}
                      title="Heading 1"
                    >
                      H1
                    </button>
                    <button
                      type="button"
                      onClick={() => achievementsEditor.chain().focus().toggleHeading({ level: 2 }).run()}
                      className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors ${
                        achievementsEditor.isActive("heading", { level: 2 }) ? "bg-gray-300" : ""
                      }`}
                      title="Heading 2"
                    >
                      H2
                    </button>
                    <button
                      type="button"
                      onClick={() => achievementsEditor.chain().focus().toggleHeading({ level: 3 }).run()}
                      className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors ${
                        achievementsEditor.isActive("heading", { level: 3 }) ? "bg-gray-300" : ""
                      }`}
                      title="Heading 3"
                    >
                      H3
                    </button>
                    <div className="w-px h-6 bg-gray-300 mx-1" />
                    <button
                      type="button"
                      onClick={() => achievementsEditor.chain().focus().toggleBold().run()}
                      className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 font-bold transition-colors ${
                        achievementsEditor.isActive("bold") ? "bg-gray-300" : ""
                      }`}
                      title="Bold"
                    >
                      <strong>B</strong>
                    </button>
                    <button
                      type="button"
                      onClick={() => achievementsEditor.chain().focus().toggleItalic().run()}
                      className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 italic transition-colors ${
                        achievementsEditor.isActive("italic") ? "bg-gray-300" : ""
                      }`}
                      title="Italic"
                    >
                      <em>I</em>
                    </button>
                    <button
                      type="button"
                      onClick={() => achievementsEditor.chain().focus().toggleUnderline().run()}
                      className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 underline transition-colors ${
                        achievementsEditor.isActive("underline") ? "bg-gray-300" : ""
                      }`}
                      title="Underline"
                    >
                      <u>U</u>
                    </button>
                    <div className="w-px h-6 bg-gray-300 mx-1" />
                    <button
                      type="button"
                      onClick={() => achievementsEditor.chain().focus().toggleBulletList().run()}
                      className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors ${
                        achievementsEditor.isActive("bulletList") ? "bg-gray-300" : ""
                      }`}
                      title="Bullet List"
                    >
                      •
                    </button>
                    <button
                      type="button"
                      onClick={() => achievementsEditor.chain().focus().toggleOrderedList().run()}
                      className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors ${
                        achievementsEditor.isActive("orderedList") ? "bg-gray-300" : ""
                      }`}
                      title="Numbered List"
                    >
                      1.
                    </button>
                  </div>
                )}
                <div className="min-h-[200px] max-h-[400px] overflow-y-auto">
                  {achievementsEditor ? (
                    <EditorContent editor={achievementsEditor} />
                  ) : (
                    <div className="min-h-[200px] p-4 flex items-center justify-center text-gray-400">
                      <p>Loading editor...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Story - HTML Editor */}
            <div className="md:col-span-2">
              <Label htmlFor="story">Story (Optional)</Label>
              <div className="bg-white border border-gray-300 rounded-md overflow-hidden">
                {storyEditor && (
                  <div className="border-b border-gray-200 bg-gray-50 p-2 flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => storyEditor.chain().focus().toggleHeading({ level: 1 }).run()}
                      className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors ${
                        storyEditor.isActive("heading", { level: 1 }) ? "bg-gray-300" : ""
                      }`}
                      title="Heading 1"
                    >
                      H1
                    </button>
                    <button
                      type="button"
                      onClick={() => storyEditor.chain().focus().toggleHeading({ level: 2 }).run()}
                      className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors ${
                        storyEditor.isActive("heading", { level: 2 }) ? "bg-gray-300" : ""
                      }`}
                      title="Heading 2"
                    >
                      H2
                    </button>
                    <button
                      type="button"
                      onClick={() => storyEditor.chain().focus().toggleHeading({ level: 3 }).run()}
                      className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors ${
                        storyEditor.isActive("heading", { level: 3 }) ? "bg-gray-300" : ""
                      }`}
                      title="Heading 3"
                    >
                      H3
                    </button>
                    <div className="w-px h-6 bg-gray-300 mx-1" />
                    <button
                      type="button"
                      onClick={() => storyEditor.chain().focus().toggleBold().run()}
                      className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 font-bold transition-colors ${
                        storyEditor.isActive("bold") ? "bg-gray-300" : ""
                      }`}
                      title="Bold"
                    >
                      <strong>B</strong>
                    </button>
                    <button
                      type="button"
                      onClick={() => storyEditor.chain().focus().toggleItalic().run()}
                      className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 italic transition-colors ${
                        storyEditor.isActive("italic") ? "bg-gray-300" : ""
                      }`}
                      title="Italic"
                    >
                      <em>I</em>
                    </button>
                    <button
                      type="button"
                      onClick={() => storyEditor.chain().focus().toggleUnderline().run()}
                      className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 underline transition-colors ${
                        storyEditor.isActive("underline") ? "bg-gray-300" : ""
                      }`}
                      title="Underline"
                    >
                      <u>U</u>
                    </button>
                    <div className="w-px h-6 bg-gray-300 mx-1" />
                    <button
                      type="button"
                      onClick={() => storyEditor.chain().focus().toggleBulletList().run()}
                      className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors ${
                        storyEditor.isActive("bulletList") ? "bg-gray-300" : ""
                      }`}
                      title="Bullet List"
                    >
                      •
                    </button>
                    <button
                      type="button"
                      onClick={() => storyEditor.chain().focus().toggleOrderedList().run()}
                      className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors ${
                        storyEditor.isActive("orderedList") ? "bg-gray-300" : ""
                      }`}
                      title="Numbered List"
                    >
                      1.
                    </button>
                  </div>
                )}
                <div className="min-h-[300px] max-h-[500px] overflow-y-auto">
                  {storyEditor ? (
                    <EditorContent editor={storyEditor} />
                  ) : (
                    <div className="min-h-[300px] p-4 flex items-center justify-center text-gray-400">
                      <p>Loading editor...</p>
                    </div>
                  )}
                </div>
              </div>
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