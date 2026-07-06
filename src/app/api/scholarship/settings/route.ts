import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/alumniProfile";

const FORM_TYPE = "scholarship_application";

// Get scholarship form settings
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await sql/* sql */`
      SELECT form_type, is_enabled, updated_at
      FROM public.scholarship_form_settings
      ORDER BY form_type
    `;

    const settings: Record<string, boolean> = {};
    rows.forEach((r: Record<string, unknown>) => {
      const isEnabled = typeof r.is_enabled === "boolean" ? r.is_enabled : Boolean(r.is_enabled);
      settings[String(r.form_type)] = isEnabled;
    });

    return NextResponse.json({
      scholarship_application: settings.scholarship_application ?? true,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("does not exist")) {
      return NextResponse.json({
        scholarship_application: true,
      });
    }
    const msg = err instanceof Error ? err.message : "Failed to fetch settings";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Update scholarship form settings (admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { formType, isEnabled } = body;

    if (!formType || typeof isEnabled !== "boolean") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (formType !== FORM_TYPE) {
      return NextResponse.json({ error: "Invalid form type" }, { status: 400 });
    }

    const userId = (session.user as { id?: number })?.id || null;

    await sql/* sql */`
      INSERT INTO public.scholarship_form_settings (form_type, is_enabled, updated_at, updated_by)
      VALUES (${formType}, ${isEnabled}, NOW(), ${userId})
      ON CONFLICT (form_type) DO UPDATE SET
        is_enabled = EXCLUDED.is_enabled,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
    `;

    return NextResponse.json({
      success: true,
      message: "Settings updated successfully",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update settings";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
