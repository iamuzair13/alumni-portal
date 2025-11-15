export function mapZodIssues(issues: Array<{ path: (string | number)[]; message: string }>): Record<string, string> {
  const vErrs: Record<string, string> = {};
  for (const iss of issues) {
    const key = Array.isArray(iss.path) && iss.path.length ? String(iss.path[0]) : "form";
    vErrs[key] = iss.message;
  }
  return vErrs;
}

export function parseContactNumber(input: string): { code: string; number: string; valid: boolean } {
  const trimmed = String(input || "").trim();
  const m = trimmed.match(/^\+?(\d{1,3})\s*(\d{7,15})$/);
  if (!m) return { code: "", number: "", valid: false };
  const code = `+${m[1]}`;
  const number = m[2];
  return { code, number, valid: true };
}

export function displayCnic(cnic?: string | null): string {
  const v = cnic === undefined || cnic === null ? "" : String(cnic);
  return v.trim() ? v : "CNIC not available";
}