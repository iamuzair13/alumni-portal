import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/dbconnect";
import { isAdminUser, isSuperAdminUser } from "@/lib/alumniProfile";
import { logAdminAction } from "@/lib/adminActivityLog";

export type Merchant = {
  id: number;
  business_name: string;
  discount_type: string;
  start_date: string;
  end_date: string;
  discount_pct: number;
  status: "active" | "expired";
  created_at: string;
  updated_at: string;
};

function toISODate(value: unknown): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(String(value));
  if (isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function mapMerchant(row: Record<string, unknown>): Merchant {
  const endDateStr = toISODate(row.end_date);
  const endDate = endDateStr ? new Date(endDateStr + "T00:00:00") : null;
  const isExpiredByDate = endDate ? endDate < new Date(new Date().toDateString()) : false;
  const rawStatus = String(row.status ?? "active");
  const status: "active" | "expired" =
    rawStatus === "expired" || isExpiredByDate ? "expired" : "active";

  return {
    id: Number(row.id),
    business_name: String(row.business_name ?? ""),
    discount_type: String(row.discount_type ?? ""),
    start_date: toISODate(row.start_date),
    end_date: endDateStr,
    discount_pct: Number(row.discount_pct ?? 0),
    status,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await sql/* sql */`
      SELECT id, business_name, discount_type, start_date, end_date,
             discount_pct, status, created_at, updated_at
      FROM public.merchants
      ORDER BY created_at DESC, id DESC
    `;

    const items = (rows as Record<string, unknown>[]).map(mapMerchant);
    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch merchants";
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

    const body = (await req.json().catch(() => ({}))) as {
      businessName?: string;
      discountType?: string;
      startDate?: string;
      endDate?: string;
      discountPct?: number;
      status?: string;
    };

    const businessName = String(body.businessName ?? "").trim();
    const discountType = String(body.discountType ?? "").trim();
    const startDate = String(body.startDate ?? "").trim();
    const endDate = String(body.endDate ?? "").trim();
    const discountPct = Number(body.discountPct ?? 0);
    const endDateObj = endDate ? new Date(endDate) : null;
    const isExpiredByDate = endDateObj ? endDateObj < new Date(new Date().toDateString()) : false;
    const rawStatus = body.status === "expired" ? "expired" : "active";
    const status = isExpiredByDate ? "expired" : rawStatus;

    if (!businessName || businessName.length < 2) {
      return NextResponse.json({ error: "Business name must be at least 2 characters" }, { status: 400 });
    }
    if (!discountType) {
      return NextResponse.json({ error: "Discount type is required" }, { status: 400 });
    }
    if (!startDate) {
      return NextResponse.json({ error: "Start date is required" }, { status: 400 });
    }
    if (!endDate) {
      return NextResponse.json({ error: "End date is required" }, { status: 400 });
    }
    if (new Date(endDate) < new Date(startDate)) {
      return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
    }
    if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > 100) {
      return NextResponse.json({ error: "Discount must be between 0 and 100" }, { status: 400 });
    }

    const rows = await sql/* sql */`
      INSERT INTO public.merchants (
        business_name, discount_type, start_date, end_date, discount_pct, status, updated_at
      )
      VALUES (
        ${businessName}, ${discountType}, ${startDate}::date, ${endDate}::date,
        ${discountPct}, ${status}, NOW()
      )
      RETURNING id, business_name, discount_type, start_date, end_date,
                discount_pct, status, created_at, updated_at
    `;

    const created = mapMerchant((rows?.[0] as Record<string, unknown>) ?? {});
    await logAdminAction({
      session,
      req,
      input: {
        action: "merchants.create",
        entityType: "merchants",
        success: true,
        entityId: created.id,
        metadata: { businessName, discountType },
      },
    });

    return NextResponse.json(
      { item: created },
      { status: 201 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create merchant";
    await logAdminAction({
      session: null,
      req,
      input: {
        action: "merchants.create",
        entityType: "merchants",
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

    const body = (await req.json().catch(() => ({}))) as {
      id?: number;
      businessName?: string;
      discountType?: string;
      startDate?: string;
      endDate?: string;
      discountPct?: number;
      status?: string;
    };

    const id = Number(body.id);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Valid id is required" }, { status: 400 });
    }

    const existing = await sql/* sql */`
      SELECT id, business_name, discount_type, start_date, end_date,
             discount_pct, status
      FROM public.merchants WHERE id = ${id} LIMIT 1
    `;
    const cur = (existing?.[0] as Record<string, unknown> | undefined) ?? null;
    if (!cur) {
      return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
    }

    const businessName = body.businessName !== undefined
      ? String(body.businessName).trim()
      : String(cur.business_name);
    const discountType = body.discountType !== undefined
      ? String(body.discountType).trim()
      : String(cur.discount_type);
    const startDate = body.startDate !== undefined
      ? String(body.startDate).trim()
      : toISODate(cur.start_date);
    const endDate = body.endDate !== undefined
      ? String(body.endDate).trim()
      : toISODate(cur.end_date);
    const discountPct = body.discountPct !== undefined
      ? Number(body.discountPct)
      : Number(cur.discount_pct);

    const endDateObj = endDate ? new Date(endDate) : null;
    const isExpiredByDate = endDateObj ? endDateObj < new Date(new Date().toDateString()) : false;
    const rawStatus = body.status === "expired" ? "expired" : body.status === "active" ? "active" : String(cur.status);
    const status = isExpiredByDate ? "expired" : rawStatus;

    if (!businessName || businessName.length < 2) {
      return NextResponse.json({ error: "Business name must be at least 2 characters" }, { status: 400 });
    }
    if (!discountType) {
      return NextResponse.json({ error: "Discount type is required" }, { status: 400 });
    }
    if (new Date(endDate) < new Date(startDate)) {
      return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
    }
    if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > 100) {
      return NextResponse.json({ error: "Discount must be between 0 and 100" }, { status: 400 });
    }

    const rows = await sql/* sql */`
      UPDATE public.merchants
      SET
        business_name = ${businessName},
        discount_type = ${discountType},
        start_date    = ${startDate}::date,
        end_date      = ${endDate}::date,
        discount_pct  = ${discountPct},
        status        = ${status},
        updated_at    = NOW()
      WHERE id = ${id}
      RETURNING id, business_name, discount_type, start_date, end_date,
                discount_pct, status, created_at, updated_at
    `;

    const updated = mapMerchant((rows?.[0] as Record<string, unknown>) ?? {});
    await logAdminAction({
      session,
      req,
      input: {
        action: "merchants.update",
        entityType: "merchants",
        success: true,
        entityId: id,
        metadata: { businessName, discountType },
      },
    });

    return NextResponse.json(
      { item: updated },
      { status: 200 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update merchant";
    await logAdminAction({
      session: null,
      req,
      input: {
        action: "merchants.update",
        entityType: "merchants",
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
      SELECT id FROM public.merchants WHERE id = ${id} LIMIT 1
    `;
    if ((existing as unknown[]).length === 0) {
      return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
    }

    await sql/* sql */`DELETE FROM public.merchants WHERE id = ${id}`;
    await logAdminAction({
      session,
      req,
      input: {
        action: "merchants.delete",
        entityType: "merchants",
        success: true,
        entityId: id,
      },
    });
    return NextResponse.json({ deleted: true }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete merchant";
    await logAdminAction({
      session: null,
      req,
      input: {
        action: "merchants.delete",
        entityType: "merchants",
        success: false,
        errorMessage: msg,
      },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
