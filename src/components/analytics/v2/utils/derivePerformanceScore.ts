import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";

export type PerformanceFactor = {
  id: string;
  label: string;
  score: number;
  weight: string;
  detail: string;
};

export type PerformanceResult = {
  score: number;
  label: "Strong" | "Stable" | "Needs Attention";
  headline: string;
  reasons: string[];
  factors: PerformanceFactor[];
};

function clamp(n: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, n));
}

function ratio(numerator: number | null | undefined, denominator: number | null | undefined): number {
  if (!denominator || denominator <= 0 || numerator == null) return 0;
  return clamp((numerator / denominator) * 100);
}

function pctText(n: number) {
  return `${n.toFixed(1)}%`;
}

function admiringReason(factor: PerformanceFactor): string | null {
  const s = factor.score;
  switch (factor.id) {
    case "verification":
      if (s < 40) return null;
      return s >= 65
        ? `Verification is excellent at ${pctText(s)} — alumni identity confidence is a standout strength.`
        : `Verification at ${pctText(s)} shows solid progress confirming alumni records.`;
    case "active":
      if (s < 35) return null;
      return s >= 60
        ? `${pctText(s)} of alumni are active — the portal has a healthy, engaged user base.`
        : `${pctText(s)} active alumni rate reflects a dependable engagement foundation.`;
    case "placement":
      if (s < 35) return null;
      return s >= 55
        ? `Placement rate of ${pctText(s)} among tracked graduates signals strong career outcomes.`
        : `Career tracking shows ${pctText(s)} employed — a meaningful share of alumni in the workforce.`;
    case "engagement":
      if (s < 30) return null;
      return s >= 55
        ? `Engagement momentum is strong — mentorship, talks & seminars are pacing well this quarter.`
        : `Quarter-to-date activities (mentorship, talks, seminars) are contributing steady engagement.`;
    case "honorCards":
      if (s < 30) return null;
      return s >= 50
        ? `Honor card delivery at ${pctText(s)} — alumni recognition is moving efficiently.`
        : `Honor card program is progressing with ${pctText(s)} of cards delivered.`;
    case "chapters":
      if (s < 30) return null;
      return s >= 50
        ? `Chapter membership density is strong — alumni are well connected through associations.`
        : `Chapter & association participation is building a connected alumni network.`;
    default:
      return null;
  }
}

function attentionReason(factor: PerformanceFactor): string | null {
  const s = factor.score;
  switch (factor.id) {
    case "verification":
      if (s >= 45) return null;
      return `Verification rate is only ${pctText(s)} — a large share of alumni records still need confirmation.`;
    case "active":
      if (s >= 40) return null;
      return `Active alumni rate is ${pctText(s)} — many registered alumni are not marked active on the portal.`;
    case "placement":
      if (s >= 40) return null;
      return `Placement among tracked graduates is ${pctText(s)} — employment outcomes need closer follow-up.`;
    case "engagement":
      if (s >= 40) return null;
      return `QTD engagement (mentorship, talks, seminars) is lagging — activity needs a coordinated push.`;
    case "honorCards":
      if (s >= 40) return null;
      return `Only ${pctText(s)} of honor cards delivered — fulfillment backlog may delay alumni recognition.`;
    case "chapters":
      if (s >= 40) return null;
      return `Chapter membership is thin (${pctText(s)} index) — expand association participation and leaders.`;
    default:
      return null;
  }
}

function buildReasons(label: PerformanceResult["label"], factors: PerformanceFactor[]): { headline: string; reasons: string[] } {
  const admiring = factors.map(admiringReason).filter((r): r is string => r != null);
  const concerns = factors.map(attentionReason).filter((r): r is string => r != null);

  if (label === "Needs Attention") {
    const reasons =
      concerns.length > 0
        ? concerns
        : ["Overall composite score is below target — review verification, engagement, and placement levers."];
    return {
      headline: "Areas driving the score down",
      reasons,
    };
  }

  if (label === "Strong") {
    const reasons =
      admiring.length > 0
        ? admiring
        : ["Composite score is strong across verification, engagement, placement, and chapters."];
    return {
      headline: "What's working well",
      reasons,
    };
  }

  const reasons =
    admiring.length > 0
      ? admiring
      : ["Performance is balanced — continue strengthening verification and engagement to reach Strong."];
  return {
    headline: "Strengths to build on",
    reasons,
  };
}

