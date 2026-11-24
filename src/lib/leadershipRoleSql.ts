import { sql } from "@/lib/dbconnect";
import type { LeadershipRoleName } from "@/lib/leadershipRoles";

export type { LeadershipRoleName };

/**
 * Matches inferRoleNameFromPosition() — substring-based on stored position
 * text (cl.post / ass.q3), not exact normalized equality. Compound roles
 * (regional/administrative affairs) must both include their qualifier and
 * be excluded from their generic counterparts.
 */
export function chapterPostRoleCondition(role: LeadershipRoleName) {
  const col = sql`LOWER(TRIM(COALESCE(cl.post, '')))`;
  switch (role) {
    case "secretary_general":
      return sql` AND ${col} LIKE '%secretary%'`;
    case "vice_president_regional_affairs":
      return sql` AND ${col} LIKE '%vice%' AND ${col} LIKE '%regional%'`;
    case "vice_president_administrative_affairs":
      return sql` AND ${col} LIKE '%vice%' AND ${col} LIKE '%administrative%'`;
    case "coordinator_regional_affairs":
      return sql` AND ${col} LIKE '%coordinator%' AND ${col} LIKE '%regional%'`;
    case "coordinator_administrative_affairs":
      return sql` AND ${col} LIKE '%coordinator%' AND ${col} LIKE '%administrative%'`;
    case "vice_president":
      return sql` AND ${col} LIKE '%vice%' AND ${col} NOT LIKE '%regional%' AND ${col} NOT LIKE '%administrative%'`;
    case "coordinator":
      return sql` AND ${col} LIKE '%coordinator%' AND ${col} NOT LIKE '%regional%' AND ${col} NOT LIKE '%administrative%'`;
    default:
      return sql` AND ${col} NOT LIKE '%vice%'
        AND ${col} NOT LIKE '%coordinator%'
        AND ${col} NOT LIKE '%secretary%'`;
  }
}

export function associationPostRoleCondition(role: LeadershipRoleName) {
  const col = sql`LOWER(TRIM(COALESCE(ass.q3, '')))`;
  switch (role) {
    case "secretary_general":
      return sql` AND ${col} LIKE '%secretary%'`;
    case "vice_president_regional_affairs":
      return sql` AND ${col} LIKE '%vice%' AND ${col} LIKE '%regional%'`;
    case "vice_president_administrative_affairs":
      return sql` AND ${col} LIKE '%vice%' AND ${col} LIKE '%administrative%'`;
    case "coordinator_regional_affairs":
      return sql` AND ${col} LIKE '%coordinator%' AND ${col} LIKE '%regional%'`;
    case "coordinator_administrative_affairs":
      return sql` AND ${col} LIKE '%coordinator%' AND ${col} LIKE '%administrative%'`;
    case "vice_president":
      return sql` AND ${col} LIKE '%vice%' AND ${col} NOT LIKE '%regional%' AND ${col} NOT LIKE '%administrative%'`;
    case "coordinator":
      return sql` AND ${col} LIKE '%coordinator%' AND ${col} NOT LIKE '%regional%' AND ${col} NOT LIKE '%administrative%'`;
    default:
      return sql` AND ${col} NOT LIKE '%vice%'
        AND ${col} NOT LIKE '%coordinator%'
        AND ${col} NOT LIKE '%secretary%'`;
  }
}
