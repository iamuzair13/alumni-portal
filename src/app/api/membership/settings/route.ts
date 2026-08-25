import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/alumniProfile";
import { logAdminAction } from "@/lib/adminActivityLog";
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
          originalPayment: 0,
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
      originalPayment?: number;
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

    const originalPayment = Number(body.originalPayment ?? 0);
    if (!Number.isFinite(originalPayment) || originalPayment < 0 || !Number.isInteger(originalPayment)) {
      return NextResponse.json(
        { error: "Original payment must be a non-negative integer" },
        { status: 400 },
      );
    }

    const discountPct = Number(body.discountPct ?? 0);
    if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > 100 || !Number.isInteger(discountPct)) {
      return NextResponse.json(
        { error: "Discount percent must be an integer between 0 and 100" },
        { status: 400 },
      );
    }

    const paymentAmount = Math.round((originalPayment * (100 - discountPct)) / 100);

    const userId = (session.user as { id?: number })?.id || null;

    await sql/* sql */`
      INSERT INTO public.membership_settings (
        facility_type, discount_basis, original_payment, payment_amount, discount_pct, updated_at, updated_by
      )
      VALUES (
        ${facilityType},
        ${basis as MembershipDiscountBasis},
        ${originalPayment},
        ${paymentAmount},
        ${discountPct},
        NOW(),
        ${userId}
      )
      ON CONFLICT (facility_type) DO UPDATE SET
        discount_basis   = EXCLUDED.discount_basis,
        original_payment = EXCLUDED.original_payment,
        payment_amount   = EXCLUDED.payment_amount,
        discount_pct     = EXCLUDED.discount_pct,
        updated_at       = EXCLUDED.updated_at,
        updated_by       = EXCLUDED.updated_by
    `;

    await logAdminAction({
      session,
      req,
      input: {
        action: "settings.membership_update",
        entityType: "membership_settings",
        success: true,
        metadata: { facilityType, discountBasis: basis, originalPayment, paymentAmount, discountPct },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Membership settings updated successfully",
      facilityType,
      discountBasis: basis,
      originalPayment,
      paymentAmount,
      discountPct,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update settings";
    await logAdminAction({
      session: null,
      req,
      input: {
        action: "settings.membership_update",
        entityType: "membership_settings",
        success: false,
        errorMessage: msg,
      },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return PUT(req);
}
