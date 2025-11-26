import { z } from "zod";

export const sapIdNumericRegex = /^\d{4,20}$/;

export const storyFormSchema = z.object({
  sapId: z.string().trim().regex(sapIdNumericRegex, "SAP ID must be 4–20 digits"),
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be under 100 chars"),
  email: z.string().trim().email("Enter a valid email address"),
  faculty: z.string().trim().min(1, "Faculty is required"),
  department: z.string().trim().min(1, "Department is required"),
  passingYear: z.number().int().min(1900).max(2100).optional(),
  contactNumber: z.string().trim().max(50).optional(),
  storyTitle: z.string().trim().min(1, "Story title is required").max(200, "Title must be under 200 chars"),
  storyHtml: z.string().trim().min(1, "Story is required"),
});

export type NewStoryPayload = z.infer<typeof storyFormSchema>;

export const storyServerSchema = z.object({
  sapId: z.string().trim().regex(sapIdNumericRegex),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email(),
  faculty: z.string().trim().min(1),
  department: z.string().trim().min(1),
  passingYear: z.number().int().min(1900).max(2100).optional(),
  contactNumber: z.string().trim().max(50).optional(),
  storyTitle: z.string().trim().min(1).max(200),
  storyHtml: z.string().trim().min(1),
});

export type ServerStoryPayload = z.infer<typeof storyServerSchema>;