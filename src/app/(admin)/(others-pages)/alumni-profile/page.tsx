export const dynamic = "force-dynamic";

import { sql } from "@/lib/dbconnect";
import Image from "next/image";
import Link from "next/link";
import AlumniCardAction from "@/components/alumni/AlumniCardAction";
import { auth } from "@/auth";
import type { CardStatus } from "./status";

type Profile = {
  alumniname: string | null;
  image1: string | null;
  campusname: string | null;
  facultyname: string | null;
  departmentname: string | null;
  degreetitle: string | null;
  yearofending: number | null;
  facebook: string | null;
  instagram: string | null;
  youtube: string | null;
  linkedin: string | null;
};

async function getProfile(searchParams: { sapid?: string }) {
  const sapid = searchParams?.sapid ? String(searchParams.sapid) : undefined;
  if (sapid) {
    const rows = await sql/* sql */`
      SELECT alumniname, image1, campusname, facultyname, departmentname, degreetitle, yearofending, facebook, instagram, youtube, linkedin
      FROM public.tbl_alumni WHERE sapid = ${sapid} LIMIT 1`;
    return rows[0] as Profile | undefined;
  }
  const session = await auth();
  const email = session?.user?.email ? String(session.user.email) : undefined;
  if (!email) return undefined;
  const rows = await sql/* sql */`
    SELECT alumniname, image1, campusname, facultyname, departmentname, degreetitle, yearofending, facebook, instagram, youtube, linkedin
    FROM public.tbl_alumni 
    WHERE personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email}
    ORDER BY alumniid DESC LIMIT 1`;
  return rows[0] as Profile | undefined;
}

