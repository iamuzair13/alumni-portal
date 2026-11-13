"use client";

import { useSession } from "next-auth/react";
import { isViewerUser } from "@/lib/alumniProfile";
import {
  Trophy,
  Mic2,
  Users2,
  Flag,
  Landmark,
  Crown,
} from "lucide-react";
import { HubTile, SectionHeader } from "@/components/alumni/profile/hub-ui";

type EngagementTabProps = {
  sapId: string;
  mentorshipStatus?: string;
  mentorshipStatusError?: string | null;
  successStoryCount?: number;
  alumniTalkCount?: number;
  chapterMembershipCount?: number;
  associationTitle?: string | null;
};

export default function EngagementTab({
  sapId,
  mentorshipStatus,
  mentorshipStatusError,
  successStoryCount,
  alumniTalkCount,
  chapterMembershipCount,
  associationTitle,
}: EngagementTabProps) {
  const { data: session } = useSession();
  const isViewer = isViewerUser(session?.user);
  const enc = encodeURIComponent(sapId);
  const withSap = (href: string) => (sapId ? `${href}${href.includes("?") ? "&" : "?"}sapid=${enc}` : href);


  const tiles: {
    title: string;
    desc: string;
    cta: string;
    applyAction?: boolean;
    href: string;
    icon: React.ReactNode;
    tone: "brand" | "amber" | "sky" | "violet" | "rose" | "emerald" | "orange";
    badge?: React.ReactNode;
  }[] = [
    {
      title: "Success Story",
      desc: "Share your story and inspire the next generation of UOL.",
      cta: "Add Story",
      applyAction: true,
      href: "/alumni-success",
      icon: <Trophy />,
      tone: "amber",
      badge:
        typeof successStoryCount === "number" ? (
          <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            All Stories: {successStoryCount}
          </span>
        ) : undefined,
    },
    {
      title: "Alumni Talk",
      desc: "Apply to lead an Alumni Talk and help students prepare for their professional journey.",
      cta: "Apply",
      applyAction: true,
      href: withSap("/alumni-profile/talks"),
      icon: <Mic2 />,
      tone: "violet",
      badge:
        typeof alumniTalkCount === "number" ? (
          <span className="rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300">
            Applications: {alumniTalkCount}
            {alumniTalkCount > 0 && mentorshipStatusError
              ? ` · ${mentorshipStatusError}`
              : alumniTalkCount > 0 && mentorshipStatus === "applied"
                ? " · Applied"
                : alumniTalkCount > 0 && mentorshipStatus === "conducted"
                  ? " · Conducted"
                  : ""}
          </span>
        ) : undefined,
    },
    {
      title: "Chapters Membership",
      desc: "Keep your UOL connection alive by joining national and international alumni chapters.",
      cta: "View Chapters",
      href: withSap("/alumni-profile/my-chapters"),
      icon: <Users2 />,
      tone: "brand",
      badge:
        typeof chapterMembershipCount === "number" ? (
          <span className="rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
            Assigned Chapters: {chapterMembershipCount}
          </span>
        ) : undefined,
    },
    {
      title: "Chapter Leadership",
      desc: "Apply for a leadership position to organize events, coordinate activities, and represent your chapter.",
      cta: "Apply",
      applyAction: true,
      href: withSap("/alumni-profile/chapter-leadership"),
      icon: <Flag />,
      tone: "sky",
    },
    {
      title: "Association Membership",
      desc: "Join a faculty or department association to connect with alumni from your academic background.",
      cta: "View",
      href: withSap("/alumni-profile/my-associations"),
      icon: <Landmark />,
      tone: "orange",
      badge: (
        <span className="rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300">
          {associationTitle ? associationTitle : "Not Assigned"}
        </span>
      ),
    },
    {
      title: "Association Leadership",
      desc: "Apply for a leadership position in the UOL Alumni Association to lead and contribute.",
      cta: "Apply",
      applyAction: true,
      href: withSap("/alumni-profile/association-leadership"),
      icon: <Crown />,
      tone: "rose",
    },
  ];

  return (
    <div>
      <SectionHeader
        title="Networking & Engagement"
        description="Stay connected — stories, talks, chapters and leadership."
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        {tiles.map((t) => {
          const gated = Boolean(isViewer && t.applyAction);
          return (
            <HubTile
              key={t.title}
              href={t.href}
              icon={t.icon}
              tone={t.tone}
              label={t.title}
              subline={t.desc}
              badge={t.badge}
              cta={gated ? "View Only" : t.cta}
              disabled={gated}
            />
          );
        })}
      </div>
    </div>
  );
}
