"use client";
import NetworkingEngagementCard from "./NetworkingEngagementCard";

type NetworkingEngagementSectionProps = {
  sapId?: string;
  mentorshipStatus?: string;
  mentorshipStatusError?: string | null;
};

export default function NetworkingEngagementSection({
  sapId,
  mentorshipStatus,
  mentorshipStatusError,
}: NetworkingEngagementSectionProps) {
  const cards = [
    {
      title: "Success Story",
      decription: "Share your story and inspire the next generation of UOL.",
      action: "Share",
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
      action: "Apply now",
      href: sapId ? `/alumni-profile/mentorship?sapid=${encodeURIComponent(sapId)}` : `/alumni-profile/mentorship`,
      color: "text-purple-600",
      bg: "bg-purple-100",
      icon: (
        <svg role="img" aria-label="Mentorship" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-16 h-16">
          <path className="fill-current" d="M7 7a4 4 0 118 0 4 4 0 01-8 0zm-3 12a6 6 0 1112 0H4zm13.5-8a2.5 2.5 0 110 5 2.5 2.5 0 010-5zM21 21h-3.5a4.5 4.5 0 114.5-4.5V21z"/>
        </svg>
      ),
      disabled: mentorshipStatus === "applied",
      disabledText: "Already Applied",
      statusError: mentorshipStatusError,
      status: mentorshipStatus,
    },
    {
      title: "Alumni Chapters",
      decription: "Keep your UOL connection alive by joining national and international alumni chapters.",
      action: "View",
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
      title: "Alumni Association",
      decription: "Join the UOL Alumni Association to connect, engage, and contribute. Apply today!",
      action: "Apply",
      href: sapId ? `/alumni-profile/association?sapid=${encodeURIComponent(sapId)}` : `/alumni-profile/association`,
      color: "text-gray-700",
      bg: "bg-red-200",
      icon: (
        <svg role="img" aria-label="Building" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-16 h-16">
          <path className="fill-current" d="M12 2L2 7v10h2v-2h2v2h2v-2h2v2h2v-2h2v2h2v-2h2v2h2V7L12 2zm0 2.5l6 2.5v2h-2V9h-2v2h-2V9h-2v2h-2V9H8v2H6V9H4v-2l6-2.5zM4 11h2v2H4v-2zm4 0h2v2H8v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 bg-slate-100 gap-4 sm:gap-5 md:gap-6">
      {cards.map((card, idx) => (
        <div key={idx} className="bg-white w-full shadow-sm border flex flex-col justify-between items-center border-gray-200 rounded-lg overflow-hidden">
          <div className="p-3 sm:p-4 md:p-5 text-center flex flex-col justify-between min-h-[10rem] sm:min-h-[12rem]">
            <h3 className="text-base sm:text-lg font-semibold text-slate-900">{card.title}</h3>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">{card.decription}</p>
            {card.title === "Alumni Talk" && (
              <>
                {card.statusError ? (
                  <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-rose-50 text-rose-700 px-2.5 py-1 border border-rose-200">
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-rose-600"><path className="fill-current" d="M12 2a10 10 0 100 20 10 10 0 000-20zm3 12l-3-3-3 3 3-3-3-3 3 3 3-3-3 3 3 3z"/></svg>
                    <span className="text-xs">{card.statusError}</span>
                  </div>
                ) : card.status === "applied" ? (
                  <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-amber-50 text-amber-700 px-2.5 py-1 border border-amber-200">
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-amber-600"><path className="fill-current" d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 11H11V7h2v6zm0 4H11v-2h2v2z"/></svg>
                    <span className="text-xs">Mentorship Status: Applied</span>
                  </div>
                ) : card.status === "conducted" ? (
                  <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-emerald-50 text-emerald-700 px-2.5 py-1 border border-emerald-200">
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-emerald-600"><path className="fill-current" d="M9 16.17l-3.88-3.88L3 14.41 9 20.41 21 8.41 18.88 6.29z"/></svg>
                    <span className="text-xs">Mentorship Status: Conducted</span>
                  </div>
                ) : null}
              </>
            )}
            <NetworkingEngagementCard
              title={card.title}
              description={card.decription}
              action={card.action}
              href={card.href}
              disabled={card.disabled}
              disabledText={card.disabledText}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

