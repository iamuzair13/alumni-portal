import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";

type LeadershipType = "chapter" | "association";
type RoleName = "president" | "vice_president" | "coordinator";

function parseLeadershipType(v: string | null): LeadershipType | null {
  if (v === "chapter" || v === "association") return v;
  return null;
}

function parseRoleName(v: string | null): RoleName | null {
  if (v === "president" || v === "vice_president" || v === "coordinator") return v;
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const type = parseLeadershipType(req.nextUrl.searchParams.get("type"));
    const role = parseRoleName(req.nextUrl.searchParams.get("role"));

    if (!type || !role) {
      return NextResponse.json({ error: "type and role are required" }, { status: 400 });
    }

    const rows = await sql/* sql */`
      SELECT id, leadership_type, role_name, role_description
      FROM public.leadership_roles
      WHERE leadership_type = ${type}
        AND role_name = ${role}
      LIMIT 1
    `;

    return NextResponse.json({ role: rows?.[0] ?? null }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch role";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      type?: LeadershipType;
      role?: RoleName;
      roleDescription?: string | null;
    };

    const type = parseLeadershipType(body.type ?? null);
    const role = parseRoleName(body.role ?? null);
    if (!type || !role) {
      return NextResponse.json({ error: "Invalid type or role" }, { status: 400 });
    }

    const roleDescription = body.roleDescription === null || body.roleDescription === undefined
      ? null
      : String(body.roleDescription);

    const rows = await sql/* sql */`
      UPDATE public.leadership_roles
      SET role_description = ${roleDescription}
      WHERE leadership_type = ${type}
        AND role_name = ${role}
      RETURNING id, leadership_type, role_name, role_description
    `;

    return NextResponse.json({ role: rows?.[0] ?? null }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update role description";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
