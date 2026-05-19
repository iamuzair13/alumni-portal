import { jsPDF } from "jspdf";
import { formatObtainedMarkDisplay, normalizeObtainedMark } from "@/lib/leadershipMarks";
import {
  discountCategoryLabel,
  isScholarshipFeeDiscountFlow,
  isScholarshipKinshipCategory,
  scholarshipFeeDiscountPercentForPdf,
} from "@/lib/scholarshipLetter";
import { readFileSync } from "fs";
import { join } from "path";

// Helper function to get logo as base64
function getLogoBase64(variant: "light" | "dark" = "dark"): string {
  // Keep PDF logo source aligned with app header branding.
  const lightCandidates = [
    // Prefer lightweight assets to avoid huge PDFs.
    join(process.cwd(), "public", "images", "logo", "logo-white.png"),
    join(process.cwd(), "public", "images", "logo", "UOL-LOGO-White.png"),
  ];
  const darkCandidates = [
    // Dark logos are usually not transparent here; use when a colored banner is not used.
    join(process.cwd(), "public", "images", "logo", "UOL-Rebrand-ID_Final-04.png"),
    join(process.cwd(), "public", "images", "logo", "UOL-Rebrand-ID_Final-01.png"),
  ];
  const candidates = variant === "light" ? [...lightCandidates, ...darkCandidates] : [...darkCandidates, ...lightCandidates];
  for (const logoPath of candidates) {
    try {
      const logoBuffer = readFileSync(logoPath);
      return `data:image/png;base64,${logoBuffer.toString("base64")}`;
    } catch {
      // try next candidate
    }
  }
  return "";
}

export interface ScholarshipApplicationData {
  alumniName: string;
  discountType: string;
  applyingFor: string;
  degreeTitle: string;
  kinshipRelation?: string | null;
  kinshipFirstName?: string | null;
  kinshipLastName?: string | null;
  kinshipName?: string | null; // Keep for backward compatibility
}

export interface ScholarshipLetterPDFData {
  dateFormatted: string;
  studentName: string;
  scholarshipType: string;
  applyingFor: string;
  previousDegree: string;
  cgpaLastDegree: string;
  requestedDiscount: string;
  documentsAttached: string[];
  sapCode: string;
  /** Alumni passing-out year from profile (e.g. tbl_alumni.yearofending) */
  passingOutYear?: string | null;
  /** Admission reference / application ID entered on the scholarship form */
  admissionApplicationRef?: string | null;
  /** e.g. AS-S-2026-001 / AS-K-2026-001 — shown next to Application Date when category applies */
  scholarshipApplicationPdfId?: string | null;
  /** Stored discount category (`discount_type`); drives banner Self vs Kinship title */
  discountType?: string | null;
  // Optional fields to support enhanced tabular layout
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
  alumniCardSubmitted: string;
  cnicDocSubmitted: string;
}

