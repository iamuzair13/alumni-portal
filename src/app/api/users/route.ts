import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";

import { auth } from "@/lib/auth";
import { isAdminUser, isSuperAdminUser, isViewerUser } from "@/lib/alumniProfile";
import { getUserAccessAssignments } from "@/lib/userAccess";
import { getUserAccessAssignmentsWithIds } from "@/lib/rbac";
import { logAdminAction } from "@/lib/adminActivityLog";

type DbUser = {
  userid: number;
  email: string | null;
  firstname: string | null;
  lastname: string | null;
  department: string | null;
  type: string | null;
  blocked: boolean | null;
  lastlogindatetime: string | null;
  password?: string | null;
};

type AccessAssignments = {
  faculties: string[];
  departments: string[];
  programs: string[];
};

async function getAccessAssignmentsForUser(userId: number): Promise<AccessAssignments> {
  try {
    const assignmentsWithIds = await getUserAccessAssignmentsWithIds(userId);
    if (assignmentsWithIds && assignmentsWithIds.length > 0) {
      const faculties = new Set<string>();
      const departments = new Set<string>();
      const programs = new Set<string>();

      assignmentsWithIds.forEach((assign) => {
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

      return {
        faculties: Array.from(faculties),
        departments: Array.from(departments),
        programs: Array.from(programs),
      };
    }

    const assignments = await getUserAccessAssignments(userId);
    const faculties = new Set<string>();
    const departments = new Set<string>();
    const programs = new Set<string>();

    assignments.forEach((assign) => {
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

    return {
      faculties: Array.from(faculties),
      departments: Array.from(departments),
      programs: Array.from(programs),
    };
  } catch {
    return { faculties: [], departments: [], programs: [] };
  }
}

export async function GET() {
  try {
    const session = await auth();
    
    // SECURITY: Require authentication
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const isAdmin = isAdminUser(session?.user);
    const isSuperAdmin = isSuperAdminUser(session?.user);
    const isViewer = isViewerUser(session?.user);
    
    // Allow viewer to see user list (read-only), but never reveal passwords.
    if (!isAdmin && !isSuperAdmin && !isViewer) {
      return NextResponse.json({ error: "Forbidden: Only staff can view user list" }, { status: 403 });
    }
    
    // Get current user's ID from session
    const currentUserId = (session?.user as { userId?: number })?.userId;

    const attachAssignments = async (rows: DbUser[]) => {
      const enriched = await Promise.all(
        (rows ?? []).map(async (u) => {
          const userType = String(u.type ?? "").toLowerCase().trim();
          if (userType !== "admin" && userType !== "viewer") {
            return { ...u, accessAssignments: undefined as AccessAssignments | undefined };
          }
          const accessAssignments = await getAccessAssignmentsForUser(Number(u.userid));
          return { ...u, accessAssignments };
        })
      );
      return enriched;
    };
    
    if (isSuperAdmin) {
      // Super Admin can see all passwords - get plain text from users.password
      const rows = await sql/* sql */`
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
        ORDER BY id DESC` as Array<DbUser & { password?: string | null }>;
      
      // Return plain text passwords (exclude hashed ones)
      const usersWithPlainPasswords = rows.map((user) => ({
        ...user,
        password: user.password && !user.password.startsWith("scrypt:") ? user.password : null
      }));

      const usersWithAccess = await attachAssignments(usersWithPlainPasswords);
      return NextResponse.json({ items: usersWithAccess ?? [] }, { status: 200 });
    } else if (isAdmin && currentUserId) {
      // Admins can only see their own password
      const userIdNum = Number(currentUserId);
      if (isNaN(userIdNum)) {
        // Invalid user ID, return without passwords
        const rows = await sql/* sql */`
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
          ORDER BY id DESC` as DbUser[];
        const usersWithAccess = await attachAssignments(rows ?? []);
        return NextResponse.json({ items: usersWithAccess ?? [] }, { status: 200 });
      }
      
      // Fetch all users, but only include password for the current admin user
      const rows = await sql/* sql */`
        SELECT 
          id as userid, 
          email, 
          firstname, 
          lastname, 
          department, 
          COALESCE(type, legacy_type) as type, 
          COALESCE(blocked, NOT is_active) as blocked, 
          lastlogindatetime,
          CASE 
            WHEN id = ${userIdNum} OR legacy_userid = ${userIdNum} THEN password
            ELSE NULL 
          END as password
        FROM public.users
        ORDER BY id DESC` as Array<DbUser & { password?: string | null }>;
      
      // Return plain text passwords (exclude hashed ones)
      const usersWithPlainPasswords = rows.map((user) => ({
        ...user,
        password: user.password && !user.password.startsWith("scrypt:") ? user.password : null
      }));

      const usersWithAccess = await attachAssignments(usersWithPlainPasswords);
      return NextResponse.json({ items: usersWithAccess ?? [] }, { status: 200 });
    } else if (isViewer && currentUserId) {
      // Viewer: can only see their own password
      const userIdNum = Number(currentUserId);
      if (isNaN(userIdNum)) {
        // Invalid user ID, return without passwords
        const rows = await sql/* sql */`
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
          ORDER BY id DESC` as DbUser[];
        const usersWithAccess = await attachAssignments(rows ?? []);
        return NextResponse.json({ items: usersWithAccess ?? [] }, { status: 200 });
      }
      
      // Fetch all users, but only include password for the current viewer user
      const rows = await sql/* sql */`
        SELECT 
          id as userid, 
          email, 
          firstname, 
          lastname, 
          department, 
          COALESCE(type, legacy_type) as type, 
          COALESCE(blocked, NOT is_active) as blocked, 
          lastlogindatetime,
          CASE 
            WHEN id = ${userIdNum} OR legacy_userid = ${userIdNum} THEN password
            ELSE NULL 
          END as password
        FROM public.users
        ORDER BY id DESC` as Array<DbUser & { password?: string | null }>;
      
      // Return plain text passwords (exclude hashed ones)
      const usersWithPlainPasswords = rows.map((user) => ({
        ...user,
        password: user.password && !user.password.startsWith("scrypt:") ? user.password : null
      }));

      const usersWithAccess = await attachAssignments(usersWithPlainPasswords);
      return NextResponse.json({ items: usersWithAccess ?? [] }, { status: 200 });
    } else {
      // No session or user ID, return without passwords
      const rows = await sql/* sql */`
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
        ORDER BY id DESC` as DbUser[];
      const usersWithAccess = await attachAssignments(rows ?? []);
      return NextResponse.json({ items: usersWithAccess ?? [] }, { status: 200 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    const isSuperAdmin = isSuperAdminUser(session?.user);
    
    // Only Super Admin can manage users
    if (!isSuperAdmin) {
      await logAdminAction({
        session,
        req,
        input: {
          action: "users.update",
          entityType: "users",
          success: false,
          errorMessage: "FORBIDDEN",
        },
      });
      return NextResponse.json({ error: "FORBIDDEN: Only Super Admin can manage users" }, { status: 403 });
    }
    
    const body = await req.json();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (body.email && !emailRegex.test(String(body.email))) {
      return NextResponse.json({ error: "INVALID_EMAIL_FORMAT" }, { status: 400 });
    }
    if (body.password && String(body.password).length < 8) return NextResponse.json({ error: "WEAK_PASSWORD" }, { status: 400 });
    let hashedPassword: string | undefined = undefined;
    if (body.password) {
      const { hashPassword } = await import("@/auth/credentials");
      hashedPassword = await hashPassword(String(body.password));
    }
    const userid = Number(body.userid);
    if (!userid || Number.isNaN(userid)) return NextResponse.json({ error: "INVALID_USERID" }, { status: 400 });
    
    // Note: Multiple superadmins are now allowed
    // Normalize user type
    const normalizedType = body.type ? String(body.type).toLowerCase().trim() : null;
    
    await sql/* sql */`
      UPDATE public.users
      SET
        email = ${body.email ?? null},
        ${hashedPassword ? sql`password = ${String(body.password)}, password_hash = ${hashedPassword},` : sql``}
        firstname = ${body.firstname ?? null},
        lastname = ${body.lastname ?? null},
        department = ${body.department ?? null},
        type = ${normalizedType},
        legacy_type = ${normalizedType},
        blocked = ${body.blocked ?? null},
        is_active = ${body.blocked === null ? sql`is_active` : sql`NOT ${Boolean(body.blocked)}`},
        updated_at = now()
      WHERE id = ${userid} OR legacy_userid = ${userid}`;

    await logAdminAction({
      session,
      req,
      input: {
        action: "users.update",
        entityType: "users",
        entityId: userid,
        metadata: {
          updatedFields: {
            email: body.email ?? null,
            firstname: body.firstname ?? null,
            lastname: body.lastname ?? null,
            department: body.department ?? null,
            type: normalizedType,
            blocked: body.blocked ?? null,
          },
        },
      },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}