import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isAdminUser, isViewerUser, isSuperAdminUser } from "@/lib/alumniProfile";
import { getUserAccessAssignments } from "@/lib/userAccess";
import { getUserAccessAssignmentsWithIds } from "@/lib/rbac";
import { buildAccessAssignmentRowsFromDb } from "@/lib/orgAccessLookup";
import { createAccessAssignmentsInNewRBAC, deleteAccessAssignmentsInNewRBAC } from "@/lib/rbac-assignments";
import { logAdminAction } from "@/lib/adminActivityLog";
import { hashAdminPassword } from "@/lib/adminPassword";

type DbUser = {
  userid: number;
  email: string | null;
  firstname: string | null;
  lastname: string | null;
  department: string | null;
  type: string | null;
  blocked: boolean | null;
  lastlogindatetime: string | null;
};

export async function GET(req: Request) {
  try {
    const session = await auth();
    const url = new URL(req.url);
    const idStr = url.pathname.split("/").pop() || "";
    const id = Number(idStr);
    
    const isSuperAdmin = isSuperAdminUser(session?.user);
    const isAdmin = isAdminUser(session?.user);
    const isViewer = isViewerUser(session?.user);
    const currentUserId = (session?.user as { userId?: number })?.userId;
    
    // Check if user can access this user's data
    if (!isSuperAdmin && !isAdmin && !isViewer) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    
    // Admin and viewer can only view their own user data
    if ((isAdmin || isViewer) && !isSuperAdmin) {
      if (!currentUserId || Number(currentUserId) !== id) {
        return NextResponse.json({ error: "Forbidden: You can only view your own account" }, { status: 403 });
      }
    }
    
    // Fetch user data with password based on role
    let rows;
    if (isSuperAdmin) {
      // Superadmin can see all passwords
      rows = await sql/* sql */`
        SELECT 
          id as userid, 
          email, 
          firstname, 
          lastname, 
          department, 
          COALESCE(type, legacy_type) as type, 
          COALESCE(blocked, NOT is_active) as blocked, 
          lastlogindatetime, 
          password
        FROM public.users 
        WHERE id = ${id} OR legacy_userid = ${id}
        LIMIT 1
      ` as Array<DbUser & { password?: string | null }>;
    } else if ((isAdmin || isViewer) && currentUserId && Number(currentUserId) === id) {
      // Admin/viewer can only see their own password
      rows = await sql/* sql */`
        SELECT 
          id as userid, 
          email, 
          firstname, 
          lastname, 
          department, 
          COALESCE(type, legacy_type) as type, 
          COALESCE(blocked, NOT is_active) as blocked, 
          lastlogindatetime, 
          password
        FROM public.users 
        WHERE id = ${id} OR legacy_userid = ${id}
        LIMIT 1
      ` as Array<DbUser & { password?: string | null }>;
    } else {
      // Should not reach here due to earlier check, but just in case
      rows = await sql/* sql */`
        SELECT 
          id as userid, 
          email, 
          firstname, 
          lastname, 
          department, 
          COALESCE(type, legacy_type) as type, 
          COALESCE(blocked, NOT is_active) as blocked, 
          lastlogindatetime
        FROM public.users 
        WHERE id = ${id} OR legacy_userid = ${id}
        LIMIT 1
      ` as DbUser[];
    }
    
    const user = rows[0] ?? null;
    
    if (!user) {
      return NextResponse.json({ item: null }, { status: 200 });
    }
    
    // Fetch access assignments if user is admin/viewer
    // Try new RBAC system first, fallback to old system
    const userType = user.type?.toLowerCase().trim();
    let accessAssignments = undefined;
    if (userType === "admin" || userType === "viewer") {
      try {
        // Try new RBAC system first (ID-based)
        const assignmentsWithIds = await getUserAccessAssignmentsWithIds(user.userid);
        
        if (assignmentsWithIds && assignmentsWithIds.length > 0) {
          // Transform ID-based assignments to arrays
          const faculties = new Set<string>();
          const departments = new Set<string>();
          const programs = new Set<string>();
          
          assignmentsWithIds.forEach(assign => {
            if (assign.faculty_name && !assign.department_name && !assign.program_name) {
              faculties.add(assign.faculty_name);
            } else if (assign.department_name && !assign.program_name) {
              departments.add(assign.department_name);
              if (assign.faculty_name) faculties.add(assign.faculty_name);
            } else if (assign.program_name) {
              programs.add(assign.program_name);
              if (assign.department_name) departments.add(assign.department_name);
              if (assign.faculty_name) faculties.add(assign.faculty_name);
            }
          });
          
          accessAssignments = {
            faculties: Array.from(faculties),
            departments: Array.from(departments),
            programs: Array.from(programs),
          };
        } else {
          // Fallback to old system (name-based)
          const assignments = await getUserAccessAssignments(user.userid);
          // Transform assignments to arrays
          const faculties = new Set<string>();
          const departments = new Set<string>();
          const programs = new Set<string>();
          
          assignments.forEach(assign => {
            if (assign.faculty_name && !assign.department_name && !assign.program_name) {
              faculties.add(assign.faculty_name);
            } else if (assign.department_name && !assign.program_name) {
              departments.add(assign.department_name);
              if (assign.faculty_name) faculties.add(assign.faculty_name);
            } else if (assign.program_name) {
              programs.add(assign.program_name);
              if (assign.department_name) departments.add(assign.department_name);
              if (assign.faculty_name) faculties.add(assign.faculty_name);
            }
          });
          
          accessAssignments = {
            faculties: Array.from(faculties),
            departments: Array.from(departments),
            programs: Array.from(programs),
          };
        }
      } catch (error) {

        // Return empty assignments on error
        accessAssignments = {
          faculties: [],
          departments: [],
          programs: [],
        };
      }
    }
    
    // Build response with password based on permissions
    const userResponse: DbUser & { password?: string | null; accessAssignments?: typeof accessAssignments } = {
      ...user,
      accessAssignments
    };
    
    // Password is already included in the query result if user has permission
    // No need to remove it - the SQL query already handles the permission check
    
    return NextResponse.json({ 
      item: userResponse
    }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    const url = new URL(req.url);
    const idStr = url.pathname.split("/").pop() || "";
    const id = Number(idStr);
    const body = await req.json();

    const nonEmptyKeys = Object.keys(body || {}).filter((k) => {
      if (k === "password") return false;
      const v = (body as Record<string, unknown>)[k];
      if (v === undefined || v === null) return false;
      if (typeof v === "string") return v.trim().length > 0;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === "object") return true;
      return true;
    });
    
    // Check authorization
    const isAdmin = isAdminUser(session?.user);
    const isSuperAdmin = isSuperAdminUser(session?.user);
    const isViewer = isViewerUser(session?.user);
    const currentUserId = (session?.user as { userId?: number })?.userId;
    
    // Viewers can only update their own record
    if (isViewer && !isAdmin && !isSuperAdmin) {
      if (!currentUserId || Number(currentUserId) !== id) {
        await logAdminAction({
          session,
          req,
          input: {
            action: "users.self_update",
            entityType: "users",
            entityId: id,
            success: false,
            errorMessage: "FORBIDDEN",
          },
        });
        return NextResponse.json({ error: "FORBIDDEN: You can only update your own account" }, { status: 403 });
      }
      if (nonEmptyKeys.length > 0) {
        await logAdminAction({
          session,
          req,
          input: {
            action: "users.self_update",
            entityType: "users",
            entityId: id,
            success: false,
            errorMessage: "FORBIDDEN",
          },
        });
        return NextResponse.json({ error: "FORBIDDEN: You can only update your password" }, { status: 403 });
      }
    }
    
    // Admins can only update their own password, email, firstname, lastname
    // They cannot manage other users (change type, department, blocked status)
    if (isAdmin && !isSuperAdmin) {
      if (!currentUserId || Number(currentUserId) !== id) {
        await logAdminAction({
          session,
          req,
          input: {
            action: "users.self_update",
            entityType: "users",
            entityId: id,
            success: false,
            errorMessage: "FORBIDDEN",
          },
        });
        return NextResponse.json({ error: "FORBIDDEN: Admins can only update their own account" }, { status: 403 });
      }
      if (nonEmptyKeys.length > 0) {
        await logAdminAction({
          session,
          req,
          input: {
            action: "users.self_update",
            entityType: "users",
            entityId: id,
            success: false,
            errorMessage: "FORBIDDEN",
          },
        });
        return NextResponse.json({ error: "FORBIDDEN: You can only update your password" }, { status: 403 });
      }
      // Admin can only update password for themselves
      await sql/* sql */`
        UPDATE public.users
        SET
          ${body.password ? sql`password = ${String(body.password)}, password_hash = ${String(body.password)},` : sql``}
          updated_at = now()
        WHERE id = ${id} OR legacy_userid = ${id}`;

      await logAdminAction({
        session,
        req,
        input: {
          action: "users.self_update",
          entityType: "users",
          entityId: id,
          metadata: {
            updatedFields: {
              passwordChanged: Boolean(body.password),
            },
          },
        },
      });
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (body.email && !emailRegex.test(String(body.email))) {
      return NextResponse.json({ error: "INVALID_EMAIL_FORMAT" }, { status: 400 });
    }
    if (body.password && String(body.password).length < 8) return NextResponse.json({ error: "WEAK_PASSWORD" }, { status: 400 });
    
    // Normalize "user" type to "viewer" for consistency
    const userType = body.type ? String(body.type).toLowerCase().trim() : null;
    const normalizedType = userType === "user" ? "viewer" : (userType || null);

    const passwordPlain = body.password !== undefined ? String(body.password) : null;
    const passwordHash =
      passwordPlain && (normalizedType === "admin" || normalizedType === "superadmin" || normalizedType === "viewer" || normalizedType === "user")
        ? await hashAdminPassword(passwordPlain)
        : passwordPlain;
    
    // Note: Multiple superadmins are now allowed
    
    // For viewers updating their own account, only allow password
    // Super Admin can update all fields
    if (isViewer && !isAdmin && !isSuperAdmin) {
      // Viewers can only update password
      await sql/* sql */`
        UPDATE public.users
        SET
          ${body.password ? sql`password = ${passwordPlain}, password_hash = ${passwordHash},` : sql``}
          updated_at = now()
        WHERE id = ${id} OR legacy_userid = ${id}`;

      await logAdminAction({
        session,
        req,
        input: {
          action: "users.self_update",
          entityType: "users",
          entityId: id,
          metadata: {
            updatedFields: {
              passwordChanged: Boolean(body.password),
            },
          },
        },
      });
    } else {
      // Super Admin can update all fields
      await sql/* sql */`
        UPDATE public.users
        SET
          email = ${body.email ?? null},
          ${body.password ? sql`password = ${passwordPlain}, password_hash = ${passwordHash},` : sql``}
          firstname = ${body.firstname ?? null},
          lastname = ${body.lastname ?? null},
          department = ${body.department ?? null},
          type = ${normalizedType},
          legacy_type = ${normalizedType},
          blocked = ${body.blocked ?? null},
          is_active = ${body.blocked === null ? sql`is_active` : sql`NOT ${Boolean(body.blocked)}`},
          updated_at = now()
        WHERE id = ${id} OR legacy_userid = ${id}`;

      await logAdminAction({
        session,
        req,
        input: {
          action: "users.update",
          entityType: "users",
          entityId: id,
          metadata: {
            updatedFields: {
              email: body.email ?? null,
              firstname: body.firstname ?? null,
              lastname: body.lastname ?? null,
              department: body.department ?? null,
              type: normalizedType,
              blocked: body.blocked ?? null,
              passwordChanged: Boolean(body.password),
            },
          },
        },
      });
    }
    
    // Update access assignments if provided and user is Super Admin
    // Only Super Admin can modify access assignments
    if (isSuperAdmin && body.accessAssignments !== undefined && normalizedType && (normalizedType === "admin" || normalizedType === "viewer")) {
      // ALWAYS delete existing access assignments first when accessAssignments is provided
      // This ensures old assignments are removed even if new ones are empty or invalid
      // This is critical: when programs are removed, old assignments must be deleted

      // Check if old table exists before trying to use it
      const tableExists = await sql/* sql */`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'user_access_assignments'
        ) as exists
      ` as Array<{ exists: boolean }>;
      
      // Delete from old system if it exists
      if (tableExists[0]?.exists) {
        // First, check what assignments exist before deletion (for logging)
        try {
          const existingAssignments = await sql/* sql */`
            SELECT faculty_name, department_name, program_name 
            FROM public.user_access_assignments 
            WHERE userid = ${id}
          ` as Array<{ faculty_name: string | null; department_name: string | null; program_name: string | null }>;

          if (existingAssignments.length > 0) {

          }
          
          // Delete all existing assignments
          await sql/* sql */`DELETE FROM public.user_access_assignments WHERE userid = ${id}`;
          
          // Verify deletion
          const remainingAssignments = await sql/* sql */`
            SELECT COUNT(*) as count 
            FROM public.user_access_assignments 
            WHERE userid = ${id}
          ` as Array<{ count: number | string }>;
          
          const remainingCount = Number(remainingAssignments[0]?.count || 0);
          if (remainingCount > 0) {

          } else {

          }
        } catch (error) {

          // Continue - table might not exist during migration
        }
      } else {

      }
      
      // Always delete from new RBAC system
      try {
        const deleted = await deleteAccessAssignmentsInNewRBAC(id);
        if (deleted > 0) {

        }
      } catch (error) {

        // Continue - might be first time creating assignments
      }
      
      // Add new access assignments if provided and valid
      if (body.accessAssignments && typeof body.accessAssignments === 'object') {
        const { faculties, departments, programs } = body.accessAssignments as { faculties?: string[]; departments?: string[]; programs?: string[] };

        const hasAnything =
          (Array.isArray(faculties) && faculties.length > 0) ||
          (Array.isArray(departments) && departments.length > 0) ||
          (Array.isArray(programs) && programs.length > 0);

        if (hasAnything) {
          const rows = await buildAccessAssignmentRowsFromDb({ faculties, departments, programs });

          // Check if old table exists before inserting
          const tableExistsForInsert = await sql/* sql */`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = 'user_access_assignments'
            ) as exists
          ` as Array<{ exists: boolean }>;
          
          // Insert into old system if it exists
          if (tableExistsForInsert[0]?.exists) {
            for (const r of rows) {
              try {
                await sql/* sql */`
                  INSERT INTO public.user_access_assignments (userid, faculty_id, department_id, program_id, faculty_name, department_name, program_name)
                  VALUES (${id}, ${r.faculty_id}, ${r.department_id}, ${r.program_id}, ${r.faculty_name}, ${r.department_name}, ${r.program_name})
                  ON CONFLICT (userid, faculty_name, department_name, program_name) DO UPDATE SET
                    faculty_id = EXCLUDED.faculty_id,
                    department_id = EXCLUDED.department_id,
                    program_id = EXCLUDED.program_id
                `;
              } catch (error) {

                // Continue with next row
              }
            }
          } else {

          }
          
          // Always try to create in new RBAC system
          try {
            const result = await createAccessAssignmentsInNewRBAC(id, normalizedType as 'admin' | 'viewer', rows);
            if (result.created > 0) {

            }
            if (result.errors > 0) {

            }
          } catch (error) {

            // Don't fail the request - old system might still work
          }
        } else {
          // If accessAssignments is an empty object or has no faculties, no new assignments are created
          // The DELETE above ensures old assignments are removed

        }
      } else {
        // If accessAssignments is null, empty, or invalid, ensure all assignments are removed
        // This handles cases where programs are removed and accessAssignments becomes empty

        // Note: DELETE already executed above, but we log it here for clarity
      }
    } else if (isSuperAdmin && body.accessAssignments === null && normalizedType) {
      // If accessAssignments is explicitly null, remove all assignments (e.g., when changing to superadmin)

      try {
        // Check if table exists first
        const tableExists = await sql/* sql */`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'user_access_assignments'
          ) as exists
        ` as Array<{ exists: boolean }>;
        
        // Delete from old system if it exists
        if (tableExists[0]?.exists) {
          await sql/* sql */`DELETE FROM public.user_access_assignments WHERE userid = ${id}`;

        } else {

        }
        
        // Always delete from new RBAC system
        try {
          const deleted = await deleteAccessAssignmentsInNewRBAC(id);
          if (deleted > 0) {

          }
        } catch (error) {

        }
      } catch (error) {

        // Continue - table might not exist during migration
      }
    }
    
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    const isSuperAdmin = isSuperAdminUser(session?.user);
    
    // Only Super Admin can delete users
    if (!isSuperAdmin) {
      const url = new URL(req.url);
      const idStr = url.pathname.split("/").pop() || "";
      const id = Number(idStr);
      await logAdminAction({
        session,
        req,
        input: {
          action: "users.delete",
          entityType: "users",
          entityId: Number.isFinite(id) ? id : null,
          success: false,
          errorMessage: "FORBIDDEN",
        },
      });
      return NextResponse.json({ error: "FORBIDDEN: Only Super Admin can delete users" }, { status: 403 });
    }
    
    const url = new URL(req.url);
    const idStr = url.pathname.split("/").pop() || "";
    const id = Number(idStr);
    
    // Safety check: Prevent deleting the last Super Admin to ensure system always has at least one
    const userToDelete = await sql/* sql */`
      SELECT COALESCE(type, legacy_type) as type FROM public.users 
      WHERE id = ${id} OR legacy_userid = ${id} 
      LIMIT 1
    ` as { type: string | null }[];
    
    if (userToDelete.length > 0) {
      const userType = String(userToDelete[0]?.type || "").toLowerCase().trim();
      if (userType === "superadmin") {
        // Check if there's at least one other Super Admin
        const otherSuperAdmin = await sql/* sql */`
          SELECT id FROM public.users 
          WHERE LOWER(TRIM(COALESCE(type, legacy_type, ''))) = 'superadmin' 
            AND id != ${id} 
            AND legacy_userid != ${id}
          LIMIT 1` as { id: number }[];
        
        if (otherSuperAdmin.length === 0) {
          return NextResponse.json({ error: "CANNOT_DELETE_LAST_SUPER_ADMIN: Cannot delete the last Super Admin. Please ensure at least one Super Admin exists in the system." }, { status: 400 });
        }
      }
    }
    
    // Delete from new system (users table)
    await sql/* sql */`DELETE FROM public.users WHERE id = ${id} OR legacy_userid = ${id}`;

    await logAdminAction({
      session,
      req,
      input: {
        action: "users.delete",
        entityType: "users",
        entityId: id,
      },
    });
    
    // Also delete from new RBAC system
    try {
      // Find user in new system by legacy_userid
      const newUser = await sql/* sql */`
        SELECT id FROM public.users WHERE legacy_userid = ${id} LIMIT 1
      ` as Array<{ id: number }>;
      
      if (newUser[0]?.id) {
        const newUserId = newUser[0].id;
        
        // Delete user roles first (foreign key constraint)
        await sql/* sql */`DELETE FROM public.user_roles WHERE user_id = ${newUserId}`;
        
        // Delete user resource access
        await sql/* sql */`DELETE FROM public.user_resource_access WHERE user_id = ${newUserId}`;
        
        // Finally delete the user
        await sql/* sql */`DELETE FROM public.users WHERE id = ${newUserId}`;

      } else {

      }
    } catch (error) {

      // Don't fail the request - old system deletion succeeded
    }
    
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}