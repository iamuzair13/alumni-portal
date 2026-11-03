import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/dbconnect";
import { isSuperAdminUser } from "@/lib/alumniProfile";
import { logAdminAction } from "@/lib/adminActivityLog";
import {
  normalizeGradeType,
  validateTierRanges,
  type ScholarshipCgpaDiscountTier,
  type ScholarshipGradeType,
} from "@/lib/scholarshipDiscount";

function parseGradeTypeInput(value: unknown): ScholarshipGradeType | null {
  if (value == null || value === "") return null;
  const s = String(value).trim().toLowerCase();
  return s === "cgpa" || s === "percentage" ? s : null;
}

function mapTier(row: Record<string, unknown>): ScholarshipCgpaDiscountTier {
  return {
    id: Number(row.id),
    category_id: Number(row.category_id),
    cgpa_min: Number(row.cgpa_min),
    cgpa_max: Number(row.cgpa_max),
    grade_type: normalizeGradeType(row.grade_type),
    discount_percent: Number(row.discount_percent),
    sort_order: Number(row.sort_order) || 0,
  };
}

async function loadTiersForCategory(categoryId: number): Promise<ScholarshipCgpaDiscountTier[]> {
  const rows = await sql/* sql */`
    SELECT id, category_id, cgpa_min, cgpa_max, grade_type, discount_percent, sort_order
    FROM public.scholarship_cgpa_discount_tiers
    WHERE category_id = ${categoryId}
    ORDER BY sort_order ASC, id ASC
  `;
  return (rows as Record<string, unknown>[]).map(mapTier);
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const categoryId = Number(req.nextUrl.searchParams.get("categoryId"));
    if (!Number.isFinite(categoryId) || categoryId < 1) {
      return NextResponse.json({ error: "categoryId is required" }, { status: 400 });
    }

    const items = await loadTiersForCategory(categoryId);
    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch CGPA tiers";
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
      categoryId?: number;
      cgpaMin?: number;
      cgpaMax?: number;
      gradeType?: string;
      discountPercent?: number;
      sortOrder?: number;
    };

    const categoryId = Number(body.categoryId);
    const cgpaMin = Number(body.cgpaMin);
    const cgpaMax = Number(body.cgpaMax);
    const gradeType = parseGradeTypeInput(body.gradeType) ?? "cgpa";
    const discountPercent = Number(body.discountPercent);
    const sortOrder = Number.isFinite(body.sortOrder as number) ? Number(body.sortOrder) : 0;

    if (!Number.isFinite(categoryId) || categoryId < 1) {
      return NextResponse.json({ error: "categoryId is required" }, { status: 400 });
    }
    if (body.gradeType != null && parseGradeTypeInput(body.gradeType) == null) {
      return NextResponse.json({ error: "gradeType must be cgpa or percentage" }, { status: 400 });
    }
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      return NextResponse.json({ error: "discountPercent must be between 0 and 100" }, { status: 400 });
    }

    const existing = await loadTiersForCategory(categoryId);
    const candidate = { cgpa_min: cgpaMin, cgpa_max: cgpaMax, grade_type: gradeType };
    const overlapErr = validateTierRanges([...existing, candidate]);
    if (overlapErr) {
      return NextResponse.json({ error: overlapErr }, { status: 400 });
    }

    const rows = await sql/* sql */`
      INSERT INTO public.scholarship_cgpa_discount_tiers (
        category_id, cgpa_min, cgpa_max, grade_type, discount_percent, sort_order, updated_at
      )
      VALUES (${categoryId}, ${cgpaMin}, ${cgpaMax}, ${gradeType}, ${discountPercent}, ${sortOrder}, NOW())
      RETURNING id, category_id, cgpa_min, cgpa_max, grade_type, discount_percent, sort_order
    `;

    const created = mapTier((rows?.[0] as Record<string, unknown>) ?? {});
    await logAdminAction({
      session,
      req,
      input: {
        action: "settings.cgpa_tier_create",
        entityType: "scholarship_cgpa_tiers",
        success: true,
        entityId: created.id,
        metadata: { categoryId, cgpaMin, cgpaMax, gradeType, discountPercent },
      },
    });

    return NextResponse.json({ item: created }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create tier";
    await logAdminAction({
      session: null,
      req,
      input: {
        action: "settings.cgpa_tier_create",
        entityType: "scholarship_cgpa_tiers",
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
      cgpaMin?: number;
      cgpaMax?: number;
      gradeType?: string;
      discountPercent?: number;
      sortOrder?: number;
    };

    const id = Number(body.id);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Valid id is required" }, { status: 400 });
    }

    const curRows = await sql/* sql */`
      SELECT id, category_id, cgpa_min, cgpa_max, grade_type, discount_percent, sort_order
      FROM public.scholarship_cgpa_discount_tiers
      WHERE id = ${id}
      LIMIT 1
    `;
    const cur = (curRows?.[0] as Record<string, unknown> | undefined) ?? null;
    if (!cur) {
      return NextResponse.json({ error: "Tier not found" }, { status: 404 });
    }

    const categoryId = Number(cur.category_id);
    const cgpaMin = body.cgpaMin !== undefined ? Number(body.cgpaMin) : Number(cur.cgpa_min);
    const cgpaMax = body.cgpaMax !== undefined ? Number(body.cgpaMax) : Number(cur.cgpa_max);
    const gradeType =
      body.gradeType !== undefined
        ? parseGradeTypeInput(body.gradeType)
        : normalizeGradeType(cur.grade_type);
    if (gradeType == null) {
      return NextResponse.json({ error: "gradeType must be cgpa or percentage" }, { status: 400 });
    }
    const discountPercent =
      body.discountPercent !== undefined ? Number(body.discountPercent) : Number(cur.discount_percent);
    const sortOrder =
      body.sortOrder !== undefined
        ? Number.isFinite(body.sortOrder as number)
          ? Number(body.sortOrder)
          : Number(cur.sort_order)
        : Number(cur.sort_order);

    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      return NextResponse.json({ error: "discountPercent must be between 0 and 100" }, { status: 400 });
    }

    const existing = await loadTiersForCategory(categoryId);
    const others = existing.filter((t) => t.id !== id);
    const overlapErr = validateTierRanges([...others, { id, cgpa_min: cgpaMin, cgpa_max: cgpaMax, grade_type: gradeType }]);
    if (overlapErr) {
      return NextResponse.json({ error: overlapErr }, { status: 400 });
    }

    const rows = await sql/* sql */`
      UPDATE public.scholarship_cgpa_discount_tiers
      SET
        cgpa_min = ${cgpaMin},
        cgpa_max = ${cgpaMax},
        grade_type = ${gradeType},
        discount_percent = ${discountPercent},
        sort_order = ${sortOrder},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, category_id, cgpa_min, cgpa_max, grade_type, discount_percent, sort_order
    `;

    const updated = mapTier((rows?.[0] as Record<string, unknown>) ?? {});
    await logAdminAction({
      session,
      req,
      input: {
        action: "settings.cgpa_tier_update",
        entityType: "scholarship_cgpa_tiers",
        success: true,
        entityId: id,
        metadata: { cgpaMin, cgpaMax, gradeType, discountPercent },
      },
    });

    return NextResponse.json({ item: updated }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update tier";
    await logAdminAction({
      session: null,
      req,
      input: {
        action: "settings.cgpa_tier_update",
        entityType: "scholarship_cgpa_tiers",
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

    await sql/* sql */`
      DELETE FROM public.scholarship_cgpa_discount_tiers WHERE id = ${id}
    `;
    await logAdminAction({
      session,
      req,
      input: {
        action: "settings.cgpa_tier_delete",
        entityType: "scholarship_cgpa_tiers",
        success: true,
        entityId: id,
      },
    });
    return NextResponse.json({ deleted: true }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete tier";
    await logAdminAction({
      session: null,
      req,
      input: {
        action: "settings.cgpa_tier_delete",
        entityType: "scholarship_cgpa_tiers",
        success: false,
        errorMessage: msg,
      },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
