"use client";
import NetworkingEngagementCard from "./NetworkingEngagementCard";
import { useSession } from "next-auth/react";
import { isViewerUser } from "@/lib/alumniProfile";

type NetworkingEngagementSectionProps = {
  sapId?: string;
  mentorshipStatus?: string;
  mentorshipStatusError?: string | null;
  successStoryCount?: number;
  alumniTalkCount?: number;
  chapterMembershipCount?: number;
  associationTitle?: string | null;
};

type EngagementCard = {
  title: string;
  decription: string;
  action: string;
  href: string;
  color: string;
  bg: string;
  icon: React.ReactElement;
  status?: string;
  statusError?: string;
  disabled?: boolean;
  disabledText?: string;
};

export default function NetworkingEngagementSection({
  sapId,
  mentorshipStatus,
  mentorshipStatusError,
  successStoryCount,
  alumniTalkCount,
  chapterMembershipCount,
  associationTitle,
}: NetworkingEngagementSectionProps) {
  const { data: session } = useSession();
  const isViewer = isViewerUser(session?.user);

  const cards: EngagementCard[] = [
    {
      title: "Success Story",
      decription: "Share your story and inspire the next generation of UOL.",
      action: "Add Story",
      href: "/alumni-success",
      color: "text-yellow-600",
      bg: "bg-yellow-100",
      icon: (
        <svg role="img" aria-label="Trophy" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-16 h-16">
          <path className="fill-current" d="M20 6h1a1 1 0 011 1c0 3.866-3.134 7-7 7h-.278A5.5 5.5 0 0113 15.5V18h3a1 1 0 110 2H8a1 1 0 110-2h3v-2.5A5.5 5.5 0 017.278 14H7c-3.866 0-7-3.134-7-7a1 1 0 011-1h1V4a1 1 0 011-1h14a1 1 0 011 1v2zm-1 2V5H5v3a5 5 0 005 5h4a5 5 0 005-5zM4 8.874C3.16 8.552 2.5 7.853 2.2 7H4v1.874zM20 8.874V7h1.8c-.3.853-.96 1.552-1.8 1.874z"/>
        </svg>
      ),
    },
    {
      title: "Alumni Talk",
      decription: "Apply to lead an Alumni Talk and help students prepare for their professional journey.",
      action: "Apply",
      href: sapId ? `/alumni-profile/talks?sapid=${encodeURIComponent(sapId)}` : `/alumni-profile/talks`,
      color: "text-purple-600",
      bg: "bg-purple-100",
      icon: (
        <svg role="img" aria-label="Mentorship" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-16 h-16">
          <path className="fill-current" d="M7 7a4 4 0 118 0 4 4 0 01-8 0zm-3 12a6 6 0 1112 0H4zm13.5-8a2.5 2.5 0 110 5 2.5 2.5 0 010-5zM21 21h-3.5a4.5 4.5 0 114.5-4.5V21z"/>
        </svg>
      ),
      statusError: mentorshipStatusError ?? undefined,
      status: mentorshipStatus,
    },
    {
      title: "Chapters Membership",
      decription: "Keep your UOL connection alive by joining national and international alumni chapters.",
      action: "View Chapters",
      href: sapId ? `/alumni-profile/my-chapters?sapid=${encodeURIComponent(sapId)}` : `/alumni-profile/my-chapters`,
      color: "text-green-700",
      bg: "bg-green-100",
      icon: (
        <svg role="img" aria-label="Group" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-16 h-16">
          <path className="fill-current" d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 9a7 7 0 0114 0H5zm14.5-9.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM3.5 11.5a2.5 2.5 0 115 0 2.5 2.5 0 01-5 0zM22 21h-3.5a5.5 5.5 0 00-3.9-5.2 6.97 6.97 0 013.4-.8A4.5 4.5 0 0122 19.5V21zM5.5 21H2v-1.5A4.5 4.5 0 016.6 15a6.97 6.97 0 013.4.8A5.5 5.5 0 005.5 21z"/>
        </svg>
      ),
    },
    {
      title: "Chapter Leadership",
      decription: "Apply for a leadership position to organize events, coordinate activities, and represent your chapter.",
      action: "Apply",
      href: sapId ? `/alumni-profile/chapter-leadership?sapid=${encodeURIComponent(sapId)}` : `/alumni-profile/chapter-leadership`,
      color: "text-blue-600",
      bg: "bg-blue-100",
      icon: (
        <svg role="img" aria-label="Leadership" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-16 h-16">
          <path className="fill-current" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
      ),
    },
    {
      title: "Association Membership",
      decription: "Join a faculty or department association to connect with alumni from your academic background.",
      action: "View",
      href: sapId ? `/alumni-profile/my-associations?sapid=${encodeURIComponent(sapId)}` : `/alumni-profile/my-associations`,
      color: "text-orange-600",
      bg: "bg-orange-100",
      icon: (
        <svg role="img" aria-label="Building" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-16 h-16">
          <path className="fill-current" d="M12 2L2 7v10h2v-2h2v2h2v-2h2v2h2v-2h2v2h2v-2h2v2h2V7L12 2zm0 2.5l6 2.5v2h-2V9h-2v2h-2V9h-2v2h-2V9H8v2H6V9H4v-2l6-2.5zM4 11h2v2H4v-2zm4 0h2v2H8v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z"/>
        </svg>
      ),
    },
    {
      title: "Association Leadership",
      decription: "Apply for a leadership position in the UOL Alumni Association to lead and contribute.",
      action: "Apply",
      href: sapId ? `/alumni-profile/association-leadership?sapid=${encodeURIComponent(sapId)}` : `/alumni-profile/association-leadership`,
      color: "text-red-600",
      bg: "bg-red-100",
      icon: (
        <svg role="img" aria-label="Leadership Badge" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-16 h-16">
          <path className="fill-current" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 bg-slate-100 gap-4 sm:gap-5 md:gap-6 dark:bg-gray-950">
      {cards.map((card, idx) => (
        <div key={idx} className="bg-white w-full shadow-sm border flex flex-col justify-between items-center border-gray-200 rounded-lg overflow-hidden dark:bg-gray-900 dark:border-gray-700">
          <div className="p-3 sm:p-4 md:p-5 text-center flex flex-col justify-between min-h-[10rem] sm:min-h-[12rem]">
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-gray-100">{card.title}</h3>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed dark:text-gray-400">{card.decription}</p>
            {card.title === "Success Story" && typeof successStoryCount === "number" && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-yellow-50 text-yellow-700 px-2.5 py-1 border border-yellow-200">
                <span className="text-xs">All Stories: {successStoryCount}</span>
              </div>
            )}
            {card.title === "Alumni Talk" && (
              <>
                {typeof alumniTalkCount === "number" && (
                  <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-purple-50 text-purple-700 px-2.5 py-1 border border-purple-200">
                    <span className="text-xs">Applications: {alumniTalkCount}</span>
                  </div>
                )}
                {typeof alumniTalkCount === "number" && alumniTalkCount > 0 ? (
                  card.statusError ? (
                    <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-rose-50 text-rose-700 px-2.5 py-1 border border-rose-200">
                      <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-rose-600"><path className="fill-current" d="M12 2a10 10 0 100 20 10 10 0 000-20zm3 12l-3-3-3 3 3-3-3-3 3 3 3-3-3 3 3 3z"/></svg>
                      <span className="text-xs">{card.statusError}</span>
                    </div>
                  ) : card.status === "applied" ? (
                    <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-amber-50 text-amber-700 px-2.5 py-1 border border-amber-200">
                      <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-amber-600"><path className="fill-current" d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 11H11V7h2v6zm0 4H11v-2h2v2z"/></svg>
                      <span className="text-xs">Status: Applied</span>
                    </div>
                  ) : card.status === "conducted" ? (
                    <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-emerald-50 text-emerald-700 px-2.5 py-1 border border-emerald-200">
                      <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-emerald-600"><path className="fill-current" d="M9 16.17l-3.88-3.88L3 14.41 9 20.41 21 8.41 18.88 6.29z"/></svg>
                      <span className="text-xs">Status: Conducted</span>
                    </div>
                  ) : null
                ) : null}
              </>
            )}
            {card.title === "Chapters Membership" && typeof chapterMembershipCount === "number" && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-green-50 text-green-700 px-2.5 py-1 border border-green-200">
                <span className="text-xs">Assigned Chapters: {chapterMembershipCount}</span>
              </div>
            )}
            {card.title === "Association Membership" && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-orange-50 text-orange-700 px-2.5 py-1 border border-orange-200">
                <span className="text-xs">{associationTitle ? associationTitle : "Not Assigned"}</span>
              </div>
            )}
            <NetworkingEngagementCard
              title={card.title}
              description={card.decription}
              action={card.action}
              href={card.href}
              disabled={card.disabled || (isViewer && (card.action === "Apply" || card.action === "Apply now" || card.action === "Share"))}
              disabledText={isViewer && (card.action === "Apply" || card.action === "Apply now" || card.action === "Share") ? "View Only" : card.disabledText}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

