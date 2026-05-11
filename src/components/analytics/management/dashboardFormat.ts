export function formatKpiValue(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : "—";
}

export function fmtCell(value: number | null | undefined): string | number {
  return typeof value === "number" && Number.isFinite(value) ? value : "—";
}
