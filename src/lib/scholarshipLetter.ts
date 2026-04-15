/** Labels and derived fields for admin scholarship application letter view */

/** Must stay aligned with the scholarship application form (`Discount Category` select). */
export const SCHOLARSHIP_DISCOUNT_CATEGORY_OPTIONS = [
  { value: "kinship", label: "Kinship Discount" },
  { value: "masters-phd", label: "Masters/PhD Discount" },
  {
    value: "masters-collaboration",
    label: "Masters Scholarships via UOL International Collaborations (for alumni only)",
  },
] as const;

/** Nested options per category — must stay aligned with the form’s “Applying for” / discount-type selects. */
export const SCHOLARSHIP_APPLYING_FOR_BY_CATEGORY: Record<
  string,
  readonly { value: string; label: string }[]
> = {
  kinship: [
    { value: "BS", label: "BS (Bachelor's)" },
    { value: "Masters", label: "Masters" },
    { value: "PhD", label: "PhD" },
  ],
  "masters-phd": [
    { value: "Masters", label: "Masters (50% discount)" },
    { value: "PhD", label: "PhD (25% discount)" },
  ],
  "masters-collaboration": [
    { value: "Masters", label: "Masters Scholarships via UOL International Collaborations" },
  ],
};

/** Form field “Discount Category” — label for the stored `discount_type` value. */
export function discountCategoryLabel(discountType: string | null | undefined): string {
  const d = String(discountType || "").trim().toLowerCase();
  const found = SCHOLARSHIP_DISCOUNT_CATEGORY_OPTIONS.find((o) => o.value === d);
  return found?.label ?? (String(discountType || "").trim() || "—");
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
  applyingFor: string | null | undefined
): string {
  const d = String(discountType || "").trim().toLowerCase();
  const a = String(applyingFor || "").trim().toLowerCase();

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
  admissionStatus?: string;
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
