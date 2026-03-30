export function computeGrowth(currentTotal: number, previousTotal: number): number {
  const current = Number.isFinite(currentTotal) ? currentTotal : 0;
  const previous = Number.isFinite(previousTotal) ? previousTotal : 0;

  if (previous <= 0) {
    if (current <= 0) return 0;
    return 100;
  }
  return ((current - previous) / previous) * 100;
}

