import {
  CAMPUS_FACILITY_CONFIG,
  type CampusFacilityType,
  type CampusMembershipApplicationDetails,
} from "@/lib/campusMembership";
import type { MembershipFormPDFData } from "@/lib/pdfGenerator";
import { resolveStoredUploadUrl } from "@/lib/uploadsImageUrl";

export type MembershipUploadedDocument = {
  label: string;
  filename: string;
  url: string;
};

export type MembershipPreviewRow = [string, string];

export type MembershipDbRow = {
  created_at: string | null;
  status: string | null;
  facility_type: string | null;
  application_ref: string | null;
  discount_type: string | null;
  membership_type: string | null;
  membership_start_date: string | null;
  preferred_timing: string | null;
  application_details: unknown;
  gym_membership_month: string | null;
  swimmingpool_membership_month: string | null;
  cricket_membership_month: string | null;
  alumniname: string | null;
  fathername: string | null;
  dateofbirth: string | null;
  cnicpassport: string | null;
  sapid: string | null;
  cgpa: number | null;
  yearofending: number | null;
  faculty_name: string | null;
  department_name: string | null;
  program_name: string | null;
  campusname: string | null;
  email?: string | null;
};

export type MembershipApplicationPreview = {
  title: string;
  headerTitle: string;
  dateFormatted: string;
  applicationRef: string | null;
  status: string;
  facilityType: CampusFacilityType;
  studentName: string;
  fatherName: string;
  dob: string;
  cnic: string;
  campus: string;
  faculty: string;
  department: string;
  program: string;
  email: string;
  sapCode: string;
  cgpa: string;
  passingOutYear: string;
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
  validTill: string;
  poolLocation: string;
  swimmingLevel: string;
  hasMedicalCondition: string;
  membershipCategory: string;
  playingCategory: string;
  playingRole: string;
  previousClub: string;
  highestPlayingLevel: string;
  injuryHistory: string;
  declarationText: string;
  membershipSectionTitle: string;
  extraSectionTitle: string | null;
  membershipRows: MembershipPreviewRow[];
  extraRows: MembershipPreviewRow[];
  emergencyRows: MembershipPreviewRow[];
  documentsChecklist: Array<{ label: string; status: string }>;
  uploadedDocuments: MembershipUploadedDocument[];
};

export function resolveMembershipFacilityType(row: MembershipDbRow): CampusFacilityType {
  const ft = String(row.facility_type || "").trim().toLowerCase();
  if (ft === "gym" || ft === "pool" || ft === "cricket") return ft;
  if (row.gym_membership_month) return "gym";
  if (row.swimmingpool_membership_month) return "pool";
  if (row.cricket_membership_month) return "cricket";
  return "gym";
}

export function membershipPdfHeaderTitle(facilityType: CampusFacilityType): string {
  const titles: Record<CampusFacilityType, string> = {
    gym: "ALUMNI GYM MEMBERSHIP APPLICATION",
    pool: "ALUMNI SWIMMING POOL MEMBERSHIP APPLICATION",
    cricket: "ALUMNI CRICKET CLUB MEMBERSHIP APPLICATION",
  };
  return titles[facilityType];
}

function parseApplicationDetails(raw: unknown): CampusMembershipApplicationDetails | null {
  if (raw == null) return null;
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof obj !== "object" || obj === null) return null;
  return obj as CampusMembershipApplicationDetails;
}

function missing(value: string | null | undefined): string {
  const v = String(value ?? "").trim();
  return v || "Missing";
}

function formatDateLong(raw: string | null | undefined): string {
  if (!raw) return "Missing";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw).trim() || "Missing";
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function docSubmittedLabel(
  doc: { url?: string; filename?: string } | null | undefined,
): string {
  if (!doc) return "No";
  const has =
    Boolean(String(doc.url ?? "").trim()) || Boolean(String(doc.filename ?? "").trim());
  return has ? "Yes" : "No";
}

function toUploadedDocument(
  doc: { label?: string; url?: string; filename?: string } | null | undefined,
  defaultLabel: string,
): MembershipUploadedDocument {
  const label = String(doc?.label ?? defaultLabel).trim() || defaultLabel;
  const filename = String(doc?.filename ?? "").trim();
  const url = resolveStoredUploadUrl(String(doc?.url ?? "").trim());
  return { label, filename, url };
}

function buildUploadedDocuments(
  facilityType: CampusFacilityType,
  details: CampusMembershipApplicationDetails | null,
): MembershipUploadedDocument[] {
  const checklist: Array<{
    key: "alumniCard" | "cnic" | "medicalFitnessCertificate" | "previousClubLetter";
    label: string;
  }> = [
    { key: "alumniCard", label: "Alumni Card" },
    { key: "cnic", label: "CNIC" },
  ];
  if (facilityType === "cricket") {
    checklist.push(
      { key: "medicalFitnessCertificate", label: "Medical Fitness Certificate" },
      { key: "previousClubLetter", label: "Previous Club Letter (if any)" },
    );
  }
  return checklist.map(({ key, label }) =>
    toUploadedDocument(details?.documents?.[key] ?? null, label),
  );
}

