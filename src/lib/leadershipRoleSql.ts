import { sql } from "@/lib/dbconnect";

export type LeadershipRoleName = "president" | "vice_president" | "coordinator";

/** Matches inferRoleNameFromPosition() — substring-based, not exact normalized equality. */
export function chapterPostRoleCondition(role: LeadershipRoleName) {
  if (role === "vice_president") {
    return sql` AND LOWER(TRIM(COALESCE(cl.post, ''))) LIKE '%vice%'`;
  }
  if (role === "coordinator") {
    return sql` AND LOWER(TRIM(COALESCE(cl.post, ''))) LIKE '%coordinator%'`;
  }
  return sql` AND LOWER(TRIM(COALESCE(cl.post, ''))) NOT LIKE '%vice%'
    AND LOWER(TRIM(COALESCE(cl.post, ''))) NOT LIKE '%coordinator%'`;
}

export function associationPostRoleCondition(role: LeadershipRoleName) {
  if (role === "vice_president") {
    return sql` AND LOWER(TRIM(COALESCE(ass.q3, ''))) LIKE '%vice%'`;
  }
  if (role === "coordinator") {
    return sql` AND LOWER(TRIM(COALESCE(ass.q3, ''))) LIKE '%coordinator%'`;
  }
  return sql` AND LOWER(TRIM(COALESCE(ass.q3, ''))) NOT LIKE '%vice%'
    AND LOWER(TRIM(COALESCE(ass.q3, ''))) NOT LIKE '%coordinator%'`;
}
