/** Labels and derived fields for admin scholarship application letter view */

/** Must stay aligned with the scholarship application form (`Discount Category` select). */
export const SCHOLARSHIP_DISCOUNT_CATEGORY_OPTIONS = [
  { value: "phd-scholarship", label: "PhD Scholarship" },
  { value: "masters-scholarship", label: "Master's (MPhil/MS) Scholarship" },
  { value: "kinship-15", label: "Kinship Scholarship" },
] as const;

/** Maps merged scholarship slugs to their underlying admission-fee and tuition-fee component slugs (used for tier resolution). */
export const SCHOLARSHIP_MERGED_FEE_COMPONENTS: Record<
  string,
  { admissionSlug: string; tuitionSlug: string }
> = {
  "phd-scholarship": { admissionSlug: "admission-fee-phd-75", tuitionSlug: "tuition-fee-phd-25" },
  "masters-scholarship": { admissionSlug: "admission-fee-masters-75", tuitionSlug: "tuition-fee-masters-25" },
};

/** Maps legacy separate slugs to their merged equivalent for backward-compatible display. */
export const SCHOLARSHIP_LEGACY_TO_MERGED: Record<string, string> = {
  "admission-fee-phd-75": "phd-scholarship",
  "tuition-fee-phd-25": "phd-scholarship",
  "admission-fee-masters-75": "masters-scholarship",
  "tuition-fee-masters-25": "masters-scholarship",
};

/** Returns true if the slug is one of the merged PhD/Masters scholarship types. */
export function isMergedScholarshipSlug(discountType: string | null | undefined): boolean {
  const d = String(discountType || "").trim().toLowerCase();
  return d === "phd-scholarship" || d === "masters-scholarship";
}

/** Converts a legacy separate slug to its merged equivalent, or returns the slug if already merged. */
export function toMergedScholarshipSlug(discountType: string | null | undefined): string | null {
  const d = String(discountType || "").trim().toLowerCase();
  if (isMergedScholarshipSlug(d)) return d;
  return SCHOLARSHIP_LEGACY_TO_MERGED[d] ?? null;
}

const LEGACY_DISCOUNT_CATEGORY_LABELS: Record<string, string> = {
  "masters-collaboration":
    "Masters Scholarships via UOL International Collaborations (for alumni only)",
};

