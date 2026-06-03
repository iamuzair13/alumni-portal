import { normalizeObtainedMark } from "./leadershipMarks";

export type ScorecardTotalsInput = {
  criteria: Array<{ obtainedMarks: number | null; totalMarks: number | null }>;
  strategyAssessmentMarks: number;
  achievementAssessmentMarks: number;
  bonusMarks: number;
};

export function computeScorecardTotals(data: ScorecardTotalsInput) {
  let assessmentObtained = 0;
  let assessmentMaximum = 0;
  for (const c of data.criteria) {
    if (c.totalMarks != null && Number.isFinite(c.totalMarks) && c.totalMarks > 0) {
      assessmentMaximum += c.totalMarks;
      if (c.obtainedMarks != null && Number.isFinite(c.obtainedMarks)) {
        assessmentObtained += c.obtainedMarks;
      }
    }
  }
  const strategyMarks = normalizeObtainedMark(data.strategyAssessmentMarks);
  const achievementMarks = normalizeObtainedMark(data.achievementAssessmentMarks);
  const bonusObtained = Number.isFinite(data.bonusMarks)
    ? normalizeObtainedMark(data.bonusMarks)
    : normalizeObtainedMark(strategyMarks + achievementMarks);
  const bonusMaximum = 25;
  const grandObtained = normalizeObtainedMark(assessmentObtained + bonusObtained);
  const grandMaximum = normalizeObtainedMark(assessmentMaximum + bonusMaximum);
  const percentage = grandMaximum > 0 ? (grandObtained / grandMaximum) * 100 : 0;
  return {
    assessmentObtained,
    assessmentMaximum,
    bonusObtained,
    bonusMaximum,
    grandObtained,
    grandMaximum,
    percentage,
  };
}
