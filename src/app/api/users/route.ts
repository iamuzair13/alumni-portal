import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";

import { auth } from "@/lib/auth";
import { isAdminUser } from "@/lib/alumniProfile";

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

export async function GET() {
  try {
    const session = await auth();
    const isAdmin = isAdminUser(session?.user);
    
    // Get current user's ID from session
    const currentUserId = (session?.user as { userId?: number })?.userId;
    
    if (isAdmin) {
      // Admins can see all passwords
      const rows = await sql/* sql */`
        SELECT userid, email, firstname, lastname, department, type, blocked, lastlogindatetime, password
        FROM public.tbl_users
        ORDER BY userid DESC` as DbUser[];
      return NextResponse.json({ items: rows ?? [] }, { status: 200 });
    } else if (currentUserId) {
      // Viewers can only see their own password
      const userIdNum = Number(currentUserId);
      if (isNaN(userIdNum)) {
        // Invalid user ID, return without passwords
        const rows = await sql/* sql */`
          SELECT userid, email, firstname, lastname, department, type, blocked, lastlogindatetime
          FROM public.tbl_users
          ORDER BY userid DESC` as DbUser[];
        return NextResponse.json({ items: rows ?? [] }, { status: 200 });
      }
      
      // Fetch all users, but only include password for the current user
      const rows = await sql/* sql */`
        SELECT 
          userid, 
          email, 
          firstname, 
          lastname, 
          department, 
          type, 
          blocked, 
          lastlogindatetime,
          CASE 
            WHEN userid = ${userIdNum} THEN password 
            ELSE NULL 
          END as password
        FROM public.tbl_users
        ORDER BY userid DESC` as DbUser[];
      
      return NextResponse.json({ items: rows ?? [] }, { status: 200 });
    } else {
      // No session or user ID, return without passwords
      const rows = await sql/* sql */`
        SELECT userid, email, firstname, lastname, department, type, blocked, lastlogindatetime
        FROM public.tbl_users
        ORDER BY userid DESC` as DbUser[];
      return NextResponse.json({ items: rows ?? [] }, { status: 200 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (body.email && !emailRegex.test(String(body.email))) {
      return NextResponse.json({ error: "INVALID_EMAIL_FORMAT" }, { status: 400 });
    }
    if (body.password && String(body.password).length < 8) return NextResponse.json({ error: "WEAK_PASSWORD" }, { status: 400 });
    const userid = Number(body.userid);
    if (!userid || Number.isNaN(userid)) return NextResponse.json({ error: "INVALID_USERID" }, { status: 400 });
    await sql/* sql */`
      UPDATE public.tbl_users
      SET
        email = ${body.email ?? null},
        ${body.password ? sql`password = ${String(body.password)},` : sql``}
        firstname = ${body.firstname ?? null},
        lastname = ${body.lastname ?? null},
        department = ${body.department ?? null},
        type = ${body.type ?? null},
        blocked = ${body.blocked ?? null}
      WHERE userid = ${userid}`;
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}