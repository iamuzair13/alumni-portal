import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/alumniProfile";
import {
  getAllMembershipSettings,
  isValidDiscountBasis,
  type MembershipFacilityType,
} from "@/lib/membershipSettings";
import { type MembershipDiscountBasis } from "@/lib/membershipSettingsShared";

const FACILITY_TYPES: MembershipFacilityType[] = ["gym", "pool", "cricket"];

function isValidFacilityType(value: unknown): value is MembershipFacilityType {
  return FACILITY_TYPES.includes(value as MembershipFacilityType);
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const items = await getAllMembershipSettings();
    return NextResponse.json({ items });
  } catch (err) {
    if (err instanceof Error && err.message.includes("does not exist")) {
      return NextResponse.json({
        items: FACILITY_TYPES.map((facilityType) => ({
          id: 0,
          facilityType,
          discountBasis: "same_as_staff_student",
          paymentAmount: 0,
          discountPct: 0,
          updatedAt: null,
          updatedBy: null,
        })),
      });
    }
    const msg = err instanceof Error ? err.message : "Failed to fetch settings";
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
      facilityType?: string;
      discountBasis?: string;
      paymentAmount?: number;
      discountPct?: number;
    };

    const facilityType = String(body.facilityType || "").trim();
    if (!isValidFacilityType(facilityType)) {
      return NextResponse.json(
        { error: "Invalid membership type" },
        { status: 400 },
      );
    }

    const basis = String(body.discountBasis || "same_as_staff_student").trim();
    if (!isValidDiscountBasis(basis)) {
      return NextResponse.json(
        { error: "Invalid discount basis" },
        { status: 400 },
      );
    }

    const paymentAmount = Number(body.paymentAmount ?? 0);
    if (!Number.isFinite(paymentAmount) || paymentAmount < 0) {
      return NextResponse.json(
        { error: "Payment amount must be a non-negative integer" },
        { status: 400 },
      );
    }

    const discountPct = Number(body.discountPct ?? 0);
    if (!Number.isFinite(discountPct) || discountPct < 1 || discountPct > 100) {
      return NextResponse.json(
        { error: "Discount percent must be between 1 and 100" },
        { status: 400 },
      );
    }

    const userId = (session.user as { id?: number })?.id || null;

    await sql/* sql */`
      INSERT INTO public.membership_settings (
        facility_type, discount_basis, payment_amount, discount_pct, updated_at, updated_by
      )
      VALUES (
        ${facilityType},
        ${basis as MembershipDiscountBasis},
        ${paymentAmount},
        ${discountPct},
        NOW(),
        ${userId}
      )
      ON CONFLICT (facility_type) DO UPDATE SET
        discount_basis = EXCLUDED.discount_basis,
        payment_amount = EXCLUDED.payment_amount,
        discount_pct   = EXCLUDED.discount_pct,
        updated_at     = EXCLUDED.updated_at,
        updated_by     = EXCLUDED.updated_by
    `;

    return NextResponse.json({
      success: true,
      message: "Membership settings updated successfully",
      facilityType,
      discountBasis: basis,
      paymentAmount,
      discountPct,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update settings";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return PUT(req);
}
