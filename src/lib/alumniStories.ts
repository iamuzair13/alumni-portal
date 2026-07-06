import { z } from "zod";

export const sapIdNumericRegex = /^\d{4,20}$/;

/** First candidate that matches the story SAP ID pattern (4–20 digits). */
export function pickStorySapId(...candidates: (string | null | undefined)[]): string | null {
  for (const candidate of candidates) {
    const value = String(candidate ?? "").trim();
    if (sapIdNumericRegex.test(value)) return value;
  }
  return null;
}

/** True when HTML has visible text (not only empty tags). */
export function storyHtmlHasText(html: string): boolean {
  if (!html || !html.trim()) return false;
  return html.replace(/<[^>]*>/g, "").trim().length > 0;
}

const singleLineString = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(250, `${label} must be 250 characters or fewer`)
    .refine((s) => !/[\r\n]/.test(s), { message: `${label} must be a single line` });

export const storyCriteriaFieldsSchema = z.object({
  criteriaHighlight: singleLineString("Story highlight explanation"),
  criteriaInspires: singleLineString("Inspiration explanation"),
  criteriaReplicable: z
    .union([z.boolean(), z.undefined()])
    .refine((v): v is boolean => v === true || v === false, { message: "Please select Yes or No" }),
  signatureConfirmed: z
    .boolean()
    .refine((v) => v === true, { message: "You must confirm your signature to submit" }),
});

export type StoryCriteriaFields = z.infer<typeof storyCriteriaFieldsSchema>;

export const storyFormSchema = z.object({
  sapId: z.string().trim().regex(sapIdNumericRegex, "SAP ID must be 4–20 digits"),
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be under 100 chars"),
  email: z.string().trim().email("Enter a valid email address"),
  faculty: z.string().trim().min(1, "Faculty is required"),
  department: z.string().trim().min(1, "Department is required"),
  passingYear: z.number().int().min(1900).max(2100).nullish(),
  contactNumber: z.string().trim().max(50).nullish(),
  storyTitle: z.string().trim().min(1, "Story title is required").max(200, "Title must be under 200 chars"),
  storyHtml: z
    .string()
    .refine(storyHtmlHasText, { message: "Story is required" }),
  criteriaHighlight: z.string().trim().max(250).optional(),
  criteriaInspires: z.string().trim().max(250).optional(),
  criteriaReplicable: z.boolean().optional(),
  signatureConfirmed: z.boolean().optional(),
});

export type NewStoryPayload = z.infer<typeof storyFormSchema>;

export const storyServerSchema = z.object({
  sapId: z.string().trim().regex(sapIdNumericRegex),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email(),
  faculty: z.string().trim().min(1),
  department: z.string().trim().min(1),
  passingYear: z.number().int().min(1900).max(2100).nullish(),
  contactNumber: z.string().trim().max(50).nullish(),
  storyTitle: z.string().trim().min(1).max(200),
  storyHtml: z.string().trim().min(1),
  criteriaHighlight: z.string().trim().max(250).optional(),
  criteriaInspires: z.string().trim().max(250).optional(),
  criteriaReplicable: z.boolean().optional(),
  signatureConfirmed: z.boolean().optional(),
});

export type ServerStoryPayload = z.infer<typeof storyServerSchema>;

/** Admin edit: criteria editable; alumni signature is not re-required. */
export const storyAdminEditCriteriaSchema = z.object({
  criteriaHighlight: singleLineString("Story highlight explanation"),
  criteriaInspires: singleLineString("Inspiration explanation"),
  criteriaReplicable: z
    .union([z.boolean(), z.undefined()])
    .refine((v): v is boolean => v === true || v === false, { message: "Please select Yes or No" }),
});

export const adminEditSchema = storyServerSchema.merge(storyAdminEditCriteriaSchema);

export type AdminEditStoryPayload = z.infer<typeof adminEditSchema>;

export const storyAlumniSubmitSchema = storyServerSchema.merge(storyCriteriaFieldsSchema);

/** Alumni self-submit when SAP ID is resolved server-side from session/DB. */
export const storyAlumniSelfSubmitWithoutSapSchema = storyServerSchema
  .omit({ sapId: true })
  .merge(storyCriteriaFieldsSchema);

export type AlumniSubmitStoryPayload = z.infer<typeof storyAlumniSubmitSchema>;

/** Parse criteria fields from JSON or multipart form values. */
export function parseStoryCriteriaFromBody(body: {
  criteriaHighlight?: unknown;
  criteriaInspires?: unknown;
  criteriaReplicable?: unknown;
  signatureConfirmed?: unknown;
}): {
  criteriaHighlight?: string;
  criteriaInspires?: string;
  criteriaReplicable?: boolean;
  signatureConfirmed?: boolean;
} {
  const criteriaHighlight =
    body.criteriaHighlight != null && String(body.criteriaHighlight).trim() !== ""
      ? String(body.criteriaHighlight).trim()
      : undefined;
  const criteriaInspires =
    body.criteriaInspires != null && String(body.criteriaInspires).trim() !== ""
      ? String(body.criteriaInspires).trim()
      : undefined;
  let criteriaReplicable: boolean | undefined;
  if (body.criteriaReplicable === true || body.criteriaReplicable === "true") {
    criteriaReplicable = true;
  } else if (body.criteriaReplicable === false || body.criteriaReplicable === "false") {
    criteriaReplicable = false;
  }
  const signatureConfirmed =
    body.signatureConfirmed === true ||
    body.signatureConfirmed === "true" ||
    body.signatureConfirmed === "on" ||
    body.signatureConfirmed === 1 ||
    body.signatureConfirmed === "1";

  return { criteriaHighlight, criteriaInspires, criteriaReplicable, signatureConfirmed };
}

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