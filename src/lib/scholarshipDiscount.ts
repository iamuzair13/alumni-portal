/** CGPA tier resolution and validation for scholarship discount categories. */

import { discountCategoryLabel } from "./scholarshipLetter";

export type ScholarshipFlowType = "fee_discount" | "kinship";

/** Grade scale a tier range is expressed in. */
export type ScholarshipGradeType = "cgpa" | "percentage";

export function normalizeGradeType(value: unknown): ScholarshipGradeType {
  return String(value || "").trim().toLowerCase() === "percentage" ? "percentage" : "cgpa";
}

export function gradeTypeBounds(type: ScholarshipGradeType): { min: number; max: number } {
  return type === "percentage" ? { min: 0, max: 100 } : { min: 0, max: 4 };
}

export type ScholarshipDiscountCategory = {
  id: number;
  slug: string;
  label: string;
  flow_type: ScholarshipFlowType;
  default_apply_for: string | null;
  sort_order: number;
  is_active: boolean;
};

export type ScholarshipCgpaDiscountTier = {
  id: number;
  category_id: number;
  cgpa_min: number;
  cgpa_max: number;
  grade_type?: ScholarshipGradeType;
  discount_percent: number;
  sort_order: number;
};

export type ScholarshipCategoryWithTiers = ScholarshipDiscountCategory & {
  tiers: ScholarshipCgpaDiscountTier[];
};

export function parseCgpa(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 4) return null;
  return n;
}

/** Parse a grade value under the given scale: 0–4 for cgpa, 0–100 for percentage. */
export function parseGradeValue(value: unknown, type: ScholarshipGradeType): number | null {
  if (value == null || value === "") return null;
  const n = Number(String(value).trim().replace(/%$/, ""));
  const b = gradeTypeBounds(type);
  if (!Number.isFinite(n) || n < b.min || n > b.max) return null;
  return n;
}

/** Applicant's grades keyed by scale; a tier resolves against its own type's value. */
export type ApplicantGrades = {
  cgpa?: number | null;
  percentage?: number | null;
};

export function tiersOverlap(
  a: { cgpa_min: number; cgpa_max: number },
  b: { cgpa_min: number; cgpa_max: number },
): boolean {
  return a.cgpa_min <= b.cgpa_max && b.cgpa_min <= a.cgpa_max;
}

export function validateTierRanges(
  tiers: Array<{ id?: number; cgpa_min: number; cgpa_max: number; grade_type?: ScholarshipGradeType }>,
  opts?: { excludeId?: number },
): string | null {
  for (const t of tiers) {
    if (!Number.isFinite(t.cgpa_min) || !Number.isFinite(t.cgpa_max)) {
      return "Grade min and max must be valid numbers.";
    }
    const type = normalizeGradeType(t.grade_type);
    const b = gradeTypeBounds(type);
    if (t.cgpa_min < b.min || t.cgpa_max > b.max || t.cgpa_min > t.cgpa_max) {
      return type === "percentage"
        ? "Percentage range must be between 0 and 100, with min ≤ max."
        : "CGPA range must be between 0 and 4, with min ≤ max.";
    }
  }

  const filtered = tiers.filter((t) => opts?.excludeId == null || t.id !== opts.excludeId);
  // Ranges in different grade scales never overlap — compare within each type only.
  for (const type of ["cgpa", "percentage"] as const) {
    const group = filtered.filter((t) => normalizeGradeType(t.grade_type) === type);
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (tiersOverlap(group[i], group[j])) {
          return type === "percentage"
            ? "Percentage ranges must not overlap within the same category."
            : "CGPA ranges must not overlap within the same category.";
        }
      }
    }
  }
  return null;
}

