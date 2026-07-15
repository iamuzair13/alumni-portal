import { sql } from "@/lib/dbconnect";
import {
  type MembershipDiscountBasis,
  type MembershipFacilityType,
  membershipDiscountBasisLabel,
} from "@/lib/membershipSettingsShared";

export type { MembershipFacilityType };

export type MembershipSettings = {
  id: number;
  facilityType: MembershipFacilityType;
  discountBasis: MembershipDiscountBasis;
  paymentAmount: number;
  originalPayment: number;
  discountPct: number;
  updatedAt: string | null;
  updatedBy: number | null;
};

export { membershipDiscountBasisLabel };

const FACILITY_TYPES: MembershipFacilityType[] = ["gym", "pool", "cricket"];

function isValidFacilityType(value: unknown): value is MembershipFacilityType {
  return FACILITY_TYPES.includes(value as MembershipFacilityType);
}

function calculatePaymentAmount(
  originalPayment: number,
  discountPct: number,
  storedPaymentAmount: number,
): number {
  const original = Number(originalPayment) || 0;
  const discount = Number(discountPct) || 0;
  if (original > 0 && discount >= 0 && discount <= 100) {
    return Math.round((original * (100 - discount)) / 100);
  }
  if (original > 0) {
    return original;
  }
  return Number(storedPaymentAmount) || 0;
}

function mapRow(row: Record<string, unknown>): MembershipSettings {
  const facilityType = isValidFacilityType(row.facility_type)
    ? row.facility_type
    : "gym";
  const basis = String(row.discount_basis || "same_as_staff_student").trim();
  const originalPayment = Number(row.original_payment ?? 0);
  const discountPct = Number(row.discount_pct ?? 0);
  return {
    id: Number(row.id ?? 0),
    facilityType,
    discountBasis:
      basis === "fifty_percent_outsiders"
        ? "fifty_percent_outsiders"
        : "same_as_staff_student",
    originalPayment,
    paymentAmount: calculatePaymentAmount(
      originalPayment,
      discountPct,
      Number(row.payment_amount ?? 0),
    ),
    discountPct,
    updatedAt: row.updated_at ? String(row.updated_at) : null,
    updatedBy: row.updated_by ? Number(row.updated_by) : null,
  };
}

export async function getMembershipSettingsByFacilityType(
  facilityType: MembershipFacilityType,
): Promise<MembershipSettings> {
  try {
    const rows = await sql/* sql */`
      SELECT id, facility_type, discount_basis, payment_amount, original_payment, discount_pct, updated_at, updated_by
      FROM public.membership_settings
      WHERE facility_type = ${facilityType}
      LIMIT 1
    `;
    const row = rows?.[0] as Record<string, unknown> | undefined;
    if (!row) {
      return {
        id: 0,
        facilityType,
        discountBasis: "same_as_staff_student",
        paymentAmount: 0,
        originalPayment: 0,
        discountPct: 0,
        updatedAt: null,
        updatedBy: null,
      };
    }
    return mapRow(row);
  } catch {
    return {
      id: 0,
      facilityType,
      discountBasis: "same_as_staff_student",
      paymentAmount: 0,
      originalPayment: 0,
      discountPct: 0,
      updatedAt: null,
      updatedBy: null,
    };
  }
}

export async function getAllMembershipSettings(): Promise<MembershipSettings[]> {
  try {
    const rows = await sql/* sql */`
      SELECT id, facility_type, discount_basis, payment_amount, original_payment, discount_pct, updated_at, updated_by
      FROM public.membership_settings
      ORDER BY facility_type
    `;
    const items = (rows ?? []) as Record<string, unknown>[];
    if (items.length === 0) {
      return FACILITY_TYPES.map((facilityType) => ({
        id: 0,
        facilityType,
        discountBasis: "same_as_staff_student" as MembershipDiscountBasis,
        paymentAmount: 0,
        originalPayment: 0,
        discountPct: 0,
        updatedAt: null,
        updatedBy: null,
      }));
    }
    return items.map(mapRow);
  } catch {
    return FACILITY_TYPES.map((facilityType) => ({
      id: 0,
      facilityType,
      discountBasis: "same_as_staff_student" as MembershipDiscountBasis,
      paymentAmount: 0,
      originalPayment: 0,
      discountPct: 0,
      updatedAt: null,
      updatedBy: null,
    }));
  }
}

export function isValidDiscountBasis(
  value: unknown,
): value is MembershipDiscountBasis {
  return (
    value === "same_as_staff_student" || value === "fifty_percent_outsiders"
  );
}
