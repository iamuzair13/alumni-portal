import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/alumniProfile";
import { logAdminAction } from "@/lib/adminActivityLog";

export type StoryCriterion = {
  id: number;
  label: string;
  description: string | null;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
};

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = isSuperAdminUser(session.user);
    const adminMode = isAdmin && req.nextUrl.searchParams.get("admin") === "1";

    const rows = await sql/* sql */`
      SELECT
        id,
        label,
        description,
        is_required,
        is_active,
        sort_order
      FROM public.story_criteria
      ${adminMode ? sql`` : sql`WHERE is_active = true`}
      ORDER BY sort_order ASC, id ASC
    `;

    return NextResponse.json({ items: rows as unknown as StoryCriterion[] }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch story criteria";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      label?: string;
      description?: string | null;
      isRequired?: boolean;
      isActive?: boolean;
      sortOrder?: number;
    };

    const label = String(body.label ?? "").trim();
    if (!label) {
      return NextResponse.json({ error: "Label is required" }, { status: 400 });
    }

    const description = body.description === null || body.description === undefined ? null : String(body.description);
    const isRequired = Boolean(body.isRequired);
    const isActive = body.isActive === undefined ? true : Boolean(body.isActive);
    const sortOrder = Number.isFinite(body.sortOrder as number) ? Number(body.sortOrder) : 0;

    const rows = await sql/* sql */`
      INSERT INTO public.story_criteria (
        label,
        description,
        is_required,
        is_active,
        sort_order,
        created_at,
        updated_at
      )
      VALUES (
        ${label},
        ${description},
        ${isRequired},
        ${isActive},
        ${sortOrder},
        NOW(),
        NOW()
      )
      RETURNING
        id,
        label,
        description,
        is_required,
        is_active,
        sort_order
    `;

    await logAdminAction({
      session,
      req,
      input: {
        action: "settings.stories_criteria_create",
        entityType: "stories_criteria",
        success: true,
        entityId: (rows?.[0] as { id?: number } | undefined)?.id,
        metadata: { label },
      },
    });

    return NextResponse.json({ item: rows?.[0] ?? null }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create criterion";
    await logAdminAction({
      session: null,
      req,
      input: {
        action: "settings.stories_criteria_create",
        entityType: "stories_criteria",
        success: false,
        errorMessage: msg,
      },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      id?: number;
      label?: string;
      description?: string | null;
      isRequired?: boolean;
      isActive?: boolean;
      sortOrder?: number;
    };

    const id = Number(body.id);
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const setLabel = Object.prototype.hasOwnProperty.call(body, "label");
    const labelValue = setLabel ? String(body.label ?? "").trim() : "";
    if (setLabel && !labelValue) {
      return NextResponse.json({ error: "Label cannot be empty" }, { status: 400 });
    }

    const setDescription = Object.prototype.hasOwnProperty.call(body, "description");
    const descriptionValue = setDescription
      ? body.description === null
        ? null
        : String(body.description ?? "")
      : null;

    const setRequired = Object.prototype.hasOwnProperty.call(body, "isRequired");
    const setActive = Object.prototype.hasOwnProperty.call(body, "isActive");
    const setSort = Object.prototype.hasOwnProperty.call(body, "sortOrder");
    const sortValue = setSort ? Number(body.sortOrder) : 0;

    const rows = await sql/* sql */`
      UPDATE public.story_criteria
      SET
        label = CASE WHEN ${setLabel} THEN ${labelValue} ELSE label END,
        description = CASE WHEN ${setDescription} THEN ${descriptionValue} ELSE description END,
        is_required = CASE WHEN ${setRequired} THEN ${Boolean(body.isRequired)} ELSE is_required END,
        is_active = CASE WHEN ${setActive} THEN ${Boolean(body.isActive)} ELSE is_active END,
        sort_order = CASE WHEN ${setSort} THEN ${sortValue} ELSE sort_order END,
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING
        id,
        label,
        description,
        is_required,
        is_active,
        sort_order
    `;

    await logAdminAction({
      session,
      req,
      input: {
        action: "settings.stories_criteria_update",
        entityType: "stories_criteria",
        success: true,
        entityId: id,
      },
    });

    return NextResponse.json({ item: rows?.[0] ?? null }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update criterion";
    await logAdminAction({
      session: null,
      req,
      input: {
        action: "settings.stories_criteria_update",
        entityType: "stories_criteria",
        success: false,
        errorMessage: msg,
      },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await sql/* sql */`
      DELETE FROM public.story_criteria
      WHERE id = ${id}
    `;

    await logAdminAction({
      session,
      req,
      input: {
        action: "settings.stories_criteria_delete",
        entityType: "stories_criteria",
        success: true,
        entityId: id,
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete criterion";
    await logAdminAction({
      session: null,
      req,
      input: {
        action: "settings.stories_criteria_delete",
        entityType: "stories_criteria",
        success: false,
        errorMessage: msg,
      },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
