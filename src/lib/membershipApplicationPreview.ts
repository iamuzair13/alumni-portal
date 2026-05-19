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
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactNumber: string;
  documentsChecklist: {
    alumniCard: string;
    cnic: string;
  };
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
  details: CampusMembershipApplicationDetails | null,
): MembershipUploadedDocument[] {
  const checklist: Array<{ key: "alumniCard" | "cnic"; label: string }> = [
    { key: "alumniCard", label: "Alumni Card" },
    { key: "cnic", label: "CNIC" },
  ];
  return checklist.map(({ key, label }) =>
    toUploadedDocument(details?.documents?.[key] ?? null, label),
  );
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
    emergencyContactName: missing(details?.emergencyContactName),
    emergencyContactRelationship: missing(details?.emergencyContactRelationship),
    emergencyContactNumber: missing(details?.emergencyContactNumber),
    documentsChecklist: {
      alumniCard: docSubmittedLabel(details?.documents?.alumniCard),
      cnic: docSubmittedLabel(details?.documents?.cnic),
    },
    uploadedDocuments: buildUploadedDocuments(details),
  };
}

export function buildMembershipFormPDFData(row: MembershipDbRow): MembershipFormPDFData {
  const preview = buildMembershipApplicationPreview(row);
  return {
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
    emergencyContactName: preview.emergencyContactName,
    emergencyContactRelationship: preview.emergencyContactRelationship,
    emergencyContactNumber: preview.emergencyContactNumber,
    alumniCardSubmitted: preview.documentsChecklist.alumniCard,
    cnicDocSubmitted: preview.documentsChecklist.cnic,
  };
}
