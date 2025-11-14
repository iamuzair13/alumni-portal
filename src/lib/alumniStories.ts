import { z } from "zod";

export const sapIdNumericRegex = /^\d{4,20}$/;

export const storyFormSchema = z.object({
  sapId: z.string().trim().regex(sapIdNumericRegex, "SAP ID must be 4–20 digits"),
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be under 100 chars"),
  email: z.string().trim().email("Enter a valid email address"),
  faculty: z.string().trim().min(1, "Faculty is required"),
  department: z.string().trim().min(1, "Department is required"),
  storyHtml: z.string().trim().min(1, "Story is required"),
});

export type NewStoryPayload = z.infer<typeof storyFormSchema>;

export const storyServerSchema = z.object({
  sapId: z.string().trim().regex(sapIdNumericRegex),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email(),
  faculty: z.string().trim().min(1),
  department: z.string().trim().min(1),
  storyHtml: z.string().trim().min(1),
});

export type ServerStoryPayload = z.infer<typeof storyServerSchema>;