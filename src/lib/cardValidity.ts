/**
 * Alumni card validity helpers.
 *
 * DB stores `tblcard.validity_date` as a DATE, typically serialized as `YYYY-MM-DD`.
 * Some UI layers historically passed `YYYY-MM` (month only) or already-formatted `MM/YYYY`.
 *
 * Policy: standard expiry for non-delivered applications and as fallback when delivered
 * rows have no `validity_date` — end of May 2029.
 */
export const ALUMNI_CARD_VALIDITY_ISO = "2029-05-31";

/** Raw ISO date (`YYYY-MM-DD`) used for expiry / `validity_date` per current policy. */
export function resolveAlumniCardValidityRaw(params: {
  status: string | null | undefined;
  validityDate: string | null | undefined;
}): string {
  const st = String(params.status ?? "")
    .trim()
    .toLowerCase();
  const vd =
    params.validityDate != null && String(params.validityDate).trim() !== ""
      ? String(params.validityDate).trim()
      : null;

  if (st === "delivered") {
    return vd ?? ALUMNI_CARD_VALIDITY_ISO;
  }

  return ALUMNI_CARD_VALIDITY_ISO;
}

export function formatCardValidityMonthYear(validity: string | null | undefined): string {
  const raw = (validity ?? "").trim();
  if (!raw) return "MM/YYYY";

  // Already formatted (UI legacy)
  if (raw.includes("/")) return raw;

  const parsed = parseYearMonthDayOrYearMonth(raw);
  if (parsed) {
    const month = String(parsed.month).padStart(2, "0");
    return `${month}/${parsed.year}`;
  }

  // Last resort: try Date parsing
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const year = d.getUTCFullYear();
    return `${month}/${year}`;
  }

  return raw;
}

/** @deprecated Years offset removed; returns fixed policy date. Kept for call-site compatibility. */
export function computeValidityISOFromAppliedAt(
  _appliedAt?: string | Date | null,
  _years?: number
): string | null {
  return ALUMNI_CARD_VALIDITY_ISO;
}

function parseYearMonthDayOrYearMonth(value: string): { year: number; month: number; day?: number } | null {
  // YYYY-MM-DD
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return { year, month, day };
    return null;
  }

  // YYYY-MM (month precision)
  const ym = /^(\d{4})-(\d{2})$/u.exec(value);
  if (ym) {
    const year = Number(ym[1]);
    const month = Number(ym[2]);
    if (month >= 1 && month <= 12) return { year, month };
    return null;
  }

  return null;
}


