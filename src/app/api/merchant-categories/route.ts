import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/dbconnect";
import { isAdminUser, isSuperAdminUser } from "@/lib/alumniProfile";
import { logAdminAction } from "@/lib/adminActivityLog";
import { slugifyCategoryName } from "@/lib/merchantCategorySlug";

export type MerchantCategory = {
  id: number;
  name: string;
  slug: string;
  color: string;
  merchant_count: number;
  created_at: string;
  updated_at: string;
};

type CategoryBody = {
  id?: number;
  name?: string;
  color?: string;
};

const CATEGORY_COLORS = new Set([
  "#EA580C", "#7C3AED", "#0D9488", "#059669", "#2563EB",
  "#DB2777", "#CA8A04", "#DC2626", "#4F46E5", "#64748B",
]);

function mapCategory(row: Record<string, unknown>): MerchantCategory {
  return {
    id: Number(row.id),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    color: String(row.color ?? "#64748B"),
    merchant_count: Number(row.merchant_count ?? 0),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function normalizeColor(raw: unknown): string | null {
  const c = String(raw ?? "").trim();
  if (c === "") return "#64748B";
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c.toUpperCase() : null;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await sql/* sql */`
      SELECT c.id, c.name, c.slug, c.color, c.created_at, c.updated_at,
             (SELECT COUNT(*) FROM public.merchant_category_map m
              WHERE m.category_id = c.id) AS merchant_count
      FROM public.merchant_categories c
      ORDER BY c.name ASC
    `;

    const items = (rows as Record<string, unknown>[]).map(mapCategory);
    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch categories";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminUser(session.user) && !isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as CategoryBody;
    const name = String(body.name ?? "").trim();
    const color = normalizeColor(body.color);

    if (!name || name.length < 2) {
      return NextResponse.json({ error: "Category name must be at least 2 characters" }, { status: 400 });
    }
    if (name.length > 100) {
      return NextResponse.json({ error: "Category name must be 100 characters or fewer" }, { status: 400 });
    }
    if (color === null) {
      return NextResponse.json({ error: "Invalid color. Expected a hex value like #EA580C." }, { status: 400 });
    }
    if (!CATEGORY_COLORS.has(color)) {
      return NextResponse.json({ error: "Color must be one of the allowed palette values" }, { status: 400 });
    }

    const slug = slugifyCategoryName(name);
    if (!slug) {
      return NextResponse.json({ error: "Category name must contain letters or numbers" }, { status: 400 });
    }

    const dup = await sql/* sql */`
      SELECT id FROM public.merchant_categories
      WHERE LOWER(name) = LOWER(${name}) OR slug = ${slug}
      LIMIT 1
    `;
    if ((dup as unknown[]).length > 0) {
      return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
    }

    const rows = await sql/* sql */`
      INSERT INTO public.merchant_categories (name, slug, color, updated_at)
      VALUES (${name}, ${slug}, ${color}, NOW())
      RETURNING id, name, slug, color, created_at, updated_at, 0 AS merchant_count
    `;

    const created = mapCategory((rows?.[0] as Record<string, unknown>) ?? {});
    await logAdminAction({
      session,
      req,
      input: {
        action: "merchant_categories.create",
        entityType: "merchant_categories",
        success: true,
        entityId: created.id,
        metadata: { name, slug },
      },
    });

    return NextResponse.json({ item: created }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create category";
    await logAdminAction({
      session: null,
      req,
      input: {
        action: "merchant_categories.create",
        entityType: "merchant_categories",
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
    if (!isAdminUser(session.user) && !isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as CategoryBody;
    const id = Number(body.id);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Valid id is required" }, { status: 400 });
    }

    const existing = await sql/* sql */`
      SELECT id, name, slug, color FROM public.merchant_categories WHERE id = ${id} LIMIT 1
    `;
    const cur = (existing?.[0] as Record<string, unknown> | undefined) ?? null;
    if (!cur) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const name = body.name !== undefined ? String(body.name).trim() : String(cur.name);
    const color = body.color !== undefined ? normalizeColor(body.color) : String(cur.color);

    if (!name || name.length < 2) {
      return NextResponse.json({ error: "Category name must be at least 2 characters" }, { status: 400 });
    }
    if (name.length > 100) {
      return NextResponse.json({ error: "Category name must be 100 characters or fewer" }, { status: 400 });
    }
    if (color === null || !CATEGORY_COLORS.has(color)) {
      return NextResponse.json({ error: "Color must be one of the allowed palette values" }, { status: 400 });
    }

    const slug = slugifyCategoryName(name);
    if (!slug) {
      return NextResponse.json({ error: "Category name must contain letters or numbers" }, { status: 400 });
    }

    const dup = await sql/* sql */`
      SELECT id FROM public.merchant_categories
      WHERE (LOWER(name) = LOWER(${name}) OR slug = ${slug}) AND id <> ${id}
      LIMIT 1
    `;
    if ((dup as unknown[]).length > 0) {
      return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
    }

    const rows = await sql/* sql */`
      UPDATE public.merchant_categories
      SET name = ${name}, slug = ${slug}, color = ${color}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, name, slug, color, created_at, updated_at,
                (SELECT COUNT(*) FROM public.merchant_category_map m
                 WHERE m.category_id = ${id}) AS merchant_count
    `;

    const updated = mapCategory((rows?.[0] as Record<string, unknown>) ?? {});
    await logAdminAction({
      session,
      req,
      input: {
        action: "merchant_categories.update",
        entityType: "merchant_categories",
        success: true,
        entityId: id,
        metadata: { name, slug },
      },
    });

    return NextResponse.json({ item: updated }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update category";
    await logAdminAction({
      session: null,
      req,
      input: {
        action: "merchant_categories.update",
        entityType: "merchant_categories",
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
    if (!isAdminUser(session.user) && !isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Valid id is required" }, { status: 400 });
    }

    const existing = await sql/* sql */`
      SELECT id, name FROM public.merchant_categories WHERE id = ${id} LIMIT 1
    `;
    const cur = (existing?.[0] as Record<string, unknown> | undefined) ?? null;
    if (!cur) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    await sql/* sql */`DELETE FROM public.merchant_categories WHERE id = ${id}`;
    await logAdminAction({
      session,
      req,
      input: {
        action: "merchant_categories.delete",
        entityType: "merchant_categories",
        success: true,
        entityId: id,
        metadata: { name: String(cur.name ?? "") },
      },
    });
    return NextResponse.json({ deleted: true }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete category";
    await logAdminAction({
      session: null,
      req,
      input: {
        action: "merchant_categories.delete",
        entityType: "merchant_categories",
        success: false,
        errorMessage: msg,
      },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
