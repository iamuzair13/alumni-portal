import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/alumniProfile";
import { getDepartmentsByFaculty, getProgramsByFacultyAndDepartment } from "@/data/programs-departments";

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

    // Check if trying to create Super Admin
    const userType = String(body.type || "viewer").trim().toLowerCase();
    if (userType === "superadmin") {
      // Check if there's already a Super Admin
      const existingSuperAdmin = await sql/* sql */`
        SELECT userid FROM public.tbl_users 
        WHERE LOWER(TRIM(type)) = 'superadmin'
        LIMIT 1` as { userid: number }[];
      
      if (existingSuperAdmin.length > 0) {
        return NextResponse.json({ error: "ONLY_ONE_SUPER_ADMIN: There can only be one Super Admin. Please transfer the role from the existing Super Admin first." }, { status: 400 });
      }
    }

    const rows = await sql/* sql */`
      INSERT INTO public.tbl_users (email, password, firstname, lastname, department, type, blocked, lastlogindatetime)
      VALUES (
        ${String(body.email).trim()},
        ${String(body.password)},
        ${body.firstname ?? null},
        ${body.lastname ?? null},
        ${body.department ?? null},
        ${String(body.type || "viewer").trim()},
        ${Boolean(body.blocked ?? false)},
        ${new Date().toISOString()}
      ) RETURNING userid` as { userid: number }[];
    
    const userId = rows[0]?.userid;
    if (!userId) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }
    
    // Save access assignments if provided (for admin/viewer roles)
    if ((userType === "admin" || userType === "viewer") && body.accessAssignments) {
      const { faculties, departments, programs } = body.accessAssignments;
      
      // If faculties are provided, create access assignments
      if (faculties && faculties.length > 0) {
        // Helper: Find which faculty a department belongs to
        const findFacultyForDepartment = (dept: string): string[] => {
          const result: string[] = [];
          for (const faculty of faculties) {
            const depts = getDepartmentsByFaculty(faculty);
            if (depts.includes(dept)) {
              result.push(faculty);
            }
          }
          return result;
        };
        
        // If specific programs are selected, create program-level assignments
        // Only create assignments for programs that actually belong to the selected departments
        if (programs && programs.length > 0 && departments && departments.length > 0) {
          for (const program of programs) {
            for (const department of departments) {
              // Find which faculty this department belongs to (from selected faculties)
              const deptFaculties = findFacultyForDepartment(department);
              for (const faculty of deptFaculties) {
                // Verify that the program actually belongs to this department before creating assignment
                // Use case-insensitive matching
                const validPrograms = getProgramsByFacultyAndDepartment(faculty, department);
                const normalizedProgram = program.toLowerCase().trim();
                const programMatches = validPrograms.some(
                  (p) => p.toLowerCase().trim() === normalizedProgram
                );
                if (programMatches) {
                  await sql/* sql */`
                    INSERT INTO public.user_access_assignments (userid, faculty_name, department_name, program_name)
                    VALUES (${userId}, ${faculty}, ${department}, ${program})
                    ON CONFLICT (userid, faculty_name, department_name, program_name) DO NOTHING
                  `;
                }
              }
            }
          }
        }
        // If specific departments are selected (but no programs), create department-level assignments
        else if (departments && departments.length > 0) {
          for (const department of departments) {
            // Find which faculty this department belongs to (from selected faculties)
            const deptFaculties = findFacultyForDepartment(department);
            for (const faculty of deptFaculties) {
              await sql/* sql */`
                INSERT INTO public.user_access_assignments (userid, faculty_name, department_name, program_name)
                VALUES (${userId}, ${faculty}, ${department}, NULL)
                ON CONFLICT (userid, faculty_name, department_name, program_name) DO NOTHING
              `;
            }
          }
        }
        // If only faculties are selected (no departments), create faculty-level assignments (access to all departments/programs)
        else {
          for (const faculty of faculties) {
            await sql/* sql */`
              INSERT INTO public.user_access_assignments (userid, faculty_name, department_name, program_name)
              VALUES (${userId}, ${faculty}, NULL, NULL)
              ON CONFLICT (userid, faculty_name, department_name, program_name) DO NOTHING
            `;
          }
        }
      }
    }
    
    return NextResponse.json({ userid: userId }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}