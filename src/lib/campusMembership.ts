export type CampusFacilityType = "gym" | "pool" | "cricket";

export type MembershipDocument = {
  label: string;
  url: string;
  filename: string;
  type: string;
  size: number;
};

export type PoolSwimmingLevel = "Beginner" | "Intermediate" | "Advanced";
export type CricketMembershipCategory = "Alumni";
export type CricketPlayingCategory = "Junior" | "Senior";
export type CricketPlayingRole =
  | "Batsman"
  | "Bowler"
  | "All-Rounder"
  | "Wicket Keeper";
export type CricketHighestPlayingLevel =
  | "School"
  | "College"
  | "University"
  | "Club"
  | "District"
  | "National";

export type CampusMembershipApplicationDetails = {
  applyingFor: string;
  discountType: string;
  membershipType: string;
  membershipStartDate: string;
  preferredTiming: string;
  medicalConditions: string;
  allergies: string;
  physicalDisability: string;
  physicalDisabilityDetails: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactNumber: string;
  validTill?: string;
  declarationAccepted?: boolean;
  poolDetails?: {
    poolLocation: string;
    swimmingLevel: PoolSwimmingLevel | "";
    hasMedicalCondition: "Yes" | "No" | "";
  };
  cricketDetails?: {
    membershipCategory: CricketMembershipCategory | "";
    playingCategory: CricketPlayingCategory | "";
    playingRole: CricketPlayingRole | "";
    previousClub: string;
    highestPlayingLevel: CricketHighestPlayingLevel | "";
    injuryHistory: string;
  };
  documents: {
    alumniCard: MembershipDocument | null;
    cnic: MembershipDocument | null;
    medicalFitnessCertificate?: MembershipDocument | null;
    previousClubLetter?: MembershipDocument | null;
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
  { value: "Semi Annual", label: "Semi Annual" },
  { value: "Annual", label: "Annual" },
] as const;

export const PREFERRED_TIMING_OPTIONS = [
  { value: "Morning", label: "Morning" },
  { value: "Evening", label: "Evening" },
] as const;

export const SWIMMING_LEVEL_OPTIONS = [
  { value: "Beginner", label: "Beginner" },
  { value: "Intermediate", label: "Intermediate" },
  { value: "Advanced", label: "Advanced" },
] as const;

export const MEDICAL_CONDITION_OPTIONS = [
  { value: "Yes", label: "Yes" },
  { value: "No", label: "No" },
] as const;

export const CRICKET_MEMBERSHIP_CATEGORY_OPTIONS = [
  { value: "Alumni", label: "Alumni" },
] as const;

export const CRICKET_PLAYING_CATEGORY_OPTIONS = [
  { value: "Junior", label: "Junior" },
  { value: "Senior", label: "Senior" },
] as const;

export const CRICKET_PLAYING_ROLE_OPTIONS = [
  { value: "Batsman", label: "Batsman" },
  { value: "Bowler", label: "Bowler" },
  { value: "All-Rounder", label: "All-Rounder" },
  { value: "Wicket Keeper", label: "Wicket Keeper" },
] as const;

export const CRICKET_HIGHEST_PLAYING_LEVEL_OPTIONS = [
  { value: "School", label: "School" },
  { value: "College", label: "College" },
  { value: "University", label: "University" },
  { value: "Club", label: "Club" },
  { value: "District", label: "District" },
  { value: "National", label: "National" },
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
