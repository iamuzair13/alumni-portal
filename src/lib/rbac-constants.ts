/**
 * RBAC Constants - Client-Safe
 * 
 * This file contains only constants and types that can be safely imported
 * by client components. It does not import any server-only modules.
 * 
 * @module rbac-constants
 */

/**
 * Role type definitions
 */
export const USER_ROLES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin",
  VIEWER: "viewer",
  ALUMNI: "alumni",
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