export function generateScholarshipLetterPDF(data: ScholarshipLetterPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF({ compress: true });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 18;
      const maxWidth = pageWidth - margin * 2;
      let y = margin;

      const clamp = (text: string | null | undefined) => {
        const value = String(text || "").replace(/\s+/g, " ").trim();
        return value || "Data unavailable";
      };

      const normalizeAdminVerified = (raw: unknown): "YES" | "NO" | null => {
        const s = String(raw ?? "")
          .trim()
          .toUpperCase();
        if (s === "YES" || s === "Y") return "YES";
        if (s === "NO" || s === "N") return "NO";
        return null;
      };

      /** Match uploaded doc rows by label keywords; show a single Yes/No from admin verification only. */
      const findChecklistValue = (keywords: string[]) => {
        const docs = data.uploadedDocuments || [];
        for (const d of docs) {
          const label = String(d.label || "")
            .trim()
            .toLowerCase();
          if (!label) continue;
          if (!keywords.some((k) => label.includes(k))) continue;
          const v = normalizeAdminVerified(d.adminVerified);
          if (v === "YES") return "Yes";
          if (v === "NO") return "No";
          return "—";
        }
        return "—";
      };

      // Section header greens (lighter than brand green 0, 102, 51). (d) uses a brighter band per official layout.
      const sectionGreen1: [number, number, number] = [150, 205, 175];
      const sectionGreen2: [number, number, number] = [195, 230, 210];
      const sectionGreenDocs: [number, number, number] = [115, 198, 155];

      const headerBandH = 22;
      doc.setFillColor(0, 102, 51);
      doc.rect(margin, y, maxWidth, headerBandH, "F");
      const logoBase64 = getLogoBase64("light");
      if (logoBase64) {
        try {
          doc.addImage(logoBase64, "PNG", margin + 2, y + 5, 30, 12, "uol-logo", "FAST");
        } catch {
          // ignore logo rendering failure
        }
      }
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      const headerTitle =
        isScholarshipKinshipCategory(data.discountType)
          ? "ALUMNI SCHOLARSHIP APPLICATION (KINSHIP)"
          : isScholarshipFeeDiscountFlow(data.discountType)
            ? "ALUMNI SCHOLARSHIP APPLICATION (SELF)"
            : "ALUMNI SCHOLARSHIP APPLICATION";
      let headerFontSize = 10;
      doc.setFontSize(headerFontSize);
      let headerTitleW = doc.getTextWidth(headerTitle);
      while (headerTitleW > maxWidth - 8 && headerFontSize > 7) {
        headerFontSize -= 0.5;
        doc.setFontSize(headerFontSize);
        headerTitleW = doc.getTextWidth(headerTitle);
      }
      doc.text(headerTitle, margin + Math.max(0, (maxWidth - headerTitleW) / 2), y + headerBandH / 2 + 3.2);
      doc.setTextColor(0, 0, 0);
      y += headerBandH + 3;

      const outerX = margin;
      const outerY = y;
      const outerW = maxWidth;
      const rowHeights = {
        date: 8,
        section: 8,
        normal: 8,
        docsRow: 8,
      };

      const c1 = outerW * 0.26;
      const c2 = outerW * 0.24;
      const c3 = outerW * 0.26;
      const c4 = outerW - c1 - c2 - c3;
      const x2 = outerX + c1;
      const x3 = x2 + c2;
      const x4 = x3 + c3;
      const toCellLines = (text: string, width: number, bold = false, maxLines = 3) => {
        let fontSize = 9;
        const shown = clamp(text);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setFontSize(fontSize);
        let lines = doc.splitTextToSize(shown, Math.max(8, width - 3));
        while (lines.length > maxLines && fontSize > 7) {
          fontSize -= 0.5;
          doc.setFontSize(fontSize);
          lines = doc.splitTextToSize(shown, Math.max(8, width - 3));
        }
        const shownLines = lines.slice(0, maxLines);
        if (lines.length > maxLines) {
          const last = shownLines[shownLines.length - 1] || "";
          shownLines[shownLines.length - 1] = `${last.slice(0, Math.max(0, last.length - 2))}..`;
        }
        return { lines: shownLines as string[], fontSize };
      };

      const drawCellText = (
        text: string,
        x: number,
        rowY: number,
        w: number,
        h: number,
        bold = false,
        center = false,
        prepared?: { lines: string[]; fontSize: number },
        centerPad?: { x?: number; y?: number }
      ) => {
        doc.setFont("helvetica", bold ? "bold" : "normal");
        if (center) {
          doc.setFontSize(9);
          const shown = clamp(text);
          const tw = doc.getTextWidth(shown);
          const px = centerPad?.x ?? 1.5;
          const py = centerPad?.y ?? 0;
          doc.text(
            shown,
            x + px + Math.max(0, (w - 2 * px - tw) / 2),
            rowY + h / 2 + 2.2 + py
          );
          return;
        }
        const cell = prepared || toCellLines(text, w, bold, 3);
        doc.setFontSize(cell.fontSize);
        const lineH = cell.fontSize * 0.38;
        const textBlockH = Math.max(1, cell.lines.length) * lineH;
        const textY = rowY + Math.max(2.6, (h - textBlockH) / 2) + lineH;
        doc.text(cell.lines, x + 1.5, textY, { maxWidth: w - 2.5 });
      };

      let rowY = outerY;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.25);

      const fillRgb = (rgb: [number, number, number]) => {
        doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      };

      const drawSectionHeader = (letter: string, title: string, shade: 1 | 2 | "docs") => {
        const rgb = shade === "docs" ? sectionGreenDocs : shade === 1 ? sectionGreen1 : sectionGreen2;
        fillRgb(rgb);
        doc.rect(outerX, rowY, outerW, rowHeights.section, "FD");
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        const midY = rowY + rowHeights.section / 2 + 2.2;
        doc.text(`(${letter})`, outerX + 2, midY);
        const t = title;
        const tw = doc.getTextWidth(t);
        doc.text(t, outerX + Math.max(0, (outerW - tw) / 2), midY);
        rowY += rowHeights.section;
      };

      const drawFourColRow = (l1: string, v1: string, l2: string, v2: string) => {
        const c1Lines = toCellLines(l1, c1, true, 2);
        const c2Lines = toCellLines(v1, c2, false, 3);
        const c3Lines = toCellLines(l2, c3, true, 2);
        const c4Lines = toCellLines(v2, c4, false, 3);
        const maxFont = Math.max(c1Lines.fontSize, c2Lines.fontSize, c3Lines.fontSize, c4Lines.fontSize);
        const lineH = maxFont * 0.38;
        const rowH =
          Math.max(
            c1Lines.lines.length,
            c2Lines.lines.length,
            c3Lines.lines.length,
            c4Lines.lines.length,
            1
          ) *
            lineH +
          5;
        const finalH = Math.max(rowHeights.normal, rowH);
        doc.rect(outerX, rowY, c1, finalH);
        doc.rect(x2, rowY, c2, finalH);
        doc.rect(x3, rowY, c3, finalH);
        doc.rect(x4, rowY, c4, finalH);
        drawCellText(l1, outerX, rowY, c1, finalH, true, false, c1Lines);
        drawCellText(v1, x2, rowY, c2, finalH, false, false, c2Lines);
        drawCellText(l2, x3, rowY, c3, finalH, true, false, c3Lines);
        drawCellText(v2, x4, rowY, c4, finalH, false, false, c4Lines);
        rowY += finalH;
      };

      // Application date + optional application reference (tabular row aligned with sections below)
      const pdfAppId = String(data.scholarshipApplicationPdfId || "").trim();
      if (pdfAppId) {
        drawFourColRow("Application Date:", data.dateFormatted, "Application ID:", pdfAppId);
      } else {
        doc.rect(outerX, rowY, c1, rowHeights.date);
        doc.rect(x2, rowY, outerW - c1, rowHeights.date);
        drawCellText("Application Date:", outerX, rowY, c1, rowHeights.date, true);
        drawCellText(data.dateFormatted, x2, rowY, outerW - c1, rowHeights.date, false);
        rowY += rowHeights.date;
      }

      drawSectionHeader("a", "Alumni Details", 1);
      drawFourColRow("Name:", data.studentName || "Missing", "Father's Name:", data.fatherName || "Missing");
      drawFourColRow("DOB:", data.dob || "Missing", "CNIC:", data.cnic || "Missing");

      const drawSpanRow = (label: string, value: string) => {
        const lbl = toCellLines(label, c1, true, 2);
        const val = toCellLines(value, c2 + c3 + c4, false, 3);
        const h = Math.max(
          rowHeights.docsRow,
          Math.max(lbl.lines.length, val.lines.length, 1) * Math.max(lbl.fontSize, val.fontSize) * 0.38 + 5
        );
        doc.rect(outerX, rowY, c1, h);
        doc.rect(x2, rowY, c2 + c3 + c4, h);
        drawCellText(label, outerX, rowY, c1, h, true, false, lbl);
        drawCellText(value, x2, rowY, c2 + c3 + c4, h, false, false, val);
        rowY += h;
      };

      drawSectionHeader("b", data.isKinship ? "Alumni Educational Record" : "Program Applied For", 2);
      drawFourColRow("Campus:", data.campus || "Missing", "Faculty:", data.faculty || "Missing");
      drawFourColRow(
        "Department:",
        data.department || "Missing",
        "Program:",
        data.isKinship ? data.program || "Missing" : data.requestedProgramDegree || "Missing",
      );
      if (data.isKinship) {
        drawFourColRow("SAP ID:", data.sapCode || "Missing", "CGPA:", data.cgpaLastDegree || "Missing");
        drawFourColRow(
          "Passing Out Year:",
          data.passingOutYear?.trim() ? String(data.passingOutYear) : "Missing",
          "Discount Category:",
          data.scholarshipType?.trim() ? data.scholarshipType : "Missing",
        );
        drawSpanRow("Applying For:", data.applyingFor || "Missing");
      } else {
        drawFourColRow(
          "Discount Category:",
          data.scholarshipType?.trim() ? data.scholarshipType : "Missing",
          "Admission Reference No:",
          data.admissionApplicationRef?.trim() ? data.admissionApplicationRef : "Missing",
        );
      }

      drawSectionHeader(
        "c",
        data.isKinship
          ? "Kin Details - Previous Educational Record & Program Applied For"
          : "Previous UOL Education Record",
        1,
      );
      if (data.isKinship) {
        drawFourColRow(
          "Name:",
          data.kinshipDetails?.kinName || "Missing",
          "Father's Name:",
          data.kinshipDetails?.kinFatherName || "Missing",
        );
        drawFourColRow(
          "Campus:",
          data.kinshipDetails?.kinCampus || "Missing",
          "Faculty:",
          data.kinshipDetails?.kinFaculty || "Missing",
        );
        drawFourColRow(
          "Department:",
          data.kinshipDetails?.kinDepartment || "Missing",
          "Program:",
          data.kinshipDetails?.kinProgram || "Missing",
        );
        drawFourColRow(
          "Admission Ref No:",
          data.kinshipDetails?.kinAdmissionRefNo || "Missing",
          "Last Degree/Certificate:",
          data.kinshipDetails?.kinLastDegreeCertificate || "Missing",
        );
        drawSpanRow("Passing Out Year:", data.kinshipDetails?.kinPassingOutYear || "Missing");
      } else {
        drawFourColRow("Campus:", data.campus || "Missing", "Faculty:", data.faculty || "Missing");
        drawFourColRow("Department:", data.department || "Missing", "Program:", data.previousDegree || "Missing");
        drawFourColRow("Sap ID:", data.sapCode || "Missing", "CGPA:", data.cgpaLastDegree || "Missing");
        const passingYearPdf =
          data.passingOutYear != null && String(data.passingOutYear).trim() !== ""
            ? String(data.passingOutYear).trim()
            : "";
        const passingYearVal = passingYearPdf !== "" ? passingYearPdf : "Missing";
        drawSpanRow("Passing Out Year:", passingYearVal);
      }

      drawSectionHeader("d", "Documents Checklist", "docs");
      const leftW = c1 + c2;
      const rightW = c3 + c4;

      const drawDocRow = (leftLabel: string, leftValue: string, rightLabel: string, rightValue: string) => {
        const c1Lines = toCellLines(leftLabel, c1, true, 2);
        const c2Lines = toCellLines(leftValue, c2, false, 3);
        const c3Lines = toCellLines(rightLabel, c3, true, 2);
        const c4Lines = toCellLines(rightValue, c4, false, 3);
        const maxFont = Math.max(c1Lines.fontSize, c2Lines.fontSize, c3Lines.fontSize, c4Lines.fontSize);
        const lineH = maxFont * 0.38;
        const rowH =
          Math.max(
            c1Lines.lines.length,
            c2Lines.lines.length,
            c3Lines.lines.length,
            c4Lines.lines.length,
            1
          ) *
            lineH +
          5;
        const finalH = Math.max(rowHeights.docsRow, rowH);
        doc.rect(outerX, rowY, c1, finalH);
        doc.rect(x2, rowY, c2, finalH);
        doc.rect(x3, rowY, c3, finalH);
        doc.rect(x4, rowY, c4, finalH);
        drawCellText(leftLabel, outerX, rowY, c1, finalH, true, false, c1Lines);
        drawCellText(leftValue, x2, rowY, c2, finalH, false, false, c2Lines);
        drawCellText(rightLabel, x3, rowY, c3, finalH, true, false, c3Lines);
        drawCellText(rightValue, x4, rowY, c4, finalH, false, false, c4Lines);
        rowY += finalH;
      };

      if (data.isKinship) {
        drawDocRow(
          "Copy of Admission Letter:",
          findChecklistValue(["copy of admission letter", "kinship-admission-letter", "admission letter"]),
          "Academic Certificates/Transcripts (Kin):",
          findChecklistValue(["academic certificates/transcripts (kin)", "kinship-academic-certificates"])
        );
        drawDocRow(
          "Alumni Card:",
          findChecklistValue(["alumni card", "kinship-alumni-card"]),
          "FRC:",
          findChecklistValue(["frc", "kinship-frc"])
        );
        drawDocRow(
          "CNIC Copy (Kin):",
          findChecklistValue(["cnic copy (kinship)", "kinship-cnic-kin"]),
          "CNIC Copy (Alumni):",
          findChecklistValue(["cnic copy (alumni)", "kinship-cnic-alumni"])
        );
      } else {
        drawDocRow(
          "Copy of Admission Letter:",
          findChecklistValue(["admission letter"]),
          "Academic Transcripts & Certificates:",
          findChecklistValue(["transcripts", "certificate"])
        );
        drawDocRow(
          "Alumni Card:",
          findChecklistValue(["alumni card", "alumni proof"]),
          "Curriculum Vitae (CV) :",
          findChecklistValue(["curriculum vitae", "cv"])
        );
        drawSpanRow("CNIC Copy:", findChecklistValue(["cnic"]));
      }

      

   

      rowY += 4;

      drawSectionHeader("e", "Review & Approval", 2);

      const sigBlockH = 34;
      doc.rect(outerX, rowY, leftW, sigBlockH);
      doc.rect(x3, rowY, rightW, sigBlockH);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text("Reviewed By (ARO):", outerX + 2, rowY + 5.5);
      doc.text("Approved By (Competent Authority):", x3 + 2, rowY + 5.5);
      rowY += sigBlockH;

      doc.rect(outerX, outerY, outerW, rowY - outerY);

      // Ensure no accidental second page is left around.
      const pages = doc.getNumberOfPages();
      if (pages > 1) {
        for (let i = pages; i > 1; i -= 1) {
          doc.deletePage(i);
        }
      }

      const pdfOutput = doc.output("arraybuffer");
      resolve(Buffer.from(pdfOutput));
    } catch (e) {
      reject(e);
    }
  });
}

