import { z } from "zod";

export const eventServerSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "Date must be YYYY-MM-DD"),
  title: z.string().min(2).max(120),
  venue: z.string().min(2).max(120),
  shortDescription: z.string().min(10).max(2000).optional(),
  imageUrl: z.string().url().optional(),
  category: z.string().min(2),
  organizer: z.string().min(2).max(120),
  cityCountry: z.string().min(2).max(120),
  shortHtml: z.string().min(0).max(5000).optional(),
  description: z.string().min(10).max(10000),
  isFeatured: z.boolean().default(false),
  startTimeUTC: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u, "Start must be ISO UTC with seconds"),
  endTimeUTC: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u, "End must be ISO UTC with seconds"),
}).refine((vals) => {
  try {
    const s = new Date(vals.startTimeUTC);
    const e = new Date(vals.endTimeUTC);
    return e.getTime() > s.getTime();
  } catch {
    return false;
  }
}, { message: "endTimeUTC must be after startTimeUTC", path: ["endTimeUTC"] });

export type ServerEventPayload = z.infer<typeof eventServerSchema>;