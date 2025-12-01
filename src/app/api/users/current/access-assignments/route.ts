import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserAccessAssignments, getUserIdFromSession } from "@/lib/userAccess";
import { isSuperAdminUser } from "@/lib/alumniProfile";

/**
 * GET /api/users/current/access-assignments
 * 
 * Returns access assignments for admin/viewer users.
 * For alumni users, returns empty assignments (alumni don't have access assignments).
 */
export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Check if user is alumni (alumni users don't have access assignments)
    const userType = (session.user as { type?: string | null })?.type;
    const normalizedType = userType ? String(userType).toLowerCase().trim() : "";
    const isAlumni = normalizedType === "alumni";
    
    // Alumni users don't need access assignments - return full access (isSuperAdmin: true)
    // This allows alumni to select any faculty/department/program when filling forms
    if (isAlumni) {
      return NextResponse.json({
        isSuperAdmin: true,
        isAlumni: true,
        faculties: [],
        departments: [],
        programs: [],
        assignments: []
      }, { status: 200 });
    }
    
    // Super admins have access to everything
    if (isSuperAdminUser(session.user)) {
      return NextResponse.json({
        isSuperAdmin: true,
        isAlumni: false,
        faculties: [],
        departments: [],
        programs: []
      }, { status: 200 });
    }
    
    // For admin/viewer users, get access assignments
    const userId = getUserIdFromSession(session);
    if (!userId) {
      // If no user ID and not alumni, this is an error
      return NextResponse.json({ error: "User ID not found" }, { status: 400 });
    }
    
    const assignments = await getUserAccessAssignments(userId);
    
    // Transform assignments to arrays
    const faculties = new Set<string>();
    const departments = new Set<string>();
    const programs = new Set<string>();
    
    assignments.forEach(assign => {
      if (assign.faculty_name && !assign.department_name && !assign.program_name) {
        // Faculty-level access
        faculties.add(assign.faculty_name);
      } else if (assign.department_name && !assign.program_name) {
        // Department-level access
        departments.add(assign.department_name);
        if (assign.faculty_name) faculties.add(assign.faculty_name);
      } else if (assign.program_name) {
        // Program-level access
        programs.add(assign.program_name);
        if (assign.department_name) departments.add(assign.department_name);
        if (assign.faculty_name) faculties.add(assign.faculty_name);
      }
    });
    
    return NextResponse.json({
      isSuperAdmin: false,
      isAlumni: false,
      faculties: Array.from(faculties),
      departments: Array.from(departments),
      programs: Array.from(programs),
      assignments: assignments
    }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("[API] /api/users/current/access-assignments error:", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

