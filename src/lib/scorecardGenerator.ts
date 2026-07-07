import { jsPDF } from "jspdf";
import { readFileSync } from "fs";
import { join } from "path";
import type { BulkScorecardCriterion, BulkScorecardPayload } from "@/lib/leadershipScorecardData";
import { bulkScorecardRoleLabel } from "@/lib/leadershipScorecardData";
import { formatObtainedMarkDisplay, normalizeObtainedMark } from "@/lib/leadershipMarks";

const PDF_LOGO_MAX_BYTES = 512 * 1024;

const THEME = {
  margin: 14,
  colors: {
    brand: [0, 102, 51] as [number, number, number],
    brandLight: [240, 247, 243] as [number, number, number],
    text: [33, 33, 33] as [number, number, number],
    muted: [100, 100, 100] as [number, number, number],
    border: [218, 218, 218] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
  },
  font: {
    h1: 14,
    h2: 11,
    body: 9,
    small: 8,
    tiny: 7.5,
  },
};

const QUESTIONS_COL_RATIO = 0.38;
const MIN_APPLICANT_COL_MM = 22;
const MIN_HEADER_ROW_H = 7;
const CELL_PAD = 1.5;
const TABLE_FONT = 8;
const HEADER_FONT = 7.5;
const SECTION_GAP = 3;
const BONUS_MARKS_MAX = 25;

function getLogoBase64(): string {
  const candidates = [
    join(process.cwd(), "public", "images", "logo", "UOL-Rebrand-ID_Final-04.png"),
    join(process.cwd(), "public", "images", "logo", "UOL-Rebrand-ID_Final-01.png"),
    join(process.cwd(), "public", "images", "logo", "logo-white.png"),
  ];
  for (const logoPath of candidates) {
    try {
      const logoBuffer = readFileSync(logoPath);
      if (logoBuffer.length > PDF_LOGO_MAX_BYTES) continue;
      return `data:image/png;base64,${logoBuffer.toString("base64")}`;
    } catch {
      // try next
    }
  }
  return "";
}

function criterionQuestionText(c: BulkScorecardCriterion): string {
  const label = String(c.label || "-");
  const desc = c.description ? `Note: ${String(c.description)}` : "";
  return [label, desc].filter(Boolean).join("\n");
}

function maxApplicantsPerPage(pageW: number, margin: number): number {
  const usable = pageW - margin * 2;
  const questionsW = usable * QUESTIONS_COL_RATIO;
  const remaining = usable - questionsW;
  return Math.max(1, Math.floor(remaining / MIN_APPLICANT_COL_MM));
}

