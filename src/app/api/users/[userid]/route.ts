import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isAdminUser, isViewerUser, isSuperAdminUser } from "@/lib/alumniProfile";
import { getUserAccessAssignments } from "@/lib/userAccess";
import { getDepartmentsByFaculty, getProgramsByFacultyAndDepartment } from "@/data/programs-departments";

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
    const url = new URL(req.url);
    const idStr = url.pathname.split("/").pop() || "";
    const id = Number(idStr);
    const rows = await sql/* sql */`SELECT userid, email, firstname, lastname, department, type, blocked, lastlogindatetime FROM public.tbl_users WHERE userid = ${id} LIMIT 1` as DbUser[];
    const user = rows[0] ?? null;
    
    if (!user) {
      return NextResponse.json({ item: null }, { status: 200 });
    }
    
    // Fetch access assignments if user is admin/viewer
    const userType = user.type?.toLowerCase().trim();
    let accessAssignments = undefined;
    if (userType === "admin" || userType === "viewer") {
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
    
    return NextResponse.json({ 
      item: {
        ...user,
        accessAssignments
      }
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
    
    // Check authorization
    const isAdmin = isAdminUser(session?.user);
    const isSuperAdmin = isSuperAdminUser(session?.user);
    const isViewer = isViewerUser(session?.user);
    const currentUserId = (session?.user as { userId?: number })?.userId;
    
    // Viewers can only update their own record
    if (isViewer && !isAdmin && !isSuperAdmin) {
      if (!currentUserId || Number(currentUserId) !== id) {
        return NextResponse.json({ error: "FORBIDDEN: You can only update your own account" }, { status: 403 });
      }
    }
    
    // Admins can only update their own password, email, firstname, lastname
    // They cannot manage other users (change type, department, blocked status)
    if (isAdmin && !isSuperAdmin) {
      if (!currentUserId || Number(currentUserId) !== id) {
        return NextResponse.json({ error: "FORBIDDEN: Admins can only update their own account" }, { status: 403 });
      }
      // Admin can only update password, email, firstname, lastname for themselves
      await sql/* sql */`
        UPDATE public.tbl_users
        SET
          email = ${body.email ?? null},
          ${body.password ? sql`password = ${String(body.password)},` : sql``}
          firstname = ${body.firstname ?? null},
          lastname = ${body.lastname ?? null}
        WHERE userid = ${id}`;
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
    
    // Check if trying to set Super Admin role
    if (normalizedType === "superadmin") {
      // Check if there's already a Super Admin
      const existingSuperAdmin = await sql/* sql */`
        SELECT userid FROM public.tbl_users 
        WHERE LOWER(TRIM(type)) = 'superadmin' AND userid != ${id}
        LIMIT 1` as { userid: number }[];
      
      if (existingSuperAdmin.length > 0) {
        return NextResponse.json({ error: "ONLY_ONE_SUPER_ADMIN: There can only be one Super Admin. Please transfer the role from the existing Super Admin first." }, { status: 400 });
      }
    }
    
    // For viewers updating their own account, only allow password, email, firstname, lastname
    // Super Admin can update all fields
    if (isViewer && !isAdmin && !isSuperAdmin) {
      // Viewers can only update password, email, firstname, lastname
      await sql/* sql */`
        UPDATE public.tbl_users
        SET
          email = ${body.email ?? null},
          ${body.password ? sql`password = ${String(body.password)},` : sql``}
          firstname = ${body.firstname ?? null},
          lastname = ${body.lastname ?? null}
        WHERE userid = ${id}`;
    } else {
      // Super Admin can update all fields
      await sql/* sql */`
        UPDATE public.tbl_users
        SET
          email = ${body.email ?? null},
          ${body.password ? sql`password = ${String(body.password)},` : sql``}
          firstname = ${body.firstname ?? null},
          lastname = ${body.lastname ?? null},
          department = ${body.department ?? null},
          type = ${normalizedType},
          blocked = ${body.blocked ?? null}
        WHERE userid = ${id}`;
    }
    
    // Update access assignments if provided and user is Super Admin
    // Only Super Admin can modify access assignments
    if (isSuperAdmin && body.accessAssignments !== undefined && normalizedType && (normalizedType === "admin" || normalizedType === "viewer")) {
      // Delete existing access assignments for this user
      await sql/* sql */`DELETE FROM public.user_access_assignments WHERE userid = ${id}`;
      
      // Add new access assignments if provided
      if (body.accessAssignments && typeof body.accessAssignments === 'object') {
        const { faculties, departments, programs } = body.accessAssignments as { faculties?: string[]; departments?: string[]; programs?: string[] };
        
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
                const deptFaculties = findFacultyForDepartment(department);
                for (const faculty of deptFaculties) {
                  // Verify that the program actually belongs to this department before creating assignment
                  const validPrograms = getProgramsByFacultyAndDepartment(faculty, department);
                  if (validPrograms.includes(program)) {
                    await sql/* sql */`
                      INSERT INTO public.user_access_assignments (userid, faculty_name, department_name, program_name)
                      VALUES (${id}, ${faculty}, ${department}, ${program})
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
              const deptFaculties = findFacultyForDepartment(department);
              for (const faculty of deptFaculties) {
                await sql/* sql */`
                  INSERT INTO public.user_access_assignments (userid, faculty_name, department_name, program_name)
                  VALUES (${id}, ${faculty}, ${department}, NULL)
                  ON CONFLICT (userid, faculty_name, department_name, program_name) DO NOTHING
                `;
              }
            }
          }
          // If only faculties are selected (no departments), create faculty-level assignments
          else {
            for (const faculty of faculties) {
              await sql/* sql */`
                INSERT INTO public.user_access_assignments (userid, faculty_name, department_name, program_name)
                VALUES (${id}, ${faculty}, NULL, NULL)
                ON CONFLICT (userid, faculty_name, department_name, program_name) DO NOTHING
              `;
            }
          }
        }
      }
    } else if (isSuperAdmin && body.accessAssignments === null && normalizedType) {
      // If accessAssignments is explicitly null, remove all assignments (e.g., when changing to superadmin)
      await sql/* sql */`DELETE FROM public.user_access_assignments WHERE userid = ${id}`;
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
      return NextResponse.json({ error: "FORBIDDEN: Only Super Admin can delete users" }, { status: 403 });
    }
    
    const url = new URL(req.url);
    const idStr = url.pathname.split("/").pop() || "";
    const id = Number(idStr);
    
    // Check if trying to delete a Super Admin
    const userToDelete = await sql/* sql */`
      SELECT type FROM public.tbl_users WHERE userid = ${id} LIMIT 1
    ` as { type: string | null }[];
    
    if (userToDelete.length > 0) {
      const userType = String(userToDelete[0]?.type || "").toLowerCase().trim();
      if (userType === "superadmin") {
        // Check if there's another Super Admin (shouldn't happen, but safety check)
        const otherSuperAdmin = await sql/* sql */`
          SELECT userid FROM public.tbl_users 
          WHERE LOWER(TRIM(type)) = 'superadmin' AND userid != ${id}
          LIMIT 1` as { userid: number }[];
        
        if (otherSuperAdmin.length === 0) {
          return NextResponse.json({ error: "CANNOT_DELETE_SUPER_ADMIN: Cannot delete the only Super Admin. Please transfer the Super Admin role to another user first." }, { status: 400 });
        }
      }
    }
    
    await sql/* sql */`DELETE FROM public.tbl_users WHERE userid = ${id}`;
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}