/** Stored `discount_type` values that use the multipart admission / document flow (same as legacy `masters-phd`). */
export const SCHOLARSHIP_FEE_DISCOUNT_FLOW_VALUES = [
  "phd-scholarship",
  "masters-scholarship",
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

/** Returns the component slugs (admission + tuition) for a merged scholarship slug, or null if not merged. */
export function getMergedFeeComponentSlugs(
  discountType: string | null | undefined,
): { admissionSlug: string; tuitionSlug: string } | null {
  const d = String(discountType || "").trim().toLowerCase();
  return SCHOLARSHIP_MERGED_FEE_COMPONENTS[d] ?? null;
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
  if (isScholarshipFeeDiscountFlow(d) || isMergedScholarshipSlug(d)) {
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
  if (d === "masters-scholarship" || d === "admission-fee-masters-75" || d === "tuition-fee-masters-25") return "Masters";
  if (d === "phd-scholarship" || d === "admission-fee-phd-75" || d === "tuition-fee-phd-25") return "PhD";
  return null;
}

/** Percent shown in the downloadable alumni scholarship PDF body for fee-discount flows. */
export function scholarshipFeeDiscountPercentForPdf(
  discountType: string | null | undefined,
  applyingFor: string | null | undefined,
  appliedDiscountPercent?: number | string | null,
): string | null {
  if (appliedDiscountPercent != null && appliedDiscountPercent !== "") {
    const n = Number(appliedDiscountPercent);
    if (Number.isFinite(n)) {
      return Number.isInteger(n) ? `${n}%` : `${n}%`;
    }
  }

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

/** Fee breakdown for merged scholarship types (admission + tuition + high achiever). */
export type ScholarshipFeeBreakdown = {
  admissionFeeDiscount: number | null;
  tuitionFeeDiscount: number | null;
  highAchieverDiscount: number | null;
  admissionFeeDisplay: string;
  tuitionFeeDisplay: string;
  highAchieverDisplay: string;
  totalDisplay: string;
};

/** High Achiever Discount percent for medalists. */
export const HIGH_ACHIEVER_DISCOUNT_PERCENT = 5;

/** Returns true if the alumni medal string indicates a Gold Medalist. */
export function isHighAchieverMedalist(medal: string | null | undefined): boolean {
  const m = String(medal || "").trim().toLowerCase();
  return m === "gold medalist";
}

/** Returns the high achiever discount percent (5) if medalist, else null. */
export function resolveHighAchieverPercent(medal: string | null | undefined): number | null {
  return isHighAchieverMedalist(medal) ? HIGH_ACHIEVER_DISCOUNT_PERCENT : null;
}

/** Returns fee breakdown display strings for a merged or legacy fee-discount slug. */
export function resolveFeeBreakdownDisplay(params: {
  discountType: string | null | undefined;
  admissionFeePercent?: number | null;
  tuitionFeePercent?: number | null;
  highAchieverPercent?: number | null;
  applyAdmissionFeeDiscount?: boolean | null;
  legacyAppliedPercent?: number | null;
}): ScholarshipFeeBreakdown {
  const { discountType, admissionFeePercent, tuitionFeePercent, highAchieverPercent, applyAdmissionFeeDiscount, legacyAppliedPercent } = params;
  const d = String(discountType || "").trim().toLowerCase();

  const fmt = (n: number | null | undefined): string => {
    if (n == null || !Number.isFinite(n)) return "—";
    return Number.isInteger(n) ? `${n}%` : `${n}%`;
  };

  const ha = highAchieverPercent ?? null;
  const applyAdm = applyAdmissionFeeDiscount === true;

  if (isMergedScholarshipSlug(d)) {
    const adm = applyAdm ? (admissionFeePercent ?? null) : null;
    const tui = tuitionFeePercent ?? null;
    // Total = tuition + high achiever only (admission fee is standalone)
    const total = tui != null && ha != null ? tui + ha : tui ?? ha ?? null;
    return {
      admissionFeeDiscount: adm,
      tuitionFeeDiscount: tui,
      highAchieverDiscount: ha,
      admissionFeeDisplay: fmt(adm),
      tuitionFeeDisplay: fmt(tui),
      highAchieverDisplay: fmt(ha),
      totalDisplay: fmt(total),
    };
  }

  // Legacy separate slugs — map to the correct component
  const merged = toMergedScholarshipSlug(d);
  if (merged) {
    const isAdmission = d.startsWith("admission-fee-");
    const adm = applyAdm && isAdmission ? (legacyAppliedPercent ?? null) : null;
    const tui = !isAdmission ? (legacyAppliedPercent ?? null) : null;
    const total = tui != null && ha != null ? tui + ha : tui ?? ha ?? null;
    return {
      admissionFeeDiscount: adm,
      tuitionFeeDiscount: tui,
      highAchieverDiscount: ha,
      admissionFeeDisplay: fmt(adm),
      tuitionFeeDisplay: fmt(tui),
      highAchieverDisplay: fmt(ha),
      totalDisplay: fmt(total),
    };
  }

  // Non-fee-discount types (kinship, masters-phd, etc.)
  const pct = legacyAppliedPercent ?? null;
  const total = pct != null && ha != null ? pct + ha : pct ?? ha ?? null;
  return {
    admissionFeeDiscount: null,
    tuitionFeeDiscount: null,
    highAchieverDiscount: ha,
    admissionFeeDisplay: "—",
    tuitionFeeDisplay: "—",
    highAchieverDisplay: fmt(ha),
    totalDisplay: fmt(total),
  };
}

/** Nested options per category — must stay aligned with the form’s “Applying for” where used. */
export const SCHOLARSHIP_APPLYING_FOR_BY_CATEGORY: Record<
  string,
  readonly { value: string; label: string }[]
> = {
  "phd-scholarship": [{ value: "PhD", label: "PhD" }],
  "masters-scholarship": [{ value: "Masters", label: "Masters" }],
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
    { value: "Masters", label: "Masters ( Upto 50% discount)" },
    { value: "PhD", label: "PhD ( Upto 25% discount)" },
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

  // Legacy separate slugs — show merged label
  const merged = toMergedScholarshipSlug(d);
  if (merged) {
    const mergedFound = SCHOLARSHIP_DISCOUNT_CATEGORY_OPTIONS.find((o) => o.value === merged);
    if (mergedFound) return mergedFound.label;
  }

  if (d === "masters-phd") {
    if (apply.includes("phd")) return "PhD Scholarship";
    if (apply.includes("master")) return "Master's (MPhil/MS) Scholarship";
    return "Master's (MPhil/MS) Scholarship";
  }
  if (d === "kinship") {
    return "Kinship Scholarship";
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
  appliedDiscountPercent?: number | string | null,
): string {
  if (appliedDiscountPercent != null && appliedDiscountPercent !== "") {
    const n = Number(appliedDiscountPercent);
    if (Number.isFinite(n)) {
      return Number.isInteger(n) ? `${n}%` : `${n}%`;
    }
  }

  const d = String(discountType || "").trim().toLowerCase();
  const a = String(applyingFor || "").trim().toLowerCase();

  if (d === "phd-scholarship" || d === "masters-scholarship") return "Per CGPA tier";
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
  admissionFeePercent?: number | null;
  tuitionFeePercent?: number | null;
  highAchieverPercent?: number | null;
  medal?: string | null;
  applyAdmissionFeeDiscount?: boolean | null;
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

/** Normalize optional Grade(%) from the form (e.g. "95" → "95%"). */
export function normalizeGradePercent(value: unknown): string | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const numeric = s.replace(/%/g, "").trim();
  if (!numeric) return null;
  if (/^\d+(\.\d+)?$/.test(numeric)) return `${numeric}%`;
  return s;
}

/**
 * Admin/PDF display: join profile CGPA and application Grade(%) as "3.4/95%".
 */
export function formatScholarshipCgpaGradeDisplay(
  cgpa: number | string | null | undefined,
  gradePercent: string | null | undefined,
  emptyFallback = "Data is missing",
): string {
  const cgpaStr =
    cgpa != null && cgpa !== "" && Number.isFinite(Number(cgpa)) ? String(cgpa) : "";
  const gradeStr = String(gradePercent ?? "").trim();
  if (cgpaStr && gradeStr) return `${cgpaStr}/${gradeStr}`;
  if (cgpaStr) return cgpaStr;
  if (gradeStr) return gradeStr;
  return emptyFallback;
}

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
