import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/dbconnect";
import { isSuperAdminUser } from "@/lib/alumniProfile";
import {
  validateTierRanges,
  type ScholarshipCgpaDiscountTier,
} from "@/lib/scholarshipDiscount";

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

async function loadTiersForCategory(categoryId: number): Promise<ScholarshipCgpaDiscountTier[]> {
  const rows = await sql/* sql */`
    SELECT id, category_id, cgpa_min, cgpa_max, discount_percent, sort_order
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
      discountPercent?: number;
      sortOrder?: number;
    };

    const categoryId = Number(body.categoryId);
    const cgpaMin = Number(body.cgpaMin);
    const cgpaMax = Number(body.cgpaMax);
    const discountPercent = Number(body.discountPercent);
    const sortOrder = Number.isFinite(body.sortOrder as number) ? Number(body.sortOrder) : 0;

    if (!Number.isFinite(categoryId) || categoryId < 1) {
      return NextResponse.json({ error: "categoryId is required" }, { status: 400 });
    }
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      return NextResponse.json({ error: "discountPercent must be between 0 and 100" }, { status: 400 });
    }

    const existing = await loadTiersForCategory(categoryId);
    const candidate = { cgpa_min: cgpaMin, cgpa_max: cgpaMax };
    const overlapErr = validateTierRanges([...existing, candidate]);
    if (overlapErr) {
      return NextResponse.json({ error: overlapErr }, { status: 400 });
    }

    const rows = await sql/* sql */`
      INSERT INTO public.scholarship_cgpa_discount_tiers (
        category_id, cgpa_min, cgpa_max, discount_percent, sort_order, updated_at
      )
      VALUES (${categoryId}, ${cgpaMin}, ${cgpaMax}, ${discountPercent}, ${sortOrder}, NOW())
      RETURNING id, category_id, cgpa_min, cgpa_max, discount_percent, sort_order
    `;

    return NextResponse.json({ item: mapTier((rows?.[0] as Record<string, unknown>) ?? {}) }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create tier";
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
      discountPercent?: number;
      sortOrder?: number;
    };

    const id = Number(body.id);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Valid id is required" }, { status: 400 });
    }

    const curRows = await sql/* sql */`
      SELECT id, category_id, cgpa_min, cgpa_max, discount_percent, sort_order
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
    const overlapErr = validateTierRanges([...others, { id, cgpa_min: cgpaMin, cgpa_max: cgpaMax }]);
    if (overlapErr) {
      return NextResponse.json({ error: overlapErr }, { status: 400 });
    }

    const rows = await sql/* sql */`
      UPDATE public.scholarship_cgpa_discount_tiers
      SET
        cgpa_min = ${cgpaMin},
        cgpa_max = ${cgpaMax},
        discount_percent = ${discountPercent},
        sort_order = ${sortOrder},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, category_id, cgpa_min, cgpa_max, discount_percent, sort_order
    `;

    return NextResponse.json({ item: mapTier((rows?.[0] as Record<string, unknown>) ?? {}) }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update tier";
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
    return NextResponse.json({ deleted: true }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete tier";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
