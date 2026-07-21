export type MembershipFacilityType = "gym" | "pool" | "cricket";

export type MembershipDiscountBasis =
  | "same_as_staff_student"
  | "fifty_percent_outsiders";

export const MEMBERSHIP_FACILITY_OPTIONS: {
  value: MembershipFacilityType;
  label: string;
}[] = [
  { value: "gym", label: "Gym Membership" },
  { value: "pool", label: "Swimming Pool Membership" },
  { value: "cricket", label: "Qalander Club Membership" },
];

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