export function sortTiersForResolution(tiers: ScholarshipCgpaDiscountTier[]): ScholarshipCgpaDiscountTier[] {
  return [...tiers].sort((a, b) => {
    const so = (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
    if (so !== 0) return so;
    return (Number(a.id) || 0) - (Number(b.id) || 0);
  });
}

/**
 * First matching tier by sort order. Each tier resolves against the applicant's
 * value in the tier's own grade scale; applicants missing that scale can't match it.
 * `grades` accepts a plain number for legacy callers (treated as cgpa).
 */
export function resolveDiscountPercent(
  grades: ApplicantGrades | number,
  tiers: ScholarshipCgpaDiscountTier[],
): number | null {
  const g: ApplicantGrades = typeof grades === "number" ? { cgpa: grades } : grades;
  const sorted = sortTiersForResolution(tiers);
  for (const t of sorted) {
    const v = g[normalizeGradeType(t.grade_type)];
    if (v == null || !Number.isFinite(v)) continue;
    const min = Number(t.cgpa_min);
    const max = Number(t.cgpa_max);
    if (v >= min && v <= max) {
      return Number(t.discount_percent);
    }
  }
  return null;
}

export function formatDiscountPercentDisplay(percent: number | null | undefined): string {
  if (percent == null || !Number.isFinite(Number(percent))) return "—";
  const n = Number(percent);
  if (Number.isInteger(n)) return `${n}%`;
  return `${n.toFixed(2).replace(/\.?0+$/, "")}%`;
}

export function formatTierCriteria(
  cgpaMin: number,
  cgpaMax: number,
  gradeType?: ScholarshipGradeType,
): string {
  const fmt = (n: number) => {
    if (!Number.isFinite(n)) return "—";
    return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
  };
  const type = normalizeGradeType(gradeType);
  if (type === "percentage") {
    return `Percentage ${fmt(Number(cgpaMin))}% – ${fmt(Number(cgpaMax))}%`;
  }
  return `CGPA ${fmt(Number(cgpaMin))} – ${fmt(Number(cgpaMax))}`;
}

export type ScholarshipDiscountTierPdfRow = {
  discountPercent: number;
  title: string;
  criteria: string;
};

export function formatTierDiscountTitle(categoryLabel: string, tierPercent: number): string {
  const label = String(categoryLabel || "").trim();
  const pctDisplay = formatDiscountPercentDisplay(tierPercent);
  if (!label) return pctDisplay;

  const base = label
    .replace(/\s*upto\s+[\d.]+\s*%/gi, "")
    .replace(/[\d.]+\s*%/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!base) return pctDisplay;
  return `${base} ${pctDisplay}`;
}

export function parseDiscountPercentValue(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const s = String(value).trim();
  if (!s) return null;
  const direct = Number(s);
  if (Number.isFinite(direct)) return direct;
  const match = s.match(/([\d.]+)\s*%/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function tiersMatchPercent(tierPercent: number, targetPercent: number): boolean {
  const tier = parseDiscountPercentValue(tierPercent);
  const target = parseDiscountPercentValue(targetPercent);
  if (tier == null || target == null) return false;
  return Math.abs(tier - target) < 0.011;
}

/** Max discount percent the applicant applied for (category cap), not CGPA-resolved amount. */
export function categoryAdvertisedMaxPercent(
  discountType: string | null | undefined,
  tiers: ScholarshipCgpaDiscountTier[],
  applyFor?: string | null,
): number | null {
  const categoryLabel = discountCategoryLabel(discountType, applyFor);
  const match = categoryLabel.match(/upto\s+([\d.]+)\s*%/i);
  if (match) {
    const n = Number(match[1]);
    if (Number.isFinite(n)) return n;
  }

  if (tiers.length === 0) return null;
  return Math.max(...tiers.map((t) => Number(t.discount_percent)));
}

export function mapTiersForPdf(
  tiers: ScholarshipCgpaDiscountTier[],
  categoryLabel: string,
): ScholarshipDiscountTierPdfRow[] {
  return sortTiersForResolution(tiers).map((t) => ({
    discountPercent: Number(t.discount_percent),
    title: formatTierDiscountTitle(categoryLabel, Number(t.discount_percent)),
    criteria: formatTierCriteria(t.cgpa_min, t.cgpa_max, t.grade_type),
  }));
}

/**
 * Render model for the scholarship letter PDF discount-tier table.
 * Rows carry numeric bounds so the renderer can mark the applicant's CGPA row.
 */
export type ScholarshipDiscountTablePdf = {
  title: string;
  /** Label for the first (grade-range) column, e.g. "CGPA" or "CGPA / %". */
  cgpaHeader?: string;
  /** Headers for the 1–2 discount columns rendered between CGPA and the Applied checkbox. */
  discountColHeaders: string[];
  rows: Array<{
    cgpaMin: number;
    cgpaMax: number;
    /** Grade scale of this row's range; renderer matches the same-typed applicant value. */
    gradeType?: ScholarshipGradeType;
    /** Formatted range label, e.g. "3.00 – 3.25" or "75% – 85%". */
    cgpa: string;
    /** Display value per discount column, aligned with `discountColHeaders`. */
    discounts: string[];
  }>;
};

/**
 * Builds the PDF tier-table model from category CGPA tiers.
 * Columns with no tiers are dropped; the row set is the union of all CGPA ranges
 * across columns (matched by exact min/max, so ranges missing in a column show "—").
 */
export function buildDiscountTablePdf(opts: {
  title: string;
  columns: Array<{ header: string; tiers: ScholarshipCgpaDiscountTier[] }>;
}): ScholarshipDiscountTablePdf {
  const withTiers = opts.columns.filter((c) => c.tiers.length > 0);
  const columns = withTiers.length > 0 ? withTiers : opts.columns.slice(0, 1);

  // Range identity includes grade scale — a CGPA 3.00–3.50 and a Percentage
  // 3.00–3.50 are different domains and must not collapse into one row.
  const ranges = new Map<string, { min: number; max: number; type: ScholarshipGradeType }>();
  for (const col of columns) {
    for (const t of col.tiers) {
      const type = normalizeGradeType(t.grade_type);
      const min = Number(t.cgpa_min);
      const max = Number(t.cgpa_max);
      const key = `${type}:${min}-${max}`;
      if (!ranges.has(key)) ranges.set(key, { min, max, type });
    }
  }
  const sortedRanges = [...ranges.values()].sort(
    (a, b) => a.min - b.min || a.max - b.max,
  );

  const rows = sortedRanges.map((r) => ({
    cgpaMin: r.min,
    cgpaMax: r.max,
    gradeType: r.type,
    cgpa:
      r.type === "percentage"
        ? `${r.min.toFixed(0)}% – ${r.max.toFixed(0)}%`
        : `${r.min.toFixed(2)} – ${r.max.toFixed(2)}`,
    discounts: columns.map((col) => {
      const tier = col.tiers.find(
        (t) =>
          Number(t.cgpa_min) === r.min &&
          Number(t.cgpa_max) === r.max &&
          normalizeGradeType(t.grade_type) === r.type,
      );
      return tier ? formatDiscountPercentDisplay(Number(tier.discount_percent)) : "—";
    }),
  }));

  const types = new Set(rows.map((r) => r.gradeType));
  const cgpaHeader =
    types.size === 1
      ? types.has("percentage")
        ? "Percentage"
        : "CGPA"
      : "CGPA / %";

  return {
    title: String(opts.title || "").trim() || "Discount",
    cgpaHeader,
    discountColHeaders: columns.map((c) => c.header),
    rows,
  };
}

export function slugifyCategoryLabel(label: string): string {
  return String(label || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function parseFlowType(v: string | null | undefined): ScholarshipFlowType | null {
  const d = String(v || "").trim().toLowerCase();
  if (d === "fee_discount" || d === "kinship") return d;
  return null;
}

export function findCategoryBySlug(
  slug: string | null | undefined,
  categories: ScholarshipCategoryWithTiers[],
): ScholarshipCategoryWithTiers | null {
  const s = String(slug || "").trim().toLowerCase();
  if (!s) return null;
  return categories.find((c) => c.slug.toLowerCase() === s) ?? null;
}

/** Resolve flow from DB category or legacy slug lists in scholarshipLetter. */
export function resolveCategoryFlowType(
  discountType: string | null | undefined,
  categories: ScholarshipCategoryWithTiers[],
  legacy: { isFee: (d: string) => boolean; isKinship: (d: string) => boolean },
): ScholarshipFlowType | null {
  const cat = findCategoryBySlug(discountType, categories);
  if (cat) return cat.flow_type;
  const d = String(discountType || "").trim().toLowerCase();
  if (legacy.isKinship(d)) return "kinship";
  if (legacy.isFee(d)) return "fee_discount";
  return null;
}

/** Result of resolving both admission and tuition fee discounts for a merged scholarship slug. */
export type MergedFeeDiscountResult = {
  admissionFeePercent: number | null;
  tuitionFeePercent: number | null;
  totalPercent: number | null;
};

/**
 * For a merged scholarship slug (e.g. "phd-scholarship"), resolves both the admission-fee
 * and tuition-fee discount percents by looking up the component category slugs in the
 * provided categories list and resolving each against the applicant's CGPA.
 */
export function resolveMergedFeeDiscount(
  discountType: string | null | undefined,
  grades: ApplicantGrades | number,
  categories: ScholarshipCategoryWithTiers[],
  componentSlugs: { admissionSlug: string; tuitionSlug: string } | null,
): MergedFeeDiscountResult {
  if (!componentSlugs) {
    return { admissionFeePercent: null, tuitionFeePercent: null, totalPercent: null };
  }

  const admissionCat = findCategoryBySlug(componentSlugs.admissionSlug, categories);
  const tuitionCat = findCategoryBySlug(componentSlugs.tuitionSlug, categories);

  const admissionFeePercent = admissionCat ? resolveDiscountPercent(grades, admissionCat.tiers) : null;
  const tuitionFeePercent = tuitionCat ? resolveDiscountPercent(grades, tuitionCat.tiers) : null;

  const totalPercent =
    admissionFeePercent != null && tuitionFeePercent != null
      ? admissionFeePercent + tuitionFeePercent
      : admissionFeePercent ?? tuitionFeePercent ?? null;

  return { admissionFeePercent, tuitionFeePercent, totalPercent };
}
