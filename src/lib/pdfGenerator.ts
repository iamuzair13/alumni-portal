import { jsPDF } from "jspdf";
import type { PdfEmbedImage } from "@/lib/alumniProfilePhotoPdf";
import { formatObtainedMarkDisplay, normalizeObtainedMark } from "@/lib/leadershipMarks";
import {
  discountCategoryLabel,
  isScholarshipFeeDiscountFlow,
  isScholarshipKinshipCategory,
  scholarshipFeeDiscountPercentForPdf,
} from "@/lib/scholarshipLetter";
import {
  type ScholarshipDiscountTierPdfRow,
  parseDiscountPercentValue,
  tiersMatchPercent,
} from "@/lib/scholarshipDiscount";
import { readFileSync } from "fs";
import { join } from "path";

const PDF_LOGO_MAX_BYTES = 512 * 1024;

/** Strip data-URL payloads and cap length so applicant uploads do not bloat PDFs. */
export function sanitizePdfText(value: unknown, maxLen = 12_000): string {
  let s = String(value ?? "").trim();
  if (!s) return "";
  if (/^data:[^;]+;base64,/i.test(s)) return "[Content omitted from PDF — see application files]";
  s = s.replace(/data:image\/[a-z0-9+.-]+;base64,[a-z0-9+/=\s]+/gi, "[Image omitted]");
  if (s.length > maxLen) {
    return `${s.slice(0, maxLen)}\n\n[Truncated for PDF export]`;
  }
  return s;
}

// ─── Logo Helper ─────────────────────────────────────────────────────────────
function getLogoBase64(variant: "light" | "dark" = "dark"): string {
  const lightCandidates = [
    join(process.cwd(), "public", "images", "logo", "logo-white.png"),
    join(process.cwd(), "public", "images", "logo", "UOL-LOGO-White.png"),
  ];
  const darkCandidates = [
    join(process.cwd(), "public", "images", "logo", "UOL-Rebrand-ID_Final-04.png"),
    join(process.cwd(), "public", "images", "logo", "UOL-Rebrand-ID_Final-01.png"),
  ];
  const candidates = variant === "light" ? [...lightCandidates, ...darkCandidates] : [...darkCandidates, ...lightCandidates];
  for (const logoPath of candidates) {
    try {
      const logoBuffer = readFileSync(logoPath);
      if (logoBuffer.length > PDF_LOGO_MAX_BYTES) continue;
      return `data:image/png;base64,${logoBuffer.toString("base64")}`;
    } catch {
      // try next candidate
    }
  }
  return "";
}

// ─── Interfaces (unchanged for compatibility) ────────────────────────────────
export interface ScholarshipApplicationData {
  alumniName: string;
  discountType: string;
  applyingFor: string;
  degreeTitle: string;
  appliedDiscountPercent?: number | null;
  kinshipRelation?: string | null;
  kinshipFirstName?: string | null;
  kinshipLastName?: string | null;
  kinshipName?: string | null;
}

export interface ScholarshipLetterPDFData {
  dateFormatted: string;
  studentName: string;
  scholarshipType: string;
  applyingFor: string;
  previousDegree: string;
  cgpaLastDegree: string;
  requestedDiscount: string;
  appliedDiscountPercent?: number | null;
  discountTiers?: ScholarshipDiscountTierPdfRow[];
  documentsAttached: string[];
  sapCode: string;
  passingOutYear?: string | null;
  admissionApplicationRef?: string | null;
  scholarshipApplicationPdfId?: string | null;
  discountType?: string | null;
  requestedProgramDegree?: string;
  faculty?: string;
  department?: string;
  program?: string;
  campus?: string;
  fatherName?: string;
  dob?: string;
  cnic?: string;
  uploadedDocuments?: Array<{ label: string; filename?: string; url?: string; adminVerified?: "YES" | "NO" | null }>;
  isKinship?: boolean;
  kinshipDetails?: {
    kinName?: string;
    kinFatherName?: string;
    kinCampus?: string;
    kinFaculty?: string;
    kinDepartment?: string;
    kinProgram?: string;
    kinAdmissionRefNo?: string;
    kinLastDegreeCertificate?: string;
    kinPassingOutYear?: string;
  };
}

export interface MembershipFormPDFData {
  facilityType: "gym" | "pool" | "cricket";
  headerTitle: string;
  dateFormatted: string;
  applicationRef: string | null;
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
  documentsChecklist: Array<{ label: string; status: string }>;
  paymentAmount?: number | null;
  originalAmount?: number | null;
  discountPercent?: number | null;
  discountBasis?: string | null;
}

export interface UpskillApplicationData {
  alumniName: string;
  courseName: string;
  departmentName: string;
}

export interface LeadershipApplicationPDFData {
  leadershipType: "chapter" | "association";
  categoryType?: "national" | "international" | "association" | null;
  categoryName?: string | null;
  status: string;
  position: string;
  applicant: {
    name: string;
    sapId: string;
    registrationNo?: string | null;
    email: string;
    gender?: string | null;
    phone?: string | null;
    passingYear?: number | null;
    faculty?: string | null;
    department?: string | null;
    program?: string | null;
  };
  alumniProfilePhoto?: PdfEmbedImage | null;
  roleDescription?: string | null;
  officeTermGovernanceHtml?: string | null;
  criteria: Array<{
    id: number;
    label: string;
    description?: string | null;
    isMandatory: boolean;
    criterionScore?: number | null;
    hasTextbox?: boolean;
    textboxLabel?: string | null;
    alumniConfirmed: boolean;
    adminConfirmed: boolean;
    alumniResponse?: string | null;
    adminResponse?: string | null;
    alumniTextResponse?: string | null;
    obtainedMarks?: number | null;
  }>;
  additionalAchievements?: string | null;
  planStrategy?: string | null;
  strategyAssessmentMarks?: number | null;
  achievementAssessmentMarks?: number | null;
  bonusMarks?: number | null;
  optionalCriteriaProficiency?: unknown;
  uploadedDocuments?: Array<{ label: string; url: string; uploadedAt?: string | null }>;
  createdAt?: string | null;
  updatedAt?: string | null;
  rejectionReason?: string | null;
  assessedByName?: string | null;
  assessedByEmail?: string | null;
  assessedAt?: string | null;
  approvedAt?: string | null;
}

// ─── Modern Design System ────────────────────────────────────────────────────
const THEME = {
  margin: 14,
  colors: {
    brand: [0, 102, 51] as [number, number, number],
    brandLight: [240, 247, 243] as [number, number, number],
    brandAccent: [0, 102, 51] as [number, number, number],
    text: [33, 33, 33] as [number, number, number],
    muted: [100, 100, 100] as [number, number, number],
    border: [218, 218, 218] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    success: [0, 128, 0] as [number, number, number],
    danger: [200, 50, 50] as [number, number, number],
  },
  font: {
    h1: 14,
    h2: 11,
    body: 9,
    small: 8,
    tiny: 7.5,
  },
};

const clamp = (text: unknown): string => {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value || "—";
};

function formatPaymentAmount(value: unknown): string {
  const n = Number(value ?? "");
  if (!Number.isFinite(n)) return "—";
  return `Rs. ${Math.round(n).toLocaleString()}`;
}

