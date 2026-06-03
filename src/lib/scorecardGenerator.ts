import jsPDF from "jspdf";
import type { LeadershipScorecardPayload } from "@/lib/leadershipScorecardData";
import { computeScorecardTotals } from "@/lib/leadershipScorecardTotals";

const STRATEGY_QUESTION =
  "Please share an outline of your plan or strategy for fulfilling the responsibilities assigned for this role.";
const ACHIEVEMENT_QUESTION =
  "Describe any additional achievements, leadership experience, awards, or qualifications relevant to this role.";

export function generateLeadershipScorecardPDF(data: LeadershipScorecardPayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 28;
      const maxWidth = pageWidth - 2 * margin;
      let y = margin;

      const totals = computeScorecardTotals(data);
      const assessedByDisplay =
        data.assessedByName?.trim() ||
        data.assessedByEmail?.trim() ||
        "—";

      const pageBottomY = () => pageHeight - margin - 12;

      const ensureSpace = (neededHeight: number) => {
        if (y + neededHeight <= pageBottomY()) return;
        doc.addPage();
        y = margin;
      };

      const setTextStyle = (fontSize: number, bold: boolean = false, color: [number, number, number] = [30, 30, 30]) => {
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setTextColor(color[0], color[1], color[2]);
      };

      const textHeight = (fontSize: number) => fontSize * 0.42;

      const drawWrapped = (text: string, x: number, fontSize: number, bold: boolean, maxW: number, spacing = 4) => {
        setTextStyle(fontSize, bold);
        const lines = doc.splitTextToSize(String(text ?? ""), maxW);
        const h = lines.length * textHeight(fontSize);
        ensureSpace(h + spacing);
        doc.text(lines, x, y, { maxWidth: maxW });
        y += h + spacing;
      };

      const fieldGrid = (
        fields: Array<{ label: string; value: string }>,
        opts?: { fontSize?: number; colGap?: number; rowGap?: number }
      ) => {
        const fontSize = opts?.fontSize ?? 9.5;
        const colGap = opts?.colGap ?? 14;
        const rowGap = opts?.rowGap ?? 4;
        const colW = (maxWidth - colGap) / 2;
        const x1 = margin;
        const x2 = margin + colW + colGap;

        setTextStyle(fontSize, false, [60, 60, 60]);
        for (let i = 0; i < fields.length; i += 2) {
          const left = fields[i];
          const right = fields[i + 1];

          const lText = `${left.label}: ${left.value || "—"}`;
          const rText = right ? `${right.label}: ${right.value || "—"}` : "";

          const lLines = doc.splitTextToSize(lText, colW);
          const rLines = rText ? doc.splitTextToSize(rText, colW) : [""];
          const rowLines = Math.max(lLines.length, rLines.length, 1);
          const rowH = rowLines * textHeight(fontSize) + rowGap;
          ensureSpace(rowH + 1);

          doc.text(lLines, x1, y, { maxWidth: colW });
          if (rText) doc.text(rLines, x2, y, { maxWidth: colW });
          y += rowH;
        }
        y += 2;
      };

      const sectionTitle = (title: string) => {
        const fontSize = 12;
        setTextStyle(fontSize, true, [0, 102, 51]);
        const lines = doc.splitTextToSize(title, maxWidth);
        const titleH = Math.max(1, lines.length) * textHeight(fontSize);
        ensureSpace(titleH + 14);
        doc.text(lines, margin, y, { maxWidth });
        y += titleH + 4;
        doc.setDrawColor(0, 102, 51);
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageWidth - margin, y);
        y += 10;
      };

      // Header
      setTextStyle(16, true, [0, 80, 40]);
      ensureSpace(20);
      doc.text("Leadership Application Scorecard", margin, y);
      y += 14;

      fieldGrid(
        [
          { label: "Application ID", value: String(data.applicationId) },
          { label: "Assessment Date", value: data.assessmentDate || "—" },
          { label: "Assessed By", value: assessedByDisplay },
          { label: "Email", value: data.applicant.email || "—" },
          { label: "Chapter / Association", value: data.applicationTypeLabel || "—" },
          { label: "Position Applied For", value: data.position || "—" },
        ],
        { fontSize: 9.2, rowGap: 3 }
      );

      y += 4;
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageWidth - margin, y);
      y += 12;

      // Section 1: Applicant Information
      sectionTitle("Section 1: Applicant Information");
      fieldGrid(
        [
          { label: "Applicant Name", value: data.applicant.name || "—" },
          { label: "Membership Number", value: data.applicant.membershipNumber || "—" },
          { label: "Position Applied For", value: data.position || "—" },
          {
            label: "Application Type",
            value: data.leadershipType === "chapter" ? "Chapter Leadership" : "Association Leadership",
          },
          { label: "Category", value: data.applicationTypeLabel || "—" },
          { label: "Application Date", value: data.applicationDate || "—" },
          ...(data.applicant.faculty ? [{ label: "Faculty", value: data.applicant.faculty }] : []),
          ...(data.applicant.department ? [{ label: "Department", value: data.applicant.department }] : []),
          ...(data.applicant.program ? [{ label: "Program", value: data.applicant.program }] : []),
        ],
        { fontSize: 9.5, rowGap: 3 }
      );

      // Section 2: Assessment Criteria Scorecard
      sectionTitle("Section 2: Assessment Criteria Scorecard");

      const col1 = margin;
      const col2 = margin + maxWidth * 0.62;
      const col3 = margin + maxWidth * 0.82;
      const rowH = 10;
      const tableFont = 9;

      const drawTableHeader = () => {
        ensureSpace(rowH + 4);
        doc.setFillColor(240, 248, 244);
        doc.rect(margin, y - 5, maxWidth, rowH, "F");
        setTextStyle(tableFont, true);
        doc.text("Assessment Criteria", col1 + 2, y);
        doc.text("Obtained", col2, y, { align: "right" });
        doc.text("Total", col3, y, { align: "right" });
        y += rowH + 2;
      };

      drawTableHeader();

      for (const row of data.criteria) {
        if (!row.label) continue;
        const obtained =
          row.obtainedMarks != null && Number.isFinite(row.obtainedMarks) ? String(row.obtainedMarks) : "—";
        const total = row.totalMarks != null && Number.isFinite(row.totalMarks) ? String(row.totalMarks) : "—";

        setTextStyle(tableFont, false);
        const labelLines = doc.splitTextToSize(row.label, maxWidth * 0.58);
        const needed = Math.max(labelLines.length * textHeight(tableFont), rowH) + 4;
        if (y + needed > pageBottomY()) {
          doc.addPage();
          y = margin;
          drawTableHeader();
        }
        doc.text(labelLines, col1 + 2, y);
        doc.text(obtained, col2, y, { align: "right" });
        doc.text(total, col3, y, { align: "right" });
        y += needed;
      }

      y += 4;
      setTextStyle(10, true);
      drawWrapped(
        `Assessment Subtotal: ${totals.assessmentObtained} / ${totals.assessmentMaximum}`,
        margin,
        10,
        true,
        maxWidth,
        8
      );

      // Section 3: Bonus Assessment
      sectionTitle("Section 3: Bonus Assessment");

      const bonusBlock = (
        subtitle: string,
        question: string,
        response: string | null,
        obtained: number,
        maximum: number
      ) => {
        setTextStyle(10, true, [0, 102, 51]);
        drawWrapped(subtitle, margin, 10, true, maxWidth, 4);
        setTextStyle(9, true);
        drawWrapped("Question:", margin, 9, true, maxWidth, 2);
        setTextStyle(9, false);
        drawWrapped(question, margin, 9, false, maxWidth, 4);
        setTextStyle(9, true);
        drawWrapped("Applicant Response:", margin, 9, true, maxWidth, 2);
        setTextStyle(9, false);
        drawWrapped(response?.trim() || "—", margin, 9, false, maxWidth, 4);
        setTextStyle(9, true);
        drawWrapped(`Marks Awarded: ${obtained} / ${maximum}`, margin, 9, true, maxWidth, 10);
      };

      bonusBlock(
        "Strategy & Planning",
        STRATEGY_QUESTION,
        data.planStrategy,
        data.strategyAssessmentMarks,
        15
      );
      bonusBlock(
        "Additional Achievements",
        ACHIEVEMENT_QUESTION,
        data.additionalAchievements,
        data.achievementAssessmentMarks,
        10
      );

      setTextStyle(10, true);
      drawWrapped(`Bonus Marks: ${totals.bonusObtained} / ${totals.bonusMaximum}`, margin, 10, true, maxWidth, 10);

      // Section 4: Final Results
      sectionTitle("Section 4: Final Results");
      doc.setFillColor(248, 250, 252);
      const boxH = 36;
      ensureSpace(boxH + 8);
      doc.rect(margin, y, maxWidth, boxH, "F");
      doc.setDrawColor(255, 255, 255);
      doc.rect(margin, y, maxWidth, boxH, "S");
      const innerY = y + 10;
      let lineY = innerY;
      doc.setFillColor(255, 255, 255); // Set background to white
      doc.rect(margin, y, maxWidth, boxH, "F"); // Overdraw white background
      setTextStyle(10, false);
      doc.text(`Assessment Marks: ${totals.assessmentObtained} / ${totals.assessmentMaximum}`, margin + 8, lineY);
      lineY += 8;
      doc.text(`Bonus Marks: ${totals.bonusObtained} / ${totals.bonusMaximum}`, margin + 8, lineY);
      lineY += 8;
      setTextStyle(11, true);
      doc.text(`Grand Total: ${totals.grandObtained} / ${totals.grandMaximum}`, margin + 8, lineY);
      y += boxH + 12;
 

      // Section 5: Percentage
      sectionTitle("Section 5: Percentage & Ranking");
      const pct = totals.grandMaximum > 0 ? totals.percentage.toFixed(2) : "0.00";
      drawWrapped(`Percentage: ${pct}%`, margin, 11, true, maxWidth, 8);

      if (data.assessmentRemarks?.trim()) {
        sectionTitle("Assessment Summary");
        setTextStyle(9, false);
        drawWrapped(data.assessmentRemarks.trim(), margin, 9, false, maxWidth, 8);
      }

      // Section 6: Signatures
      sectionTitle("Section 6: Signatures");
      ensureSpace(40);
      setTextStyle(10, false);
      doc.text("Assessed By:", margin, y);
      doc.line(margin + 32, y, margin + 120, y);
      y += 14;
      doc.text("Date:", margin, y);
      doc.line(margin + 18, y, margin + 90, y);
      y += 20;

      // Footer page numbers
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        setTextStyle(8, false, [120, 120, 120]);
        doc.text(
          `Leadership Scorecard — Application #${data.applicationId} — Page ${i} of ${pageCount}`,
          pageWidth / 2,
          pageHeight - 14,
          { align: "center" }
        );
      }

      const buf = Buffer.from(doc.output("arraybuffer"));
      resolve(buf);
    } catch (e) {
      reject(e);
    }
  });
}