function buildDocumentsChecklist(
  facilityType: CampusFacilityType,
  details: CampusMembershipApplicationDetails | null,
) {
  const rows = [
    { label: "Alumni Card", status: docSubmittedLabel(details?.documents?.alumniCard) },
    {
      label: facilityType === "pool" ? "CNIC Copy" : "CNIC",
      status: docSubmittedLabel(details?.documents?.cnic),
    },
  ];
  if (facilityType === "cricket") {
    rows.push(
      {
        label: "Medical Fitness Certificate",
        status: docSubmittedLabel(details?.documents?.medicalFitnessCertificate),
      },
      {
        label: "Previous Club Letter (if any)",
        status: docSubmittedLabel(details?.documents?.previousClubLetter),
      },
    );
  }
  return rows;
}

export function buildMembershipApplicationPreview(
  row: MembershipDbRow,
): MembershipApplicationPreview {
  const facilityType = resolveMembershipFacilityType(row);
  const config = CAMPUS_FACILITY_CONFIG[facilityType];
  const details = parseApplicationDetails(row.application_details);

  const dateRaw = row.created_at ? new Date(row.created_at) : new Date();
  const dateFormatted = dateRaw.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const membershipStartRaw =
    details?.membershipStartDate ||
    row.membership_start_date ||
    row.gym_membership_month ||
    row.swimmingpool_membership_month ||
    row.cricket_membership_month;
  const validTillRaw = details?.validTill;
  const poolLocation = missing(details?.poolDetails?.poolLocation || "The University of Lahore");
  const swimmingLevel = missing(details?.poolDetails?.swimmingLevel);
  const hasMedicalCondition = missing(details?.poolDetails?.hasMedicalCondition);
  const membershipCategory = missing(details?.cricketDetails?.membershipCategory);
  const playingCategory = missing(details?.cricketDetails?.playingCategory);
  const playingRole = missing(details?.cricketDetails?.playingRole);
  const previousClub = missing(details?.cricketDetails?.previousClub);
  const highestPlayingLevel = missing(details?.cricketDetails?.highestPlayingLevel);
  const injuryHistory = missing(details?.cricketDetails?.injuryHistory);

  const membershipSectionTitle =
    facilityType === "pool"
      ? "Membership Details"
      : facilityType === "cricket"
        ? "Cricket Membership Details"
        : "Membership Details";

  const extraSectionTitle =
    facilityType === "pool"
      ? "Swimming Information"
      : facilityType === "cricket"
        ? "Playing Information"
        : null;

  const membershipRows: MembershipPreviewRow[] =
    facilityType === "pool"
      ? [
          ["Membership Type", details?.membershipType || row.membership_type || "Missing"],
          ["Pool Location", poolLocation],
          ["Preferred Session", details?.preferredTiming || row.preferred_timing || "Missing"],
          ["Valid From", formatDateLong(membershipStartRaw)],
          ["Valid To", formatDateLong(validTillRaw)],
        ]
      : facilityType === "cricket"
        ? [
            ["Membership Category", membershipCategory],
            ["Membership Type", details?.membershipType || row.membership_type || "Missing"],
            ["Playing Category", playingCategory],
            ["Playing Role", playingRole],
            ["Preferred Practice Session", details?.preferredTiming || row.preferred_timing || "Missing"],
            ["Valid From", formatDateLong(membershipStartRaw)],
            ["Valid Till", formatDateLong(validTillRaw)],
          ]
        : [
            ["Applying For", details?.applyingFor || config.applyingFor],
            ["Discount Type", details?.discountType || row.discount_type || config.discountType],
            ["Membership Type", details?.membershipType || row.membership_type || "Missing"],
            ["Membership Start Date", formatDateLong(membershipStartRaw)],
            ["Preferred Timing", details?.preferredTiming || row.preferred_timing || "Missing"],
          ];

  const physicalDisabilityDetailsRow: MembershipPreviewRow[] =
    details?.physicalDisability === "Yes" && details?.physicalDisabilityDetails
      ? [["Physical Disability Details", details.physicalDisabilityDetails]]
      : [];

  const extraRows: MembershipPreviewRow[] =
    facilityType === "pool"
      ? [
          ["Swimming Level", swimmingLevel],
          ["Any Medical Condition", hasMedicalCondition],
          ["Medical Conditions", missing(details?.medicalConditions)],
          ["Physical Disability", missing(details?.physicalDisability)],
          ...physicalDisabilityDetailsRow,
          ["Allergies", missing(details?.allergies)],
        ]
      : facilityType === "cricket"
        ? [
            ["Previous Club (if any)", previousClub],
            ["Highest Playing Level", highestPlayingLevel],
            ["Any Injury History", injuryHistory],
            ["Medical Conditions", missing(details?.medicalConditions)],
            ["Physical Disability", missing(details?.physicalDisability)],
            ...physicalDisabilityDetailsRow,
            ["Allergies", missing(details?.allergies)],
          ]
        : [
            ["Medical Conditions", missing(details?.medicalConditions)],
            ["Allergies", missing(details?.allergies)],
            ["Physical Disability", missing(details?.physicalDisability)],
            ...physicalDisabilityDetailsRow,
          ];

  const emergencyRows: MembershipPreviewRow[] = [
    ["Name", missing(details?.emergencyContactName)],
    ["Relationship", missing(details?.emergencyContactRelationship)],
    ["Phone", missing(details?.emergencyContactNumber)],
  ];

  return {
    title: config.pageTitle,
    headerTitle: membershipPdfHeaderTitle(facilityType),
    dateFormatted,
    applicationRef: String(row.application_ref ?? "").trim() || null,
    status: String(row.status || "pending").toLowerCase(),
    facilityType,
    studentName: missing(row.alumniname),
    fatherName: missing(row.fathername),
    dob: row.dateofbirth ? formatDateLong(row.dateofbirth) : "Missing",
    cnic: missing(row.cnicpassport),
    campus: missing(row.campusname),
    faculty: missing(row.faculty_name),
    department: missing(row.department_name),
    program: missing(row.program_name),
    email: String(row.email ?? "").trim() || "Missing",
    sapCode: missing(row.sapid),
    cgpa:
      row.cgpa != null && Number.isFinite(Number(row.cgpa)) ? String(row.cgpa) : "Missing",
    passingOutYear:
      row.yearofending != null && Number.isFinite(Number(row.yearofending))
        ? String(Number(row.yearofending))
        : "Missing",
    applyingFor: details?.applyingFor || config.applyingFor,
    discountType: details?.discountType || row.discount_type || config.discountType,
    membershipType: details?.membershipType || row.membership_type || "Missing",
    membershipStartDate: formatDateLong(membershipStartRaw),
    preferredTiming: details?.preferredTiming || row.preferred_timing || "Missing",
    medicalConditions: missing(details?.medicalConditions),
    allergies: missing(details?.allergies),
    physicalDisability: missing(details?.physicalDisability),
    physicalDisabilityDetails: missing(details?.physicalDisabilityDetails),
    emergencyContactName: missing(details?.emergencyContactName),
    emergencyContactRelationship: missing(details?.emergencyContactRelationship),
    emergencyContactNumber: missing(details?.emergencyContactNumber),
    validTill: formatDateLong(validTillRaw),
    poolLocation,
    swimmingLevel,
    hasMedicalCondition,
    membershipCategory,
    playingCategory,
    playingRole,
    previousClub,
    highestPlayingLevel,
    injuryHistory,
    declarationText:
      facilityType === "pool"
        ? "I agree to follow all pool safety rules and understand that management reserves the right to suspend membership for violation of regulations."
        : "",
    membershipSectionTitle,
    extraSectionTitle,
    membershipRows,
    extraRows,
    emergencyRows,
    documentsChecklist: buildDocumentsChecklist(facilityType, details),
    uploadedDocuments: buildUploadedDocuments(facilityType, details),
  };
}

