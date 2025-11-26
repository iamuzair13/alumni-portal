import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isAdminUser, isViewerUser, isSuperAdminUser } from "@/lib/alumniProfile";

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
    return NextResponse.json({ item: rows[0] ?? null }, { status: 200 });
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