import { sql } from "@/lib/dbconnect";
import {
  CAMPUS_FACILITY_CONFIG,
  formatMembershipMonthFromDate,
  type CampusFacilityType,
  type CampusMembershipApplicationDetails,
} from "@/lib/campusMembership";
import type { SavedMembershipDocument } from "@/lib/campusMembershipUpload";

export type CampusMembershipSubmitBody = {
  alumniId: string | number;
  membershipType: string;
  membershipStartDate: string;
  preferredTiming: string;
  medicalConditions?: string;
  allergies?: string;
  physicalDisability?: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactNumber: string;
  documents: {
    alumniCard: SavedMembershipDocument;
    cnic: SavedMembershipDocument;
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
    documents: {
      alumniCard: body.documents.alumniCard,
      cnic: body.documents.cnic,
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
