import Link from "next/link";
import {
  ArrowRight,
  BadgePercent,
  Building2,
  CreditCard,
  GraduationCap,
  Lock,
  Store,
  Users2,
} from "lucide-react";
import { CountUp } from "./useCountUp";
import type { CardStatus } from "@/app/alumni-profile/status";

export type ScholarshipSummary = { count: number; approved: number; pending: number; maxDiscountPct: number | null };
export type MembershipSummary = { count: number; approved: number; pending: number; facilities: string[] };
export type MerchantSummary = { count: number; maxPct: number; topNames: string[] };
export type EngagementSummary = { stories: number; talks: number; mentorship?: string | null; leadershipRole?: string | null };

type BenefitsBentoProps = {
  sapId: string;
  cardStatus: CardStatus;
  cardValidity?: string;
  isViewer: boolean;
  scholarships: ScholarshipSummary;
  memberships: MembershipSummary;
  merchants: MerchantSummary;
  chapters: string[];
  engagement: EngagementSummary;
};

function BenefitTile({
  href,
  icon,
  label,
  headline,
  subline,
  cta,
  tint = "brand",
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  headline: React.ReactNode;
  subline?: React.ReactNode;
  cta: string;
  tint?: "brand" | "amber" | "sky";
}) {
  const iconTint =
    tint === "amber"
      ? "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300"
      : tint === "sky"
        ? "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300"
        : "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300";
  return (
    <Link
      href={href}
      className="group relative flex flex-col rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      <div className="flex items-start justify-between">
        <span aria-hidden className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${iconTint}`}>
          {icon}
        </span>
        <ArrowRight
          className="h-4 w-4 text-content-muted opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100 motion-reduce:transition-none"
          aria-hidden
        />
      </div>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-content-muted">{label}</p>
      <p className="mt-0.5 text-lg sm:text-xl font-bold text-content leading-snug">{headline}</p>
      {subline ? <p className="mt-1 text-xs leading-relaxed text-content-secondary line-clamp-2">{subline}</p> : null}
      <p className="mt-auto pt-3 text-sm font-semibold text-brand-600 group-hover:text-brand-700 dark:text-brand-400 dark:group-hover:text-brand-300">
        {cta}
      </p>
    </Link>
  );
}

const CARD_STATUS_LABEL: Record<CardStatus, string> = {
  none: "Not Applied",
  "under-review": "Under Review",
  inprocess: "In Process",
  active: "Issued",
  onhold: "On Hold",
  received: "Issued",
  full: "Paused",
};

export default function BenefitsBento({
  sapId,
  cardStatus,
  isViewer,
  scholarships,
  memberships,
  merchants,
  chapters,
  engagement,
}: BenefitsBentoProps) {
  const enc = encodeURIComponent(sapId);
  const withSap = (href: string) => (sapId ? `${href}${href.includes("?") ? "&" : "?"}sapid=${enc}` : href);
  const cardIssued = cardStatus === "active" || cardStatus === "received";

  const cardHeadline =
    cardStatus === "none"
      ? "Not applied"
      : cardIssued
        ? "Active"
        : CARD_STATUS_LABEL[cardStatus];

  const membershipNames =
    memberships.facilities.length > 0 ? memberships.facilities.join(" · ") : "Gym · Swimming Pool · Cricket Club";

  return (
    <section aria-label="Your benefits" className="mt-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold text-content sm:text-lg">Your Benefits</h2>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        <BenefitTile
          href={withSap("/alumni-profile/card")}
          icon={<CreditCard className="h-5 w-5" />}
          label="Alumni Card"
          headline={
            <>
              {cardHeadline}
              {cardStatus === "none" && !isViewer && (
                <Lock className="ml-1.5 inline h-4 w-4 text-amber-500 align-[-2px]" aria-hidden />
              )}
            </>
          }
          subline={cardIssued ? "Your digital card is issued and valid." : "Your card unlocks alumni benefits."}
          cta={cardIssued ? "View card" : cardStatus === "none" ? "Apply now" : "Check status"}
        />

        <BenefitTile
          href={withSap("/alumni-profile/benefits/academic-benefits")}
          icon={<GraduationCap className="h-5 w-5" />}
          tint="sky"
          label="Scholarships"
          headline={
            scholarships.count > 0 ? (
              <>
                <CountUp value={scholarships.count} /> application{scholarships.count === 1 ? "" : "s"}
              </>
            ) : (
              "Available"
            )
          }
          subline={
            scholarships.maxDiscountPct
              ? `Kinship, merit & PhD fee discounts — up to ${scholarships.maxDiscountPct}% tuition`
              : "Kinship, merit & PhD fee discounts — up to 75% tuition"
          }
          cta={scholarships.count > 0 ? "View applications" : "Apply for scholarship"}
        />

        <BenefitTile
          href={withSap("/alumni-profile/benefits/campus-facilities")}
          icon={<Building2 className="h-5 w-5" />}
          label="Campus Memberships"
          headline={
            memberships.count > 0 ? (
              <>
                <CountUp value={memberships.count} /> {memberships.count === 1 ? "facility" : "facilities"}
              </>
            ) : (
              "3 facilities"
            )
          }
          subline={membershipNames}
          cta="See facilities"
        />

        <BenefitTile
          href={withSap("/alumni-profile/benefits/merchant-promotions")}
          icon={<Store className="h-5 w-5" />}
          tint="amber"
          label="Partner Discounts"
          headline={
            merchants.maxPct ? (
              <>
                <CountUp value={merchants.maxPct} />% off
              </>
            ) : merchants.count > 0 ? (
              <>
                <CountUp value={merchants.count} /> partners
              </>
            ) : (
              "Partner offers"
            )
          }
          subline={
            merchants.topNames.length > 0
              ? `${merchants.topNames.slice(0, 3).join(", ")}${merchants.topNames.length > 3 ? ` +${merchants.topNames.length - 3} more` : ""}`
              : "Browse discounts at partner merchants"
          }
          cta="Browse offers"
        />

        <BenefitTile
          href={withSap("/alumni-profile/my-chapters")}
          icon={<Users2 className="h-5 w-5" />}
          label="Chapters"
          headline={
            chapters.length > 0 ? (
              <>
                <CountUp value={chapters.length} /> chapter{chapters.length === 1 ? "" : "s"}
              </>
            ) : (
              "Join a chapter"
            )
          }
          subline={
            chapters.length > 0
              ? chapters.slice(0, 2).join(" · ") + (chapters.length > 2 ? ` +${chapters.length - 2} more` : "")
              : "Local & international alumni chapters"
          }
          cta="My chapters"
        />

        <BenefitTile
          href={withSap("/alumni-profile?tab=engagement")}
          icon={<BadgePercent className="h-5 w-5" />}
          label="Engagement"
          headline={
            <>
              <CountUp value={engagement.stories + engagement.talks} /> activities
            </>
          }
          subline={
            [
              engagement.stories > 0 ? `${engagement.stories} stor${engagement.stories === 1 ? "y" : "ies"}` : null,
              engagement.talks > 0 ? `${engagement.talks} talk${engagement.talks === 1 ? "" : "s"}` : null,
              engagement.mentorship === "applied" ? "Mentor applied" : engagement.mentorship === "conducted" ? "Talk conducted" : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Share a story or book a mentorship session"
          }
          cta="View activity"
        />
      </div>
    </section>
  );
}
