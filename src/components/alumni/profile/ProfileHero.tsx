"use client";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, CreditCard, Sparkles } from "lucide-react";
import { useAlumniFullDetails } from "@/app/queries/alumni-profile";
import { calculateProfileCompletion } from "@/lib/profileCompletion";
import { useCountUp } from "./useCountUp";
import type { CardStatus } from "@/app/alumni-profile/status";

type ProfileHeroProps = {
  name: string;
  avatar: string;
  sapId: string;
  memberId: string;
  program: string;
  department: string;
  faculty: string;
  graduationYear: number | null;
  campus: string | null;
  isVerified: boolean;
  cardStatus: CardStatus;
  cardValidity?: string;
  leadershipRole?: string | null;
};

const CARD_STATUS_LABEL: Record<CardStatus, string> = {
  none: "Not Applied",
  "under-review": "Under Review",
  inprocess: "In Process",
  active: "Ready for Delivery",
  onhold: "On Hold",
  received: "Received",
  full: "Paused",
};

function CompletenessMeter({ sapId }: { sapId: string }) {
  const { data, isLoading, isError } = useAlumniFullDetails(sapId || undefined);
  const pct = data ? calculateProfileCompletion(data) : null;
  const animated = useCountUp(pct ?? 0);

  if (isLoading) {
    return (
      <div className="flex items-center gap-3" aria-busy="true">
        <div className="h-11 w-11 rounded-full bg-white/15 animate-pulse" />
        <div className="space-y-1.5">
          <div className="h-3 w-24 rounded bg-white/15 animate-pulse" />
          <div className="h-2.5 w-32 rounded bg-white/10 animate-pulse" />
        </div>
      </div>
    );
  }
  if (isError || pct === null) return null;

  const complete = pct >= 100;
  const R = 15.5;
  const CIRC = 2 * Math.PI * R;
  const filled = CIRC * (1 - animated / 100);

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-11 w-11" role="img" aria-label={`Profile ${animated}% complete`}>
        <svg viewBox="0 0 40 40" className="h-11 w-11 -rotate-90">
          <circle cx="20" cy="20" r={R} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
          <circle
            cx="20" cy="20" r={R} fill="none"
            stroke={complete ? "#6ce9a6" : "#fbbf24"}
            strokeWidth="4" strokeLinecap="round"
            strokeDasharray={CIRC} strokeDashoffset={filled}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
          {animated}%
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white leading-tight">
          {complete ? "Profile complete" : `${animated}% complete`}
        </p>
        {!complete && (
          <Link
            href="#profile"
            className="text-xs font-medium text-amber-200 hover:text-amber-100 underline decoration-amber-300/60 underline-offset-2 focus-visible:outline-2 focus-visible:outline-amber-300 rounded-sm"
          >
            Complete your profile
          </Link>
        )}
      </div>
    </div>
  );
}

export default function ProfileHero({
  name,
  avatar,
  sapId,
  memberId,
  program,
  department,
  faculty,
  graduationYear,
  campus,
  isVerified,
  cardStatus,
  cardValidity,
  leadershipRole,
}: ProfileHeroProps) {
  const cardIssued = cardStatus === "active" || cardStatus === "received";
  const identity = [program || null, department || null].filter(Boolean).join(" · ");
  const meta = [faculty || null, graduationYear ? `Class of ${graduationYear}` : null, campus].filter(Boolean).join("  ·  ");

  return (
    <section
      aria-label="Alumni identity"
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-accent-950 via-accent-800 to-brand-900 shadow-xl"
    >
      {/* decorative layers — pure CSS, no assets */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-amber-400/10 blur-3xl" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{ backgroundImage: "repeating-linear-gradient(135deg, #fff 0 1px, transparent 1px 14px)" }}
      />

      <div className="relative flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        {/* identity */}
        <div className="flex items-start gap-4 sm:gap-5 min-w-0">
          <div className="relative shrink-0">
            <div className="h-20 w-20 sm:h-24 sm:w-24 overflow-hidden rounded-2xl ring-4 ring-white/15 bg-white/10">
              <Image src={avatar} alt={name ? `${name}'s photo` : "Alumni photo"} width={96} height={96} className="h-full w-full object-cover" priority />
            </div>
            {isVerified && (
              <span className="absolute -bottom-1.5 -right-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white ring-2 ring-accent-800">
                <BadgeCheck className="h-3 w-3" aria-hidden /> Verified
              </span>
            )}
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300/90">
              University of Lahore · Alumni
            </p>
            <h1 className="mt-1 truncate text-2xl font-bold text-white sm:text-3xl">
              {name || "Alumni Member"}
            </h1>
            {identity && <p className="mt-1 truncate text-sm text-white/80">{identity}</p>}
            {meta && <p className="mt-0.5 truncate text-xs text-white/60">{meta}</p>}
            {leadershipRole && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-400/15 border border-amber-300/30 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                <Sparkles className="h-3 w-3" aria-hidden /> {leadershipRole}
              </span>
            )}
          </div>
        </div>

        {/* membership card face */}
        <div className="w-full max-w-sm shrink-0 lg:w-80">
          <div
            role="img"
            aria-label={`Membership card, ID ${memberId || "pending"}, status ${CARD_STATUS_LABEL[cardStatus]}`}
            className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm shadow-inner"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/70">
                Alumni Card
              </span>
              <CreditCard className="h-4 w-4 text-amber-300/80" aria-hidden />
            </div>
            <p className="mt-3 font-mono text-lg font-semibold tracking-wider text-white">
              {memberId || "UOL-AL-····"}
            </p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  cardIssued
                    ? "bg-emerald-400/20 text-emerald-200"
                    : cardStatus === "onhold"
                      ? "bg-red-400/20 text-red-200"
                      : cardStatus === "none"
                        ? "bg-white/15 text-white/80"
                        : "bg-amber-400/20 text-amber-200"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${cardIssued ? "bg-emerald-300" : cardStatus === "onhold" ? "bg-red-300" : cardStatus === "none" ? "bg-white/60" : "bg-amber-300"}`} aria-hidden />
                {CARD_STATUS_LABEL[cardStatus]}
              </span>
              {cardValidity && (
                <span className="text-[11px] font-medium text-white/60">
                  Valid to <span className="text-white/90">{cardValidity}</span>
                </span>
              )}
            </div>
          </div>
          {sapId && (
            <div className="mt-4">
              <CompletenessMeter sapId={sapId} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
