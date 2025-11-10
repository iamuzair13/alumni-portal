import { z } from "zod";

// Server-side payload schema for Alumni Cards
// Mirrors patterns used in events.ts and alumniStories.ts
export const alumniCardServerSchema = z.object({
  // Prefer SAP-style ids, but allow alphanumeric with dashes
  id: z.string().regex(/^[A-Za-z0-9-]+$/u, "Invalid id format").optional(),
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  program: z.string().min(1).max(120),
  campus: z.string().min(1).max(120),
  faculty: z.string().min(1).max(120),
  passingYear: z.number().int().min(1900).max(2100),
  workCountry: z.string().min(1).max(120),
  status: z.enum(["active", "pending", "declined"]),
  createdAt: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u,
      "createdAt must be ISO string with milliseconds UTC"
    ),
});

export type ServerAlumniCardPayload = z.infer<typeof alumniCardServerSchema>;

// Client-side form schema (optional) can be added later to mirror form validation
// when an add/edit UI exists for alumni cards.