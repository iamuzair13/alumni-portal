/** Non-negative decimal marks; stored with up to 4 fractional digits. */
export function normalizeObtainedMark(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Math.round(value * 10000) / 10000;
}

export function clampObtainedMark(value: number, maxScore: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(maxScore)) return value;
  return normalizeObtainedMark(Math.min(maxScore, Math.max(0, value)));
}

export function formatObtainedMarkDisplay(value: number): string {
  if (!Number.isFinite(value)) return "";
  const n = normalizeObtainedMark(value);
  const s = n.toString();
  return s;
}
