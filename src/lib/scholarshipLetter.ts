/** Labels and derived fields for admin scholarship application letter view */

/** Must stay aligned with the scholarship application form (`Discount Category` select). */
export const SCHOLARSHIP_DISCOUNT_CATEGORY_OPTIONS = [
  { value: "admission-fee-masters-75", label: "Admission Fee Masters 75%" },
  { value: "admission-fee-phd-75", label: "Admission Fee PhD 75%" },
  { value: "kinship-15", label: "Kinship Tution Discount 15%" },
  { value: "tuition-fee-masters-25", label: "Tuition Fee Masters 50%" },
  { value: "tuition-fee-phd-25", label: "Tuition Fee PhD 25%" },
] as const;

const LEGACY_DISCOUNT_CATEGORY_LABELS: Record<string, string> = {
  "masters-collaboration":
    "Masters Scholarships via UOL International Collaborations (for alumni only)",
};

/** Stored `discount_type` values that use the multipart admission / document flow (same as legacy `masters-phd`). */
export const SCHOLARSHIP_FEE_DISCOUNT_FLOW_VALUES = [
  "admission-fee-masters-75",
  "admission-fee-phd-75",
  "tuition-fee-masters-25",
  "tuition-fee-phd-25",
  "masters-phd",
] as const;

export function isScholarshipFeeDiscountFlow(
  discountType: string | null | undefined,
): boolean {
  const d = String(discountType || "").trim().toLowerCase();
  return (SCHOLARSHIP_FEE_DISCOUNT_FLOW_VALUES as readonly string[]).includes(d);
}

export function isScholarshipKinshipCategory(
  discountType: string | null | undefined,
): boolean {
  const d = String(discountType || "").trim().toLowerCase();
  return d === "kinship-15" || d === "kinship";
}

/**
 * Human-facing application reference for the alumni scholarship PDF (header area).
 * AS = Alumni Scholarship; S = Self (fee-discount flows); K = Kinship; year from submission; trailing digits from DB row id.
 */
export function formatAlumniScholarshipApplicationPdfId(params: {
  discountType: string | null | undefined;
  applicationId: number;
  /** Calendar year (e.g. from application `created_at`); defaults to current year. */
  submissionYear?: number;
}): string | null {
  const d = String(params.discountType || "").trim().toLowerCase();
  const id = Math.floor(Number(params.applicationId));
  if (!Number.isFinite(id) || id < 1) return null;

  const year =
    params.submissionYear != null && Number.isFinite(params.submissionYear)
      ? Math.floor(params.submissionYear)
      : new Date().getFullYear();
  const seq = String(Math.max(0, id)).padStart(3, "0");

  if (isScholarshipKinshipCategory(d)) {
    return `AS-K-${year}-${seq}`;
  }
  if (isScholarshipFeeDiscountFlow(d)) {
    return `AS-S-${year}-${seq}`;
  }
  return null;
}

/**
 * When non-null, `apply_for` is implied by the category (no separate Masters/PhD picker).
 * Legacy `masters-phd` returns null — applicant still chooses Masters vs PhD in the form.
 */
export function scholarshipApplyingForFromCategory(
  discountType: string | null | undefined,
): string | null {
  const d = String(discountType || "").trim().toLowerCase();
  if (d === "admission-fee-masters-75" || d === "tuition-fee-masters-25") return "Masters";
  if (d === "admission-fee-phd-75" || d === "tuition-fee-phd-25") return "PhD";
  return null;
}

/** Percent shown in the downloadable alumni scholarship PDF body for fee-discount flows. */
export function scholarshipFeeDiscountPercentForPdf(
  discountType: string | null | undefined,
  applyingFor: string | null | undefined,
): string | null {
  const d = String(discountType || "").trim().toLowerCase();
  const a = String(applyingFor || "").trim().toLowerCase();
  if (d === "admission-fee-masters-75" || d === "admission-fee-phd-75") return "75%";
  if (d === "tuition-fee-masters-25" || d === "tuition-fee-phd-25") return "25%";
  if (d === "masters-phd") {
    if (a.includes("phd")) return "25%";
    if (a.includes("master")) return "50%";
  }
  return null;
}

/** Nested options per category — must stay aligned with the form’s “Applying for” where used. */
export const SCHOLARSHIP_APPLYING_FOR_BY_CATEGORY: Record<
  string,
  readonly { value: string; label: string }[]