export function generateScholarshipPDF(data: ScholarshipApplicationData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF({ compress: true });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 50;
      const maxWidth = pageWidth - 2 * margin;
      let yPosition = margin;

      // Add logo on top right
      const logoBase64 = getLogoBase64();
      if (logoBase64) {
        try {
          const logoWidth = 40;
          const logoHeight = 20;
          const logoX = pageWidth - margin - logoWidth;
          const logoY = margin;
          doc.addImage(logoBase64, "PNG", logoX, logoY, logoWidth, logoHeight, "uol-logo", "FAST");
          yPosition = logoY + logoHeight + 15;
        } catch {
          yPosition = margin + 10;
        }
      } else {
        yPosition = margin + 10;
      }

      // Draw a line under the header
      doc.setDrawColor(0, 102, 51); // Green color matching logo
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 15;

      // Header text (left aligned)
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 102, 51); // Green color
      doc.text("Alumni Scholarship Application", margin, yPosition);
      yPosition += 10;

      // Date (right aligned)
      const date = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0); // Black
      const dateText = `Date: ${date}`;
      const dateWidth = doc.getTextWidth(dateText);
      doc.text(dateText, pageWidth - margin - dateWidth, yPosition);
      yPosition += 20;

      // Helper function to add text with word wrapping
      const addText = (text: string, fontSize: number, isBold: boolean = false, align: "left" | "center" | "right" = "left", spacing: number = 5) => {
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        doc.setTextColor(0, 0, 0); // Black
        const lines = doc.splitTextToSize(text, maxWidth);
        const xPos = align === "center" ? pageWidth / 2 : align === "right" ? pageWidth - margin : margin;
        doc.text(lines, xPos, yPosition, { align, maxWidth });
        yPosition += lines.length * (fontSize * 0.4) + spacing;
      };

      // Salutation
      addText("Dear Concern,", 12, false, "left", 8);

      // Main content
      addText(
        `I, ${data.alumniName}, an alumnus of UOL, am applying for ${discountCategoryLabel(data.discountType, data.applyingFor)}.`,
        12,
        false,
        "left",
        8,
      );

      // Conditional content based on discount type
      if (isScholarshipKinshipCategory(data.discountType)) {
        const relation = data.kinshipRelation || "family member";
        // Use firstName and lastName if available, otherwise fall back to kinshipName
        const firstName = data.kinshipFirstName || "";
        const lastName = data.kinshipLastName || "";
        const name = firstName && lastName 
          ? `${firstName} ${lastName}` 
          : data.kinshipName || "beneficiary";
        const discountPercent = "15%";
        const pronoun = relation.toLowerCase().includes("sister")
          ? "She"
          : relation.toLowerCase().includes("brother")
          ? "He"
          : "She/He";
        addText(`I am applying for my ${relation}, ${name}. ${pronoun} can avail ${discountPercent} discount.`, 12, false, "left", 8);
      } else if (isScholarshipFeeDiscountFlow(data.discountType)) {
        const discountPercent = scholarshipFeeDiscountPercentForPdf(data.discountType, data.applyingFor);
        const level = String(data.applyingFor || "").trim() || "selected";
        if (discountPercent) {
          addText(`I can avail ${discountPercent} discount for my ${level} program.`, 12, false, "left", 8);
        }
      } else if (data.discountType === "masters-collaboration") {
        addText("I am eligible to apply for the Masters Scholarship via UOL International Collaborations.", 12, false, "left", 8);
      }

      addText(`Degree Title: ${data.degreeTitle}`, 12, false, "left", 8);
      addText("Please approve so that the applicant can proceed with the admission process.", 12, false, "left", 15);
      
      // Closing
      addText("Regards,", 12, false, "left", 8);
      addText(data.alumniName, 12, true, "left", 10);

      // Add footer line
      const footerY = pageHeight - 30;
      doc.setDrawColor(0, 102, 51);
      doc.setLineWidth(0.5);
      doc.line(margin, footerY, pageWidth - margin, footerY);
      
      // Footer text
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100); // Gray
  
      const footerText = "Office of Alumni Relations, EE2 Building 4th Floor | University of Lahore";
      const footerWidth = doc.getTextWidth(footerText);
      doc.text(footerText, (pageWidth - footerWidth) / 2, footerY + 8);

      // Convert to buffer
      const pdfOutput = doc.output("arraybuffer");
      const buffer = Buffer.from(pdfOutput);
      resolve(buffer);
    } catch (error) {
      reject(error);
    }
  });
}

