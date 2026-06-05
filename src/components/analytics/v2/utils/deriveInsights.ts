import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";

export type InsightItem = { label: string; detail: string };

export function deriveInsights(data: ManagementDashboardPayload | undefined): {
  strengths: InsightItem[];
  weaknesses: InsightItem[];
} {
  if (!data) return { strengths: [], weaknesses: [] };

  const strengths: InsightItem[] = [];
  const weaknesses: InsightItem[] = [];

  const facultyRows = data.sectionA?.facultyRows ?? [];
  const facultyTotal = facultyRows.reduce((s, r) => s + (r.registrations ?? 0), 0);
  if (facultyRows.length > 0) {
    const top = [...facultyRows].sort((a, b) => (b.registrations ?? 0) - (a.registrations ?? 0))[0];
    const share = facultyTotal > 0 ? (((top.registrations ?? 0) / facultyTotal) * 100).toFixed(1) : "0";
    strengths.push({
      label: "Top faculty by registrations",
      detail: `${top.faculty} — ${(top.registrations ?? 0).toLocaleString()} (${share}% share)`,
    });

    const nonZero = facultyRows.filter((r) => (r.registrations ?? 0) > 0);
    if (nonZero.length > 1) {
      const bottom = [...nonZero].sort((a, b) => (a.registrations ?? 0) - (b.registrations ?? 0))[0];
      const bottomShare = facultyTotal > 0 ? (((bottom.registrations ?? 0) / facultyTotal) * 100).toFixed(1) : "0";
      weaknesses.push({
        label: "Lowest faculty share",
        detail: `${bottom.faculty} — ${(bottom.registrations ?? 0).toLocaleString()} (${bottomShare}% share)`,
      });
    }
  }

  const activities = data.sectionB?.activities;
  const activityEntries = [
    { name: "Mentorship Sessions", q: activities?.mentorshipSessions?.quarter },
    { name: "Seminars", q: activities?.seminarsParticipation?.quarter },
    { name: "Conferences", q: activities?.conferencesParticipation?.quarter },
    { name: "Alumni Talks", q: activities?.alumniTalks?.quarter },
    { name: "High Achievers", q: activities?.highAchieversRecognition?.quarter },
    { name: "Wellbeing Support", q: activities?.wellbeingSupport?.quarter },
  ];
  const withQ = activityEntries.filter((a) => typeof a.q === "number");
  if (withQ.length > 0) {
    const topAct = [...withQ].sort((a, b) => (b.q ?? 0) - (a.q ?? 0))[0];
    strengths.push({
      label: "Highest engagement activity (QTD)",
      detail: `${topAct.name} — ${(topAct.q ?? 0).toLocaleString()} in selected period`,
    });
    const zeroActs = withQ.filter((a) => (a.q ?? 0) === 0);
    if (zeroActs.length > 0) {
      weaknesses.push({
        label: "Zero QTD activities",
        detail: zeroActs.map((a) => a.name).join(", "),
      });
    }
  }

  const pl = data.sectionA?.provinceLocation;
  if (pl) {
    const regions = [
      { name: "Punjab", count: pl.punjab },
      { name: "Islamabad", count: pl.islamabad },
      { name: "KPK", count: pl.kpk },
      { name: "Sindh", count: pl.sindh },
      { name: "Overseas", count: pl.overseas },
    ].filter((r) => typeof r.count === "number");
    if (regions.length > 0) {
      const topRegion = [...regions].sort((a, b) => (b.count ?? 0) - (a.count ?? 0))[0];
      strengths.push({
        label: "Top alumni region",
        detail: `${topRegion.name} — ${(topRegion.count ?? 0).toLocaleString()} alumni`,
      });
      const bottomRegions = [...regions].sort((a, b) => (a.count ?? 0) - (b.count ?? 0)).slice(0, 2);
      weaknesses.push({
        label: "Lowest reach regions",
        detail: bottomRegions.map((r) => `${r.name} (${(r.count ?? 0).toLocaleString()})`).join(", "),
      });
    }
  }

  const oc = data.sectionA?.currentOccupation;
  if (oc) {
    const employed = oc.employed ?? 0;
    const unemployed = (oc.unemployedSearching ?? 0) + (oc.unemployedByChoice ?? 0);
    const total = employed + unemployed + (oc.selfEmployed ?? 0);
    if (total > 0) {
      const placementPct = ((employed / total) * 100).toFixed(1);
      if (Number(placementPct) >= 50) {
        strengths.push({
          label: "Strong placement rate",
          detail: `${placementPct}% employed among tracked alumni`,
        });
      }
      const unempPct = ((unemployed / total) * 100).toFixed(1);
      if (Number(unempPct) >= 20) {
        weaknesses.push({
          label: "Elevated unemployment share",
          detail: `${unempPct}% unemployed (searching or by choice)`,
        });
      }
    }
  }

  const cards = data.sectionB?.cardsStatus;
  if (cards && typeof cards.delivered === "number" && cards.delivered > 0) {
    strengths.push({
      label: "Honor cards delivered",
      detail: `${cards.delivered.toLocaleString()} cards successfully delivered`,
    });
  }
  if (cards && typeof cards.onHold === "number" && cards.onHold > 0) {
    weaknesses.push({
      label: "Cards on hold",
      detail: `${cards.onHold.toLocaleString()} honor cards awaiting resolution`,
    });
  }

  const chapters = data.sectionB?.chaptersAssociations;
  if (chapters) {
    const totalChapters = (chapters.nationalChapters ?? 0) + (chapters.internationalChapters ?? 0);
    if (totalChapters > 0) {
      strengths.push({
        label: "Chapter network",
        detail: `${totalChapters} chapters · ${(chapters.members ?? 0).toLocaleString()} members`,
      });
    }
  }

  return {
    strengths: strengths.slice(0, 5),
    weaknesses: weaknesses.slice(0, 5),
  };
}
