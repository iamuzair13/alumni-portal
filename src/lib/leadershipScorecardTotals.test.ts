import { describe, expect, it } from "vitest";
import { computeScorecardTotals } from "./leadershipScorecardTotals";

describe("computeScorecardTotals", () => {
  it("sums assessment criteria and bonus correctly", () => {
    const totals = computeScorecardTotals({
      criteria: [
        { obtainedMarks: 8, totalMarks: 10 },
        { obtainedMarks: 9, totalMarks: 10 },
      ],
      strategyAssessmentMarks: 12,
      achievementAssessmentMarks: 8,
      bonusMarks: 20,
    });
    expect(totals.assessmentObtained).toBe(17);
    expect(totals.assessmentMaximum).toBe(20);
    expect(totals.bonusObtained).toBe(20);
    expect(totals.bonusMaximum).toBe(25);
    expect(totals.grandObtained).toBe(37);
    expect(totals.grandMaximum).toBe(45);
  });

  it("calculates percentage from grand total", () => {
    const totals = computeScorecardTotals({
      criteria: [
        { obtainedMarks: 8, totalMarks: 10 },
        { obtainedMarks: 9, totalMarks: 10 },
      ],
      strategyAssessmentMarks: 12,
      achievementAssessmentMarks: 8,
      bonusMarks: 20,
    });
    expect(totals.percentage).toBeCloseTo((37 / 45) * 100, 5);
  });
});
