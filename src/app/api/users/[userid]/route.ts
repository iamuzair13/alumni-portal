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
    
    // Note: Multiple superadmins are now allowed
    
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
      // ALWAYS delete existing access assignments first when accessAssignments is provided
      // This ensures old assignments are removed even if new ones are empty or invalid
      // This is critical: when programs are removed, old assignments must be deleted
      console.log("[user update] Deleting existing access assignments for user", id);
      
      // First, check what assignments exist before deletion (for logging)
      const existingAssignments = await sql/* sql */`
        SELECT faculty_name, department_name, program_name 
        FROM public.user_access_assignments 
        WHERE userid = ${id}
      ` as Array<{ faculty_name: string | null; department_name: string | null; program_name: string | null }>;
      
      console.log("[user update] Found", existingAssignments.length, "existing assignments to delete");
      if (existingAssignments.length > 0) {
        console.log("[user update] Existing assignments:", existingAssignments.map(a => 
          `${a.faculty_name || 'N/A'}/${a.department_name || 'N/A'}/${a.program_name || 'N/A'}`
        ));
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
        console.error("[user update] WARNING: Failed to delete all assignments. Remaining:", remainingCount);
      } else {
        console.log("[user update] Successfully deleted all existing assignments");
      }
      
      // Add new access assignments if provided and valid
      if (body.accessAssignments && typeof body.accessAssignments === 'object') {
        const { faculties, departments, programs } = body.accessAssignments as { faculties?: string[]; departments?: string[]; programs?: string[] };
        
        console.log("[user update] Adding new access assignments:", {
          faculties: faculties?.length || 0,
          departments: departments?.length || 0,
          programs: programs?.length || 0
        });
        
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
                  // Use case-insensitive matching
                  const validPrograms = getProgramsByFacultyAndDepartment(faculty, department);
                  const normalizedProgram = program.toLowerCase().trim();
                  const programMatches = validPrograms.some(
                    (p) => p.toLowerCase().trim() === normalizedProgram
                  );
                  if (programMatches) {
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
        } else {
          // If accessAssignments is an empty object or has no faculties, no new assignments are created
          // The DELETE above ensures old assignments are removed
          console.log("[user update] No new access assignments to add (empty or invalid)");
          console.log("[user update] Old assignments have been deleted - user will have no access");
        }
      } else {
        // If accessAssignments is null, empty, or invalid, ensure all assignments are removed
        // This handles cases where programs are removed and accessAssignments becomes empty
        console.log("[user update] Access assignments is null/empty - ensuring all old assignments are removed");
        // Note: DELETE already executed above, but we log it here for clarity
      }
    } else if (isSuperAdmin && body.accessAssignments === null && normalizedType) {
      // If accessAssignments is explicitly null, remove all assignments (e.g., when changing to superadmin)
      console.log("[user update] Removing all access assignments (user type change or explicit null)");
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
    
    // Safety check: Prevent deleting the last Super Admin to ensure system always has at least one
    const userToDelete = await sql/* sql */`
      SELECT type FROM public.tbl_users WHERE userid = ${id} LIMIT 1
    ` as { type: string | null }[];
    
    if (userToDelete.length > 0) {
      const userType = String(userToDelete[0]?.type || "").toLowerCase().trim();
      if (userType === "superadmin") {
        // Check if there's at least one other Super Admin
        const otherSuperAdmin = await sql/* sql */`
          SELECT userid FROM public.tbl_users 
          WHERE LOWER(TRIM(type)) = 'superadmin' AND userid != ${id}
          LIMIT 1` as { userid: number }[];
        
        if (otherSuperAdmin.length === 0) {
          return NextResponse.json({ error: "CANNOT_DELETE_LAST_SUPER_ADMIN: Cannot delete the last Super Admin. Please ensure at least one Super Admin exists in the system." }, { status: 400 });
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