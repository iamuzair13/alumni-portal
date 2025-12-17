/**
 * Chapter cities helpers.
 *
 * DB column: `tblchapters.cities` is TEXT (nullable).
 * Historically it may contain:
 * - JSON array string: '["Lahore","Karachi"]'
 * - Comma/newline separated text: 'Lahore, Karachi'
 */

export function parseChapterCities(raw: unknown): string[] {
  if (raw == null) return [];

  if (Array.isArray(raw)) {
    return normalizeCities(raw.map((x) => String(x)));
  }

  const s = String(raw).trim();
  if (!s) return [];

  // Try JSON array first
  if (s.startsWith("[") && s.endsWith("]")) {
    try {
      const parsed = JSON.parse(s) as unknown;
      if (Array.isArray(parsed)) {
        return normalizeCities(parsed.map((x) => String(x)));
      }
    } catch {
      // fall through to delimiter parsing
    }
  }

  // Fallback: split by comma / semicolon / newline
  const parts = s.split(/[,;\n\r]+/u).map((p) => p.trim()).filter(Boolean);
  return normalizeCities(parts);
}

export function serializeChapterCities(cities: string[] | null | undefined): string | null {
  const normalized = normalizeCities(cities ?? []);
  if (normalized.length === 0) return null;
  // Store as JSON string for unambiguous parsing
  return JSON.stringify(normalized);
}

export function normalizeCities(cities: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of cities) {
    const cleaned = String(c ?? "").trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}


