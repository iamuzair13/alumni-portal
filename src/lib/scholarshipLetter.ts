/** Labels and derived fields for admin scholarship application letter view */

export function scholarshipTypeLabel(discountType: string | null | undefined): string {
  const d = String(discountType || "").trim().toLowerCase();
  if (d === "kinship") return "Personal / Kinship";
  if (d === "masters-phd") return "Personal / Kinship";
  if (d === "masters-collaboration") return "Personal / Kinship";
  if (!d) return "Scholarship / Discount";
  return discountType || "Scholarship / Discount";
}

export function requestedDiscountLabel(discountType: string | null | undefined): string {
  const d = String(discountType || "").trim().toLowerCase();
  if (d === "kinship") return "Kinship Discount";
  if (d === "masters-phd") return "Masters/PhD Discount";
  if (d === "masters-collaboration") {
    return "Masters Scholarships via UOL International Collaborations (for alumni only)";
  }
  if (!d) return "Scholarship / Discount";
  return discountType || "Scholarship / Discount";
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
