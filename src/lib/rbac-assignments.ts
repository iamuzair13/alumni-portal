/**
 * RBAC Assignment Helper
 * 
 * Creates access assignments in the new RBAC system (user_resource_access)
 * when the old user_access_assignments table doesn't exist
 */

import { sql } from "@/lib/dbconnect";
import type { AccessAssignmentRow } from "@/lib/orgAccessLookup";

/**
 * Create access assignments in the new RBAC system
 * @param userId - The user ID (can be users.id or legacy_userid)
 * @param userType - 'admin' or 'viewer'
 * @param assignmentRows - Rows from buildAccessAssignmentRowsFromDb
 */
export async function createAccessAssignmentsInNewRBAC(
  userId: number,
  userType: 'admin' | 'viewer',
  assignmentRows: AccessAssignmentRow[]
): Promise<{ created: number; errors: number }> {
  if (assignmentRows.length === 0) {
    return { created: 0, errors: 0 };
  }

  // Determine access level based on role
  const accessLevel = userType === 'admin' ? 'write' : 'read';

  // Find the user in the new RBAC system
  // Try by legacy_userid first, then by direct id
  let newUser = await sql/* sql */`
    SELECT id FROM public.users 
    WHERE legacy_userid = ${userId}
    LIMIT 1
  ` as Array<{ id: number }>;
  
  // If not found by legacy_userid, try by direct id (in case userId is already the new ID)
  if (!newUser[0]?.id) {
    newUser = await sql/* sql */`
      SELECT id FROM public.users 
      WHERE id = ${userId}
      LIMIT 1
    ` as Array<{ id: number }>;
  }

  if (!newUser[0]?.id) {
    console.warn(`[RBAC-Assignments] User ${userId} not found in new RBAC system (users table). User may need to be migrated first.`);
    return { created: 0, errors: assignmentRows.length };
  }

  const newUserId = newUser[0].id;

  let created = 0;
  let errors = 0;

  // Process each assignment row
  for (const row of assignmentRows) {
    try {
      // Find resource IDs based on legacy IDs
      let resourceId: number | null = null;

      // Priority: program > department > faculty
      if (row.program_id) {
        const programResource = await sql/* sql */`
          SELECT id FROM public.resources
          WHERE type = 'program' AND legacy_program_id = ${row.program_id}
          LIMIT 1
        ` as Array<{ id: number }>;
        resourceId = programResource[0]?.id ?? null;
      } else if (row.department_id) {
        const deptResource = await sql/* sql */`
          SELECT id FROM public.resources
          WHERE type = 'department' AND legacy_department_id = ${row.department_id}
          LIMIT 1
        ` as Array<{ id: number }>;
        resourceId = deptResource[0]?.id ?? null;
      } else if (row.faculty_id) {
        const facultyResource = await sql/* sql */`
          SELECT id FROM public.resources
          WHERE type = 'faculty' AND legacy_faculty_id = ${row.faculty_id}
          LIMIT 1
        ` as Array<{ id: number }>;
        resourceId = facultyResource[0]?.id ?? null;
      }

      if (!resourceId) {
        console.warn(`[RBAC-Assignments] Resource not found for:`, {
          faculty_id: row.faculty_id,
          department_id: row.department_id,
          program_id: row.program_id,
          faculty_name: row.faculty_name,
          department_name: row.department_name,
          program_name: row.program_name
        });
        errors++;
        continue;
      }

      // Insert into user_resource_access
      await sql/* sql */`
        INSERT INTO public.user_resource_access (user_id, resource_id, access_level)
        VALUES (${newUserId}, ${resourceId}, ${accessLevel})
        ON CONFLICT (user_id, resource_id) DO UPDATE SET
          access_level = EXCLUDED.access_level,
          updated_at = now()
      `;

      created++;
    } catch (error) {
      console.error(`[RBAC-Assignments] Error creating assignment:`, error, row);
      errors++;
    }
  }

  console.log(`[RBAC-Assignments] Created ${created} assignments, ${errors} errors for user ${userId} (new ID: ${newUserId})`);
  return { created, errors };
}

/**
 * Delete all access assignments for a user in the new RBAC system
 * @param userId - The user ID (can be users.id or legacy_userid)
 */
export async function deleteAccessAssignmentsInNewRBAC(userId: number): Promise<number> {
  // Find the user in the new RBAC system
  const newUser = await sql/* sql */`
    SELECT id FROM public.users 
    WHERE legacy_userid = ${userId} OR id = ${userId}
    LIMIT 1
  ` as Array<{ id: number }>;

  if (!newUser[0]?.id) {
    console.warn(`[RBAC-Assignments] User ${userId} not found in new RBAC system (users table)`);
    return 0;
  }

  const newUserId = newUser[0].id;

  const result = await sql/* sql */`
    DELETE FROM public.user_resource_access
    WHERE user_id = ${newUserId}
    RETURNING id
  ` as Array<{ id: number }>;

  const deleted = result.length;
  console.log(`[RBAC-Assignments] Deleted ${deleted} assignments for user ${userId} (new ID: ${newUserId})`);
  return deleted;
}