export default async function Page({ searchParams }: { searchParams: Promise<{ sapid?: string }> }) {
  const sp = await searchParams;
  const p = await getProfile(sp);
  const session = await auth();
  const name = p?.alumniname ?? "";
  const googleImage = session?.user?.image && String(session.user.image).includes("googleusercontent") ? String(session.user.image) : undefined;
  const avatar = googleImage ?? "/images/person.jpg";
  const campus = p?.campusname ?? "";
  const faculty = p?.facultyname ?? "";
  const dept = p?.departmentname ?? "";
  const program = p?.degreetitle ?? "";
  const year = p?.yearofending ?? "";
  const email = session?.user?.email ? String(session.user.email) : undefined;
  const sapRows = email ? await sql/* sql */`
    SELECT alumniid, sapid FROM public.tbl_alumni 
    WHERE personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email}
    ORDER BY alumniid DESC LIMIT 1` : [];
  const sapId = String(sapRows[0]?.sapid ?? sp?.sapid ?? "");
  const alumniId = String(sapRows[0]?.alumniid ?? "");
  let cardStatus: CardStatus = "none";
  let cardStatusError: string | null = null;
  try {
    if (alumniId) {
      const cr = await sql/* sql */`
        SELECT status FROM public.tblcard WHERE alumniid = ${alumniId} ORDER BY cardid DESC LIMIT 1`;
      const raw = String(cr[0]?.status ?? "").toLowerCase();
      cardStatus = raw === "delivered" ? "active" : raw === "rejected" ? "rejected" : raw === "pending" ? "pending" : raw === "full" ? "full" : "none";
    }
  } catch (e) {
    cardStatusError = e instanceof Error ? e.message : "Failed to load card status";
  }
  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 mt-20">
      <div className="w-full">
    <div className="w-full h-32 bg-gray-200 rounded-t-lg"></div>

    {/* 2. Main Content Container (Max-width and Padding) */}
    {/* This container centers and holds the profile details and ID card. */}
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row -mt-20 sm:-mt-16 gap-8">

            {/* A. Profile Card & Social Links (Takes full width on small screens, adjusts on large) */}
            <div className="w-full lg:w-3/4 flex-shrink-0">
                <div className="bg-white rounded-lg shadow-xl p-6 pt-0">
                    
                    {/* Avatar & Details Group */}
                    <div className="flex flex-col items-start sm:flex-row sm:items-end">
                        
                        {/* Avatar */}
                        {/* Adjusted negative margin (-mt-16) to align with the banner bottom */}
                        <div className="w-32 h-32 rounded-full border-4 border-white bg-gray-100 overflow-hidden -mt-16 sm:-mt-10">
                            <Image src={avatar} alt={name || "alumni"} width={128} height={128} className="w-full h-full object-cover" />
                        </div>
                        
                        {/* Name and Social Links */}
                        <div className="pt-4 sm:pt-0 sm:ml-6 flex-grow">
                            <h4 className="text-slate-900 text-2xl font-bold">{name}</h4>
                            
                            {/* Social Icons */}
                            <div className="space-x-3 mt-4">
                                {[
                                    { href: p?.facebook ?? null, label: "Facebook", svg: (
                                        <svg role="img" aria-label="Facebook" xmlns="http://www.w3.org/2000/svg" width="12" className="fill-gray-700" viewBox="0 0 155.139 155.139"><path d="M89.584 155.139V84.378h23.742l3.562-27.585H89.584V39.184c0-7.984 2.208-13.425 13.67-13.425l14.595-.006V1.08C115.325.752 106.661 0 96.577 0 75.52 0 61.104 12.853 61.104 36.452v20.341H37.29v27.585h23.814v70.761h28.48z"/></svg>
                                    )},
                                    { href: p?.instagram ?? null, label: "Instagram", svg: (
                                        <svg role="img" aria-label="Instagram" xmlns="http://www.w3.org/2000/svg" width="12" className="fill-gray-700" viewBox="0 0 512 512"><path d="M512 97.248c-19.04 8.352-39.328 13.888-60.48 16.576 21.76-12.992 38.368-33.408 46.176-58.016-20.288 12.096-42.688 20.64-66.56 25.408C411.872 60.704 384.416 48 354.464 48c-58.112 0-104.896 47.168-104.896 104.992 0 8.32.704 16.32 2.432 23.936-87.264-4.256-164.48-46.08-216.352-109.792-9.056 15.712-14.368 33.696-14.368 53.056 0 36.352 18.72 68.576 46.624 87.232-16.864-.32-33.408-5.216-47.424-12.928v1.152c0 51.008 36.384 93.376 84.096 103.136-8.544 2.336-17.856 3.456-27.52 3.456-6.72 0-13.504-.384-19.872-1.792 13.6 41.568 52.192 72.128 98.08 73.12-35.712 27.936-81.056 44.768-130.144 44.768-8.608 0-16.864-.384-25.12-1.44C46.496 446.88 101.6 464 161.024 464c193.152 0 298.752-160 298.752-298.688 0-4.64-.16-9.12-.384-13.568 20.832-14.784 38.336-33.248 52.608-54.496z"/></svg>
                                    )},
                                    { href: p?.linkedin ?? null, label: "LinkedIn", svg: (
                                        <svg role="img" aria-label="LinkedIn" xmlns="http://www.w3.org/2000/svg" width="14" className="fill-gray-700" viewBox="0 0 24 24"><path d="M23.994 24v-.001H24v-8.802c0-4.306-.927-7.623-5.961-7.623-2.42 0-4.044 1.328-4.707 2.587h-.07V7.976H8.489v16.023h4.97v-7.934c0-2.089.396-4.109 2.983-4.109 2.549 0 2.587 2.384 2.587 4.243V24zM.396 7.977h4.976V24H.396zM2.882 0C1.291 0 0 1.291 0 2.882s1.291 2.909 2.882 2.909 2.882-1.318 2.882-2.909A2.884 2.884 0 0 0 2.882 0z"/></svg>
                                    )},
                                    { href: p?.youtube ?? null, label: "YouTube", svg: (
                                        <svg role="img" aria-label="YouTube" xmlns="http://www.w3.org/2000/svg" width="14" className="fill-gray-700" viewBox="0 0 24 24"><path d="M23.498 6.186a2.999 2.999 0 0 0-2.116-2.12C19.59 3.5 12 3.5 12 3.5s-7.59 0-9.382.566A2.999 2.999 0 0 0 .502 6.186C0 8.002 0 12 0 12s0 3.998.502 5.814a2.999 2.999 0 0 0 2.116 2.12C4.41 20.5 12 20.5 12 20.5s7.59 0 9.382-.566a2.999 2.999 0 0 0 2.116-2.12C24 15.998 24 12 24 12s0-3.998-.502-5.814zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg>
                                    )},
                                ].map((s, i) => (
                                    s.href ? (
                                        <a key={i} href={s.href} target="_blank" rel="noopener noreferrer" className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-300 transition-colors" aria-label={s.label}>
                                            {s.svg}
                                        </a>
                                    ) : (
                                        <button key={i} type="button" className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-gray-50 text-gray-400 cursor-not-allowed" aria-label={`${s.label} not provided`} title={`${s.label} not provided`}>
                                            {s.svg}
                                        </button>
                                    )
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    {/* Academic Details - Added padding-top to separate from name/socials */}
                    <div className="mt-6 pt-4 border-t border-gray-100">
                        <h5 className="text-lg font-semibold text-slate-800 mb-3">Academic History</h5>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 text-sm text-slate-700">
                            <div className="font-medium col-span-2 sm:col-span-1">
                                <span className="font-bold">{campus}</span> — {faculty}
                            </div>
                            <div className="col-span-2 sm:col-span-1">{dept}</div>
                            <div className="col-span-2 sm:col-span-1">{program}</div>
                            <div className="col-span-2 sm:col-span-1">
                                <span className="font-semibold">Passing Year:</span> {String(year)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* B. Alumni ID Card (Fixed width on larger screens) */}
            <div className="w-full lg:w-1/4 flex-shrink-0">
              {cardStatus === "active" ? (
                <div className="bg-white shadow-xl border border-gray-100 rounded-lg overflow-hidden p-6 text-center lg:mt-0" aria-label="Active alumni card">
                  <h3 className="text-xl font-bold text-indigo-600 mb-1">Alumni Card</h3>
                  <div className="border-t border-gray-200 pt-3 mt-3 text-sm text-slate-700">
                    <div className="font-semibold text-base">{name}</div>
                    <div className="mt-1 text-xs text-gray-500">SAP ID: {sapId || "N/A"}</div>
                  </div>
                  <p className="mt-4 text-xs text-gray-400">Please carry this ID for campus access.</p>
                </div>
              ) : cardStatus === "pending" ? (
                <div className="bg-amber-50 shadow-sm border border-amber-200 rounded-lg overflow-hidden p-6 text-center lg:mt-0" aria-label="Pending alumni card">
                  <h3 className="text-lg font-semibold text-amber-700">Alumni Card (Pending)</h3>
                  <div className="mt-2 text-xs text-amber-700">Your application is under review.</div>
                </div>
              ) : cardStatus === "rejected" ? (
                <div className="bg-rose-50 shadow-sm border border-rose-200 rounded-lg overflow-hidden p-6 text-center lg:mt-0" aria-label="Rejected alumni card">
                  <h3 className="text-lg font-semibold text-rose-700">Alumni Card (Rejected)</h3>
                  <div className="mt-2 text-xs text-rose-700">Your application was rejected. You may reapply.</div>
                </div>
              ) : cardStatus === "full" ? (
                <div className="bg-sky-50 shadow-sm border border-sky-200 rounded-lg overflow-hidden p-6 text-center lg:mt-0" aria-label="Capacity full">
                  <h3 className="text-lg font-semibold text-sky-700">Alumni Card (Capacity Full)</h3>
                  <div className="mt-2 text-xs text-sky-700">Application capacity is currently full. Please try later.</div>
                </div>
              ) : (
                <div className="bg-gray-50 shadow-sm border border-gray-200 rounded-lg overflow-hidden p-6 text-center lg:mt-0" aria-label="No application">
                  <h3 className="text-lg font-semibold text-gray-700">No Alumni Card Application</h3>
                  <div className="mt-2 text-xs text-gray-700">Start your application using the Alumni Card section below.</div>
                </div>
              )}
            </div>
        </div>
    </div>
</div>
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          {
            title: "Success Story",
            action: "View",
            color: "text-yellow-600",
            bg: "bg-yellow-100",
            icon: (
              <svg role="img" aria-label="Trophy" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-16 h-16">
                <path className="fill-current" d="M20 6h1a1 1 0 011 1c0 3.866-3.134 7-7 7h-.278A5.5 5.5 0 0113 15.5V18h3a1 1 0 110 2H8a1 1 0 110-2h3v-2.5A5.5 5.5 0 017.278 14H7c-3.866 0-7-3.134-7-7a1 1 0 011-1h1V4a1 1 0 011-1h14a1 1 0 011 1v2zm-1 2V5H5v3a5 5 0 005 5h4a5 5 0 005-5zM4 8.874C3.16 8.552 2.5 7.853 2.2 7H4v1.874zM20 8.874V7h1.8c-.3.853-.96 1.552-1.8 1.874z"/>
              </svg>
            ),
          },
          {
            title: "Alumni Card",
            action: "Apply now",
            color: "text-blue-600",
            bg: "bg-blue-100",
            icon: (
              <svg role="img" aria-label="Graduation cap" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-16 h-16">
                <path className="fill-current" d="M12 3l10 5-10 5-10-5 10-5zm0 12l7-3.5V17a2 2 0 01-2 2H7a2 2 0 01-2-2v-5.5L12 15z"/>
              </svg>
            ),
          },
          {
            title: "Mentorship Session",
            action: "Apply now",
            color: "text-purple-600",
            bg: "bg-purple-100",
            icon: (
              <svg role="img" aria-label="Mentorship" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-16 h-16">
                <path className="fill-current" d="M7 7a4 4 0 118 0 4 4 0 01-8 0zm-3 12a6 6 0 1112 0H4zm13.5-8a2.5 2.5 0 110 5 2.5 2.5 0 010-5zM21 21h-3.5a4.5 4.5 0 114.5-4.5V21z"/>
              </svg>
            ),
          },
          {
            title: "Alumni Chapters",
            action: "Apply now",
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
            action: "VIEW",
            color: "text-gray-700",
            bg: "bg-gray-200",
            icon: (
              <svg role="img" aria-label="Handshake" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-16 h-16">
                <path className="fill-current" d="M16 7a3 3 0 013 3v3l-2 2-3-3-3 3-2-2 3-3-3-3 2-2 3 3 3-3 2 2-3 3zM5 7h4l-2 2-2-2zm0 10l4-4 2 2-3 3H5z"/>
              </svg>
            ),
          },
        ].map((c, idx) => (
          <div key={idx} className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
            <div className={`flex items-center justify-center ${c.bg} ${c.color} h-40`}>
              {c.icon}
            </div>
            <div className="p-4 text-center">
              {c.title === "Alumni Card" && (
                <div role="status" aria-live="polite" className="mb-2">
                  {cardStatusError ? (
                    <div className="inline-flex items-center gap-2 rounded-md bg-rose-50 text-rose-700 px-2.5 py-1 border border-rose-200">
                      <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-rose-600"><path className="fill-current" d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 14H11v-2h2v2zm0-4H11V7h2v5z"/></svg>
                      <span className="text-xs">{cardStatusError}</span>
                    </div>
                  ) : cardStatus === "active" ? (
                    <div className="inline-flex items-center gap-2 rounded-md bg-emerald-50 text-emerald-700 px-2.5 py-1 border border-emerald-200">
                      <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-emerald-600"><path className="fill-current" d="M9 16.17l-3.88-3.88L3 14.41 9 20.41 21 8.41 18.88 6.29z"/></svg>
                      <span className="text-xs">Card Status: Active</span>
                    </div>
                  ) : cardStatus === "rejected" ? (
                    <div className="inline-flex items-center gap-2 rounded-md bg-rose-50 text-rose-700 px-2.5 py-1 border border-rose-200">
                      <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-rose-600"><path className="fill-current" d="M12 2a10 10 0 100 20 10 10 0 000-20zm3 12l-3-3-3 3 3-3-3-3 3 3 3-3-3 3 3 3z"/></svg>
                      <span className="text-xs">Card Status: Rejected</span>
                    </div>
                  ) : cardStatus === "pending" ? (
                    <div className="inline-flex items-center gap-2 rounded-md bg-amber-50 text-amber-700 px-2.5 py-1 border border-amber-200">
                      <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-amber-600"><path className="fill-current" d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 11H11V7h2v6zm0 4H11v-2h2v2z"/></svg>
                      <span className="text-xs">Card Status: Pending</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 rounded-md bg-gray-50 text-gray-700 px-2.5 py-1 border border-gray-200">
                      <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-gray-600"><path className="fill-current" d="M12 2a10 10 0 100 20 10 10 0 000-20zM11 7h2v6h-2V7zm0 8h2v2h-2v-2z"/></svg>
                      <span className="text-xs">No Application Found</span>
                    </div>
                  )}
                </div>
              )}
              <h3 className="text-lg font-semibold text-slate-900">{c.title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">Explore opportunities and resources tailored for alumni.</p>
              {c.title === "Success Story" ? (
                <Link href="/alumni-success" className="mt-4 inline-flex items-center justify-center px-4 py-2.5 w-full rounded-lg text-white text-sm font-medium bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                  {c.action}
                </Link>
              ) : c.title === "Alumni Card" ? (
                <AlumniCardAction
                  alumniId={alumniId}
                  name={name}
                  sapId={sapId}
                  faculty={faculty}
                  department={dept}
                  program={program}
                  initialStatus={cardStatus === "active" ? "delivered" : cardStatus === "rejected" ? "rejected" : cardStatus === "pending" ? "pending" : null}
                />
              ) : (
                <button type="button" className="mt-4 px-4 py-2.5 w-full rounded-lg text-white text-sm font-medium border-none outline-none bg-blue-600 hover:bg-blue-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                  {c.action}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}