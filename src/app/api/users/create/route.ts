import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/alumniProfile";
import { buildAccessAssignmentRowsFromDb } from "@/lib/orgAccessLookup";
import { createAccessAssignmentsInNewRBAC } from "@/lib/rbac-assignments";

type UserBody = {
  email: string;
  password: string;
  firstname?: string | null;
  lastname?: string | null;
  department?: string | null;
  type: string; // expect "admin" for admin, "viewer" for view-only
  blocked?: boolean | null;
  csrf?: string;
  accessAssignments?: {
    faculties: string[];
    departments: string[];
    programs: string[];
  };
};

const RATE_LIMIT = new Map<string, { count: number; last: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_WINDOW_MS = 5 * 60 * 1000;

function rateLimitPrune() {
  const now = Date.now();
  for (const [k, v] of RATE_LIMIT.entries()) {
    if (now - v.last > RATE_WINDOW_MS) RATE_LIMIT.delete(k);
  }
}


export async function POST(req: Request) {
  try {
    const session = await auth();
    const isSuperAdmin = isSuperAdminUser(session?.user);
    
    // Only Super Admin can create users
    if (!isSuperAdmin) {
      return NextResponse.json({ error: "FORBIDDEN: Only Super Admin can create users" }, { status: 403 });
    }
    
    const ip = (req as unknown as { ip?: string }).ip || req.headers.get("x-forwarded-for") || "unknown";
    rateLimitPrune();
    const key = `create-user|${String(ip)}`;
    const rl = RATE_LIMIT.get(key) || { count: 0, last: Date.now() };
    const now = Date.now();
    if (now - rl.last > RATE_WINDOW_MS) rl.count = 0;
    rl.last = now;
    rl.count += 1;
    RATE_LIMIT.set(key, rl);
    if (rl.count > RATE_LIMIT_MAX) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });

    if (process.env.NODE_ENV === "production") {
      const proto = req.headers.get("x-forwarded-proto") || "";
      if (proto.toLowerCase() !== "https") return NextResponse.json({ error: "HTTPS_REQUIRED" }, { status: 400 });
    }

    const body = (await req.json()) as UserBody;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(body.email || "").trim())) return NextResponse.json({ error: "INVALID_EMAIL_FORMAT" }, { status: 400 });
    if (String(body.password || "").length < 8) return NextResponse.json({ error: "WEAK_PASSWORD" }, { status: 400 });

    const cookies = req.headers.get("cookie") || "";
    const match = cookies.match(/csrf_token=([^;]+)/);
    const cookieCsrf = match?.[1] ?? "";
    if (!cookieCsrf || cookieCsrf !== String(body.csrf || "")) return NextResponse.json({ error: "CSRF_INVALID" }, { status: 400 });

    // Note: Multiple superadmins are now allowed
    const userType = String(body.type || "viewer").trim().toLowerCase();

    // Create user directly in new users table
    const rows = await sql/* sql */`
      INSERT INTO public.users (
        email, 
        password_hash, 
        password, 
        firstname, 
        lastname, 
        department, 
        type, 
        legacy_type,
        blocked, 
        is_active,
        lastlogindatetime,
        created_at,
        updated_at
      )
      VALUES (
        ${String(body.email).trim()},
        ${String(body.password)},
        ${String(body.password)},
        ${body.firstname ?? null},
        ${body.lastname ?? null},
        ${body.department ?? null},
        ${String(body.type || "viewer").trim()},
        ${String(body.type || "viewer").trim()},
        ${Boolean(body.blocked ?? false)},
        ${!Boolean(body.blocked ?? false)},
        ${new Date().toISOString()},
        now(),
        now()
      ) RETURNING id, id as userid` as Array<{ id: number; userid: number }>;
    
    const userId = rows[0]?.id;
    const useridForResponse = rows[0]?.userid || userId;
    if (!userId) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }
    
    // Set legacy_userid to match the new id (for backward compatibility)
    await sql/* sql */`
      UPDATE public.users 
      SET legacy_userid = ${userId}
      WHERE id = ${userId} AND legacy_userid IS NULL
    `;
    
    // Assign role in new RBAC system
    try {
      const roleName = userType === "user" ? "viewer" : userType;
      const role = await sql/* sql */`
        SELECT id FROM public.roles WHERE name = ${roleName} LIMIT 1
      ` as Array<{ id: number }>;
      
      if (role[0]?.id) {
        await sql/* sql */`
          INSERT INTO public.user_roles (user_id, role_id)
          VALUES (${userId}, ${role[0].id})
          ON CONFLICT (user_id, role_id) DO NOTHING
        `;
        console.log(`[user create] ✅ Assigned role '${roleName}' to user in new RBAC system`);
      }
    } catch (error) {
      console.error("[user create] Error assigning role in new RBAC system:", error);
      // Don't fail the request
    }
    
    // Save access assignments if provided (for admin/viewer roles)
    if ((userType === "admin" || userType === "viewer") && body.accessAssignments) {
      const { faculties, departments, programs } = body.accessAssignments;
      
      const hasAnything =
        (Array.isArray(faculties) && faculties.length > 0) ||
        (Array.isArray(departments) && departments.length > 0) ||
        (Array.isArray(programs) && programs.length > 0);

      if (hasAnything) {
        const rows = await buildAccessAssignmentRowsFromDb({ faculties, departments, programs });
        
        // Check if old table exists before trying to use it
        const tableExists = await sql/* sql */`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'user_access_assignments'
          ) as exists
        ` as Array<{ exists: boolean }>;
        
        if (tableExists[0]?.exists) {
          // Use old system
          for (const r of rows) {
            try {
              await sql/* sql */`
                INSERT INTO public.user_access_assignments (userid, faculty_id, department_id, program_id, faculty_name, department_name, program_name)
                VALUES (${userId}, ${r.faculty_id}, ${r.department_id}, ${r.program_id}, ${r.faculty_name}, ${r.department_name}, ${r.program_name})
                ON CONFLICT (userid, faculty_name, department_name, program_name) DO UPDATE SET
                  faculty_id = EXCLUDED.faculty_id,
                  department_id = EXCLUDED.department_id,
                  program_id = EXCLUDED.program_id
              `;
            } catch (error) {
              console.error("[user create] Error inserting into user_access_assignments:", error);
              // Continue with next row
            }
          }
        }
        
        // Always try to create in new RBAC system (works even if old table exists)
        try {
          const result = await createAccessAssignmentsInNewRBAC(userId, userType as 'admin' | 'viewer', rows);
          if (result.created > 0) {
            console.log(`[user create] ✅ Created ${result.created} assignments in new RBAC system`);
          }
          if (result.errors > 0) {
            console.warn(`[user create] ⚠️ ${result.errors} assignments failed in new RBAC system`);
          }
        } catch (error) {
          console.error("[user create] Error creating assignments in new RBAC system:", error);
          // Don't fail the request - old system might still work
        }
      }
    }
    
    return NextResponse.json({ userid: useridForResponse }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}