export function buildMembershipFormPDFData(row: MembershipDbRow): MembershipFormPDFData {
  const preview = buildMembershipApplicationPreview(row);
  return {
    facilityType: preview.facilityType,
    headerTitle: preview.headerTitle,
    dateFormatted: preview.dateFormatted,
    applicationRef: preview.applicationRef,
    studentName: preview.studentName,
    fatherName: preview.fatherName,
    dob: preview.dob,
    cnic: preview.cnic,
    campus: preview.campus,
    faculty: preview.faculty,
    department: preview.department,
    program: preview.program,
    email: preview.email,
    sapCode: preview.sapCode,
    cgpa: preview.cgpa,
    passingOutYear: preview.passingOutYear,
    applyingFor: preview.applyingFor,
    discountType: preview.discountType,
    membershipType: preview.membershipType,
    membershipStartDate: preview.membershipStartDate,
    preferredTiming: preview.preferredTiming,
    medicalConditions: preview.medicalConditions,
    allergies: preview.allergies,
    physicalDisability: preview.physicalDisability,
    physicalDisabilityDetails: preview.physicalDisabilityDetails,
    emergencyContactName: preview.emergencyContactName,
    emergencyContactRelationship: preview.emergencyContactRelationship,
    emergencyContactNumber: preview.emergencyContactNumber,
    validTill: preview.validTill,
    poolLocation: preview.poolLocation,
    swimmingLevel: preview.swimmingLevel,
    hasMedicalCondition: preview.hasMedicalCondition,
    membershipCategory: preview.membershipCategory,
    playingCategory: preview.playingCategory,
    playingRole: preview.playingRole,
    previousClub: preview.previousClub,
    highestPlayingLevel: preview.highestPlayingLevel,
    injuryHistory: preview.injuryHistory,
    declarationText: preview.declarationText,
    documentsChecklist: preview.documentsChecklist,
  };
}
