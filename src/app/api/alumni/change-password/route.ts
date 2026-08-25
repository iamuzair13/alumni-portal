import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { logAdminAction } from "@/lib/adminActivityLog";
import { verifyPassword } from "@/auth/credentials";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userType = String((session.user as { type?: string | null })?.type || "")
      .toLowerCase()
      .trim();

    if (userType !== "alumni") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const alumniId = (session.user as { userId?: number | null })?.userId;
    if (!alumniId || !Number.isFinite(Number(alumniId))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as
      | { currentPassword?: unknown; newPassword?: unknown; confirmPassword?: unknown }
      | null;

    const currentPassword = String(body?.currentPassword ?? "");
    const newPassword = String(body?.newPassword ?? "");
    const confirmPassword = String(body?.confirmPassword ?? "");

    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    if (newPassword.trim().length < 4) {
      return NextResponse.json({ error: "New password must be at least 4 characters long" }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "New password and confirm password do not match" }, { status: 400 });
    }

    const rows = await sql/* sql */`
      SELECT password
      FROM public.tbl_alumni
      WHERE alumniid = ${Number(alumniId)}
      LIMIT 1
    `;

    const stored = rows[0]?.password ? String(rows[0].password) : "";
    const ok = await verifyPassword(currentPassword, stored);
    if (!ok) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    await sql/* sql */`
      UPDATE public.tbl_alumni
      SET password = ${newPassword.trim()}
      WHERE alumniid = ${Number(alumniId)}
    `;

    await logAdminAction({
      session,
      req,
      input: {
        action: "alumni.change_password",
        entityType: "tbl_alumni",
        entityId: String(alumniId),
        success: true,
        metadata: {
          sapid: (session.user as { sapid?: string | null })?.sapid ?? null,
        },
      },
    });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to change password";
    await logAdminAction({
      session: await auth(),
      req,
      input: {
        action: "alumni.change_password",
        entityType: "tbl_alumni",
        success: false,
        errorMessage: message,
      },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
