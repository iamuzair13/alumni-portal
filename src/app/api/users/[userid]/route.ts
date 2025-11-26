import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isAdminUser, isViewerUser } from "@/lib/alumniProfile";

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
    const isViewer = isViewerUser(session?.user);
    const currentUserId = (session?.user as { userId?: number })?.userId;
    
    // Viewers can only update their own record
    if (isViewer && !isAdmin) {
      if (!currentUserId || Number(currentUserId) !== id) {
        return NextResponse.json({ error: "FORBIDDEN: You can only update your own account" }, { status: 403 });
      }
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (body.email && !emailRegex.test(String(body.email))) {
      return NextResponse.json({ error: "INVALID_EMAIL_FORMAT" }, { status: 400 });
    }
    if (body.password && String(body.password).length < 8) return NextResponse.json({ error: "WEAK_PASSWORD" }, { status: 400 });
    
    // Normalize "user" type to "viewer" for consistency
    const userType = body.type ? String(body.type).toLowerCase().trim() : null;
    const normalizedType = userType === "user" ? "viewer" : (userType || null);
    
    // For viewers updating their own account, only allow password, email, firstname, lastname
    // Admins can update all fields
    if (isViewer && !isAdmin) {
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
      // Admins can update all fields
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
    const url = new URL(req.url);
    const idStr = url.pathname.split("/").pop() || "";
    const id = Number(idStr);
    await sql/* sql */`DELETE FROM public.tbl_users WHERE userid = ${id}`;
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}