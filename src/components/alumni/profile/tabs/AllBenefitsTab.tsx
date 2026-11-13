"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  ClipboardList,
  CreditCard,
  Crown,
  Dumbbell,
  Flag,
  GraduationCap,
  HeartPulse,
  Landmark,
  Mail,
  Mic2,
  Search,
  Store,
  Trophy,
  Users2,
  Award,
} from "lucide-react";
import type { CardStatus } from "@/app/alumni-profile/status";

type AllBenefitsTabProps = {
  sapId: string;
  cardStatus: CardStatus;
  scholarshipsTotal: number;
  membershipsTotal: number;
  merchantsActive: number;
  chaptersCount: number;
  storiesCount: number;
  talksCount: number;
};

type IndexItem = {
  title: string;
  type: "Card" | "Benefit" | "Perk" | "Engagement" | "Update";
  desc: string;
  href: string;
  icon: React.ReactNode;
  status?: string;
};

const TYPES = ["All", "Card", "Benefit", "Perk", "Engagement", "Update"] as const;

export default function AllBenefitsTab({
  sapId,
  cardStatus,
  scholarshipsTotal,
  membershipsTotal,
  merchantsActive,
  chaptersCount,
  storiesCount,
  talksCount,
}: AllBenefitsTabProps) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("All");
  const withSap = useMemo(
    () => (href: string) => (sapId ? `${href}${href.includes("?") ? "&" : "?"}sapid=${encodeURIComponent(sapId)}` : href),
    [sapId]
  );

  const cardStatusLabel =
    cardStatus === "none"
      ? "Not Applied"
      : cardStatus === "active" || cardStatus === "received"
        ? "Issued"
        : cardStatus === "onhold"
          ? "On Hold"
          : cardStatus === "full"
            ? "Paused"
            : cardStatus === "inprocess"
              ? "In Process"
              : "Under Review";

  const items = useMemo<IndexItem[]>(
    () => [
      { title: "Alumni Card", type: "Card", desc: "Digital alumni identity card.", href: withSap("/alumni-profile/card"), icon: <CreditCard className="h-4.5 w-4.5" />, status: cardStatusLabel },
      { title: "Academic Benefits & Scholarships", type: "Benefit", desc: "Kinship, merit and PhD tuition discounts.", href: withSap("/alumni-profile/benefits/academic-benefits"), icon: <GraduationCap className="h-4.5 w-4.5" />, status: scholarshipsTotal > 0 ? `${scholarshipsTotal} application${scholarshipsTotal === 1 ? "" : "s"}` : "Available" },
      { title: "Healthcare Benefits", type: "Perk", desc: "ULH & Social Medical Centers discounts.", href: withSap("/alumni-profile/benefits/healthcare-benefits"), icon: <HeartPulse className="h-4.5 w-4.5" /> },
      { title: "Campus Facilities & Memberships", type: "Perk", desc: "Gym, swimming pool and cricket club memberships.", href: withSap("/alumni-profile/benefits/campus-facilities"), icon: <Dumbbell className="h-4.5 w-4.5" />, status: membershipsTotal > 0 ? `${membershipsTotal} active` : "3 facilities" },
      { title: "Merchant & Business Promotions", type: "Perk", desc: "Partner discounts and alumni start-up launches.", href: withSap("/alumni-profile/benefits/merchant-promotions"), icon: <Store className="h-4.5 w-4.5" />, status: merchantsActive > 0 ? `${merchantsActive} partners` : undefined },
      { title: "Career & Mentorship", type: "Perk", desc: "Mentorship, jobs, counselling and upskill courses.", href: withSap("/alumni-profile/benefits/career-mentorship"), icon: <Briefcase className="h-4.5 w-4.5" /> },
      { title: "Chapters & Engagement Events", type: "Perk", desc: "Local & international chapters, meet-ups and mega events.", href: withSap("/alumni-profile/benefits/chapters-events"), icon: <Users2 className="h-4.5 w-4.5" /> },
      { title: "Identity, Inclusion & Recognition", type: "Perk", desc: "Awards, wall of fame and alumni email.", href: withSap("/alumni-profile/benefits/recognition"), icon: <Award className="h-4.5 w-4.5" /> },
      { title: "Success Story", type: "Engagement", desc: "Share your story and inspire students.", href: "/alumni-success", icon: <Trophy className="h-4.5 w-4.5" />, status: storiesCount > 0 ? `${storiesCount} stories` : undefined },
      { title: "Alumni Talk", type: "Engagement", desc: "Lead a talk for current students.", href: withSap("/alumni-profile/talks"), icon: <Mic2 className="h-4.5 w-4.5" />, status: talksCount > 0 ? `${talksCount} applications` : undefined },
      { title: "Chapters Membership", type: "Engagement", desc: "Join national and international chapters.", href: withSap("/alumni-profile/my-chapters"), icon: <Users2 className="h-4.5 w-4.5" />, status: chaptersCount > 0 ? `${chaptersCount} assigned` : undefined },
      { title: "Chapter Leadership", type: "Engagement", desc: "Apply to lead your chapter.", href: withSap("/alumni-profile/chapter-leadership"), icon: <Flag className="h-4.5 w-4.5" /> },
      { title: "Association Membership", type: "Engagement", desc: "Faculty & department associations.", href: withSap("/alumni-profile/my-associations"), icon: <Landmark className="h-4.5 w-4.5" /> },
      { title: "Association Leadership", type: "Engagement", desc: "Apply for association leadership.", href: withSap("/alumni-profile/association-leadership"), icon: <Crown className="h-4.5 w-4.5" /> },
      { title: "My Applications", type: "Card", desc: "Track all your submitted applications.", href: withSap("/alumni-profile/view-applications"), icon: <ClipboardList className="h-4.5 w-4.5" /> },
      { title: "Newsletters", type: "Update", desc: "Read alumni newsletters.", href: withSap("/alumni-profile?tab=updates"), icon: <Mail className="h-4.5 w-4.5" /> },
    ],
    [withSap, cardStatusLabel, scholarshipsTotal, membershipsTotal, merchantsActive, chaptersCount, storiesCount, talksCount]
  );

  const filtered = items.filter((i) => {
    const matchType = type === "All" || i.type === type;
    const q = query.trim().toLowerCase();
    const matchQ = !q || i.title.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q);
    return matchType && matchQ;
  });

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search benefits…"
            aria-label="Search benefits"
            className="w-full rounded-xl border border-border-subtle bg-surface py-2.5 pl-9 pr-3 text-sm text-content placeholder:text-content-muted focus-visible:outline-2 focus-visible:outline-brand-500"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by type">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => setType(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand-500 ${
                type === t
                  ? "bg-brand-600 text-white dark:bg-brand-500 dark:text-accent-950"
                  : "border border-border-subtle bg-surface text-content-secondary hover:bg-surface-raised"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-subtle bg-surface-raised px-4 py-10 text-center">
          <p className="text-sm font-semibold text-content">No matches</p>
          <p className="mt-1 text-xs text-content-muted">Try a different search or filter.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((i) => (
            <li key={`${i.type}-${i.title}`}>
              <Link
                href={i.href}
                className="group flex h-full items-start gap-3 rounded-2xl border border-border-subtle bg-surface p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                <span aria-hidden className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                  {i.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-content">{i.title}</span>
                    {i.status && (
                      <span className="shrink-0 rounded-full border border-border-subtle bg-surface-raised px-2 py-0.5 text-[10px] font-semibold text-content-secondary">
                        {i.status}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-content-muted">{i.desc}</span>
                </span>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-content-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand-500 motion-reduce:transition-none" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