/** Tabular membership application form PDF (Gym / Pool / Cricket Club). */
export function generateMembershipFormPDF(data: MembershipFormPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF({ compress: true });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 18;
      const maxWidth = pageWidth - margin * 2;
      let y = margin;

      const clamp = (text: string | null | undefined) => {
        const value = String(text || "").replace(/\s+/g, " ").trim();
        return value || "Missing";
      };

      const sectionGreen1: [number, number, number] = [150, 205, 175];
      const sectionGreen2: [number, number, number] = [195, 230, 210];
      const sectionGreenDocs: [number, number, number] = [115, 198, 155];

      const headerBandH = 22;
      doc.setFillColor(0, 102, 51);
      doc.rect(margin, y, maxWidth, headerBandH, "F");
      const logoBase64 = getLogoBase64("light");
      if (logoBase64) {
        try {
          doc.addImage(logoBase64, "PNG", margin + 2, y + 5, 30, 12, "uol-logo", "FAST");
        } catch {
          // ignore logo rendering failure
        }
      }
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      let headerFontSize = 10;
      const headerTitle = clamp(data.headerTitle);
      doc.setFontSize(headerFontSize);
      let headerTitleW = doc.getTextWidth(headerTitle);
      while (headerTitleW > maxWidth - 8 && headerFontSize > 7) {
        headerFontSize -= 0.5;
        doc.setFontSize(headerFontSize);
        headerTitleW = doc.getTextWidth(headerTitle);
      }
      doc.text(headerTitle, margin + Math.max(0, (maxWidth - headerTitleW) / 2), y + headerBandH / 2 + 3.2);
      doc.setTextColor(0, 0, 0);
      y += headerBandH + 3;

      const outerX = margin;
      const outerY = y;
      const outerW = maxWidth;
      const rowHeights = { date: 8, section: 8, normal: 8, docsRow: 8 };

      const c1 = outerW * 0.26;
      const c2 = outerW * 0.24;
      const c3 = outerW * 0.26;
      const c4 = outerW - c1 - c2 - c3;
      const x2 = outerX + c1;
      const x3 = x2 + c2;
      const x4 = x3 + c3;

      const toCellLines = (text: string, width: number, bold = false, maxLines = 3) => {
        let fontSize = 9;
        const shown = clamp(text);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setFontSize(fontSize);
        let lines = doc.splitTextToSize(shown, Math.max(8, width - 3));
        while (lines.length > maxLines && fontSize > 7) {
          fontSize -= 0.5;
          doc.setFontSize(fontSize);
          lines = doc.splitTextToSize(shown, Math.max(8, width - 3));
        }
        const shownLines = lines.slice(0, maxLines);
        if (lines.length > maxLines) {
          const last = shownLines[shownLines.length - 1] || "";
          shownLines[shownLines.length - 1] = `${last.slice(0, Math.max(0, last.length - 2))}..`;
        }
        return { lines: shownLines as string[], fontSize };
      };

      const drawCellText = (
        text: string,
        x: number,
        rowY: number,
        w: number,
        h: number,
        bold = false,
        center = false,
        prepared?: { lines: string[]; fontSize: number },
      ) => {
        doc.setFont("helvetica", bold ? "bold" : "normal");
        if (center) {
          doc.setFontSize(9);
          const shown = clamp(text);
          const tw = doc.getTextWidth(shown);
          doc.text(shown, x + 1.5 + Math.max(0, (w - 3 - tw) / 2), rowY + h / 2 + 2.2);
          return;
        }
        const cell = prepared || toCellLines(text, w, bold, 3);
        doc.setFontSize(cell.fontSize);
        const lineH = cell.fontSize * 0.38;
        const textBlockH = Math.max(1, cell.lines.length) * lineH;
        const textY = rowY + Math.max(2.6, (h - textBlockH) / 2) + lineH;
        doc.text(cell.lines, x + 1.5, textY, { maxWidth: w - 2.5 });
      };

      let rowY = outerY;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.25);

      const fillRgb = (rgb: [number, number, number]) => {
        doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      };

      const drawSectionHeader = (letter: string, title: string, shade: 1 | 2 | "docs") => {
        const rgb = shade === "docs" ? sectionGreenDocs : shade === 1 ? sectionGreen1 : sectionGreen2;
        fillRgb(rgb);
        doc.rect(outerX, rowY, outerW, rowHeights.section, "FD");
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        const midY = rowY + rowHeights.section / 2 + 2.2;
        doc.text(`(${letter})`, outerX + 2, midY);
        const tw = doc.getTextWidth(title);
        doc.text(title, outerX + Math.max(0, (outerW - tw) / 2), midY);
        rowY += rowHeights.section;
      };

      const drawFourColRow = (l1: string, v1: string, l2: string, v2: string) => {
        const c1Lines = toCellLines(l1, c1, true, 2);
        const c2Lines = toCellLines(v1, c2, false, 3);
        const c3Lines = toCellLines(l2, c3, true, 2);
        const c4Lines = toCellLines(v2, c4, false, 3);
        const maxFont = Math.max(c1Lines.fontSize, c2Lines.fontSize, c3Lines.fontSize, c4Lines.fontSize);
        const lineH = maxFont * 0.38;
        const rowH =
          Math.max(c1Lines.lines.length, c2Lines.lines.length, c3Lines.lines.length, c4Lines.lines.length, 1) *
            lineH +
          5;
        const finalH = Math.max(rowHeights.normal, rowH);
        doc.rect(outerX, rowY, c1, finalH);
        doc.rect(x2, rowY, c2, finalH);
        doc.rect(x3, rowY, c3, finalH);
        doc.rect(x4, rowY, c4, finalH);
        drawCellText(l1, outerX, rowY, c1, finalH, true, false, c1Lines);
        drawCellText(v1, x2, rowY, c2, finalH, false, false, c2Lines);
        drawCellText(l2, x3, rowY, c3, finalH, true, false, c3Lines);
        drawCellText(v2, x4, rowY, c4, finalH, false, false, c4Lines);
        rowY += finalH;
      };

      const drawSpanRow = (label: string, value: string) => {
        const lbl = toCellLines(label, c1, true, 2);
        const val = toCellLines(value, c2 + c3 + c4, false, 3);
        const h =
          Math.max(rowHeights.docsRow, Math.max(lbl.lines.length, val.lines.length, 1) * Math.max(lbl.fontSize, val.fontSize) * 0.38 + 5);
        doc.rect(outerX, rowY, c1, h);
        doc.rect(x2, rowY, c2 + c3 + c4, h);
        drawCellText(label, outerX, rowY, c1, h, true, false, lbl);
        drawCellText(value, x2, rowY, c2 + c3 + c4, h, false, false, val);
        rowY += h;
      };

      const pdfAppId = String(data.applicationRef || "").trim();
      if (pdfAppId) {
        drawFourColRow("Application Date:", data.dateFormatted, "Application ID:", pdfAppId);
      } else {
        doc.rect(outerX, rowY, c1, rowHeights.date);
        doc.rect(x2, rowY, outerW - c1, rowHeights.date);
        drawCellText("Application Date:", outerX, rowY, c1, rowHeights.date, true);
        drawCellText(data.dateFormatted, x2, rowY, outerW - c1, rowHeights.date, false);
        rowY += rowHeights.date;
      }

      drawSectionHeader("a", "Alumni Personal Details", 1);
      drawFourColRow("Name:", data.studentName, "Father's Name:", data.fatherName);
      drawFourColRow("DOB:", data.dob, "CNIC:", data.cnic);

      drawSectionHeader("b", "Alumni Education Details", 2);
      drawFourColRow("Campus:", data.campus, "Faculty:", data.faculty);
      drawFourColRow("Department:", data.department, "Program:", data.program);
      drawFourColRow("SAP ID:", data.sapCode, "CGPA:", data.cgpa);
      drawSpanRow("Passing Out Year:", data.passingOutYear);

      drawSectionHeader("c", "Membership Details", 1);
      drawFourColRow("Applying For:", data.applyingFor, "Discount Type:", data.discountType);
      drawFourColRow(
        "Membership Type:",
        data.membershipType,
        "Membership Start Date:",
        data.membershipStartDate,
      );
      drawSpanRow("Preferred Timing:", data.preferredTiming);

      drawSectionHeader("d", "Medical & Fitness Information", 2);
      drawSpanRow("Medical Conditions:", data.medicalConditions);
      drawFourColRow("Allergies:", data.allergies, "Physical Disability:", data.physicalDisability);

      drawSectionHeader("e", "Emergency Contact", 1);
      drawFourColRow(
        "Contact Name:",
        data.emergencyContactName,
        "Relationship:",
        data.emergencyContactRelationship,
      );
      drawSpanRow("Contact Number:", data.emergencyContactNumber);

      drawSectionHeader("f", "Documents Checklist", "docs");
      drawFourColRow("Alumni Card:", data.alumniCardSubmitted, "CNIC:", data.cnicDocSubmitted);

      rowY += 4;

      const leftW = c1 + c2;
      const rightW = c3 + c4;
      const sigBlockH = 34;
      doc.rect(outerX, rowY, leftW, sigBlockH);
      doc.rect(x3, rowY, rightW, sigBlockH);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text("Reviewed By (ARO):", outerX + 2, rowY + 5.5);
      doc.text("Approved By (Competent Authority):", x3 + 2, rowY + 5.5);
      rowY += sigBlockH;

      doc.rect(outerX, outerY, outerW, rowY - outerY);

      const pages = doc.getNumberOfPages();
      if (pages > 1) {
        for (let i = pages; i > 1; i -= 1) {
          doc.deletePage(i);
        }
      }

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
  optionalCriteriaProficiency?: unknown;
  uploadedDocuments?: Array<{ label: string; url: string; uploadedAt?: string | null }>;
  createdAt?: string | null;
  updatedAt?: string | null;
  rejectionReason?: string | null;
}

