import { sql } from "@/lib/dbconnect";
import {
  CAMPUS_FACILITY_CONFIG,
  formatMembershipMonthFromDate,
  type CampusFacilityType,
  type CampusMembershipApplicationDetails,
  type CricketHighestPlayingLevel,
  type CricketMembershipCategory,
  type CricketPlayingCategory,
  type CricketPlayingRole,
  type PoolSwimmingLevel,
} from "@/lib/campusMembership";
import type { SavedMembershipDocument } from "@/lib/campusMembershipUpload";

export type CampusMembershipSubmitBody = {
  alumniId: string | number;
  membershipType: string;
  membershipStartDate: string;
  validTill?: string;
  preferredTiming: string;
  medicalConditions?: string;
  allergies?: string;
  physicalDisability?: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactNumber: string;
  declarationAccepted?: boolean;
  poolDetails?: {
    poolLocation?: string;
    swimmingLevel?: PoolSwimmingLevel | "";
    hasMedicalCondition?: "Yes" | "No" | "";
  };
  cricketDetails?: {
    membershipCategory?: CricketMembershipCategory | "";
    playingCategory?: CricketPlayingCategory | "";
    playingRole?: CricketPlayingRole | "";
    previousClub?: string;
    highestPlayingLevel?: CricketHighestPlayingLevel | "";
    injuryHistory?: string;
  };
  documents: {
    alumniCard: SavedMembershipDocument;
    cnic: SavedMembershipDocument;
    medicalFitnessCertificate?: SavedMembershipDocument | null;
    previousClubLetter?: SavedMembershipDocument | null;
  };
};

export async function generateMembershipApplicationRef(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `AM-S-${year}-`;
  const rows = await sql/* sql */`
    SELECT application_ref
    FROM public.alumni_memberships
    WHERE application_ref LIKE ${prefix + "%"}
    ORDER BY id DESC
    LIMIT 1
  `;
  const last = rows[0]?.application_ref as string | undefined;
  let seq = 1;
  if (last) {
    const part = last.slice(prefix.length);
    const n = parseInt(part, 10);
    if (Number.isFinite(n)) seq = n + 1;
  }
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

export function buildApplicationDetails(
  facilityType: CampusFacilityType,
  body: CampusMembershipSubmitBody,
): CampusMembershipApplicationDetails {
  const config = CAMPUS_FACILITY_CONFIG[facilityType];
  return {
    applyingFor: config.applyingFor,
    discountType: config.discountType,
    membershipType: body.membershipType.trim(),
    membershipStartDate: body.membershipStartDate.trim(),
    preferredTiming: body.preferredTiming.trim(),
    medicalConditions: (body.medicalConditions || "").trim(),
    allergies: (body.allergies || "").trim(),
    physicalDisability: (body.physicalDisability || "").trim(),
    emergencyContactName: body.emergencyContactName.trim(),
    emergencyContactRelationship: body.emergencyContactRelationship.trim(),
    emergencyContactNumber: body.emergencyContactNumber.trim(),
    validTill: (body.validTill || "").trim(),
    declarationAccepted: Boolean(body.declarationAccepted),
    poolDetails:
      facilityType === "pool"
        ? {
            poolLocation: (body.poolDetails?.poolLocation || "").trim(),
            swimmingLevel: body.poolDetails?.swimmingLevel || "",
            hasMedicalCondition: body.poolDetails?.hasMedicalCondition || "",
          }
        : undefined,
    cricketDetails:
      facilityType === "cricket"
        ? {
            membershipCategory: body.cricketDetails?.membershipCategory || "",
            playingCategory: body.cricketDetails?.playingCategory || "",
            playingRole: body.cricketDetails?.playingRole || "",
            previousClub: (body.cricketDetails?.previousClub || "").trim(),
            highestPlayingLevel: body.cricketDetails?.highestPlayingLevel || "",
            injuryHistory: (body.cricketDetails?.injuryHistory || "").trim(),
          }
        : undefined,
    documents: {
      alumniCard: body.documents.alumniCard,
      cnic: body.documents.cnic,
      medicalFitnessCertificate: body.documents.medicalFitnessCertificate || null,
      previousClubLetter: body.documents.previousClubLetter || null,
    },
  };
}

export async function insertCampusMembershipApplication(
  facilityType: CampusFacilityType,
  alumniId: number,
  body: CampusMembershipSubmitBody,
): Promise<{ applicationRef: string }> {
  const config = CAMPUS_FACILITY_CONFIG[facilityType];
  const applicationDetails = buildApplicationDetails(facilityType, body);
  const applicationRef = await generateMembershipApplicationRef();
  const monthLabel = formatMembershipMonthFromDate(body.membershipStartDate);
  const startDate = body.membershipStartDate.trim();

  const gymMonth = facilityType === "gym" ? monthLabel : null;
  const poolMonth = facilityType === "pool" ? monthLabel : null;
  const cricketMonth = facilityType === "cricket" ? monthLabel : null;

  await sql/* sql */`
    INSERT INTO public.alumni_memberships (
      alumniid,
      facility_type,
      application_ref,
      discount_type,
      membership_type,
      membership_start_date,
      preferred_timing,
      application_details,
      gym_membership_month,
      swimmingpool_membership_month,
      cricket_membership_month,
      created_at,
      status
    )
    VALUES (
      ${alumniId},
      ${facilityType},
      ${applicationRef},
      ${config.discountType},
      ${body.membershipType.trim()},
      ${startDate}::date,
      ${body.preferredTiming.trim()},
      ${JSON.stringify(applicationDetails)}::jsonb,
      ${gymMonth},
      ${poolMonth},
      ${cricketMonth},
      NOW(),
      'pending'
    )
  `;

  return { applicationRef };
}
