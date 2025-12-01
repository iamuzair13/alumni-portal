import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserAccessAssignments, getUserIdFromSession } from "@/lib/userAccess";
import { isSuperAdminUser } from "@/lib/alumniProfile";

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Super admins have access to everything
    if (isSuperAdminUser(session.user)) {
      return NextResponse.json({
        isSuperAdmin: true,
        faculties: [],
        departments: [],
        programs: []
      }, { status: 200 });
    }
    
    const userId = getUserIdFromSession(session);
    if (!userId) {
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
      faculties: Array.from(faculties),
      departments: Array.from(departments),
      programs: Array.from(programs),
      assignments: assignments
    }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

