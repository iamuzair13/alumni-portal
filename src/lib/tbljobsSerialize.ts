/**
 * Serialize a `public.tbljobs` row from the DB driver for JSON responses.
 * Handles bigint `id`, `Date` values, and passes through every column (including optional `status`, etc.).
 */
export function serializeTbljobsRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined) continue;
    if (key === "id") {
      out[key] = typeof value === "bigint" ? Number(value) : Number(value);
      continue;
    }
    if (value instanceof Date) {
      out[key] = value.toISOString();
      continue;
    }
    if (typeof value === "bigint") {
      out[key] = Number(value);
      continue;
    }
    out[key] = value;
  }
  return out;
}
