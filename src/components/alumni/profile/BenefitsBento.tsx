"use client";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  CreditCard,
  Dumbbell,
  GraduationCap,
  MapPin,
  Store,
} from "lucide-react";
import { useCountUp } from "./useCountUp";
import type { CardStatus, MentorshipStatus } from "@/app/alumni-profile/status";

export type ScholarshipSummary = {
  count: number;
  approved: number;
  pending: number;
  maxDiscountPct: number | null;
};

export type MembershipSummary = {
  count: number;
  approved: number;
  pending: number;
  facilities: string[];
};

export type MerchantSummary = {
  count: number;
  maxPct: number;
  topNames: string[];
};

export type EngagementSummary = {
  stories: number;
  talks: number;
  mentorship: MentorshipStatus;
  leadershipRole?: string | null;
};

type BenefitsBentoProps = {
  sapId: string;
  isViewer: boolean;
  cardStatus: CardStatus;
  cardValidity?: string;
  scholarships: ScholarshipSummary;
  memberships: MembershipSummary;
  merchants: MerchantSummary;
  chapters: string[];
  engagement: EngagementSummary;
};

const FACILITY_LABEL: Record<string, string> = {
  gym: "Gym",
  pool: "Swimming Pool",
  swimming_pool: "Swimming Pool",
  cricket: "Cricket Club",
};

const CARD_TILE_LABEL: Record<CardStatus, string> = {
  none: "Not Applied",
  "under-review": "Under Review",
  inprocess: "In Process",
  active: "Ready",
  onhold: "On Hold",
  received: "Received",
  full: "Paused",
};

function Stat({ value, suffix = "" }: { value: number; suffix?: string }) {
  const animated = useCountUp(value);
  return (
    <>
      {animated}
      {suffix}
    </>
  );
}