export function generateLeadershipApplicationPDF(data: LeadershipApplicationPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 30;
      const maxWidth = pageWidth - 2 * margin;
      let y = margin;

      const pageBottomY = () => pageHeight - margin;

      const ensureSpace = (neededHeight: number) => {
        if (y + neededHeight <= pageBottomY()) return;
        doc.addPage();
        y = margin;
      };

      const hLine = (gapTop: number = 8, gapBottom: number = 10) => {
        ensureSpace(gapTop + gapBottom + 2);
        y += gapTop;
        doc.setDrawColor(210, 210, 210);
        doc.setLineWidth(0.3);
        doc.line(margin, y, pageWidth - margin, y);
        y += gapBottom;
      };

      const setTextStyle = (fontSize: number, bold: boolean = false, color: [number, number, number] = [0, 0, 0]) => {
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setTextColor(color[0], color[1], color[2]);
      };

      const textHeight = (fontSize: number) => fontSize * 0.42;

      const drawWrappedText = (text: string, x: number, fontSize: number, bold: boolean, maxW: number, spacing: number = 4) => {
        setTextStyle(fontSize, bold);
        const lines = doc.splitTextToSize(String(text ?? ""), maxW);
        const height = lines.length * textHeight(fontSize);
        ensureSpace(height + spacing);
        doc.text(lines, x, y, { maxWidth: maxW });
        y += height + spacing;
      };

      const sectionTitle = (title: string) => {
        const fontSize = 12;
        const rightPadding = 10;
        const maxW = maxWidth - rightPadding;
        setTextStyle(fontSize, true);
        const lines = doc.splitTextToSize(String(title ?? ""), Math.max(10, maxW));
        const titleH = Math.max(1, lines.length) * textHeight(fontSize);

        // total needed height: title block + gap + underline + bottom gap
        const needed = titleH + 4 + 2 + 10;
        ensureSpace(needed);

        doc.text(lines, margin, y, { maxWidth: maxW });
        y += titleH + 4;
        doc.setDrawColor(0, 102, 51);
        doc.setLineWidth(0.4);
        doc.line(margin, y, pageWidth - margin - rightPadding, y);
        y += 10;
      };

      const fieldPairGrid = (left: Array<{ label: string; value: string }>, right: Array<{ label: string; value: string }>) => {
        const colGap = 14;
        const colW = (maxWidth - colGap) / 2;
        const x1 = margin;
        const x2 = margin + colW + colGap;
        const fontSize = 10.5;

        const measureLines = (txt: string) => doc.splitTextToSize(txt, colW).length;
        const rows = Math.max(left.length, right.length);
        for (let i = 0; i < rows; i++) {
          const l = left[i] ?? { label: "", value: "" };
          const r = right[i] ?? { label: "", value: "" };
          const lText = l.label ? `${l.label}: ${l.value || "-"}` : "";
          const rText = r.label ? `${r.label}: ${r.value || "-"}` : "";
          const rowLines = Math.max(measureLines(lText), measureLines(rText), 1);
          const rowH = rowLines * textHeight(fontSize) + 3;
          ensureSpace(rowH + 2);
          if (lText) {
            setTextStyle(fontSize, false);
            doc.text(doc.splitTextToSize(lText, colW), x1, y, { maxWidth: colW });
          }
          if (rText) {
            setTextStyle(fontSize, false);
            doc.text(doc.splitTextToSize(rText, colW), x2, y, { maxWidth: colW });
          }
          y += rowH;
        }
        y += 4;
      };

      const ratingLabel = (value: number | null | undefined) => {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 1) return "";
        const m = Math.min(5, Math.max(1, Math.round(n)));
        if (m === 1) return "Beginner";
        if (m === 2) return "Basic";
        if (m === 3) return "Intermediate";
        if (m === 4) return "Advanced";
        return "Expert";
      };

      const proficiencyMap = (() => {
        try {
          const raw = data.optionalCriteriaProficiency as unknown;
          let obj: unknown = raw;
          if (typeof obj === "string") {
            const s = obj.trim();
            if (!s) return {} as Record<string, number>;
            obj = JSON.parse(s) as unknown;
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

      const normalizeHtml = (html: string) => {
        return String(html || "")
          .replace(/\u00a0/g, " ")
          .replace(/&nbsp;/gi, " ")
          .replace(/&#160;/gi, " ")
          .replace(/&amp;/gi, "&")
          .replace(/&lt;/gi, "<")
          .replace(/&gt;/gi, ">")
          .replace(/&quot;/gi, "\"")
          .replace(/&#39;/gi, "'")
          .replace(/\r\n/g, "\n")
          .replace(/<br\s*\/?\s*>/gi, "\n")
          .replace(/<\/?p\b[^>]*>/gi, "\n")
          .replace(/<\/?div\b[^>]*>/gi, "\n")
          .replace(/<\/?h[1-6]\b[^>]*>/gi, "\n")
          .replace(/<li\b[^>]*>/gi, "\n• ")
          .replace(/<\/?(ul|ol)\b[^>]*>/gi, "\n")
          .replace(/<strong\b[^>]*>/gi, "**")
          .replace(/<\/?strong>/gi, "**")
          .replace(/<b\b[^>]*>/gi, "**")
          .replace(/<\/?b>/gi, "**")
          .replace(/<[^>]+>/g, "")
          .replace(/[ \t]{2,}/g, " ")
          .replace(/\n[ \t]+/g, "\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
      };

      const drawInlineBoldLine = (line: string, x: number, fontSize: number, maxW: number, baseBold: boolean = false) => {
        const parts = String(line || "").split("**");
        const outLines: Array<Array<{ t: string; b: boolean }>> = [[]];
        let bold = false;

        for (let i = 0; i < parts.length; i++) {
          const t = parts[i];
          if (t) outLines[outLines.length - 1].push({ t, b: bold });
          bold = !bold;
        }

        const tokens = outLines[0];
        const words: Array<{ t: string; b: boolean }> = [];
        tokens.forEach((tk) => {
          tk.t.split(/(\s+)/).forEach((w) => {
            if (w) words.push({ t: w, b: tk.b });
          });
        });

        const lines: Array<Array<{ t: string; b: boolean }>> = [[]];
        let curW = 0;
        for (const w of words) {
          setTextStyle(fontSize, baseBold || w.b);
          const wW = doc.getTextWidth(w.t);
          if (curW + wW > maxW && lines[lines.length - 1].length > 0) {
            lines.push([]);
            curW = 0;
          }
          lines[lines.length - 1].push(w);
          curW += wW;
        }

        ensureSpace(lines.length * textHeight(fontSize) + 2);
        for (const ln of lines) {
          let xPos = x;
          for (const w of ln) {
            setTextStyle(fontSize, baseBold || w.b);
            doc.text(w.t, xPos, y);
            xPos += doc.getTextWidth(w.t);
          }
          y += textHeight(fontSize);
        }
        y += 2;
      };

      const drawRichTextBlock = (htmlOrText: string, maxW: number, fontSize: number = 10.5, baseBold: boolean = false) => {
        const txt = normalizeHtml(htmlOrText);
        if (!txt) {
          drawWrappedText("-", margin, fontSize, baseBold, maxW, 6);
          return;
        }
        const lines = txt.split("\n");
        for (const rawLine of lines) {
          const line = rawLine.trimEnd();
          if (!line.trim()) {
            y += 4;
            continue;
          }
          drawInlineBoldLine(line, margin, fontSize, maxW, baseBold);
        }
        y += 2;
      };

      const logoBase64 = getLogoBase64();
      if (logoBase64) {
        try {
          const logoWidth = 40;
          const logoHeight = 20;
          const logoX = pageWidth - margin - logoWidth;
          const logoY = margin;
          doc.addImage(logoBase64, "PNG", logoX, logoY, logoWidth, logoHeight);
          y = logoY + logoHeight + 10;
        } catch {
          y = margin + 10;
        }
      } else {
        y = margin + 10;
      }

      setTextStyle(14, true, [0, 102, 51]);
      doc.text("Leadership Application", margin, y);
      y += 10;
      hLine(0, 10);

      

      const headerLeft: Array<{ label: string; value: string }> = [
        { label: "Application Type", value: data.leadershipType === "chapter" ? "Chapter" : "Association" },
        {
          label: "Chapter/Association Name",
          value: (() => {
            const t = String(data.categoryType || "").toLowerCase();
            const name = String(data.categoryName || "").trim();
            if (!name) return "-";
            if (t === "national") return `National Chapter - ${name}`;
            if (t === "international") return `International Chapter - ${name}`;
            if (t === "association") return `Association - ${name}`;
            return name;
          })(),
        },
        { label: "Role Applied For", value: String(data.position || "-") },
      ];
      const headerRight: Array<{ label: string; value: string }> = [
        { label: "Application Date", value: String(data.createdAt || "-") },
        { label: "Application Status", value: String(data.status || "pending") },
      ];
      fieldPairGrid(headerLeft, headerRight);
      hLine(2, 10);

      sectionTitle("Personal Information");
      fieldPairGrid(
        [
          { label: "Full Name", value: String(data.applicant.name || "-") },
          { label: "Gender", value: String(data.applicant.gender || "-") },
          { label: "Department", value: String(data.applicant.department || "-") },
          { label: "Passing Year", value: data.applicant.passingYear ? String(data.applicant.passingYear) : "-" },
          { label: "Phone", value: String(data.applicant.phone || "-") },
        ],
        [
          { label: "SAP ID", value: String(data.applicant.sapId || "-") },
          { label: "Faculty", value: String(data.applicant.faculty || "-") },
          { label: "Program", value: String(data.applicant.program || "-") },
          { label: "Email", value: String(data.applicant.email || "-") },
        ]
      );
      hLine(0, 10);

      sectionTitle("Role Description");
      drawRichTextBlock(String(data.roleDescription || "-"), maxWidth);
      hLine(0, 10);
      sectionTitle("Criteria");
      const applicationApproved = String(data.status || "").toLowerCase() === "approved";
      const tableColW = {
        req: maxWidth * 0.50,
        marks: maxWidth * 0.14,
        obtained: maxWidth * 0.16,
        alumni: maxWidth * 0.20,
      };
      const tableX = {
        req: margin,
        marks: margin + tableColW.req,
        obtained: margin + tableColW.req + tableColW.marks,
        alumni: margin + tableColW.req + tableColW.marks + tableColW.obtained,
      };
      const tableFont = 9.5;

      const drawTableHeader = () => {
        ensureSpace(18);
        doc.setFillColor(245, 245, 245);
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.2);
        const headerH = 10;
        doc.rect(margin, y, maxWidth, headerH, "F");
        doc.rect(margin, y, maxWidth, headerH);
        doc.line(tableX.marks, y, tableX.marks, y + headerH);
        doc.line(tableX.obtained, y, tableX.obtained, y + headerH);
        doc.line(tableX.alumni, y, tableX.alumni, y + headerH);
        setTextStyle(tableFont, true);
        doc.text("Requirement", tableX.req + 2, y + 7);
        doc.text("Marks", tableX.marks + 2, y + 7);
        doc.text("Obtained", tableX.obtained + 2, y + 7);
        doc.text("Alumni", tableX.alumni + 2, y + 7);
        y += headerH;
      };

      const drawTableRow = (cells: { req: string; marks: string; obtained: string; alumni: string }) => {
        const reqLines = doc.splitTextToSize(cells.req, tableColW.req - 4);
        const marksLines = doc.splitTextToSize(cells.marks, tableColW.marks - 4);
        const obtainedLines = doc.splitTextToSize(cells.obtained, tableColW.obtained - 4);
        const alumniLines = doc.splitTextToSize(cells.alumni, tableColW.alumni - 4);
        const lines = Math.max(
          reqLines.length,
          marksLines.length,
          obtainedLines.length,
          alumniLines.length,
          1
        );
        const rowH = lines * textHeight(tableFont) + 6;
        if (y + rowH > pageBottomY()) {
          doc.addPage();
          y = margin;
          drawTableHeader();
        }
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.2);
        doc.rect(margin, y, maxWidth, rowH);
        doc.line(tableX.marks, y, tableX.marks, y + rowH);
        doc.line(tableX.obtained, y, tableX.obtained, y + rowH);
        doc.line(tableX.alumni, y, tableX.alumni, y + rowH);
        setTextStyle(tableFont, false);
        doc.text(reqLines, tableX.req + 2, y + 5, { maxWidth: tableColW.req - 4 });
        doc.text(marksLines, tableX.marks + 2, y + 5, { maxWidth: tableColW.marks - 4 });
        doc.text(obtainedLines, tableX.obtained + 2, y + 5, { maxWidth: tableColW.obtained - 4 });
        doc.text(alumniLines, tableX.alumni + 2, y + 5, { maxWidth: tableColW.alumni - 4 });
        y += rowH;
      };

      if (!data.criteria || data.criteria.length === 0) {
        drawWrappedText("No criteria found.", margin, 10.5, false, maxWidth, 10);
      } else {
        drawTableHeader();
        let totalMarks = 0;
        let totalObtained = 0;

        data.criteria.forEach((c) => {
          const alumniResp = String(c.alumniResponse ?? "").toUpperCase();
          const alumniSelected = alumniResp === "YES" || alumniResp === "NO" ? alumniResp : c.alumniConfirmed ? "YES" : "NO";
          const marksRaw = c.criterionScore;
          const marksNum = Number.isFinite(Number(marksRaw)) ? normalizeObtainedMark(Number(marksRaw)) : NaN;
          const marksCell =
            Number.isFinite(marksNum) && marksNum > 0 ? formatObtainedMarkDisplay(marksNum) : "N/A";

          const obtainedStored = c.obtainedMarks;
          const obtainedCell =
            !applicationApproved
              ? "—"
              : Number.isFinite(Number(obtainedStored))
                ? formatObtainedMarkDisplay(Number(obtainedStored))
                : "—";

          if (Number.isFinite(marksNum) && marksNum > 0) {
            totalMarks += marksNum;
            if (applicationApproved && Number.isFinite(Number(obtainedStored))) {
              totalObtained += normalizeObtainedMark(Number(obtainedStored));
            }
          }

          let alumniCell = alumniSelected;
          if (alumniSelected === "YES" && !c.isMandatory) {
            const rating = Number(proficiencyMap[String(c.id)] ?? 0);
            const safeRating = Number.isFinite(rating) ? Math.min(5, Math.max(0, Math.round(rating))) : 0;
            if (safeRating >= 1) {
              const stars = Array.from({ length: safeRating }).map(() => "*").join(" ");
              const label = ratingLabel(safeRating) || "";
              alumniCell = label ? `YES\n${stars}\n${label}` : `YES\n${stars}`;
            } else {
              alumniCell = "YES\nNo rating";
            }
          }

          const criterionText = (() => {
            const base = String(c.label || "-") + (c.description ? `\n${String(c.description)}` : "");
            if (!c.hasTextbox) return base;
            const response =
              c.alumniTextResponse && String(c.alumniTextResponse).trim()
                ? String(c.alumniTextResponse)
                : "No response provided";
            const label = String(c.textboxLabel || "Response");
            return `${base}\n${label}: ${response}`;
          })();

          drawTableRow({
            req: criterionText,
            marks: marksCell,
            obtained: obtainedCell,
            alumni: alumniCell,
          });
        });
        y += 10;

        if (totalMarks > 0) {
          ensureSpace(14);
          setTextStyle(10.5, true);
          doc.text(
            `Result — Total marks: ${formatObtainedMarkDisplay(totalMarks)} | Total obtained marks: ${applicationApproved ? formatObtainedMarkDisplay(totalObtained) : "—"}`,
            margin,
            y
          );
          y += 10;
        }
      }

      hLine(0, 10);
      sectionTitle("Describe any additional achievements, leadership experience, awards, or qualifications relevant to this role.");
      drawRichTextBlock(String(data.additionalAchievements || "-"), maxWidth);

      hLine(0, 10);
      sectionTitle("Please share an outline of your plan or strategy for fulfilling the responsibilities assigned for this role");
      drawRichTextBlock(String(data.planStrategy || "-"), maxWidth, 9, true);

       sectionTitle("Uploaded Documents");

      const fileNameFromUrlPdf = (url: string) => {
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
      };

      const uploaded = Array.isArray(data.uploadedDocuments) ? data.uploadedDocuments : [];
      if (!uploaded.length) {
        drawWrappedText("-", margin, 10.5, false, maxWidth, 6);
      } else {
        uploaded.forEach((d) => {
          const label = String(d.label || "Document");
          const fileName = fileNameFromUrlPdf(String(d.url || ""));
          const value = fileName || String(d.url || "-");
          drawWrappedText(`${label}: ${value}`, margin, 10.5, false, maxWidth, 4);
        });
      }

      const footerY = pageHeight - 18;
      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.3);
      doc.line(margin, footerY - 6, pageWidth - margin, footerY - 6);
      setTextStyle(9, false, [100, 100, 100]);
      const footerText = "Office of Alumni Relations, EE2 Building 4th Floor | University of Lahore";
      const footerWidth = doc.getTextWidth(footerText);
      doc.text(footerText, (pageWidth - footerWidth) / 2, footerY);

      const pdfOutput = doc.output("arraybuffer");
      const buffer = Buffer.from(pdfOutput);
      resolve(buffer);
    } catch (error) {
      reject(error);
    }
  });
}