> = {
  "kinship-15": [
    { value: "BS", label: "BS (Bachelor's)" },
    { value: "Masters", label: "Masters" },
    { value: "PhD", label: "PhD" },
  ],
  kinship: [
    { value: "BS", label: "BS (Bachelor's)" },
    { value: "Masters", label: "Masters" },
    { value: "PhD", label: "PhD" },
  ],
  "masters-phd": [
    { value: "Masters", label: "Masters (50% discount)" },
    { value: "PhD", label: "PhD (25% discount)" },
  ],
  "admission-fee-masters-75": [{ value: "Masters", label: "Masters" }],
  "admission-fee-phd-75": [{ value: "PhD", label: "PhD" }],
  "tuition-fee-masters-25": [{ value: "Masters", label: "Masters" }],
  "tuition-fee-phd-25": [{ value: "PhD", label: "PhD" }],
  "masters-collaboration": [
    { value: "Masters", label: "Masters Scholarships via UOL International Collaborations" },
  ],
};

/**
 * Human label for Discount Category — same strings as the scholarship form dropdown.
 * Optional `applyFor` disambiguates legacy `masters-phd` rows (Masters vs PhD → tuition fee labels).
 */
export function discountCategoryLabel(
  discountType: string | null | undefined,
  applyFor?: string | null,
): string {
  const d = String(discountType || "").trim().toLowerCase();
  const apply = String(applyFor ?? "")
    .trim()
    .toLowerCase();

  const found = SCHOLARSHIP_DISCOUNT_CATEGORY_OPTIONS.find((o) => o.value === d);
  if (found) return found.label;

  if (d === "masters-phd") {
    if (apply.includes("phd")) return "Tuition Fee PhD 25%";
    if (apply.includes("master")) return "Tuition Fee Masters 25%";
    return "Tuition Fee Masters 25%";
  }
  if (d === "kinship") {
    return "Kinship Tution Discount 15%";
  }

  const legacy = LEGACY_DISCOUNT_CATEGORY_LABELS[d];
  if (legacy) return legacy;
  const raw = String(discountType || "").trim();
  return raw || "—";
}

/**
 * Form nested “Discount Type” / “Applying for” — label for `apply_for` within the selected category.
 * PDF column “Discount Type” uses this; it is not the same as Discount Category.
 */
export function discountTypeOptionLabel(
  discountType: string | null | undefined,
  applyFor: string | null | undefined,
): string {
  const d = String(discountType || "").trim().toLowerCase();
  const raw = String(applyFor || "").trim();
  if (!raw) return "Data is missing";
  const list = SCHOLARSHIP_APPLYING_FOR_BY_CATEGORY[d] ?? [];
  const found = list.find((o) => o.value === raw);
  return found?.label ?? raw;
}

export function requestedPercent(
  discountType: string | null | undefined,
  applyingFor: string | null | undefined,
): string {
  const d = String(discountType || "").trim().toLowerCase();
  const a = String(applyingFor || "").trim().toLowerCase();

  if (d === "admission-fee-masters-75" || d === "admission-fee-phd-75") return "75%";
  if (d === "tuition-fee-masters-25" || d === "tuition-fee-phd-25") return "25%";
  if (d === "kinship-15") return "15%";
  if (d === "masters-phd") {
    if (a.includes("phd")) return "25%";
    if (a.includes("master")) return "50%";
    return "Per policy";
  }
  if (d === "kinship") return "Per kinship policy";
  if (d === "masters-collaboration") return "Per collaboration terms";
  return "—";
}

export type MastersDetailsParsed = {
  admissionFacultyId?: string;
  admissionDepartmentId?: string;
  admissionProgramId?: string;
  admissionCampus?: string;
  admissionSession?: string;
  declarationAccepted?: boolean;
};

export function parseMastersDetails(raw: unknown): MastersDetailsParsed | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as MastersDetailsParsed;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw as MastersDetailsParsed;
  return null;
}

export type UploadedDocItem = { label: string; url: string; filename?: string };

export function parseUploadedDocuments(raw: unknown): UploadedDocItem[] {
  if (raw == null) return [];
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const o = x as Record<string, unknown>;
      const label = String(o.label ?? "").trim();
      const url = String(o.url ?? "").trim();
      if (!label && !url) return null;
      return {
        label: label || "Document",
        url,
        filename: o.filename != null ? String(o.filename) : undefined,
      };
    })
    .filter(Boolean) as UploadedDocItem[];
}
