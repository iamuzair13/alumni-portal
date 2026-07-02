import { z } from "zod";

export const sapIdNumericRegex = /^\d{4,20}$/;

/** True when HTML has visible text (not only empty tags). */
export function storyHtmlHasText(html: string): boolean {
  if (!html || !html.trim()) return false;
  return html.replace(/<[^>]*>/g, "").trim().length > 0;
}

export const storyFormSchema = z.object({
  sapId: z.string().trim().regex(sapIdNumericRegex, "SAP ID must be 4–20 digits"),
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be under 100 chars"),
  email: z.string().trim().email("Enter a valid email address"),
  faculty: z.string().trim().min(1, "Faculty is required"),
  department: z.string().trim().min(1, "Department is required"),
  passingYear: z.number().int().min(1900).max(2100).optional(),
  contactNumber: z.string().trim().max(50).optional(),
  storyTitle: z.string().trim().min(1, "Story title is required").max(200, "Title must be under 200 chars"),
  storyHtml: z
    .string()
    .refine(storyHtmlHasText, { message: "Story is required" }),
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

export const STORY_STATUSES = ["pending", "approved", "not-approved"] as const;
export type StoryStatus = (typeof STORY_STATUSES)[number];

export function normalizeStoryStatus(status: string | null | undefined): StoryStatus {
  const s = String(status || "pending").toLowerCase().trim();
  if (s === "approved") return "approved";
  if (s === "not-approved" || s === "not approved" || s === "rejected" || s === "declined") {
    return "not-approved";
  }
  return "pending";
}

export function isStoryApproved(status: string | null | undefined): boolean {
  return normalizeStoryStatus(status) === "approved";
}

type AlumniContactRow = {
  sapid: string | null;
  personalemail: string | null;
  officialemail: string | null;
  universityemail: string | null;
};

export function isStoryOwner(
  sessionUser: { email?: string | null; sapid?: string | null } | null | undefined,
  alumni: AlumniContactRow
): boolean {
  if (!sessionUser) return false;
  const userEmail = sessionUser.email ? String(sessionUser.email) : null;
  const userSapid = sessionUser.sapid ? String(sessionUser.sapid).trim() : null;
  const isOwnerBySapid =
    Boolean(userSapid && alumni.sapid && userSapid.toLowerCase() === alumni.sapid.toLowerCase().trim());
  const isOwnerByEmail =
    Boolean(
      userEmail &&
        [
          alumni.personalemail,
          alumni.officialemail,
          alumni.universityemail,
        ].some((e) => e && e.toLowerCase().trim() === userEmail.toLowerCase().trim())
    );
  return isOwnerBySapid || isOwnerByEmail;
}