export function generateUpskillPDF(data: UpskillApplicationData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 50;
      const maxWidth = pageWidth - 2 * margin;
      let yPosition = margin;

      // Add logo on top right
      const logoBase64 = getLogoBase64();
      if (logoBase64) {
        try {
          const logoWidth = 40;
          const logoHeight = 20;
          const logoX = pageWidth - margin - logoWidth;
          const logoY = margin;
          doc.addImage(logoBase64, "PNG", logoX, logoY, logoWidth, logoHeight);
          yPosition = logoY + logoHeight + 15;
        } catch {
          yPosition = margin + 10;
        }
      } else {
        yPosition = margin + 10;
      }

      // Draw a line under the header
      doc.setDrawColor(0, 102, 51); // Green color matching logo
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 15;

      // Header text (left aligned)
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 102, 51); // Green color
      doc.text("Upskill & Reskill Course Application", margin, yPosition);
      yPosition += 10;

      // Date (right aligned)
      const date = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0); // Black
      const dateText = `Date: ${date}`;
      const dateWidth = doc.getTextWidth(dateText);
      doc.text(dateText, pageWidth - margin - dateWidth, yPosition);
      yPosition += 20;

      // Helper function to add text with word wrapping
      const addText = (text: string, fontSize: number, isBold: boolean = false, align: "left" | "center" | "right" = "left", spacing: number = 5) => {
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        doc.setTextColor(0, 0, 0); // Black
        const lines = doc.splitTextToSize(text, maxWidth);
        const xPos = align === "center" ? pageWidth / 2 : align === "right" ? pageWidth - margin : margin;
        doc.text(lines, xPos, yPosition, { align, maxWidth });
        yPosition += lines.length * (fontSize * 0.4) + spacing;
      };

      // Salutation
      addText("Dear Concern,", 12, false, "left", 8);

      // Main content
      addText(`I, ${data.alumniName}, an alumnus of UOL, am applying for the ${data.courseName} offered by the ${data.departmentName} with 15% discount.`, 12, false, "left", 8);
      addText("Please approve my application so I can proceed with enrollment in this course/program.", 12, false, "left", 15);
      
      // Closing
      addText("Regards,", 12, false, "left", 8);
      addText(data.alumniName, 12, true, "left", 10);

      // Add footer line
      const footerY = pageHeight - 30;
      doc.setDrawColor(0, 102, 51);
      doc.setLineWidth(0.5);
      doc.line(margin, footerY, pageWidth - margin, footerY);
      
      // Footer text
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100); // Gray
      const footerText = "Office of Alumni Relations, EE2 Building 4th Floor | University of Lahore";
      const footerWidth = doc.getTextWidth(footerText);
      doc.text(footerText, (pageWidth - footerWidth) / 2, footerY + 8);

      // Convert to buffer
      const pdfOutput = doc.output("arraybuffer");
      const buffer = Buffer.from(pdfOutput);
      resolve(buffer);
    } catch (error) {
      reject(error);
    }
  });
}
