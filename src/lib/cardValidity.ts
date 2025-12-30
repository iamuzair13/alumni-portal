/**
 * Alumni card validity helpers.
 *
 * DB stores `tblcard.validity_date` as a DATE, typically serialized as `YYYY-MM-DD`.
 * Some UI layers historically passed `YYYY-MM` (month only) or already-formatted `MM/YYYY`.
 */
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

export function computeValidityISOFromAppliedAt(appliedAt: string | Date | null | undefined, years: number = 3): string | null {
  if (!appliedAt) return null;
  const base = appliedAt instanceof Date ? appliedAt : new Date(String(appliedAt));
  if (Number.isNaN(base.getTime())) return null;

  // Work in UTC to avoid timezone/day rollovers.
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  d.setUTCFullYear(d.getUTCFullYear() + years);

  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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


