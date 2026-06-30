/** Display helpers for faculty names in compact analytics charts. */

export function stripFacultyOfPrefix(name: string): string {
  const trimmed = name.trim();
  const stripped = trimmed.replace(/^Faculty of\s+/i, "");
  return stripped || trimmed;
}

/** Fixed abbreviations that do not follow the general F-prefix rules. */
const SPECIAL_FACULTY_ABBREVIATIONS: Array<{ match: RegExp; short: string }> = [
  { match: /medicine\s*&\s*dentistry|ucmd|university college of medicine/i, short: "UCMD" },
];

/**
 * Short axis label for faculty bar charts.
 * - Multi-word faculties: first letter of each word, no leading "F" (e.g. Allied Health Sciences → AHS).
 * - Single-word faculties after "Faculty of": "F" + initial (e.g. Sciences → FS).
 */
export function abbreviateFacultyLabel(name: string): string {
  const raw = String(name || "").trim();
  if (!raw) return "N/A";
  if (raw.toLowerCase() === "total") return "Total";

  const special = SPECIAL_FACULTY_ABBREVIATIONS.find((m) => m.match.test(raw));
  if (special) return special.short;

  const remainder = stripFacultyOfPrefix(raw);
  const words = remainder
    .split(/[\s/&,-]+/)
    .filter(Boolean);

  if (words.length === 0) return raw.slice(0, 6);

  if (words.length === 1) {
    const initial = words[0][0]?.toUpperCase() ?? "";
    return initial ? `F${initial}` : raw.slice(0, 6);
  }

  return words.map((w) => w[0]?.toUpperCase() ?? "").join("");
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