export function derivePerformanceScore(data: ManagementDashboardPayload | undefined): PerformanceResult {
  const empty: PerformanceResult = {
    score: 0,
    label: "Needs Attention",
    headline: "Areas driving the score down",
    reasons: ["Dashboard data is not available yet — refresh once analytics load."],
    factors: [],
  };

  if (!data) return empty;

  const ah = data.alumniHeadline;
  const kpis = data.kpis;
  const oc = data.sectionA?.currentOccupation;
  const cards = data.sectionB?.cardsStatus;
  const chapters = data.sectionB?.chaptersAssociations;
  const activities = data.sectionB?.activities;

  const verificationRate = ratio(ah?.verified, ah?.total);
  const activeRate = ratio(kpis?.activeAlumni, ah?.total);

  const employed = oc?.employed ?? 0;
  const jobSeekers = (oc?.unemployedSearching ?? 0) + (oc?.unemployedByChoice ?? 0);
  const placementDenom = employed + jobSeekers + (oc?.selfEmployed ?? 0);
  const placementRate = ratio(employed, placementDenom);

  const engagementQ = [
    activities?.mentorshipSessions?.quarter,
    activities?.alumniTalks?.quarter,
    activities?.seminarsParticipation?.quarter,
  ].filter((v): v is number => typeof v === "number");
  const engagementY = [
    activities?.mentorshipSessions?.ytd,
    activities?.alumniTalks?.ytd,
    activities?.seminarsParticipation?.ytd,
  ].filter((v): v is number => typeof v === "number");
  const qSum = engagementQ.reduce((s, v) => s + v, 0);
  const ySum = engagementY.reduce((s, v) => s + v, 0);
  const engagementMomentum = ySum > 0 ? clamp((qSum / ySum) * 100 * 4) : qSum > 0 ? 50 : 0;

  const honorDeliveryRate = ratio(cards?.delivered, cards?.totalCards ?? (cards?.delivered ?? 0) + (cards?.applied ?? 0));

  const memberDensity =
    chapters?.members && chapters?.associations
      ? clamp(((chapters.members / Math.max(chapters.associations, 1)) / 50) * 100)
      : chapters?.members
        ? clamp(Math.min(chapters.members / 10, 100))
        : 0;

  const factors: PerformanceFactor[] = [
    {
      id: "verification",
      label: "Verification",
      score: verificationRate,
      weight: "20%",
      detail: `${pctText(verificationRate)} verified of total alumni`,
    },
    {
      id: "active",
      label: "Active alumni",
      score: activeRate,
      weight: "20%",
      detail: `${pctText(activeRate)} marked active`,
    },
    {
      id: "placement",
      label: "Placement",
      score: placementRate,
      weight: "20%",
      detail: `${pctText(placementRate)} employed among tracked`,
    },
    {
      id: "engagement",
      label: "Engagement momentum",
      score: engagementMomentum,
      weight: "15%",
      detail: `QTD sum ${qSum.toLocaleString()} vs YTD ${ySum.toLocaleString()}`,
    },
    {
      id: "honorCards",
      label: "Honor cards",
      score: honorDeliveryRate,
      weight: "10%",
      detail: `${pctText(honorDeliveryRate)} delivered`,
    },
    {
      id: "chapters",
      label: "Chapter density",
      score: memberDensity,
      weight: "15%",
      detail: chapters?.members != null ? `${chapters.members.toLocaleString()} chapter members` : "No chapter data",
    },
  ];

  const score = Math.round(
    verificationRate * 0.2 +
      activeRate * 0.2 +
      placementRate * 0.2 +
      engagementMomentum * 0.15 +
      honorDeliveryRate * 0.1 +
      memberDensity * 0.15
  );

  const label: PerformanceResult["label"] =
    score >= 70 ? "Strong" : score >= 45 ? "Stable" : "Needs Attention";

  const { headline, reasons } = buildReasons(label, factors);

  return { score: clamp(score), label, headline, reasons, factors };
}
