import { z } from "zod";

// Client-side form schema (uses File type for image)
export const storyFormSchema = z.object({
  imageFile: z
    .any()
    .optional()
    .refine(
      (file) => !file || (file instanceof File && ["image/png", "image/jpeg"].includes(file.type)),
      { message: "Invalid image type. Use JPG/PNG." }
    )
    .refine((file) => !file || (file instanceof File && file.size <= 2 * 1024 * 1024), {
      message: "Image exceeds 2MB size limit.",
    }),
  name: z.string().min(1, "Name is required").max(100, "Name must be under 100 chars"),
  degreeSession: z.string().min(1, "Degree & Session is required"),
  faculty: z.string().min(1, "Faculty is required"),
  company: z.string().min(1, "Company is required"),
  designation: z.string().min(1, "Designation is required"),
  cityCountry: z.string().min(1, "City, Country is required"),
  shortStoriesHtml: z.string().min(1, "Short Stories is required"),
  description: z.string().min(100, "Description must be at least 100 characters"),
  showHome: z.boolean(),
  date: z.string().min(1, "Date is required"),
});

export type NewStoryPayload = z.infer<typeof storyFormSchema>;

// Server-side payload schema (image provided as URL or omitted)
export const storyServerSchema = z.object({
  name: z.string().min(1).max(100),
  degreeSession: z.string().min(1),
  faculty: z.string().min(1),
  company: z.string().min(1),
  designation: z.string().min(1),
  cityCountry: z.string().min(1),
  shortStoriesHtml: z.string().min(1),
  description: z.string().min(100),
  showHome: z.boolean(),
  date: z.string().min(1),
  imageUrl: z.string().url().optional(),
});

export type ServerStoryPayload = z.infer<typeof storyServerSchema>;