function chunkApplicants<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [[]];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function generateBulkLeadershipScorecardPDF(
  data: BulkScorecardPayload | BulkScorecardPayload[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const payloads = Array.isArray(data) ? data : [data];
      const isMultiRole = payloads.length > 1;
      const doc = new jsPDF({ compress: true, unit: "mm", orientation: "landscape" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const m = THEME.margin;
      const W = pageW - m * 2;
      let y = m;
      let activePayload = payloads[0];

      const pageBottom = () => pageH - m - 12;
      const lineH = (size: number) => size * 0.38;
      let allowVerticalPageBreak = false;

      const startNewContentPage = () => {
        drawPageFooter();
        doc.addPage();
        y = m;
      };

      const setStyle = (size: number, bold = false, color: [number, number, number] = THEME.colors.text) => {
        doc.setFontSize(size);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setTextColor(color[0], color[1], color[2]);
      };

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
        if (!allowVerticalPageBreak || y + need <= pageBottom()) return false;
        startNewContentPage();
        return true;
      };

      const startApplicantBatchPage = (batchIdx: number) => {
        if (batchIdx > 0) {
          startNewContentPage();
        }
      };

      const drawContinuationHeader = (batchStart: number, batchEnd: number, roleLabel?: string) => {
        const barH = 10;
        doc.setFillColor(...THEME.colors.brandLight);
        doc.setDrawColor(...THEME.colors.brand);
        doc.setLineWidth(0.3);
        doc.rect(m, y, W, barH, "S");
        setStyle(THEME.font.small, true, THEME.colors.brand);
        const rolePrefix = roleLabel ? `${roleLabel} — ` : "";
        doc.text(
          `${rolePrefix}Leadership Scorecard — Applicants ${batchStart}–${batchEnd}`,
          m + 2,
          y + 4
        );
        y += barH + 4;
      };

      const drawRoleSectionBanner = (roleLabel: string, roleIndex: number) => {
        const barH = 14;
        ensureSpace(barH + 5);
        doc.setFillColor(...THEME.colors.brand);
        doc.setDrawColor(...THEME.colors.brand);
        doc.setLineWidth(0.3);
        doc.rect(m, y, W, barH, "F");

        setStyle(THEME.font.h2, true, THEME.colors.white);
        doc.text(roleLabel.toUpperCase(), m + 4, y + 6.5);
        setStyle(THEME.font.small, false, [220, 240, 230] as [number, number, number]);
        doc.text("All Applicants", m + 4, y + 11.5);

        const badge = `${roleIndex + 1} of ${payloads.length}`;
        setStyle(THEME.font.small, true, THEME.colors.brand);
        const badgeW = doc.getTextWidth(badge) + 8;
        const badgeX = pageW - m - badgeW - 2;
        doc.setFillColor(...THEME.colors.white);
        doc.roundedRect(badgeX, y + 3.5, badgeW, 7, 1.5, 1.5, "F");
        doc.text(badge, badgeX + 4, y + 8.5);

        y += barH + 5;
      };

      const drawBrandedHeader = () => {
        const headerH = 20;
        doc.setFillColor(...THEME.colors.brand);
        doc.rect(m, y, W, headerH, "F");

        const titleX = m + 4;
        doc.setFontSize(THEME.font.h1);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        const headerTitle = isMultiRole
          ? `Leadership Scorecard — ${bulkScorecardRoleLabel(activePayload.role)}`
          : "Leadership Scorecard";
        doc.text(headerTitle, titleX, y + 9);
        doc.setFontSize(THEME.font.small);
        doc.setFont("helvetica", "normal");
        doc.text("Office of Alumni Relations — University of Lahore", titleX, y + 15);

        const logo = getLogoBase64();
        if (logo) {
          try {
            const logoW = 28;
            const logoH = 12;
            doc.addImage(logo, "PNG", pageW - m - logoW - 2, y + 4, logoW, logoH);
          } catch {
            // skip logo
          }
        }

        y += headerH + 5;

        const roleLabel = bulkScorecardRoleLabel(activePayload.role);
        const typeLabel = activePayload.leadershipType === "chapter" ? "Chapter" : "Association";
        const infoPairs = [
          { label: "Role", value: roleLabel },
          { label: "Type", value: typeLabel },
          ...(activePayload.categoryLabel ? [{ label: "Category", value: activePayload.categoryLabel }] : []),
          { label: "Generated", value: activePayload.generatedAt },
          { label: "Applicants", value: String(activePayload.applicants.length) },
        ];

        const colCount = infoPairs.length;
        const colW = (W - (colCount - 1) * 2) / colCount;
        let maxRowH = 10;
        infoPairs.forEach((p) => {
          const lines = doc.splitTextToSize(p.value, colW - 4);
          maxRowH = Math.max(maxRowH, lines.length * lineH(THEME.font.small) + 7);
        });
        ensureSpace(maxRowH + 4);

        infoPairs.forEach((p, i) => {
          const x = m + i * (colW + 2);
          doc.setFillColor(250, 250, 250);
          doc.setDrawColor(...THEME.colors.border);
          doc.setLineWidth(0.1);
          doc.rect(x, y, colW, maxRowH, "FD");
          setStyle(THEME.font.tiny, true, THEME.colors.muted);
          doc.text(p.label.toUpperCase(), x + 2.5, y + 3.5);
          setStyle(THEME.font.small, false, THEME.colors.text);
          doc.text(doc.splitTextToSize(p.value, colW - 4), x + 2.5, y + 7);
        });
        y += maxRowH + 6;
      };

      const drawSectionTitle = (
        title: string,
        opts?: { compact?: boolean; roleLabel?: string }
      ) => {
        const barH = opts?.compact ? 5.5 : 6.5;
        y += opts?.compact ? 0 : SECTION_GAP;
        ensureSpace(barH + 2);
        doc.setFillColor(...THEME.colors.brandLight);
        doc.setDrawColor(...THEME.colors.brand);
        doc.setLineWidth(0.3);
        doc.rect(m, y, 2.5, barH, "F");
        doc.rect(m, y, W, barH, "S");
        setStyle(THEME.font.small, true, THEME.colors.brand);
        const displayTitle = opts?.roleLabel ? `${title} — ${opts.roleLabel}` : title;
        doc.text(displayTitle.toUpperCase(), m + 5, y + 4.3);
        y += barH + 2;
      };

      type TableContext = {
        questionsW: number;
        applicantW: number;
        batch: BulkScorecardPayload["applicants"];
        batchLabel?: string;
        payload: BulkScorecardPayload;
      };

      const measureTableHeaderHeight = (ctx: TableContext): number => {
        setStyle(HEADER_FONT, true, THEME.colors.white);
        const nameColW = ctx.applicantW - CELL_PAD * 2;
        const questionsLabelLines = doc.splitTextToSize("Questions", ctx.questionsW - CELL_PAD * 2);
        const applicantNameLines = ctx.batch.map((applicant) =>
          doc.splitTextToSize(applicant.name || "—", nameColW)
        );
        const maxNameLines = Math.max(
          questionsLabelLines.length,
          ...applicantNameLines.map((lines) => lines.length),
          1
        );
        return Math.max(MIN_HEADER_ROW_H, maxNameLines * lineH(HEADER_FONT) + CELL_PAD * 2);
      };

      const measureTableRowHeight = (
        ctx: TableContext,
        question: string,
        marks: Array<number | string | null>,
        bold = false
      ): number => {
        setStyle(TABLE_FONT, bold, THEME.colors.text);
        const qLines = doc.splitTextToSize(question, ctx.questionsW - CELL_PAD * 2);
        const markLineCounts = marks.map((mark) => {
          const text = formatMarkCell(mark);
          return doc.splitTextToSize(text, ctx.applicantW - CELL_PAD * 2).length;
        });
        const rowLines = Math.max(qLines.length, ...markLineCounts, 1);
        return Math.max(MIN_HEADER_ROW_H - 1, rowLines * lineH(TABLE_FONT) + CELL_PAD * 2);
      };

      const drawTableHeader = (ctx: TableContext) => {
        const totalW = ctx.questionsW + ctx.applicantW * ctx.batch.length;
        const nameColW = ctx.applicantW - CELL_PAD * 2;

        setStyle(HEADER_FONT, true, THEME.colors.white);
        const questionsLabelLines = doc.splitTextToSize("Questions", ctx.questionsW - CELL_PAD * 2);
        const applicantNameLines = ctx.batch.map((applicant) =>
          doc.splitTextToSize(applicant.name || "—", nameColW)
        );
        const headerRowH = measureTableHeaderHeight(ctx);
        const textStartY = y + CELL_PAD + lineH(HEADER_FONT);

        doc.setFillColor(...THEME.colors.brand);
        doc.setDrawColor(...THEME.colors.brand);
        doc.setLineWidth(0.15);
        doc.rect(m, y, totalW, headerRowH, "F");

        setStyle(HEADER_FONT, true, THEME.colors.white);
        doc.text(questionsLabelLines, m + CELL_PAD, textStartY);

        ctx.batch.forEach((applicant, idx) => {
          const x = m + ctx.questionsW + idx * ctx.applicantW;
          doc.text(applicantNameLines[idx], x + CELL_PAD, textStartY);
        });

        y += headerRowH;
      };

      const formatMarkCell = (mark: number | string | null): string => {
        if (typeof mark === "string") return mark;
        return mark != null && Number.isFinite(mark) ? formatObtainedMarkDisplay(mark) : "—";
      };

      const drawTableRow = (
        ctx: TableContext,
        question: string,
        marks: Array<number | string | null>,
        shaded: boolean,
        bold = false
      ) => {
        const rowH = measureTableRowHeight(ctx, question, marks, bold);
        const totalW = ctx.questionsW + ctx.applicantW * ctx.batch.length;
        const qLines = doc.splitTextToSize(question, ctx.questionsW - CELL_PAD * 2);

        if (shaded) {
          doc.setFillColor(248, 250, 248);
          doc.rect(m, y, totalW, rowH, "F");
        }

        doc.setDrawColor(...THEME.colors.border);
        doc.setLineWidth(0.1);
        doc.rect(m, y, totalW, rowH, "S");

        doc.line(m + ctx.questionsW, y, m + ctx.questionsW, y + rowH);
        for (let i = 1; i < ctx.batch.length; i++) {
          const dividerX = m + ctx.questionsW + i * ctx.applicantW;
          doc.line(dividerX, y, dividerX, y + rowH);
        }

        setStyle(TABLE_FONT, bold, THEME.colors.text);
        doc.text(qLines, m + CELL_PAD, y + CELL_PAD + lineH(TABLE_FONT));

        marks.forEach((mark, idx) => {
          const x = m + ctx.questionsW + idx * ctx.applicantW;
          const lines = doc.splitTextToSize(formatMarkCell(mark), ctx.applicantW - CELL_PAD * 2);
          doc.text(lines, x + CELL_PAD, y + CELL_PAD + lineH(TABLE_FONT));
        });

        y += rowH;
      };

      const drawTableContinuationLabel = (sectionLabel: string, roleLabel?: string) => {
        const barH = 7;
        ensureSpace(barH + 2);
        doc.setFillColor(...THEME.colors.brandLight);
        doc.setDrawColor(...THEME.colors.brand);
        doc.setLineWidth(0.2);
        doc.rect(m, y, W, barH, "S");
        setStyle(THEME.font.tiny, true, THEME.colors.brand);
        const prefix = roleLabel ? `${roleLabel} — ` : "";
        doc.text(`${prefix}${sectionLabel} (continued)`, m + 3, y + 4.5);
        y += barH + 2;
      };

      const drawCriteriaTable = (
        ctx: TableContext,
        criteria: BulkScorecardCriterion[],
        emptyMessage: string,
        opts?: { sectionLabel?: string; roleLabel?: string }
      ) => {
        if (criteria.length === 0) {
          setStyle(TABLE_FONT, false, THEME.colors.muted);
          doc.text(emptyMessage, m, y);
          y += 6;
          return;
        }

        let needsHeader = true;

        const ensureTableHeader = () => {
          const headerH = measureTableHeaderHeight(ctx);
          if (y + headerH > pageBottom()) {
            startNewContentPage();
            if (opts?.sectionLabel) {
              drawTableContinuationLabel(opts.sectionLabel, opts.roleLabel);
            }
          }
          drawTableHeader(ctx);
          needsHeader = false;
        };

        criteria.forEach((criterion, idx) => {
          const question = criterionQuestionText(criterion);
          const marks = ctx.batch.map((a) => a.marksByCriterionId[criterion.id] ?? null);
          const rowH = measureTableRowHeight(ctx, question, marks);

          if (needsHeader) {
            const headerH = measureTableHeaderHeight(ctx);
            if (y + headerH + rowH > pageBottom()) {
              startNewContentPage();
              if (opts?.sectionLabel) {
                drawTableContinuationLabel(opts.sectionLabel, opts.roleLabel);
              }
            }
            ensureTableHeader();
          } else if (y + rowH > pageBottom()) {
            startNewContentPage();
            needsHeader = true;
            if (opts?.sectionLabel) {
              drawTableContinuationLabel(opts.sectionLabel, opts.roleLabel);
            }
            ensureTableHeader();
          }

          drawTableRow(ctx, question, marks, idx % 2 === 1);
        });
      };

      const sumApplicantObtainedMarks = (
        applicant: BulkScorecardPayload["applicants"][number],
        criteria: BulkScorecardCriterion[]
      ): number | null => {
        let total = 0;
        let hasAny = false;
        for (const criterion of criteria) {
          const mark = applicant.marksByCriterionId[criterion.id];
          if (mark != null && Number.isFinite(mark)) {
            total += mark;
            hasAny = true;
          }
        }
        return hasAny ? normalizeObtainedMark(total) : null;
      };

      const sumCriteriaMaximumMarks = (criteria: BulkScorecardCriterion[]): number => {
        return normalizeObtainedMark(
          criteria.reduce((sum, criterion) => {
            const max = criterion.criterionScore;
            return max != null && Number.isFinite(max) && max > 0 ? sum + max : sum;
          }, 0)
        );
      };

      const drawSummaryRows = (
        ctx: TableContext,
        allCriteria: BulkScorecardCriterion[],
        opts?: { sectionLabel?: string; roleLabel?: string }
      ) => {
        if (ctx.batch.length === 0 || allCriteria.length === 0) return;

        const criteriaMax = sumCriteriaMaximumMarks(allCriteria);
        const obtainedTotals = ctx.batch.map((a) => sumApplicantObtainedMarks(a, allCriteria));
        const bonusMarks = ctx.batch.map((a) => a.bonusMarks ?? 0);
        const grandTotals = ctx.batch.map((a, idx) => {
          const obtained = obtainedTotals[idx];
          if (obtained == null) return null;
          return normalizeObtainedMark(obtained + (bonusMarks[idx] ?? 0));
        });
        const grandMaximum = normalizeObtainedMark(criteriaMax + BONUS_MARKS_MAX);

        const summaryRows: Array<{ label: string; values: Array<string> }> = [
          {
            label: "Total Obtained Marks",
            values: obtainedTotals.map((total) =>
              total != null ? `${formatObtainedMarkDisplay(total)} / ${formatObtainedMarkDisplay(criteriaMax)}` : "—"
            ),
          },
          {
            label: "Bonus Marks",
            values: bonusMarks.map((bonus) =>
              `${formatObtainedMarkDisplay(bonus)} / ${formatObtainedMarkDisplay(BONUS_MARKS_MAX)}`
            ),
          },
          {
            label: "Grand Total",
            values: grandTotals.map((total) =>
              total != null
                ? `${formatObtainedMarkDisplay(total)} / ${formatObtainedMarkDisplay(grandMaximum)}`
                : "—"
            ),
          },
        ];

        summaryRows.forEach((row, idx) => {
          const rowH = measureTableRowHeight(ctx, row.label, row.values, true);
          if (y + rowH > pageBottom()) {
            startNewContentPage();
            if (opts?.sectionLabel) {
              drawTableContinuationLabel(opts.sectionLabel, opts.roleLabel);
            }
            drawTableHeader(ctx);
          }
          drawTableRow(ctx, row.label, row.values, idx % 2 === 1, true);
        });
      };

      const drawApplicantBatchScorecard = (
        batchIdx: number,
        perPage: number,
        ctx: TableContext,
        payloadIdx: number
      ) => {
        const roleLabel = bulkScorecardRoleLabel(ctx.payload.role);
        const sectionRoleLabel = isMultiRole ? roleLabel : undefined;

        startApplicantBatchPage(batchIdx);

        if (batchIdx === 0) {
          if (isMultiRole) {
            drawRoleSectionBanner(roleLabel, payloadIdx);
          }
          allowVerticalPageBreak = true;
          drawBrandedHeader();
        } else {
          const batchStart = batchIdx * perPage + 1;
          const batchEnd = batchIdx * perPage + ctx.batch.length;
          drawContinuationHeader(
            batchStart,
            batchEnd,
            isMultiRole ? roleLabel : undefined
          );
        }

        allowVerticalPageBreak = true;
        const tableOpts = {
          sectionLabel: "Scorecard",
          roleLabel: sectionRoleLabel,
        };

        drawSectionTitle("Section 1: Mandatory Criteria", {
          compact: batchIdx > 0,
          roleLabel: sectionRoleLabel,
        });
        if (ctx.payload.applicants.length === 0) {
          setStyle(TABLE_FONT, false, THEME.colors.muted);
          doc.text(
            "No applications found for the selected role, type, and chapter or association.",
            m,
            y
          );
          y += 6;
        } else {
          drawCriteriaTable(
            ctx,
            ctx.payload.criteria.mandatory,
            "No mandatory criteria defined.",
            { ...tableOpts, sectionLabel: "Section 1: Mandatory Criteria" }
          );
        }

        drawSectionTitle("Section 2: Optional Criteria", {
          compact: true,
          roleLabel: sectionRoleLabel,
        });
        if (ctx.payload.applicants.length > 0) {
          drawCriteriaTable(
            ctx,
            ctx.payload.criteria.optional,
            "No optional criteria defined.",
            { ...tableOpts, sectionLabel: "Section 2: Optional Criteria" }
          );
          const allCriteria = [...ctx.payload.criteria.mandatory, ...ctx.payload.criteria.optional];
          if (allCriteria.length > 0) {
            y += 1;
            drawSummaryRows(ctx, allCriteria, {
              ...tableOpts,
              sectionLabel: "Summary",
            });
          }
        }
        allowVerticalPageBreak = false;
      };

      payloads.forEach((payload, payloadIdx) => {
        activePayload = payload;
        if (payloadIdx > 0) {
          startNewContentPage();
        }

        const perPage = maxApplicantsPerPage(pageW, m);
        const batches = chunkApplicants(payload.applicants, perPage);
        batches.forEach((batch, batchIdx) => {
          const questionsW = W * QUESTIONS_COL_RATIO;
          const ctx: TableContext = {
            questionsW,
            applicantW: (W - questionsW) / Math.max(batch.length, 1),
            batch,
            payload,
          };
          drawApplicantBatchScorecard(batchIdx, perPage, ctx, payloadIdx);
        });
      });

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        drawPageFooter();
      }

      resolve(Buffer.from(doc.output("arraybuffer")));
    } catch (e) {
      reject(e);
    }
  });
}
