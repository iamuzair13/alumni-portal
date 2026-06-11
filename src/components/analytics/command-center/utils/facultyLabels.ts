/** Display label for faculty names in compact dashboard chips. */
export function stripFacultyOfPrefix(name: string): string {
  const trimmed = name.trim();
  const stripped = trimmed.replace(/^Faculty of\s+/i, "");
  return stripped || trimmed;
}
