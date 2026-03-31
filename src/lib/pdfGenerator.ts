import { jsPDF } from "jspdf";
import { formatObtainedMarkDisplay, normalizeObtainedMark } from "@/lib/leadershipMarks";
import { readFileSync } from "fs";
import { join } from "path";

// Helper function to get logo as base64
function getLogoBase64(): string {
  try {
    const logoPath = join(process.cwd(), "public", "images", "logo", "logo.png");
    const logoBuffer = readFileSync(logoPath);
    return `data:image/png;base64,${logoBuffer.toString("base64")}`;
  } catch {
    return "";
  }
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

 export interface MembershipApplicationData {
   alumniName: string;
   membershipType: string;
   gymMembershipMonth?: string | null;
   swimmingPoolMembershipMonth?: string | null;
 }

export function generateScholarshipPDF(data: ScholarshipApplicationData): Promise<Buffer> {
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
      addText(`I, ${data.alumniName}, an alumnus of UOL, am applying for ${getDiscountLabel(data.discountType)}.`, 12, false, "left", 8);

      // Conditional content based on discount type
      if (data.discountType === "kinship") {
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
      } else if (data.discountType === "masters-phd") {
        const discountPercent = data.applyingFor === "Masters" ? "50%" : "25%";
        addText(`I can avail ${discountPercent} discount for my ${data.applyingFor} program.`, 12, false, "left", 8);
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
      const footerText = "Office of Alumni Relations | University of Lahore";
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

 export function generateMembershipPDF(data: MembershipApplicationData): Promise<Buffer> {
   return new Promise((resolve, reject) => {
     try {
       const doc = new jsPDF();
       const pageWidth = doc.internal.pageSize.getWidth();
       const pageHeight = doc.internal.pageSize.getHeight();
       const margin = 50;
       const maxWidth = pageWidth - 2 * margin;
       let yPosition = margin;

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

       doc.setDrawColor(0, 102, 51);
       doc.setLineWidth(0.5);
       doc.line(margin, yPosition, pageWidth - margin, yPosition);
       yPosition += 15;

       doc.setFontSize(18);
       doc.setFont("helvetica", "bold");
       doc.setTextColor(0, 102, 51);
       doc.text("Alumni Membership Application", margin, yPosition);
       yPosition += 10;

       const date = new Date().toLocaleDateString("en-US", {
         year: "numeric",
         month: "long",
         day: "numeric",
       });
       doc.setFontSize(11);
       doc.setFont("helvetica", "normal");
       doc.setTextColor(0, 0, 0);
       const dateText = `Date: ${date}`;
       const dateWidth = doc.getTextWidth(dateText);
       doc.text(dateText, pageWidth - margin - dateWidth, yPosition);
       yPosition += 20;

       const addText = (
         text: string,
         fontSize: number,
         isBold: boolean = false,
         align: "left" | "center" | "right" = "left",
         spacing: number = 5
       ) => {
         doc.setFontSize(fontSize);
         doc.setFont("helvetica", isBold ? "bold" : "normal");
         doc.setTextColor(0, 0, 0);
         const lines = doc.splitTextToSize(text, maxWidth);
         const xPos = align === "center" ? pageWidth / 2 : align === "right" ? pageWidth - margin : margin;
         doc.text(lines, xPos, yPosition, { align, maxWidth });
         yPosition += lines.length * (fontSize * 0.4) + spacing;
       };

       addText("Dear Concern,", 12, false, "left", 8);

       addText(
         `I, ${data.alumniName}, an alumnus of UOL, am applying for ${data.membershipType} membership.`,
         12,
         false,
         "left",
         8
       );

       if (data.gymMembershipMonth) {
         addText(`Gym Membership Month: ${data.gymMembershipMonth}`, 12, false, "left", 8);
       }
       if (data.swimmingPoolMembershipMonth) {
         addText(`Swimming Pool Membership Month: ${data.swimmingPoolMembershipMonth}`, 12, false, "left", 8);
       }

       addText("Please approve so that the applicant can proceed with the process.", 12, false, "left", 15);

       addText("Regards,", 12, false, "left", 8);
       addText(data.alumniName, 12, true, "left", 10);

       const footerY = pageHeight - 30;
       doc.setDrawColor(0, 102, 51);
       doc.setLineWidth(0.5);
       doc.line(margin, footerY, pageWidth - margin, footerY);

       doc.setFontSize(9);
       doc.setFont("helvetica", "normal");
       doc.setTextColor(100, 100, 100);
       const footerText = "Office of Alumni Relations | University of Lahore";
       const footerWidth = doc.getTextWidth(footerText);
       doc.text(footerText, (pageWidth - footerWidth) / 2, footerY + 8);

       const pdfOutput = doc.output("arraybuffer");
       const buffer = Buffer.from(pdfOutput);
       resolve(buffer);
     } catch (error) {
       reject(error);
     }
   });
 }

function getDiscountLabel(discountType: string): string {
  switch (discountType) {
    case "kinship":
      return "Kinship Discount";
    case "masters-phd":
      return "Masters/PhD Discount";
    case "masters-collaboration":
      return "Masters Scholarships via UOL International Collaborations";
    default:
      return "Scholarship/Discount";
  }
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
      const footerText = "Office of Alumni Relations | University of Lahore";
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
      const footerText = "Office of Alumni Relations | University of Lahore";
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
