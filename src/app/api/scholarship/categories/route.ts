import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/dbconnect";
import { isSuperAdminUser } from "@/lib/alumniProfile";
import { logAdminAction } from "@/lib/adminActivityLog";
import {
  parseFlowType,
  slugifyCategoryLabel,
  type ScholarshipCgpaDiscountTier,
  type ScholarshipDiscountCategory,
} from "@/lib/scholarshipDiscount";

function mapCategory(row: Record<string, unknown>): ScholarshipDiscountCategory {
  return {
    id: Number(row.id),
    slug: String(row.slug ?? ""),
    label: String(row.label ?? ""),
    flow_type: String(row.flow_type) as "fee_discount" | "kinship",
    default_apply_for: row.default_apply_for != null ? String(row.default_apply_for) : null,
    sort_order: Number(row.sort_order) || 0,
    is_active: Boolean(row.is_active),
  };
}

function mapTier(row: Record<string, unknown>): ScholarshipCgpaDiscountTier {
  return {
    id: Number(row.id),
    category_id: Number(row.category_id),
    cgpa_min: Number(row.cgpa_min),
    cgpa_max: Number(row.cgpa_max),
    discount_percent: Number(row.discount_percent),
    sort_order: Number(row.sort_order) || 0,
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const includeTiers = req.nextUrl.searchParams.get("includeTiers") === "1";
    const adminAll = req.nextUrl.searchParams.get("admin") === "1" && isSuperAdminUser(session.user);
    const activeOnly = !adminAll;

    const categoryRows = await sql/* sql */`
      SELECT id, slug, label, flow_type, default_apply_for, sort_order, is_active
      FROM public.scholarship_discount_categories
      WHERE (${activeOnly} = false OR is_active = true)
      ORDER BY sort_order ASC, id ASC
    `;

    const categories = (categoryRows as Record<string, unknown>[]).map(mapCategory);

    if (!includeTiers) {
      return NextResponse.json({ items: categories }, { status: 200 });
    }

    const categoryIds = categories.map((c) => c.id);
    if (categoryIds.length === 0) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    const tierRows = await sql/* sql */`
      SELECT id, category_id, cgpa_min, cgpa_max, discount_percent, sort_order
      FROM public.scholarship_cgpa_discount_tiers
      WHERE category_id = ANY(${categoryIds}::int[])
      ORDER BY sort_order ASC, id ASC
    `;

    const tiersByCategory = new Map<number, ScholarshipCgpaDiscountTier[]>();
    for (const row of tierRows as Record<string, unknown>[]) {
      const t = mapTier(row);
      const list = tiersByCategory.get(t.category_id) ?? [];
      list.push(t);
      tiersByCategory.set(t.category_id, list);
    }

    const items = categories.map((c) => ({
      ...c,
      tiers: tiersByCategory.get(c.id) ?? [],
    }));

    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch scholarship categories";
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
      slug?: string;
      label?: string;
      flowType?: string;
      defaultApplyFor?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    };

    const label = String(body.label ?? "").trim();
    const flowType = parseFlowType(body.flowType ?? null);
    let slug = String(body.slug ?? "").trim().toLowerCase();
    if (!slug && label) slug = slugifyCategoryLabel(label);
    const defaultApplyFor =
      body.defaultApplyFor === null || body.defaultApplyFor === undefined
        ? null
        : String(body.defaultApplyFor).trim() || null;
    const sortOrder = Number.isFinite(body.sortOrder as number) ? Number(body.sortOrder) : 0;
    const isActive = body.isActive !== false;

    if (!label) {
      return NextResponse.json({ error: "Label is required" }, { status: 400 });
    }
    if (!slug) {
      return NextResponse.json({ error: "Slug is required" }, { status: 400 });
    }
    if (!flowType) {
      return NextResponse.json({ error: "flowType must be fee_discount or kinship" }, { status: 400 });
    }

    const rows = await sql/* sql */`
      INSERT INTO public.scholarship_discount_categories (
        slug, label, flow_type, default_apply_for, sort_order, is_active, updated_at
      )
      VALUES (${slug}, ${label}, ${flowType}, ${defaultApplyFor}, ${sortOrder}, ${isActive}, NOW())
      RETURNING id, slug, label, flow_type, default_apply_for, sort_order, is_active
    `;

    const created = mapCategory((rows?.[0] as Record<string, unknown>) ?? {});
    await logAdminAction({
      session,
      req,
      input: {
        action: "settings.scholarship_category_create",
        entityType: "scholarship_categories",
        success: true,
        entityId: created.id,
        metadata: { slug, label, flowType },
      },
    });

    return NextResponse.json({ item: created }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create category";
    await logAdminAction({
      session: null,
      req,
      input: {
        action: "settings.scholarship_category_create",
        entityType: "scholarship_categories",
        success: false,
        errorMessage: msg,
      },
    });
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json({ error: "A category with this slug already exists" }, { status: 409 });
    }
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
      slug?: string;
      label?: string;
      flowType?: string;
      defaultApplyFor?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    };

    const id = Number(body.id);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Valid id is required" }, { status: 400 });
    }

    const existing = await sql/* sql */`
      SELECT id, slug, label, flow_type, default_apply_for, sort_order, is_active
      FROM public.scholarship_discount_categories
      WHERE id = ${id}
      LIMIT 1
    `;
    const cur = (existing?.[0] as Record<string, unknown> | undefined) ?? null;
    if (!cur) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const label = body.label !== undefined ? String(body.label).trim() : String(cur.label);
    const slug = body.slug !== undefined ? String(body.slug).trim().toLowerCase() : String(cur.slug);
    const flowType =
      body.flowType !== undefined ? parseFlowType(body.flowType) : parseFlowType(String(cur.flow_type));
    const defaultApplyFor =
      body.defaultApplyFor !== undefined
        ? body.defaultApplyFor === null
          ? null
          : String(body.defaultApplyFor).trim() || null
        : cur.default_apply_for != null
          ? String(cur.default_apply_for)
          : null;
    const sortOrder =
      body.sortOrder !== undefined
        ? Number.isFinite(body.sortOrder as number)
          ? Number(body.sortOrder)
          : Number(cur.sort_order)
        : Number(cur.sort_order);
    const isActive = body.isActive !== undefined ? Boolean(body.isActive) : Boolean(cur.is_active);

    if (!label || !slug || !flowType) {
      return NextResponse.json({ error: "Invalid category fields" }, { status: 400 });
    }

    const rows = await sql/* sql */`
      UPDATE public.scholarship_discount_categories
      SET
        slug = ${slug},
        label = ${label},
        flow_type = ${flowType},
        default_apply_for = ${defaultApplyFor},
        sort_order = ${sortOrder},
        is_active = ${isActive},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, slug, label, flow_type, default_apply_for, sort_order, is_active
    `;

    const updated = mapCategory((rows?.[0] as Record<string, unknown>) ?? {});
    await logAdminAction({
      session,
      req,
      input: {
        action: "settings.scholarship_category_update",
        entityType: "scholarship_categories",
        success: true,
        entityId: id,
        metadata: { slug, label, flowType },
      },
    });

    return NextResponse.json({ item: updated }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update category";
    await logAdminAction({
      session: null,
      req,
      input: {
        action: "settings.scholarship_category_update",
        entityType: "scholarship_categories",
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
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Valid id is required" }, { status: 400 });
    }

    const catRows = await sql/* sql */`
      SELECT slug FROM public.scholarship_discount_categories WHERE id = ${id} LIMIT 1
    `;
    const slug = String((catRows?.[0] as { slug?: string } | undefined)?.slug ?? "");
    if (!slug) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const used = await sql/* sql */`
      SELECT 1 FROM public.alumni_scholarships WHERE discount_type = ${slug} LIMIT 1
    `;
    if ((used as unknown[]).length > 0) {
      await sql/* sql */`
        UPDATE public.scholarship_discount_categories
        SET is_active = false, updated_at = NOW()
        WHERE id = ${id}
      `;
      await logAdminAction({
        session,
        req,
        input: {
          action: "settings.scholarship_category_delete",
          entityType: "scholarship_categories",
          success: true,
          entityId: id,
          metadata: { slug, deactivated: true },
        },
      });
      return NextResponse.json({ deactivated: true }, { status: 200 });
    }

    await sql/* sql */`
      DELETE FROM public.scholarship_discount_categories WHERE id = ${id}
    `;
    await logAdminAction({
      session,
      req,
      input: {
        action: "settings.scholarship_category_delete",
        entityType: "scholarship_categories",
        success: true,
        entityId: id,
        metadata: { slug, deleted: true },
      },
    });
    return NextResponse.json({ deleted: true }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete category";
    await logAdminAction({
      session: null,
      req,
      input: {
        action: "settings.scholarship_category_delete",
        entityType: "scholarship_categories",
        success: false,
        errorMessage: msg,
      },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
