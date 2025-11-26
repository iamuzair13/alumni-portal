import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/alumniProfile";

type UserBody = {
  email: string;
  password: string;
  firstname?: string | null;
  lastname?: string | null;
  department?: string | null;
  type: string; // expect "admin" for admin, "viewer" for view-only
  blocked?: boolean | null;
  csrf?: string;
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
    return NextResponse.json({ userid: rows[0]?.userid }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}