function Tile({
  href,
  icon,
  tint,
  label,
  headline,
  subline,
  cta,
}: {
  href: string;
  icon: React.ReactNode;
  tint: string;
  label: string;
  headline: React.ReactNode;
  subline: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex min-h-[9.5rem] flex-col rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-gray-300 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:bg-gray-900 dark:border-gray-800 dark:hover:border-gray-600"
    >
      <div className="flex items-center justify-between">
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${tint}`}>
          {icon}
        </span>
        <ArrowRight className="h-4 w-4 text-gray-300 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-brand-600 dark:text-gray-600" aria-hidden />
      </div>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="mt-0.5 text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-50 leading-tight">
        {headline}
      </p>
      <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
        {subline}
      </p>
      <span className="mt-auto pt-3 text-xs sm:text-sm font-semibold text-brand-700 dark:text-brand-300">
        {cta}
      </span>
    </Link>
  );
}

export default function BenefitsBento({
  sapId,
  isViewer,
  cardStatus,
  cardValidity,
  scholarships,
  memberships,
  merchants,
  chapters,
  engagement,
}: BenefitsBentoProps) {
  const sap = sapId ? `?sapid=${encodeURIComponent(sapId)}` : "";
  const issued = cardStatus === "active" || cardStatus === "received";

  const facilityNames = memberships.facilities
    .map((f) => FACILITY_LABEL[f] ?? f.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(" · ");

  const engagementParts: string[] = [];
  if (engagement.stories > 0) engagementParts.push(`${engagement.stories} ${engagement.stories === 1 ? "story" : "stories"}`);
  if (engagement.talks > 0) engagementParts.push(`${engagement.talks} ${engagement.talks === 1 ? "session" : "sessions"}`);
  if (engagement.mentorship === "conducted") engagementParts.push("mentor");
  if (engagement.leadershipRole) engagementParts.push(engagement.leadershipRole);
  const engagementSub = engagementParts.length
    ? engagementParts.join(" · ")
    : "Share a story or book a mentorship session";

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
      <Tile
        href={issued || isViewer ? "#profile" : `/alumni-profile/card${sap}`}
        icon={<CreditCard className="h-5 w-5 text-brand-700 dark:text-brand-300" aria-hidden />}
        tint="bg-brand-100 dark:bg-brand-950/60"
        label="Alumni Card"
        headline={CARD_TILE_LABEL[cardStatus]}
        subline={
          issued
            ? cardValidity
              ? `Valid to ${cardValidity} — show on campus and at partners`
              : "Your card is issued"
            : cardStatus === "none"
              ? "Required to avail all alumni benefits"
              : "Your card application is being processed"
        }
        cta={issued ? "View card" : cardStatus === "none" && !isViewer ? "Apply now" : "View details"}
      />
      <Tile
        href={isViewer ? "#profile" : `/alumni-profile/scholarship-application${sap}`}
        icon={<GraduationCap className="h-5 w-5 text-indigo-700 dark:text-indigo-300" aria-hidden />}
        tint="bg-indigo-100 dark:bg-indigo-950/60"
        label="Scholarships"
        headline={
          scholarships.count > 0 ? (
            <Stat value={scholarships.count} />
          ) : (
            "Available"
          )
        }
        subline={
          scholarships.count > 0
            ? `${scholarships.approved} approved · ${scholarships.pending} pending` +
              (scholarships.maxDiscountPct ? ` · up to ${Math.round(scholarships.maxDiscountPct)}% awarded` : "")
            : "Kinship, Masters & PhD fee discounts — up to 75% admission"
        }
        cta={scholarships.count > 0 ? "View applications" : "Apply for scholarship"}
      />
      <Tile
        href={`/alumni-profile/benefits/campus-facilities${sap}`}
        icon={<Dumbbell className="h-5 w-5 text-sky-700 dark:text-sky-300" aria-hidden />}
        tint="bg-sky-100 dark:bg-sky-950/60"
        label="Campus Memberships"
        headline={memberships.count > 0 ? <Stat value={memberships.count} /> : "3 facilities"}
        subline={
          memberships.count > 0
            ? facilityNames +
              (memberships.approved > 0 ? ` · ${memberships.approved} approved` : "")
            : "Gym · Swimming Pool · Cricket Club"
        }
        cta={memberships.count > 0 ? "View memberships" : "See facilities"}
      />
      <Tile
        href={`/alumni-profile/benefits/merchant-promotions${sap}`}
        icon={<Store className="h-5 w-5 text-orange-700 dark:text-orange-300" aria-hidden />}
        tint="bg-orange-100 dark:bg-orange-950/60"
        label="Partner Discounts"
        headline={merchants.count > 0 ? <><Stat value={merchants.maxPct} suffix="%" /> off</> : "Coming soon"}
        subline={
          merchants.count > 0
            ? `Up to ${merchants.maxPct}% at ${merchants.count} partner${merchants.count === 1 ? "" : "s"}` +
              (merchants.topNames.length ? ` — ${merchants.topNames.join(", ")}` : "")
            : "No active partner offers right now"
        }
        cta="Browse offers"
      />
      <Tile
        href={`/alumni-profile/my-chapters${sap}`}
        icon={<MapPin className="h-5 w-5 text-rose-700 dark:text-rose-300" aria-hidden />}
        tint="bg-rose-100 dark:bg-rose-950/60"
        label="Chapters"
        headline={<Stat value={chapters.length} />}
        subline={chapters.length > 0 ? chapters.slice(0, 2).join(" · ") + (chapters.length > 2 ? ` +${chapters.length - 2}` : "") : "Join a chapter in your city or country"}
        cta={chapters.length > 0 ? "My chapters" : "Find a chapter"}
      />
      <Tile
        href="#engagement"
        icon={<Award className="h-5 w-5 text-amber-700 dark:text-amber-300" aria-hidden />}
        tint="bg-amber-100 dark:bg-amber-950/60"
        label="Engagement"
        headline={<Stat value={engagement.stories + engagement.talks} />}
        subline={engagementSub}
        cta="View activity"
      />
    </div>
  );
}
