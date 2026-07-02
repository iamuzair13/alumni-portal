/** CGPA tier resolution and validation for scholarship discount categories. */

import { discountCategoryLabel } from "@/lib/scholarshipLetter";

export type ScholarshipFlowType = "fee_discount" | "kinship";

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

export function tiersOverlap(
  a: { cgpa_min: number; cgpa_max: number },
  b: { cgpa_min: number; cgpa_max: number },
): boolean {
  return a.cgpa_min <= b.cgpa_max && b.cgpa_min <= a.cgpa_max;
}

export function validateTierRanges(
  tiers: Array<{ id?: number; cgpa_min: number; cgpa_max: number }>,
  opts?: { excludeId?: number },
): string | null {
  for (const t of tiers) {
    if (!Number.isFinite(t.cgpa_min) || !Number.isFinite(t.cgpa_max)) {
      return "CGPA min and max must be valid numbers.";
    }
    if (t.cgpa_min < 0 || t.cgpa_max > 4 || t.cgpa_min > t.cgpa_max) {
      return "CGPA range must be between 0 and 4, with min ≤ max.";
    }
  }

  const filtered = tiers.filter((t) => opts?.excludeId == null || t.id !== opts.excludeId);
  for (let i = 0; i < filtered.length; i++) {
    for (let j = i + 1; j < filtered.length; j++) {
      if (tiersOverlap(filtered[i], filtered[j])) {
        return "CGPA ranges must not overlap within the same category.";
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

export function resolveDiscountPercent(
  cgpa: number,
  tiers: ScholarshipCgpaDiscountTier[],
): number | null {
  const sorted = sortTiersForResolution(tiers);
  for (const t of sorted) {
    const min = Number(t.cgpa_min);
    const max = Number(t.cgpa_max);
    if (cgpa >= min && cgpa <= max) {
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

export function formatTierCriteria(cgpaMin: number, cgpaMax: number): string {
  const fmt = (n: number) => {
    if (!Number.isFinite(n)) return "—";
    return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
  };
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
    criteria: formatTierCriteria(t.cgpa_min, t.cgpa_max),
  }));
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
