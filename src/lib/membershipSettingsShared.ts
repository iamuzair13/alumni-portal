export type MembershipFacilityType = "gym" | "pool" | "cricket";

export type MembershipDiscountBasis =
  | "same_as_staff_student"
  | "fifty_percent_outsiders";

export const MEMBERSHIP_FACILITY_OPTIONS: {
  value: MembershipFacilityType;
  label: string;
  note?: string;
}[] = [
  { value: "gym", label: "Gym Membership", note: "Including 1000/- registration fee" },
  { value: "pool", label: "Swimming Pool Membership" },
  { value: "cricket", label: "Qalander Club Membership" },
];

export function membershipFacilityNote(
  facilityType: MembershipFacilityType | string | null | undefined,
): string | null {
  const key = String(facilityType || "").trim();
  return MEMBERSHIP_FACILITY_OPTIONS.find((opt) => opt.value === key)?.note ?? null;
}

export const DISCOUNT_BASIS_OPTIONS: {
  value: MembershipDiscountBasis;
  label: string;
}[] = [
  {
    value: "same_as_staff_student",
    label: "Same % discount as offered to UOL Staff",
  },
  {
    value: "fifty_percent_outsiders",
    label: "50% discount on rate for outsiders",
  },
];

export function membershipDiscountBasisLabel(
  basis: MembershipDiscountBasis | string | null | undefined,
): string {
  const key = String(basis || "").trim();
  if (key === "same_as_staff_student" || key === "fifty_percent_outsiders") {
    return DISCOUNT_BASIS_OPTIONS.find((opt) => opt.value === key)?.label ?? key;
  }
  return String(basis || "—");
}
