/** Display helpers for faculty names in compact analytics charts. */

export function stripFacultyOfPrefix(name: string): string {
  const trimmed = name.trim();
  const stripped = trimmed.replace(/^Faculty of\s+/i, "");
  return stripped || trimmed;
}

const FACULTY_ABBREVIATION_MAP: Array<{ match: RegExp; short: string }> = [
  { match: /allied\s*health/i, short: "FAHS" },
  { match: /information\s*technology/i, short: "FIT" },
  { match: /management\s*sciences?/i, short: "FMS" },
  { match: /social\s*sciences?/i, short: "FSS" },
  { match: /medicine\s*&\s*dentistry|ucmd/i, short: "UCMD" },
  { match: /engineering\s*&\s*technology/i, short: "FET" },
  { match: /arts\s*&\s*architecture/i, short: "FA&A" },
  { match: /languages?\s*&\s*literature/i, short: "FLL" },
  { match: /pharmacy/i, short: "FPh" },
  { match: /^faculty\s+of\s+sciences?\b/i, short: "FSc" },
  { match: /\blaw\b/i, short: "FL" },
];

/** Short axis label for faculty bar charts — no truncation ellipsis. */
export function abbreviateFacultyLabel(name: string): string {
  const raw = String(name || "").trim();
  if (!raw) return "N/A";
  if (raw.toLowerCase() === "total") return "Total";

  const mapped = FACULTY_ABBREVIATION_MAP.find((m) => m.match.test(raw));
  if (mapped) return mapped.short;

  const words = stripFacultyOfPrefix(raw)
    .split(/[\s/&,-]+/)
    .filter(Boolean);
  const abbr = words.map((w) => w[0]?.toUpperCase() ?? "").join("");
  return abbr || raw.slice(0, 6);
}

export function facultyBarChartRow(faculty: string) {
  return {
    faculty: abbreviateFacultyLabel(faculty),
    fullName: faculty,
    tooltipLabel: stripFacultyOfPrefix(faculty),
  };
}

export function facultyTooltipLabel(
  label: string,
  payload: ReadonlyArray<{ payload?: { tooltipLabel?: string; fullName?: string } }> | undefined
): string {
  const row = payload?.[0]?.payload;
  if (row?.tooltipLabel) return row.tooltipLabel;
  if (row?.fullName) return stripFacultyOfPrefix(row.fullName);
  return label;
}