function formatDiscountPercent(value: unknown): string {
  const n = Number(value ?? "");
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n)}%`;
}

// ─── Shared application-form layout (single-page, consistent spacing) ────────
type FormMetrics = {
  rowMinH: number;
  tableRowH: number;
  sectionH: number;
  sectionGap: number;
  headerH: number;
  headerGap: number;
  sigH: number;
  fontLabel: number;
  fontBody: number;
  fontSmall: number;
  fontTiny: number;
  maxValueLines: number;
};

const FORM_METRIC_PRESETS: FormMetrics[] = [
  {
    rowMinH: 7.5,
    tableRowH: 5.5,
    sectionH: 6,
    sectionGap: 1.5,
    headerH: 18,
    headerGap: 3,
    sigH: 14,
    fontLabel: 8,
    fontBody: 9,
    fontSmall: 8,
    fontTiny: 7.5,
    maxValueLines: 3,
  },
  {
    rowMinH: 6.5,
    tableRowH: 5,
    sectionH: 5.5,
    sectionGap: 1,
    headerH: 16,
    headerGap: 2.5,
    sigH: 12,
    fontLabel: 7.5,
    fontBody: 8.5,
    fontSmall: 7.5,
    fontTiny: 7,
    maxValueLines: 2,
  },
  {
    rowMinH: 6,
    tableRowH: 4.5,
    sectionH: 5,
    sectionGap: 0.75,
    headerH: 15,
    headerGap: 2,
    sigH: 11,
    fontLabel: 7,
    fontBody: 8,
    fontSmall: 7,
    fontTiny: 6.5,
    maxValueLines: 2,
  },
  {
    rowMinH: 5.5,
    tableRowH: 4,
    sectionH: 4.5,
    sectionGap: 0.5,
    headerH: 14,
    headerGap: 2,
    sigH: 10,
    fontLabel: 6.5,
    fontBody: 7.5,
    fontSmall: 6.5,
    fontTiny: 6.5,
    maxValueLines: 1,
  },
];

function pickFormMetrics(
  estimate: (metrics: FormMetrics) => number,
  availableHeight: number,
): FormMetrics {
  for (const preset of FORM_METRIC_PRESETS) {
    if (estimate(preset) <= availableHeight) return preset;
  }
  return FORM_METRIC_PRESETS[FORM_METRIC_PRESETS.length - 1];
}

function createApplicationFormRenderer(
  doc: jsPDF,
  metrics: FormMetrics,
  opts?: { footerText?: string },
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const m = THEME.margin;
  const W = pageW - m * 2;
  const colW = W / 2;
  const footerReserve = 10;
  const footerY = pageH - footerReserve;
  const sigBlockH = metrics.sectionH + metrics.sectionGap + metrics.sigH + 2;
  const contentBottom = footerY - sigBlockH - 4;
  let y = m;

  const footerText =
    opts?.footerText ??
    "Office of Alumni Relations, EE2 Building 4th Floor | University of Lahore";

  const lineHeight = (fontSize: number) => fontSize * 0.38;

  const cappedLines = (text: string, width: number, fontSize: number) => {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, width) as string[];
    if (lines.length <= metrics.maxValueLines) return lines;
    const kept = lines.slice(0, metrics.maxValueLines);
    const last = kept[kept.length - 1] ?? "";
    kept[kept.length - 1] = last.length > 3 ? `${last.slice(0, Math.max(0, last.length - 1))}…` : "…";
    return kept;
  };

  const valueBlockHeight = (text: string, width: number) => {
    const lines = cappedLines(text, width, metrics.fontBody);
    return Math.max(metrics.rowMinH - 3.5, lines.length * lineHeight(metrics.fontBody));
  };

  const drawHRule = (yy: number, light = false) => {
    doc.setDrawColor(...THEME.colors.border);
    doc.setLineWidth(light ? 0.1 : 0.15);
    doc.line(m, yy, m + W, yy);
  };

  const drawVRule = (xx: number, y1: number, y2: number) => {
    doc.setDrawColor(...THEME.colors.border);
    doc.setLineWidth(0.1);
    doc.line(xx, y1, xx, y2);
  };

  const truncateToWidth = (text: string, maxW: number, fontSize = metrics.fontTiny) => {
    const value = String(text || "").trim();
    if (!value) return "—";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    if (doc.getTextWidth(value) <= maxW) return value;
    let s = value;
    while (s.length > 0 && doc.getTextWidth(`${s}…`) > maxW) s = s.slice(0, -1);
    return s.length < value.length ? `${s}…` : s;
  };

  const drawFormBodyStart = () => {
    drawHRule(y);
  };

  const drawHeader = (title: string, logoVariant: "light" | "dark" = "light") => {
    doc.setFillColor(...THEME.colors.brand);
    doc.rect(m, y, W, metrics.headerH, "F");

    const logoBase64 = getLogoBase64(logoVariant);
    if (logoBase64) {
      try {
        const logoH = Math.min(9, metrics.headerH - 6);
        const logoW = logoH * (26 / 9);
        doc.addImage(
          logoBase64,
          "PNG",
          m + 3,
          y + (metrics.headerH - logoH) / 2,
          logoW,
          logoH,
          "uol-logo",
          "FAST",
        );
      } catch {
        // skip logo on failure
      }
    }

    doc.setTextColor(...THEME.colors.white);
    doc.setFont("helvetica", "bold");
    let fs = Math.min(11, metrics.fontBody + 2);
    doc.setFontSize(fs);
    const headerTitle = clamp(title).toUpperCase();
    let tw = doc.getTextWidth(headerTitle);
    while (tw > W - 12 && fs > 7) {
      fs -= 0.5;
      doc.setFontSize(fs);
      tw = doc.getTextWidth(headerTitle);
    }
    doc.text(headerTitle, m + Math.max(0, (W - tw) / 2), y + metrics.headerH / 2 + fs * 0.12);
    y += metrics.headerH + metrics.headerGap;
  };

  const drawSection = (letter: string, title: string) => {
    doc.setFillColor(...THEME.colors.brandLight);
    doc.rect(m, y, W, metrics.sectionH, "F");
    doc.setDrawColor(...THEME.colors.border);
    doc.setLineWidth(0.1);
    doc.rect(m, y, W, metrics.sectionH, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(metrics.fontSmall);
    doc.setTextColor(...THEME.colors.brand);
    doc.text(`(${letter})  ${title.toUpperCase()}`, m + 2, y + metrics.sectionH * 0.62);
    y += metrics.sectionH + metrics.sectionGap;
  };

  const drawFieldPair = (
    label1: string,
    value1: string | null | undefined,
    label2: string,
    value2: string | null | undefined,
  ) => {
    if (y >= contentBottom) return;
    const v1 = clamp(value1);
    const v2 = clamp(value2);
    let h = Math.max(
      metrics.rowMinH,
      valueBlockHeight(v1, colW - 6) + 3.5,
      valueBlockHeight(v2, colW - 6) + 3.5,
    );
    if (y + h > contentBottom) h = Math.max(metrics.rowMinH * 0.85, contentBottom - y);
    if (h <= 0) return;
    const rowTop = y;
    drawHRule(y + h);
    drawVRule(m + colW, rowTop, y + h);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(metrics.fontLabel);
    doc.setTextColor(...THEME.colors.muted);
    doc.text(clamp(label1).toUpperCase(), m + 2, y + 3.2);
    doc.text(clamp(label2).toUpperCase(), m + colW + 2, y + 3.2);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(metrics.fontBody);
    doc.setTextColor(...THEME.colors.text);
    doc.text(cappedLines(v1, colW - 6, metrics.fontBody), m + 2, y + 6.5);
    doc.text(cappedLines(v2, colW - 6, metrics.fontBody), m + colW + 2, y + 6.5);
    y += h;
  };

  const drawFullRow = (label: string, value: string | null | undefined) => {
    if (y >= contentBottom) return;
    const v = clamp(value);
    let h = Math.max(metrics.rowMinH, valueBlockHeight(v, W - 6) + 3.5);
    if (y + h > contentBottom) h = Math.max(metrics.rowMinH * 0.85, contentBottom - y);
    if (h <= 0) return;
    drawHRule(y + h);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(metrics.fontLabel);
    doc.setTextColor(...THEME.colors.muted);
    doc.text(clamp(label).toUpperCase(), m + 2, y + 3.2);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(metrics.fontBody);
    doc.setTextColor(...THEME.colors.text);
    doc.text(cappedLines(v, W - 6, metrics.fontBody), m + 2, y + 6.5);
    y += h;
  };

  const drawCheckbox = (cx: number, cy: number, checked: boolean) => {
    const size = Math.max(2.4, metrics.tableRowH * 0.5);
    doc.setDrawColor(...THEME.colors.border);
    doc.setLineWidth(0.15);
    doc.rect(cx, cy, size, size);
    if (checked) {
      doc.setDrawColor(...THEME.colors.brand);
      doc.setLineWidth(0.25);
      doc.line(cx + size * 0.15, cy + size * 0.52, cx + size * 0.38, cy + size * 0.78);
      doc.line(cx + size * 0.38, cy + size * 0.78, cx + size * 0.88, cy + size * 0.22);
    }
  };

  const drawChecklistTable = (items: Array<{ label: string; value: string }>) => {
    const labelColW = W * 0.72;
    const rowH = metrics.tableRowH;

    doc.setFillColor(...THEME.colors.brandLight);
    doc.rect(m, y, W, rowH, "F");
    doc.setDrawColor(...THEME.colors.border);
    doc.setLineWidth(0.1);
    doc.rect(m, y, W, rowH, "S");
    drawVRule(m + labelColW, y, y + rowH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(metrics.fontSmall);
    doc.setTextColor(...THEME.colors.text);
    doc.text("DOCUMENT", m + 2, y + rowH * 0.72);
    doc.text("STATUS", m + labelColW + 2, y + rowH * 0.72);
    y += rowH;

    items.forEach((item, i) => {
      if (i % 2 === 1) {
        doc.setFillColor(250, 250, 250);
        doc.rect(m, y, W, rowH, "F");
      }
      drawHRule(y + rowH, true);
      drawVRule(m + labelColW, y, y + rowH);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(metrics.fontSmall);
      doc.setTextColor(...THEME.colors.text);
      doc.text(truncateToWidth(item.label, labelColW - 4, metrics.fontSmall), m + 2, y + rowH * 0.72);

      const val = clamp(item.value);
      if (val === "Yes") doc.setTextColor(...THEME.colors.success);
      else if (val === "No") doc.setTextColor(...THEME.colors.danger);
      else doc.setTextColor(...THEME.colors.muted);
      doc.text(val, m + labelColW + 2, y + rowH * 0.72);
      doc.setTextColor(...THEME.colors.text);
      y += rowH;
    });
  };

  const drawDiscountTierTable = (
    tiers: ScholarshipDiscountTierPdfRow[],
    appliedPct: number | null,
    bottomLimit: number,
  ) => {
    const rowH = metrics.tableRowH;
    const checkW = 6;
    const srW = 7;
    const discountW = W * 0.5;
    const criteriaW = W - checkW - srW - discountW;
    const discountX = m + checkW + srW;
    const criteriaX = discountX + discountW;
    const isApplicableTier = (pct: number) => appliedPct != null && tiersMatchPercent(pct, appliedPct);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(metrics.fontTiny);
    doc.setTextColor(...THEME.colors.text);
    doc.text("Table 1.1 — Applicable Discount Criteria", m, y + 2.5);
    y += 3.5;

    doc.setFillColor(...THEME.colors.brandLight);
    doc.rect(m, y, W, rowH, "F");
    doc.setDrawColor(...THEME.colors.border);
    doc.setLineWidth(0.1);
    doc.rect(m, y, W, rowH, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(metrics.fontTiny);
    doc.setTextColor(...THEME.colors.text);
    doc.text("SR", m + checkW + 0.5, y + rowH * 0.72);
    doc.text("DISCOUNT", discountX + 1, y + rowH * 0.72);
    doc.text("CRITERIA", criteriaX + 1, y + rowH * 0.72);
    y += rowH;

    if (tiers.length === 0) {
      drawHRule(y + rowH, true);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(metrics.fontTiny);
      doc.setTextColor(...THEME.colors.muted);
      doc.text("No discount tiers configured.", m + 2, y + rowH * 0.72);
      y += rowH;
      return;
    }

    tiers.forEach((tier, i) => {
      if (y + rowH > bottomLimit) return;
      if (i % 2 === 1) {
        doc.setFillColor(250, 250, 250);
        doc.rect(m, y, W, rowH, "F");
      }
      drawHRule(y + rowH, true);

      drawCheckbox(m + 1, y + (rowH - Math.max(2.4, rowH * 0.5)) / 2, isApplicableTier(tier.discountPercent));

      doc.setFont("helvetica", "normal");
      doc.setFontSize(metrics.fontTiny);
      doc.setTextColor(...THEME.colors.text);
      doc.text(String(i + 1), m + checkW + 0.5, y + rowH * 0.72);
      doc.text(truncateToWidth(clamp(tier.title), discountW - 2), discountX + 1, y + rowH * 0.72);
      doc.text(truncateToWidth(clamp(tier.criteria), criteriaW - 2), criteriaX + 1, y + rowH * 0.72);
      y += rowH;
    });
  };

  const drawSignatureBlock = (leftLabel: string, rightLabel: string) => {
    y = Math.max(y + 2, contentBottom - sigBlockH);
    drawSection("e", "Review & Approval");

    const sigCol = W / 2;
    doc.setDrawColor(...THEME.colors.border);
    doc.setLineWidth(0.2);
    doc.rect(m, y, sigCol - 2, metrics.sigH);
    doc.rect(m + sigCol + 2, y, sigCol - 2, metrics.sigH);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(metrics.fontTiny);
    doc.setTextColor(...THEME.colors.muted);
    doc.text(leftLabel, m + 2, y + 4);
    doc.text(rightLabel, m + sigCol + 4, y + 4);
    y += metrics.sigH + 2;
  };

  const drawMembershipSignatures = (
    leftLabel: string,
    centerLabel: string,
    rightLabel?: string,
  ) => {
    y = Math.max(y + 2, contentBottom - metrics.sigH - 2);
    const columns = rightLabel ? 3 : 2;
    const sigCol = W / columns;
    doc.setDrawColor(...THEME.colors.border);
    doc.setLineWidth(0.2);
    doc.rect(m, y, sigCol - 2, metrics.sigH);
    doc.rect(m + sigCol + 2, y, sigCol - 2, metrics.sigH);
    if (rightLabel) {
      doc.rect(m + sigCol * 2 + 4, y, sigCol - 2, metrics.sigH);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(metrics.fontSmall);
    doc.setTextColor(...THEME.colors.muted);
    doc.text(leftLabel, m + 2, y + 4.5);
    doc.text(centerLabel, m + sigCol + 4, y + 4.5);
    if (rightLabel) {
      doc.text(rightLabel, m + sigCol * 2 + 6, y + 4.5);
    }
    y += metrics.sigH;
  };

  const drawFooter = () => {
    doc.setDrawColor(...THEME.colors.brand);
    doc.setLineWidth(0.35);
    doc.line(m, footerY - 4, m + W, footerY - 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(metrics.fontTiny);
    doc.setTextColor(...THEME.colors.muted);
    const fw = doc.getTextWidth(footerText);
    doc.text(footerText, m + (W - fw) / 2, footerY);
  };

  const ensureSinglePage = () => {
    const pages = doc.getNumberOfPages();
    if (pages > 1) {
      for (let i = pages; i > 1; i--) doc.deletePage(i);
    }
  };

  const remaining = () => contentBottom - y;

  return {
    m,
    W,
    colW,
    y,
    contentBottom,
    footerY,
    getY: () => y,
    setY: (next: number) => {
      y = next;
    },
    remaining,
    drawHeader,
    drawFormBodyStart,
    drawSection,
    drawFieldPair,
    drawFullRow,
    drawChecklistTable,
    drawDiscountTierTable,
    drawSignatureBlock,
    drawMembershipSignatures,
    drawFooter,
    ensureSinglePage,
  };
}

function estimateScholarshipFormHeight(
  data: ScholarshipLetterPDFData,
  metrics: FormMetrics,
): number {
  const tierCount = data.discountTiers?.length ?? 0;
  const tierRows = tierCount === 0 ? 1 : tierCount;
  let rows = 1; // meta
  rows += 2; // section A
  rows += data.isKinship ? 3 : 2;
  if (!data.isKinship) rows += 1; // admission ref
  rows += data.isKinship ? 5 : 3; // section C
  const sections = 5;
  const checklistItems = data.isKinship ? 6 : 5;

  return (
    metrics.headerH +
    metrics.headerGap +
    rows * metrics.rowMinH +
    sections * (metrics.sectionH + metrics.sectionGap) +
    3.5 +
    (1 + tierRows) * metrics.tableRowH +
    (1 + checklistItems) * metrics.tableRowH +
    metrics.sigH +
    14
  );
}

function estimateMembershipFormHeight(
  metrics: FormMetrics,
  facilityType: "gym" | "pool" | "cricket",
  checklistCount: number,
): number {
  // Section A now has 4 rows: Name/Father, SAP/CNIC, Campus/Mobile, Email/DOB
  // Membership details section includes two extra rows for payment amount / discount % and discount basis.
  const rows =
    facilityType === "pool"
      ? 1 + 4 + 5 + 2 + 2 + 2  // meta + A(4) + B membership(5) + C swimming(2) + D medical+emergency(2) + E contact(2) — approximate
      : facilityType === "cricket"
        ? 1 + 4 + 6 + 3 + 2 + 2  // meta + A(4) + B cricket(6) + C playing(3) + D emergency(2) + E checklist(2)
        : 1 + 4 + 5 + 3 + 2 + 2; // meta + A(4) + B membership(5) + C medical(3) + D emergency(2) + E checklist(2)
  // Gym: A B C D E = 5 sections; Pool: A B C D E F G = 7 sections; Cricket: A B C D E F = 6 sections
  const sections =
    facilityType === "pool" ? 7 : facilityType === "cricket" ? 6 : 5;
  return (
    metrics.headerH +
    metrics.headerGap +
    rows * metrics.rowMinH +
    sections * (metrics.sectionH + metrics.sectionGap) +
    (1 + checklistCount) * metrics.tableRowH +
    metrics.sigH +
    14
  );
}

const normalizeAdminVerified = (raw: unknown): "YES" | "NO" | null => {
  const s = String(raw ?? "").trim().toUpperCase();
  if (s === "YES" || s === "Y") return "YES";
  if (s === "NO" || s === "N") return "NO";
  return null;
};

function formatLeadershipDate(value: unknown): string {
  if (!value) return "—";
  try {
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return clamp(value);
    return d.toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return clamp(value);
  }
}

function formatLeadershipStatus(status: unknown): string {
  const s = String(status || "pending").toLowerCase();
  if (s === "approved") return "Approved";
  if (s === "assessed") return "Assessed";
  if (s === "rejected") return "Not Approved";
  return "Pending";
}

function stripHtmlForPdf(html: unknown, maxLen = 20_000): string {
  const stripped = String(html || "")
    .replace(/\u00a0/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r\n/g, "\n")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/?p\b[^>]*>/gi, "\n")
    .replace(/<\/?div\b[^>]*>/gi, "\n")
    .replace(/<\/?h[1-6]\b[^>]*>/gi, "\n\n")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(/<\/?(ul|ol)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\*\*/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return sanitizePdfText(stripped, maxLen) || "—";
}

function proficiencyLabelForPdf(value: number | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return "";
  const m = Math.min(5, Math.max(1, Math.round(n)));
  const map = ["", "Beginner", "Basic", "Intermediate", "Advanced", "Expert"];
  return map[m] || "";
}

const LEADERSHIP_PLAN_STRATEGY_QUESTION =
  "Please share an outline of your plan or strategy for fulfilling the responsibilities assigned for this role.";

const LEADERSHIP_ADDITIONAL_ACHIEVEMENTS_QUESTION =
  "Describe any additional achievements, leadership experience, awards, or qualifications relevant to this role.";

function fileNameFromUrlPdf(url: string): string {
  try {
    const u = String(url || "").trim();
    if (!u) return "";
    const path = u.split("?")[0].split("#")[0];
    const parts = path.split("/").filter(Boolean);
    const last = parts[parts.length - 1] || "";
    return last ? decodeURIComponent(last) : "";
  } catch {
    return "";
  }
}

// ─── 1. Scholarship Letter PDF (Tabular) ─────────────────────────────────────
export function generateScholarshipLetterPDF(data: ScholarshipLetterPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF({ compress: true, unit: "mm" });
      const pageH = doc.internal.pageSize.getHeight();
      const availableHeight = pageH - THEME.margin * 2 - 24;

      const metrics = pickFormMetrics(
        (preset) => estimateScholarshipFormHeight(data, preset),
        availableHeight,
      );
      const form = createApplicationFormRenderer(doc, metrics);

      const headerTitle = isScholarshipKinshipCategory(data.discountType)
        ? "Alumni Scholarship Application (Kinship)"
        : isScholarshipFeeDiscountFlow(data.discountType)
          ? "Alumni Scholarship Application (Self)"
          : "Alumni Scholarship Application";

      const findChecklistValue = (keywords: string[]) => {
        const docs = data.uploadedDocuments || [];
        for (const d of docs) {
          const label = String(d.label || "").trim().toLowerCase();
          if (!label) continue;
          if (!keywords.some((k) => label.includes(k))) continue;
          const v = normalizeAdminVerified(d.adminVerified);
          if (v === "YES") return "Yes";
          if (v === "NO") return "No";
          return "—";
        }
        return "—";
      };

      form.drawHeader(headerTitle);
      form.drawFormBodyStart();

      const pdfAppId = String(data.scholarshipApplicationPdfId || "").trim();
      if (pdfAppId) {
        form.drawFieldPair("Application Date", data.dateFormatted, "Application ID", pdfAppId);
      } else {
        form.drawFullRow("Application Date", data.dateFormatted);
      }

      form.drawSection("a", "Alumni Details");
      form.drawFieldPair("Name", data.studentName, "Father's Name", data.fatherName);
      form.drawFieldPair("Date of Birth", data.dob, "CNIC", data.cnic);

      form.drawSection("b", data.isKinship ? "Alumni Educational Record" : "Program Applied For");
      form.drawFieldPair("Campus", data.campus, "Faculty", data.faculty);
      form.drawFieldPair(
        "Department",
        data.department,
        "Program",
        data.isKinship ? data.program : data.requestedProgramDegree,
      );

      if (data.isKinship) {
        form.drawFieldPair("SAP ID", data.sapCode, "CGPA / Grade", data.cgpaLastDegree);
        form.drawFieldPair("Passing Out Year", data.passingOutYear, "Discount Category", data.scholarshipType);
        form.drawFieldPair("Applicable Discount", data.requestedDiscount, "Applying For", data.applyingFor);
      } else {
        form.drawFieldPair(
          "Discount Category",
          data.scholarshipType,
          "Applicable Discount (Table 1.1)",
          data.requestedDiscount,
        );
        form.drawFullRow("Admission Reference No", data.admissionApplicationRef);
      }

      const appliedPct =
        parseDiscountPercentValue(data.appliedDiscountPercent) ??
        parseDiscountPercentValue(data.requestedDiscount);
      const tierBottomLimit = form.contentBottom - 90;
      form.drawDiscountTierTable(data.discountTiers ?? [], appliedPct, tierBottomLimit);

      form.drawSection(
        "c",
        data.isKinship
          ? "Kin Details — Educational Record & Program Applied For"
          : "Previous UOL Education Record",
      );

      if (data.isKinship) {
        form.drawFieldPair("Name", data.kinshipDetails?.kinName, "Father's Name", data.kinshipDetails?.kinFatherName);
        form.drawFieldPair("Campus", data.kinshipDetails?.kinCampus, "Faculty", data.kinshipDetails?.kinFaculty);
        form.drawFieldPair("Department", data.kinshipDetails?.kinDepartment, "Program", data.kinshipDetails?.kinProgram);
        form.drawFieldPair(
          "Admission Ref No",
          data.kinshipDetails?.kinAdmissionRefNo,
          "Last Degree / Certificate",
          data.kinshipDetails?.kinLastDegreeCertificate,
        );
        form.drawFullRow("Passing Out Year", data.kinshipDetails?.kinPassingOutYear);
      } else {
        form.drawFieldPair("Campus", data.campus, "Faculty", data.faculty);
        form.drawFieldPair("Department", data.department, "Program", data.previousDegree);
        form.drawFieldPair("SAP ID", data.sapCode, "CGPA / Grade", data.cgpaLastDegree);
        form.drawFullRow("Passing Out Year", data.passingOutYear);
      }

      form.drawSection("d", "Documents Checklist");
      const docItems = data.isKinship
        ? [
            {
              label: "Copy of Admission Letter",
              value: findChecklistValue(["copy of admission letter", "kinship-admission-letter", "admission letter"]),
            },
            {
              label: "Academic Certificates / Transcripts (Kin)",
              value: findChecklistValue(["academic certificates/transcripts (kin)", "kinship-academic-certificates"]),
            },
            { label: "Alumni Card", value: findChecklistValue(["alumni card", "kinship-alumni-card"]) },
            { label: "FRC", value: findChecklistValue(["frc", "kinship-frc"]) },
            { label: "CNIC Copy (Kin)", value: findChecklistValue(["cnic copy (kinship)", "kinship-cnic-kin"]) },
            { label: "CNIC Copy (Alumni)", value: findChecklistValue(["cnic copy (alumni)", "kinship-cnic-alumni"]) },
          ]
        : [
            { label: "Copy of Admission Letter", value: findChecklistValue(["admission letter"]) },
            { label: "Academic Transcripts & Certificates", value: findChecklistValue(["transcripts", "certificate"]) },
            { label: "Alumni Card", value: findChecklistValue(["alumni card", "alumni proof"]) },
            { label: "Curriculum Vitae (CV)", value: findChecklistValue(["curriculum vitae", "cv"]) },
            { label: "CNIC Copy", value: findChecklistValue(["cnic"]) },
          ];
      form.drawChecklistTable(docItems);

      form.drawSignatureBlock("Reviewed By (ARO)", "Approved By (Competent Authority)");
      form.drawFooter();
      form.ensureSinglePage();

      resolve(Buffer.from(doc.output("arraybuffer")));
    } catch (e) {
      reject(e);
    }
  });
}

// ─── 2. Scholarship Letter (Narrative) ───────────────────────────────────────
export function generateScholarshipPDF(data: ScholarshipApplicationData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF({ compress: true, unit: "mm" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const m = 45; // wider margins for letter style
      const W = pageW - m * 2;
      let y = m;

      // Logo
      const logoBase64 = getLogoBase64();
      if (logoBase64) {
        try {
          const lw = 35;
          const lh = 16;
          doc.addImage(logoBase64, "PNG", pageW - m - lw, y, lw, lh, "uol-logo", "FAST");
          y += lh + 10;
        } catch {
          y += 10;
        }
      }

      // Brand line
      doc.setDrawColor(...THEME.colors.brand);
      doc.setLineWidth(0.5);
      doc.line(m, y, pageW - m, y);
      y += 12;

      // Title
      doc.setFontSize(THEME.font.h1);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...THEME.colors.brand);
      doc.text("Alumni Scholarship Application", m, y);
      y += 8;

      // Date
      const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      doc.setFontSize(THEME.font.body);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...THEME.colors.muted);
      const dateTxt = `Date: ${dateStr}`;
      const dw = doc.getTextWidth(dateTxt);
      doc.text(dateTxt, pageW - m - dw, y);
      y += 18;

      // Body helper
      const addParagraph = (text: string, bold = false, spacing = 6) => {
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setFontSize(THEME.font.body);
        doc.setTextColor(...THEME.colors.text);
        const lines = doc.splitTextToSize(text, W);
        doc.text(lines, m, y, { maxWidth: W });
        y += lines.length * (THEME.font.body * 0.42) + spacing;
      };

      addParagraph("Dear Concern,", false, 8);

      const levelLabel = discountCategoryLabel(data.discountType, data.applyingFor);
      addParagraph(
        `I, ${data.alumniName}, an alumnus of UOL, am applying for ${levelLabel}.`,
        false,
        8
      );

      if (isScholarshipKinshipCategory(data.discountType)) {
        const relation = data.kinshipRelation || "family member";
        const firstName = data.kinshipFirstName || "";
        const lastName = data.kinshipLastName || "";
        const name = firstName && lastName ? `${firstName} ${lastName}` : data.kinshipName || "beneficiary";
        const discountPercent =
          scholarshipFeeDiscountPercentForPdf(data.discountType, data.applyingFor, data.appliedDiscountPercent) ??
          (data.appliedDiscountPercent != null && Number.isFinite(Number(data.appliedDiscountPercent))
            ? `${Number(data.appliedDiscountPercent)}%`
            : "15%");
        const pronoun = relation.toLowerCase().includes("sister") ? "She" : relation.toLowerCase().includes("brother") ? "He" : "She/He";
        addParagraph(
          `I am applying for my ${relation}, ${name}. ${pronoun} can avail ${discountPercent} discount.`,
          false,
          8
        );
      } else if (isScholarshipFeeDiscountFlow(data.discountType)) {
        const discountPercent = scholarshipFeeDiscountPercentForPdf(data.discountType, data.applyingFor, data.appliedDiscountPercent);
        const level = String(data.applyingFor || "").trim() || "selected";
        if (discountPercent) {
          addParagraph(`I can avail ${discountPercent} discount for my ${level} program.`, false, 8);
        }
      } else if (data.discountType === "masters-collaboration") {
        addParagraph(
          "I am eligible to apply for the Masters Scholarship via UOL International Collaborations.",
          false,
          8
        );
      }

      addParagraph(`Degree Title: ${data.degreeTitle}`, false, 8);
      addParagraph("Please approve so that the applicant can proceed with the admission process.", false, 14);

      addParagraph("Regards,", false, 8);
      addParagraph(data.alumniName, true, 10);

      // Footer
      const fy = pageH - 25;
      doc.setDrawColor(...THEME.colors.brand);
      doc.setLineWidth(0.3);
      doc.line(m, fy, pageW - m, fy);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(THEME.font.tiny);
      doc.setTextColor(...THEME.colors.muted);
      const ft = "Office of Alumni Relations, EE2 Building 4th Floor | University of Lahore";
      const fw = doc.getTextWidth(ft);
      doc.text(ft, (pageW - fw) / 2, fy + 6);

      resolve(Buffer.from(doc.output("arraybuffer")));
    } catch (error) {
      reject(error);
    }
  });
}

// ─── 3. Membership Form PDF (Tabular) ────────────────────────────────────────
export function generateMembershipFormPDF(data: MembershipFormPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF({ compress: true, unit: "mm" });
      const pageH = doc.internal.pageSize.getHeight();
      const availableHeight = pageH - THEME.margin * 2 - 24;

      const metrics = pickFormMetrics(
        (preset) =>
          estimateMembershipFormHeight(
            preset,
            data.facilityType,
            Math.max(2, data.documentsChecklist?.length ?? 0),
          ),
        availableHeight,
      );
      const form = createApplicationFormRenderer(doc, metrics);

      form.drawHeader(data.headerTitle);
      form.drawFormBodyStart();

      const appRef = String(data.applicationRef || "").trim();
      if (appRef) {
        form.drawFieldPair("Application Date", data.dateFormatted, "Application ID", appRef);
      } else {
        form.drawFullRow("Application Date", data.dateFormatted);
      }

      form.drawSection("A", "Alumni Personal Details");
      form.drawFieldPair("Name", data.studentName, "Father's Name", data.fatherName);
      form.drawFieldPair("SAP ID", data.sapCode, "CNIC", data.cnic);
      form.drawFieldPair("Campus", data.campus, "Mobile No", data.emergencyContactNumber);
      form.drawFieldPair("Email Address", data.email, "DOB", data.dob);
      form.drawFieldPair("Degree/Program", data.program, "Passing out Year", data.passingOutYear);




      if (data.facilityType === "pool") {
        form.drawSection("B", "Membership Details");
        form.drawFieldPair("Membership Type", data.membershipType, "Pool Location", data.poolLocation);
        form.drawFieldPair("Preferred Timing", data.preferredTiming, "Valid From", data.membershipStartDate);
        form.drawFieldPair("Payment Amount Due", formatPaymentAmount(data.paymentAmount), "Applied Discount %", formatDiscountPercent(data.discountPercent));
        form.drawFullRow("Original Amount", formatPaymentAmount(data.originalAmount));
        form.drawFullRow("Valid To", data.validTill);

        form.drawSection("C", "Swimming Information");
        form.drawFieldPair("Swimming Level", data.swimmingLevel, "Any Medical Condition", data.hasMedicalCondition);
        
        form.drawSection("D", "Medical & Fitness Information");
        form.drawFieldPair("Medical Conditions", data.medicalConditions, "Physical Disability", data.physicalDisability);
        form.drawFullRow("Allergies", data.allergies);
        
        form.drawSection("E", "Emergency Contact");
        form.drawFieldPair("Contact Name", data.emergencyContactName, "Relationship", data.emergencyContactRelationship);
        form.drawFullRow("Contact Number", data.emergencyContactNumber);

        form.drawSection("F", "Document Checklist");
        form.drawChecklistTable(data.documentsChecklist.map((item) => ({ label: item.label, value: item.status })));

        form.drawSection("G", "Declaration");
        form.drawFullRow("Declaration", data.declarationText);
        form.drawFullRow("Note : ", "Any revision in the membership fee after this month will be communicated by the pool manager.")
      } else if (data.facilityType === "cricket") {
        form.drawSection("c", "Cricket Membership Details");
        form.drawFieldPair("Membership Category", data.membershipCategory, "Membership Type", data.membershipType);
        form.drawFieldPair("Playing Category", data.playingCategory, "Playing Role", data.playingRole);
        form.drawFieldPair("Preferred Practice Session", data.preferredTiming, "Valid From", data.membershipStartDate);
        form.drawFieldPair("Payment Amount Due", formatPaymentAmount(data.paymentAmount), "Applied Discount %", formatDiscountPercent(data.discountPercent));
        form.drawFullRow("Original Amount", formatPaymentAmount(data.originalAmount));
        form.drawFullRow("Valid Till", data.validTill);

        form.drawSection("d", "Playing Information");
        form.drawFullRow("Previous Club (if any)", data.previousClub);
        form.drawFieldPair("Highest Playing Level", data.highestPlayingLevel, "Any Injury History", data.injuryHistory);

        form.drawSection("e", "Emergency Contact");
        form.drawFieldPair("Name", data.emergencyContactName, "Phone", data.emergencyContactNumber);

        form.drawSection("f", "Document Checklist");
        form.drawChecklistTable(data.documentsChecklist.map((item) => ({ label: item.label, value: item.status })));
        form.drawFullRow("Note : ", "Any revision in the membership fee after this month will be communicated by the Qalandar Club manager.")
      } else {
        form.drawSection("B", "Membership Details");
        form.drawFieldPair("Applying For", data.applyingFor, "Applied Discount %", formatDiscountPercent(data.discountPercent));
        form.drawFieldPair("Membership Type", data.membershipType,"Preferred Timing", data.preferredTiming);
        form.drawFieldPair("Valid From", data.membershipStartDate, "Valid To", data.validTill);
        form.drawFieldPair("Original Amount", formatPaymentAmount(data.originalAmount),"Payment Amount Due", formatPaymentAmount(data.paymentAmount));

        form.drawSection("C", "Medical & Fitness Information");
        form.drawFieldPair("Medical Conditions", data.medicalConditions, "Physical Disability", data.physicalDisability);
        form.drawFullRow("Allergies", data.allergies);

        form.drawSection("D", "Emergency Contact");
        form.drawFieldPair("Contact Name", data.emergencyContactName, "Relationship", data.emergencyContactRelationship);
        form.drawFullRow("Contact Number", data.emergencyContactNumber);

        form.drawSection("E", "Documents Checklist");
        form.drawChecklistTable(data.documentsChecklist.map((item) => ({ label: item.label, value: item.status })));
      
        form.drawSection("G", "Declaration");
        form.drawFullRow("Declaration", data.declarationText);
        form.drawFullRow("Note : ", "Any revision in the membership fee after this month will be communicated by the gym manager.")
      }

      form.drawMembershipSignatures("Reviewed By (ARO)", "1. Approved By (ARO)", "2. Approved By (Facility Manager )");
      form.drawFooter();
      form.ensureSinglePage();

      resolve(Buffer.from(doc.output("arraybuffer")));
    } catch (e) {
      reject(e);
    }
  });
}

/** @deprecated Use generateMembershipFormPDF */
export function generateMembershipPDF(data: MembershipFormPDFData): Promise<Buffer> {
  return generateMembershipFormPDF(data);
}

// ─── 4. Leadership Application PDF ───────────────────────────────────────────
export function generateLeadershipApplicationPDF(data: LeadershipApplicationPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF({ compress: true, unit: "mm" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const m = THEME.margin;
      const W = pageW - m * 2;
      const footerReserve = 12;
      let y = m;

      const statusLower = String(data.status || "pending").toLowerCase();
      const showAssessmentMarks =
        statusLower === "approved" || statusLower === "assessed" || statusLower === "rejected";

      const pageBottom = () => pageH - m - footerReserve;

      const drawPageFooter = () => {
        const footerY = pageH - 8;
        doc.setDrawColor(...THEME.colors.brand);
        doc.setLineWidth(0.25);
        doc.line(m, footerY - 3, pageW - m, footerY - 3);
        doc.setFontSize(THEME.font.tiny);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...THEME.colors.muted);
        const ft = "Office of Alumni Relations, EE2 Building 4th Floor | University of Lahore";
        const fw = doc.getTextWidth(ft);
        doc.text(ft, (pageW - fw) / 2, footerY);
        const pageNum = `Page ${doc.getCurrentPageInfo().pageNumber}`;
        doc.text(pageNum, pageW - m - doc.getTextWidth(pageNum), footerY);
      };

      const ensureSpace = (need: number) => {
        if (y + need <= pageBottom()) return;
        drawPageFooter();
        doc.addPage();
        y = m;
      };

      const setStyle = (size: number, bold = false, color: [number, number, number] = THEME.colors.text) => {
        doc.setFontSize(size);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setTextColor(color[0], color[1], color[2]);
      };

      const lineH = (size: number) => size * 0.42;

      const drawSectionTitle = (title: string) => {
        ensureSpace(10);
        const barH = 6.5;
        doc.setFillColor(...THEME.colors.brandLight);
        doc.setDrawColor(...THEME.colors.brand);
        doc.setLineWidth(0.3);
        doc.rect(m, y, 2.5, barH, "F");
        doc.rect(m, y, W, barH, "S");
        setStyle(THEME.font.small, true, THEME.colors.brand);
        doc.text(title.toUpperCase(), m + 5, y + 4.3);
        y += barH + 4;
      };

      const drawInfoGrid = (pairs: Array<{ label: string; value: string }>, cols = 2) => {
        const gap = 3;
        const colWidth = (W - (cols - 1) * gap) / cols;
        const rows = Math.ceil(pairs.length / cols);
        for (let r = 0; r < rows; r++) {
          const rowPairs = pairs.slice(r * cols, r * cols + cols);
          let rowH = 0;
          rowPairs.forEach((p) => {
            const lines = doc.splitTextToSize(clamp(p.value), colWidth - 6);
            rowH = Math.max(rowH, lines.length * lineH(THEME.font.body) + 7);
          });
          rowH = Math.max(10, rowH);
          ensureSpace(rowH + 2);

          rowPairs.forEach((p, i) => {
            const x = m + i * (colWidth + gap);
            doc.setFillColor(250, 250, 250);
            doc.setDrawColor(...THEME.colors.border);
            doc.setLineWidth(0.1);
            doc.rect(x, y, colWidth, rowH, "FD");
            setStyle(THEME.font.tiny, true, THEME.colors.muted);
            doc.text(clamp(p.label).toUpperCase(), x + 2.5, y + 3.5);
            setStyle(THEME.font.body, false, THEME.colors.text);
            doc.text(doc.splitTextToSize(clamp(p.value), colWidth - 6), x + 2.5, y + 7);
          });
          y += rowH + 2;
        }
      };

      const drawTextBlock = (text: string, maxWidth = W) => {
        ensureSpace(12);
        setStyle(THEME.font.body, false, THEME.colors.text);
        const lines = doc.splitTextToSize(text, maxWidth);
        ensureSpace(lines.length * lineH(THEME.font.body) + 4);
        doc.text(lines, m, y);
        y += lines.length * lineH(THEME.font.body) + 4;
      };

      // ── Branded header ──
      const headerH = 22;
      doc.setFillColor(...THEME.colors.brand);
      doc.rect(m, y, W, headerH, "F");

      const photoW = 18;
      const photoH = 22;
      const profilePhoto = data.alumniProfilePhoto;
      if (profilePhoto?.dataUrl) {
        try {
          doc.setDrawColor(255, 255, 255);
          doc.setFillColor(255, 255, 255);
          doc.rect(m + 2, y + 2, photoW, photoH - 4, "F");
          doc.addImage(
            profilePhoto.dataUrl,
            profilePhoto.format,
            m + 2.5,
            y + 2.5,
            photoW - 1,
            photoH - 5,
            "alumni-profile-photo",
            "FAST"
          );
        } catch {
          // skip photo on failure
        }
      }

      const titleX = m + (profilePhoto?.dataUrl ? photoW + 6 : 4);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("Leadership Application", titleX, y + 10);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.text("Office of Alumni Relations — University of Lahore", titleX, y + 15.5);

      const logoBase64 = getLogoBase64("light");
      if (logoBase64) {
        try {
          doc.addImage(logoBase64, "PNG", pageW - m - 34, y + 4, 32, 14, "uol-logo", "FAST");
        } catch {
          // skip logo on failure
        }
      }

      y += headerH + 6;

      // ── Application overview ──
      const appType = data.leadershipType === "chapter" ? "Chapter" : "Association";
      const catName = (() => {
        const t = String(data.categoryType || "").toLowerCase();
        const name = String(data.categoryName || "").trim();
        if (!name) return "—";
        if (t === "national") return `National Chapter — ${name}`;
        if (t === "international") return `International Chapter — ${name}`;
        if (t === "association") return `Association — ${name}`;
        return name;
      })();

      const sapOrReg =
        String(data.applicant.sapId || "").trim() ||
        String(data.applicant.registrationNo || "").trim() ||
        "—";

      drawInfoGrid(
        [
          { label: "Application Type", value: appType },
          { label: "Chapter / Association", value: catName },
          { label: "Role Applied For", value: data.position },
          { label: "Application Date", value: formatLeadershipDate(data.createdAt) },
          { label: "Application Status", value: formatLeadershipStatus(data.status) },
          { label: "SAP / Reg No", value: sapOrReg },
        ],
        2
      );

      y += 2;

      // ── Personal information ──
      drawSectionTitle("Personal Information");
      drawInfoGrid(
        [
          { label: "Full Name", value: data.applicant.name },
          { label: "Gender", value: data.applicant.gender || "—" },
          { label: "Faculty", value: data.applicant.faculty || "—" },
          { label: "Department", value: data.applicant.department || "—" },
          { label: "Program", value: data.applicant.program || "—" },
          { label: "Passing Year", value: data.applicant.passingYear ? String(data.applicant.passingYear) : "—" },
          { label: "Phone", value: data.applicant.phone || "—" },
          { label: "Email", value: data.applicant.email || "—" },
        ],
        2
      );

      // ── Role description ──
      drawSectionTitle("Role Description");
      drawTextBlock(stripHtmlForPdf(data.roleDescription));

      // ── Criteria table ──
      drawSectionTitle("Criteria Assessment");

      const cW = {
        req: W * 0.50,
        marks: W * 0.12,
        obtained: W * 0.14,
        alumni: W * 0.24,
      };
      const cX = {
        req: m,
        marks: m + cW.req,
        obtained: m + cW.req + cW.marks,
        alumni: m + cW.req + cW.marks + cW.obtained,
      };

      const drawTableHeader = () => {
        ensureSpace(9);
        const hh = 7;
        doc.setFillColor(...THEME.colors.brand);
        doc.setDrawColor(...THEME.colors.brand);
        doc.setLineWidth(0.15);
        doc.rect(m, y, W, hh, "F");
        doc.line(cX.marks, y, cX.marks, y + hh);
        doc.line(cX.obtained, y, cX.obtained, y + hh);
        doc.line(cX.alumni, y, cX.alumni, y + hh);
        setStyle(THEME.font.tiny, true, THEME.colors.white);
        doc.text("Requirement", cX.req + 2, y + 4.5);
        doc.text("Marks", cX.marks + 2, y + 4.5);
        doc.text("Obtained", cX.obtained + 2, y + 4.5);
        doc.text("Alumni Response", cX.alumni + 2, y + 4.5);
        y += hh;
      };

      const drawTableRow = (
        cells: { req: string; marks: string; obtained: string; alumni: string },
        shaded = false
      ) => {
        const reqLines = doc.splitTextToSize(cells.req, cW.req - 4);
        const marksLines = doc.splitTextToSize(cells.marks, cW.marks - 3);
        const obtainedLines = doc.splitTextToSize(cells.obtained, cW.obtained - 3);
        const alumniLines = doc.splitTextToSize(cells.alumni, cW.alumni - 4);
        const lines = Math.max(reqLines.length, marksLines.length, obtainedLines.length, alumniLines.length, 1);
        const rowH = lines * lineH(THEME.font.tiny) + 5;

        if (y + rowH > pageBottom()) {
          drawPageFooter();
          doc.addPage();
          y = m;
          drawTableHeader();
        }

        if (shaded) {
          doc.setFillColor(248, 250, 248);
          doc.rect(m, y, W, rowH, "F");
        }
        doc.setDrawColor(...THEME.colors.border);
        doc.setLineWidth(0.1);
        doc.line(m, y + rowH, m + W, y + rowH);
        doc.line(cX.marks, y, cX.marks, y + rowH);
        doc.line(cX.obtained, y, cX.obtained, y + rowH);
        doc.line(cX.alumni, y, cX.alumni, y + rowH);

        setStyle(THEME.font.tiny, false, THEME.colors.text);
        doc.text(reqLines, cX.req + 2, y + 4, { maxWidth: cW.req - 4 });
        doc.text(marksLines, cX.marks + 2, y + 4, { maxWidth: cW.marks - 3 });
        doc.text(obtainedLines, cX.obtained + 2, y + 4, { maxWidth: cW.obtained - 3 });
        doc.text(alumniLines, cX.alumni + 2, y + 4, { maxWidth: cW.alumni - 4 });
        y += rowH;
      };

      const proficiencyMap = (() => {
        try {
          const raw = data.optionalCriteriaProficiency;
          let obj: unknown = raw;
          if (typeof obj === "string") {
            const s = obj.trim();
            if (!s) return {} as Record<string, number>;
            obj = JSON.parse(s);
          }
          if (!obj || typeof obj !== "object") return {} as Record<string, number>;
          const rec = obj as Record<string, unknown>;
          const out: Record<string, number> = {};
          for (const [k, v] of Object.entries(rec)) {
            const id = Number(k);
            const rating = Number(v);
            if (!Number.isFinite(id) || id <= 0) continue;
            if (!Number.isFinite(rating) || rating < 1) continue;
            out[String(id)] = Math.min(5, Math.max(1, Math.round(rating)));
          }
          return out;
        } catch {
          return {} as Record<string, number>;
        }
      })();

      let criteriaTotalMarks = 0;
      let criteriaTotalObtained = 0;

      if (!data.criteria || data.criteria.length === 0) {
        setStyle(THEME.font.body, false, THEME.colors.muted);
        doc.text("No criteria found.", m, y);
        y += 6;
      } else {
        drawTableHeader();
        let totalMarks = 0;
        let totalObtained = 0;

        data.criteria.forEach((c, idx) => {
          const alumniResp = String(c.alumniResponse ?? "").toUpperCase();
          const alumniSelected =
            alumniResp === "YES" || alumniResp === "NO" ? alumniResp : c.alumniConfirmed ? "YES" : "NO";
          const marksNum = Number.isFinite(Number(c.criterionScore))
            ? normalizeObtainedMark(Number(c.criterionScore))
            : NaN;
          const marksCell =
            Number.isFinite(marksNum) && marksNum > 0 ? formatObtainedMarkDisplay(marksNum) : "N/A";

          const obtainedStored = c.obtainedMarks;
          const obtainedCell = !showAssessmentMarks
            ? "—"
            : Number.isFinite(Number(obtainedStored))
              ? formatObtainedMarkDisplay(Number(obtainedStored))
              : "—";

          if (Number.isFinite(marksNum) && marksNum > 0) {
            totalMarks += marksNum;
            if (showAssessmentMarks && Number.isFinite(Number(obtainedStored))) {
              totalObtained += normalizeObtainedMark(Number(obtainedStored));
            }
          }

          let alumniCell = alumniSelected === "YES" ? "Yes" : "No";
          if (alumniSelected === "YES" && !c.isMandatory) {
            const rating = Number(proficiencyMap[String(c.id)] ?? 0);
            const safeRating = Number.isFinite(rating) ? Math.min(5, Math.max(0, Math.round(rating))) : 0;
            if (safeRating >= 1) {
              const label = proficiencyLabelForPdf(safeRating);
              alumniCell = label ? `Yes (${safeRating}/5 — ${label})` : `Yes (${safeRating}/5)`;
            } else {
              alumniCell = "Yes (no rating)";
            }
          }

          const criterionText = (() => {
            const label = String(c.label || "-");
            const desc = c.description ? `Note: ${String(c.description)}` : "";
            const parts = [label, desc].filter(Boolean);
            if (!c.hasTextbox) return parts.join("\n");
            const response =
              c.alumniTextResponse && String(c.alumniTextResponse).trim()
                ? sanitizePdfText(c.alumniTextResponse, 6_000)
                : "No response provided";
            const tbLabel = String(c.textboxLabel || "Response");
            return [...parts, `${tbLabel}: ${response}`].join("\n");
          })();

          drawTableRow(
            { req: criterionText, marks: marksCell, obtained: obtainedCell, alumni: alumniCell },
            idx % 2 === 1
          );
        });

        criteriaTotalMarks = totalMarks;
        criteriaTotalObtained = totalObtained;

        if (totalMarks > 0) {
          ensureSpace(9);
          doc.setFillColor(...THEME.colors.brandLight);
          doc.setDrawColor(...THEME.colors.border);
          doc.setLineWidth(0.15);
          const resultH = 7;
          doc.rect(m, y, W, resultH, "FD");
          setStyle(THEME.font.small, true, THEME.colors.brand);
          doc.text(
            `Criteria Total: ${formatObtainedMarkDisplay(totalMarks)}   |   Obtained: ${
              showAssessmentMarks ? formatObtainedMarkDisplay(totalObtained) : "—"
            }`,
            m + 2,
            y + 4.5
          );
          y += resultH + 4;
        }
      }

      // ── Bonus assessment ──
      const strategyMarks = Number.isFinite(Number(data.strategyAssessmentMarks))
        ? normalizeObtainedMark(Number(data.strategyAssessmentMarks))
        : 0;
      const achievementsMarks = Number.isFinite(Number(data.achievementAssessmentMarks))
        ? normalizeObtainedMark(Number(data.achievementAssessmentMarks))
        : 0;
      const bonusMarks = Number.isFinite(Number(data.bonusMarks))
        ? normalizeObtainedMark(Number(data.bonusMarks))
        : normalizeObtainedMark(strategyMarks + achievementsMarks);

      drawSectionTitle("Bonus Assessment");

      const planStrategyText = sanitizePdfText(data.planStrategy, 12_000) || "No response provided";
      const additionalAchievementsText = sanitizePdfText(data.additionalAchievements, 12_000) || "No response provided";
      const halfW = (W - 4) / 2;
      const boxPad = 3;

      const measureBonusBox = (question: string, answer: string, width: number) => {
        const innerW = width - boxPad * 2;
        const qLines = doc.splitTextToSize(question, innerW);
        const aLines = doc.splitTextToSize(answer, innerW);
        const questionH = qLines.length * lineH(THEME.font.tiny);
        const maxMarksH = lineH(THEME.font.tiny) + 1;
        const answerH = aLines.length * lineH(THEME.font.tiny);
        return questionH + maxMarksH + answerH + boxPad * 2 + 4;
      };

      const drawBonusBox = (
        x: number,
        question: string,
        maxMarks: number,
        answer: string,
        width: number,
        height: number
      ) => {
        const innerW = width - boxPad * 2;
        doc.setFillColor(252, 252, 252);
        doc.setDrawColor(...THEME.colors.border);
        doc.setLineWidth(0.15);
        doc.rect(x, y, width, height, "FD");

        let innerY = y + boxPad;
        setStyle(THEME.font.tiny, true, THEME.colors.brand);
        const qLines = doc.splitTextToSize(question, innerW);
        doc.text(qLines, x + boxPad, innerY);
        innerY += qLines.length * lineH(THEME.font.tiny) + 1;

        setStyle(THEME.font.tiny, false, THEME.colors.muted);
        doc.text(`(Maximum marks: ${maxMarks})`, x + boxPad, innerY);
        innerY += lineH(THEME.font.tiny) + 2;

        setStyle(THEME.font.tiny, false, THEME.colors.text);
        doc.text(doc.splitTextToSize(answer, innerW), x + boxPad, innerY);
      };

      const boxH = Math.max(
        measureBonusBox(LEADERSHIP_PLAN_STRATEGY_QUESTION, planStrategyText, halfW),
        measureBonusBox(LEADERSHIP_ADDITIONAL_ACHIEVEMENTS_QUESTION, additionalAchievementsText, halfW),
        28
      );
      ensureSpace(boxH + 14);

      drawBonusBox(m, LEADERSHIP_PLAN_STRATEGY_QUESTION, 15, planStrategyText, halfW, boxH);
      drawBonusBox(m + halfW + 4, LEADERSHIP_ADDITIONAL_ACHIEVEMENTS_QUESTION, 10, additionalAchievementsText, halfW, boxH);

      y += boxH + 4;
      setStyle(THEME.font.body, false, THEME.colors.text);
      doc.text(`Strategy: ${formatObtainedMarkDisplay(strategyMarks)} / 15`, m, y);
      doc.text(`Achievements: ${formatObtainedMarkDisplay(achievementsMarks)} / 10`, m + halfW + 4, y);
      y += 5;
      setStyle(THEME.font.body, true, THEME.colors.brand);
      doc.text(`Bonus Marks Total: ${formatObtainedMarkDisplay(bonusMarks)} / 25`, m, y);
      y += 8;

      // ── Assessment summary ──
      drawSectionTitle("Assessment Summary");
      const grandObtained = normalizeObtainedMark(criteriaTotalObtained + bonusMarks);
      const grandMaximum = normalizeObtainedMark(criteriaTotalMarks + 25);

      ensureSpace(22);
      doc.setFillColor(...THEME.colors.brandLight);
      doc.setDrawColor(...THEME.colors.brand);
      doc.setLineWidth(0.2);
      const summaryH = 18;
      doc.rect(m, y, W, summaryH, "FD");
      setStyle(THEME.font.body, false, THEME.colors.text);
      doc.text(
        `Assessment Marks: ${showAssessmentMarks ? formatObtainedMarkDisplay(criteriaTotalObtained) : "—"} / ${formatObtainedMarkDisplay(criteriaTotalMarks)}`,
        m + 3,
        y + 6
      );
      doc.text(`Bonus Marks: ${formatObtainedMarkDisplay(bonusMarks)} / 25`, m + 3, y + 11);
      setStyle(THEME.font.body, true, THEME.colors.brand);
      doc.text(
        `Grand Total: ${showAssessmentMarks ? formatObtainedMarkDisplay(grandObtained) : "—"} / ${formatObtainedMarkDisplay(grandMaximum)}`,
        m + 3,
        y + 16
      );
      y += summaryH + 6;

      // ── Uploaded documents ──
      drawSectionTitle("Uploaded Documents");
      const uploaded = Array.isArray(data.uploadedDocuments) ? data.uploadedDocuments : [];
      if (!uploaded.length) {
        setStyle(THEME.font.body, false, THEME.colors.muted);
        doc.text("No documents uploaded.", m, y);
        y += 5;
      } else {
        uploaded.forEach((d, idx) => {
          const label = String(d.label || "Document");
          const fileName = fileNameFromUrlPdf(String(d.url || ""));
          const value = fileName || String(d.url || "-");
          ensureSpace(8);
          if (idx % 2 === 0) {
            doc.setFillColor(252, 252, 252);
            doc.rect(m, y - 1, W, 7, "F");
          }
          setStyle(THEME.font.tiny, true, THEME.colors.muted);
          doc.text(`${label}:`, m + 2, y + 3);
          const lw = doc.getTextWidth(`${label}:`);
          setStyle(THEME.font.tiny, false, THEME.colors.text);
          const valLines = doc.splitTextToSize(value, W - lw - 8);
          doc.text(valLines, m + lw + 4, y + 3);
          y += Math.max(valLines.length * lineH(THEME.font.tiny), 5) + 1;
        });
      }

      // ── Signatures ──
      drawSectionTitle("Signatures");
      const sigGap = 8;
      const sigColW = (W - sigGap) / 2;
      const sigBoxH = 30;
      ensureSpace(sigBoxH + 4);

      const drawSignatureBox = (
        x: number,
        title: string,
        name: string | null | undefined,
        dateValue: string | null | undefined
      ) => {
        doc.setFillColor(252, 252, 252);
        doc.setDrawColor(...THEME.colors.border);
        doc.setLineWidth(0.2);
        doc.rect(x, y, sigColW, sigBoxH, "FD");

        setStyle(THEME.font.small, true, THEME.colors.brand);
        doc.text(title, x + 3, y + 5);

        const displayName = String(name || "").trim();
        const nameY = y + 12;
        if (displayName) {
          setStyle(THEME.font.body, false, THEME.colors.text);
          const nameLines = doc.splitTextToSize(displayName, sigColW - 6);
          doc.text(nameLines, x + 3, nameY);
        }

        const lineY = y + 20;
        doc.setDrawColor(...THEME.colors.muted);
        doc.setLineWidth(0.25);
        doc.line(x + 3, lineY, x + sigColW - 3, lineY);

        setStyle(THEME.font.tiny, false, THEME.colors.muted);
        doc.text("Signature", x + 3, lineY - 1.5);

        const dateText = dateValue ? formatLeadershipDate(dateValue) : "____________________";
        setStyle(THEME.font.tiny, false, THEME.colors.text);
        doc.text(`Date: ${dateText}`, x + 3, y + 26);
      };

      const assessedByDisplay =
        String(data.assessedByName || "").trim() ||
        String(data.assessedByEmail || "").trim() ||
        null;

      drawSignatureBox(m, "Assessed by", assessedByDisplay, data.assessedAt);
      drawSignatureBox(
        m + sigColW + sigGap,
        "Approved by",
        null,
        statusLower === "approved" ? data.approvedAt : null
      );

      y += sigBoxH + 6;

      // Footers on all pages
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        drawPageFooter();
      }

      resolve(Buffer.from(doc.output("arraybuffer")));
    } catch (error) {
      reject(error);
    }
  });
}

// ─── 5. Upskill PDF (Letter) ─────────────────────────────────────────────────
export function generateUpskillPDF(data: UpskillApplicationData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF({ compress: true, unit: "mm" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const m = 45;
      const W = pageW - m * 2;
      let y = m;

      const logoBase64 = getLogoBase64();
      if (logoBase64) {
        try {
          const lw = 35;
          const lh = 16;
          doc.addImage(logoBase64, "PNG", pageW - m - lw, y, lw, lh, "uol-logo", "FAST");
          y += lh + 10;
        } catch {
          y += 10;
        }
      }

      doc.setDrawColor(...THEME.colors.brand);
      doc.setLineWidth(0.5);
      doc.line(m, y, pageW - m, y);
      y += 12;

      doc.setFontSize(THEME.font.h1);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...THEME.colors.brand);
      doc.text("Upskill & Reskill Course Application", m, y);
      y += 8;

      const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      doc.setFontSize(THEME.font.body);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...THEME.colors.muted);
      const dw = doc.getTextWidth(`Date: ${dateStr}`);
      doc.text(`Date: ${dateStr}`, pageW - m - dw, y);
      y += 18;

      const addParagraph = (text: string, bold = false, spacing = 6) => {
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setFontSize(THEME.font.body);
        doc.setTextColor(...THEME.colors.text);
        const lines = doc.splitTextToSize(text, W);
        doc.text(lines, m, y, { maxWidth: W });
        y += lines.length * (THEME.font.body * 0.42) + spacing;
      };

      addParagraph("Dear Concern,", false, 8);
      addParagraph(
        `I, ${data.alumniName}, an alumnus of UOL, am applying for the ${data.courseName} offered by the ${data.departmentName} with 15% discount.`,
        false,
        8
      );
      addParagraph("Please approve my application so I can proceed with enrollment in this course/program.", false, 14);
      addParagraph("Regards,", false, 8);
      addParagraph(data.alumniName, true, 10);

      const fy = pageH - 25;
      doc.setDrawColor(...THEME.colors.brand);
      doc.setLineWidth(0.3);
      doc.line(m, fy, pageW - m, fy);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(THEME.font.tiny);
      doc.setTextColor(...THEME.colors.muted);
      const ft = "Office of Alumni Relations, EE2 Building 4th Floor | University of Lahore";
      const fw = doc.getTextWidth(ft);
      doc.text(ft, (pageW - fw) / 2, fy + 6);

      resolve(Buffer.from(doc.output("arraybuffer")));
    } catch (error) {
      reject(error);
    }
  });
}