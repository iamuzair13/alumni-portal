import { sql } from "@/lib/dbconnect";
import { combineOrConditions } from "@/lib/master-filter-utils";

/**
 * Faculty/department chips on the Alumni Association tab use the same values as
 * /api/alumni/faculties and /api/alumni/departments: `value` is a numeric id string
 * (or "NULL"), not a display name.
 */
export function buildAssociationTabFacultyFilterSQL(
  selectedFaculties: string[]
): ReturnType<typeof sql> {
  if (selectedFaculties.length === 0) return sql``;
  const facultyConditions = selectedFaculties.map((raw) => {
    const t = raw.trim();
    if (t === "NULL" || t === "null") {
      return sql`a.faculty IS NULL`;
    }
    if (/^\d+$/.test(t)) {
      const id = parseInt(t, 10);
      return sql`a.faculty = ${id}`;
    }
    return sql`LOWER(TRIM(COALESCE(f.faculty_name, a.facultyname, ''))) = ${t.toLowerCase()}`;
  });
  const combinedCondition = combineOrConditions(facultyConditions);
  if (facultyConditions.length === 1) {
    return sql` AND ${combinedCondition}`;
  }
  return sql` AND (${combinedCondition})`;
}

export function buildAssociationTabDepartmentFilterSQL(
  selectedDepartments: string[]
): ReturnType<typeof sql> {
  if (selectedDepartments.length === 0) return sql``;
  const departmentConditions = selectedDepartments.map((raw) => {
    const t = raw.trim();
    if (t === "NULL" || t === "null") {
      return sql`a.department IS NULL`;
    }
    if (/^\d+$/.test(t)) {
      const id = parseInt(t, 10);
      return sql`a.department = ${id}`;
    }
    return sql`LOWER(TRIM(COALESCE(d.department_name, a.departmentname, ''))) = ${t.toLowerCase()}`;
  });
  const combinedCondition = combineOrConditions(departmentConditions);
  if (departmentConditions.length === 1) {
    return sql` AND ${combinedCondition}`;
  }
  return sql` AND (${combinedCondition})`;
}
