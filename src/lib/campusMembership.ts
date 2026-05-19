export type CampusFacilityType = "gym" | "pool" | "cricket";

export type CampusMembershipApplicationDetails = {
  applyingFor: string;
  discountType: string;
  membershipType: string;
  membershipStartDate: string;
  preferredTiming: string;
  medicalConditions: string;
  allergies: string;
  physicalDisability: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactNumber: string;
  documents: {
    alumniCard: {
      label: string;
      url: string;
      filename: string;
      type: string;
      size: number;
    } | null;
    cnic: {
      label: string;
      url: string;
      filename: string;
      type: string;
      size: number;
    } | null;
  };
};

export type CampusFacilityConfig = {
  facilityType: CampusFacilityType;
  applyingFor: string;
  discountType: string;
  pageTitle: string;
  formHeading: string;
  formDescription: string;
  submitApiPath: string;
  emailKind: "gym" | "pool" | "cricket";
};

export const CAMPUS_FACILITY_CONFIG: Record<CampusFacilityType, CampusFacilityConfig> = {
  gym: {
    facilityType: "gym",
    applyingFor: "Gym",
    discountType: "Gym 50%",
    pageTitle: "Gym Membership Application",
    formHeading: " ",
    formDescription:
      "Apply for UOL Gym membership. Alumni are eligible for special facility discounts.",
    submitApiPath: "/api/alumni/gym-membership",
    emailKind: "gym",
  },
  pool: {
    facilityType: "pool",
    applyingFor: "Pool",
    discountType: "Pool 50%",
    pageTitle: "Swimming Pool Membership Application",
    formHeading: " ",
    formDescription:
      "Apply for UOL Swimming Pool membership. Alumni are eligible for special facility discounts.",
    submitApiPath: "/api/alumni/swimming-pool-membership",
    emailKind: "pool",
  },
  cricket: {
    facilityType: "cricket",
    applyingFor: "Cricket Club",
    discountType: "Cricket Club 50%",
    pageTitle: "UOL Qalandars Cricket Club Membership",
    formHeading: " ",
    formDescription:
      "Apply for UOL Qalandars Cricket Club membership. Alumni are eligible for special facility discounts.",
    submitApiPath: "/api/alumni/cricket-membership",
    emailKind: "cricket",
  },
};

export const MEMBERSHIP_TYPE_OPTIONS = [
  { value: "Monthly", label: "Monthly" },
  { value: "Quarterly", label: "Quarterly" },
  { value: "Half-Yearly", label: "Half-Yearly" },
] as const;

export const PREFERRED_TIMING_OPTIONS = [
  { value: "Morning", label: "Morning" },
  { value: "Evening", label: "Evening" },
] as const;

export function formatMembershipMonthFromDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}
