// Shared semester bounds for scholarship applications.
// BS programs run up to 8 semesters; the same bounds apply to the semester
// being applied for and to the semester into which credits were transferred.
export const SCHOLARSHIP_SEMESTER_MIN = 1;
export const SCHOLARSHIP_SEMESTER_MAX = 8;

export const SCHOLARSHIP_SEMESTER_OPTIONS: readonly string[] = Array.from(
  { length: SCHOLARSHIP_SEMESTER_MAX },
  (_, i) => String(i + SCHOLARSHIP_SEMESTER_MIN),
);

export function isValidScholarshipSemester(n: number | null | undefined): n is number {
  return (
    n != null &&
    Number.isFinite(n) &&
    n >= SCHOLARSHIP_SEMESTER_MIN &&
    n <= SCHOLARSHIP_SEMESTER_MAX
  );
}
