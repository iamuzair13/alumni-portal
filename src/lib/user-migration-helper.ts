/**
 * User Migration Helper
 * 
 * Provides helper functions to query the users table with column aliases
 * for backward compatibility
 */

import { sql } from "@/lib/dbconnect";

/**
 * Query users table with column aliases
 * This allows existing code to work with minimal changes
 */
export async function queryUsersAsTblUsers(whereClause?: string, orderBy?: string) {
  const where = whereClause || "1=1";
  const order = orderBy || "id DESC";
  
  // Use postgres.js unsafe to inject dynamic WHERE/ORDER BY built by our code.
  // These clauses should always be constructed from trusted strings in our code,
  // not from direct user input.
  const whereSql = (sql as any).unsafe ? (sql as any).unsafe(where) : (sql as any)` ${sql([where])} `;
  const orderSql = (sql as any).unsafe ? (sql as any).unsafe(order) : (sql as any)` ${sql([order])} `;

  return sql/* sql */`
    SELECT 
      id as userid,
      email,
      COALESCE(password, password_hash) as password,
      firstname,
      lastname,
      department,
      COALESCE(type, legacy_type) as type,
      COALESCE(blocked, NOT is_active) as blocked,
      lastlogindatetime,
      id,
      password_hash,
      is_active,
      created_at,
      updated_at,
      legacy_userid,
      legacy_type
    FROM public.users
    WHERE ${whereSql}
    ORDER BY ${orderSql}
  `;
}

/**
 * Get user by ID (works with both old userid and new id)
 */
export async function getUserById(id: number) {
  return sql/* sql */`
    SELECT 
      id as userid,
      email,
      COALESCE(password, password_hash) as password,
      firstname,
      lastname,
      department,
      COALESCE(type, legacy_type) as type,
      COALESCE(blocked, NOT is_active) as blocked,
      lastlogindatetime,
      id,
      password_hash,
      is_active
    FROM public.users
    WHERE id = ${id} OR legacy_userid = ${id}
    LIMIT 1
  `;
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string) {
  return sql/* sql */`
    SELECT 
      id as userid,
      email,
      COALESCE(password, password_hash) as password,
      firstname,
      lastname,
      department,
      COALESCE(type, legacy_type) as type,
      COALESCE(blocked, NOT is_active) as blocked,
      lastlogindatetime,
      id,
      password_hash,
      is_active
    FROM public.users
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(${email}))
    LIMIT 1
  `;
}
