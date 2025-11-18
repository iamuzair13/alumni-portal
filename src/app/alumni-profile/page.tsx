export const dynamic = "force-dynamic";
import type { Viewport } from "next";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

import { sql } from "@/lib/dbconnect";
import Image from "next/image";
import Link from "next/link";
import AlumniCardAction from "@/components/alumni/AlumniCardAction";
import MentorshipForm from "@/components/forms/MentorshipForm";
import { auth } from "@/lib/auth";
import type { CardStatus } from "./status";
import AppHeader from "@/layout/AppHeader";
import Alert from "@/components/ui/alert/Alert";
import { computeLoginBanner, isAdminUser, safeText, formatPhone } from "@/lib/alumniProfile";
import { deriveMentorshipStatus, type MentorshipStatus } from "./status";
import ProfileDetailsClient from "./ProfileDetailsClient";

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
  contactno: string | null;
};

async function getProfile(searchParams: { sapid?: string }) {
  const sapid = searchParams?.sapid ? String(searchParams.sapid) : undefined;
  try {
    if (sapid) {
      const rows = await sql/* sql */`
        SELECT alumniname, image1, campusname, facultyname, departmentname, degreetitle, yearofending, facebook, instagram, youtube, linkedin, contactno
        FROM public.tbl_alumni WHERE sapid = ${sapid} LIMIT 1`;
      return rows[0] as Profile | undefined;
    }
    const session = await auth();
    const email = session?.user?.email ? String(session.user.email) : undefined;
    if (!email) return undefined;
    const rows = await sql/* sql */`
      SELECT alumniname, image1, campusname, facultyname, departmentname, degreetitle, yearofending, facebook, instagram, youtube, linkedin, contactno
      FROM public.tbl_alumni 
      WHERE personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email}
      ORDER BY alumniid DESC LIMIT 1`;
    return rows[0] as Profile | undefined;
  } catch {
    return undefined;
  }
}

type AlumniProfileSearchParams = { sapid?: string; modal?: string };


export default async function Page({ searchParams }: { searchParams: Promise<AlumniProfileSearchParams> }) {
  const sp = await searchParams;
  let p: Profile | undefined;
  let profileError: string | null = null;
  try {
    p = await getProfile(sp);
  } catch (e) {
    profileError = e instanceof Error ? e.message : "Failed to load profile";
  }
  const session = await auth();
  const isAdmin = isAdminUser(session?.user);
  const name = p?.alumniname ?? "";
  const googleImage = session?.user?.image && String(session.user.image).includes("googleusercontent") ? String(session.user.image) : undefined;
  const avatar = googleImage ?? "/images/person.jpg";
  const faculty = p?.facultyname ?? "";
  const dept = p?.departmentname ?? "";
  const program = p?.degreetitle ?? "";
  const contact = p?.contactno ?? "";
  const email = session?.user?.email ? String(session.user.email) : undefined;
  let sapRows: Array<{ alumniid: number; sapid: string }> = [];
  let sapError: string | null = null;
  if (email) {
    try {
      sapRows = await sql/* sql */`
        SELECT alumniid, sapid FROM public.tbl_alumni 
        WHERE personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email}
        ORDER BY alumniid DESC LIMIT 1`;
    } catch (e) {
      sapError = e instanceof Error ? e.message : "Failed to load SAP ID";
    }
  }
  const sapId = String(sapRows[0]?.sapid ?? sp?.sapid ?? "");
  const alumniId = String(sapRows[0]?.alumniid ?? "");
  const modal = String(sp?.modal ?? "");
  let cardStatus: CardStatus = "none";
  let cardStatusError: string | null = null;
  if (isAdmin) {
    cardStatus = "active";
    cardStatusError = null;
  } else {
    try {
      if (sapId) {
        // Preload validation now uses sapid to check existing tblcard association
        const cr = await sql/* sql */`
          SELECT c.status FROM public.tblcard c
          JOIN public.tbl_alumni a ON a.alumniid = c.alumniid
          WHERE a.sapid = ${sapId}
          ORDER BY c.cardid DESC LIMIT 1`;
        const raw = String(cr[0]?.status ?? "").toLowerCase();
        cardStatus = raw === "delivered" ? "active" : raw === "rejected" ? "rejected" : raw === "pending" ? "pending" : raw === "full" ? "full" : "none";
      }
    } catch (e) {
      cardStatusError = e instanceof Error ? e.message : "Failed to load card status";
    }
  }
  // Mentorship application status for alumni users
  let mentorshipStatus: MentorshipStatus = "none";
  let mentorshipStatusError: string | null = null;
  if (!isAdmin) {
    try {
      if (alumniId) {
        const mrows = await sql/* sql */`
          SELECT alumnitalks, mentorshipprogram FROM public.tblalumnitalks WHERE alumniid = ${alumniId} LIMIT 1`;
        const rec = mrows[0] as { alumnitalks?: string | null; mentorshipprogram?: string | null } | undefined;
        mentorshipStatus = deriveMentorshipStatus(rec);
      }
    } catch (e) {
      mentorshipStatusError = e instanceof Error ? e.message : "Failed to load mentorship status";
    }
  }
  return (
    <>
    <div className=" bg-slate-200 overflow-x-hidden">
      <div className="border bg-white relative z-50">
        <AppHeader />
      </div>
      {(() => {
        const b = computeLoginBanner(session?.user);
        return b.show ? (
          <div className="mt-4">
            <Alert variant="error" title="Access Restricted" message={b.message} />
          </div>
        ) : null;
      })()}
      {profileError && (
        <div className="mt-4">
          <Alert variant="error" title="Profile Load Failed" message={profileError} />
        </div>
      )}
      {sapError && (
        <div className="mt-2">
          <Alert variant="error" title="Account Lookup Failed" message={sapError} />
        </div>
      )}
      <div className="min-w-screen">
        <div className="-mx-4 sm:-mx-6 lg:-mx-8">
          <div className="w-full bg-gradient-to-r from-green-700 to-green-400 text-white">
            <div className="max-w-screen-xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-8">
              <h1 className="text-center text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">Alumni Profile</h1>
            </div>
          </div>
        </div>

        {/* 2. Main Content Container (Max-width and Padding) */}
        {/* This container centers and holds the profile details and ID card. */}
        <div className="min-w-screen mx-auto mt-16 px-4 sm:px-6 md:px-8 lg:px-10">
          <div className="flex flex-col bg-white rounded-lg md:flex-row lg:flex-row mt-12 sm:-mt-16 md:-mt-16 gap-6 md:gap-8 p-4 sm:p-6 md:p-8">

            <div className="w-full flex min-w-0 order-1">
                {sapId ? (
                  <ProfileDetailsClient sapId={sapId} />
                ) : (
                  <div className="bg-white flex justify-between border rounded-lg p-6 pt-0">
                    <div>
                      <div className="flex flex-col items-start sm:flex-row sm:items-end">
                        <div className="w-32 h-32 rounded-full border-4 border-white bg-gray-100 overflow-hidden -mt-16 sm:-mt-10">
                          <Image
                            src={avatar}
                            alt={name || "alumni"}
                            width={128}
                            height={128}
                            sizes="(max-width: 640px) 8rem, (max-width: 768px) 8rem, 8rem"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="pt-4 sm:pt-0 sm:ml-6 flex-grow">
                          <h4 className="text-slate-900 text-2xl font-bold">{name}</h4>
                        </div>
                      </div>
                      <div className="mt-6 pt-4 border-t border-gray-100">
                        <h5 className="text-lg font-semibold text-slate-800 mb-3">Profile Details</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-6 text-sm text-slate-700">
                          <div className="col-span-1"><span className="font-semibold">SAP ID:</span> <br/> {safeText(sapId) || "N/A"}</div>
                          <div className="col-span-1"><span className="font-semibold">Phone:</span> <br/> {formatPhone(contact) || "Not provided"}</div>
                          <div className="col-span-1"><span className="font-semibold">Faculty:</span> <br/> {safeText(faculty) || "N/A"}</div>
                          <div className="col-span-1"><span className="font-semibold">Department:</span> <br/> {safeText(dept) || "N/A"}</div>
                          <div className="col-span-1"><span className="font-semibold">Program:</span> <br/> {safeText(program) || "N/A"}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                </div>
                  <div className="w-full md:w-1/3 lg:w-1/4 flex-shrink-0 pt-8 md:pt-10 mt-8 md:mt-0 order-2">
                    {cardStatus === "active" ? (
                      <div className="bg-green-100 border border-gray-100 rounded-lg overflow-hidden p-6 text-center lg:mt-0" aria-label="Active alumni card">
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

          {/* B. Alumni ID Card (Fixed width on larger screens) */}
        </div>
      </div>
      </div>
      <div className="p-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 bg-slate-100 gap-6">
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
            bg: "bg-red-200",
            icon: (
              <svg role="img" aria-label="Building" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-16 h-16">
                <path className="fill-current" d="M12 2L2 7v10h2v-2h2v2h2v-2h2v2h2v-2h2v2h2v-2h2v2h2V7L12 2zm0 2.5l6 2.5v2h-2V9h-2v2h-2V9h-2v2h-2V9H8v2H6V9H4v-2l6-2.5zM4 11h2v2H4v-2zm4 0h2v2H8v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z"/>
              </svg>
            ),
          },
        ].map((c, idx) => (
          <div key={idx} className="bg-white w-full shadow-sm border flex flex-col justify-between items-center border-gray-200 rounded-lg overflow-hidden">
            <div className={`flex items-center justify-center ${c.bg} ${c.color} min-h-[12rem] w-full`}>
              {c.icon}
            </div>
            <div className="p-4 text-center flex flex-col justify-between min-h-[12rem]">
              {c.title === "Alumni Card" ? (
                <div className="flex items-center justify-center gap-3">
                  <h3 className="text-lg font-semibold text-slate-900">{c.title}</h3>
                  <div role="status" aria-live="polite">
                    {cardStatusError ? (
                      <div className="inline-flex items-center gap-2 rounded-md bg-rose-50 text-rose-700 px-2.5 py-1 border border-rose-200">
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-rose-600"><path className="fill-current" d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 14H11v-2h2v2zm0-4H11V7h2v5z"/></svg>
                        <span className="text-xs">{cardStatusError}</span>
                      </div>
                    ) : cardStatus === "active" ? (
                      <div className="inline-flex items-center gap-2 rounded-md bg-emerald-50 text-emerald-700 px-2.5 py-1 border border-emerald-200">
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-emerald-600"><path className="fill-current" d="M9 16.17l-3.88-3.88L3 14.41 9 20.41 21 8.41 18.88 6.29z"/></svg>
                        <span className="text-xs">Active</span>
                      </div>
                    ) : cardStatus === "rejected" ? (
                      <div className="inline-flex items-center gap-2 rounded-md bg-rose-50 text-rose-700 px-2.5 py-1 border border-rose-200">
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-rose-600"><path className="fill-current" d="M12 2a10 10 0 100 20 10 10 0 000-20zm3 12l-3-3-3 3 3-3-3-3 3 3 3-3-3 3 3 3z"/></svg>
                        <span className="text-xs">Rejected</span>
                      </div>
                    ) : cardStatus === "pending" ? (
                      <div className="inline-flex items-center gap-2 rounded-md bg-amber-50 text-amber-700 px-2.5 py-1 border border-amber-200">
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-amber-600"><path className="fill-current" d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 11H11V7h2v6zm0 4H11v-2h2v2z"/></svg>
                        <span className="text-xs">Pending</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 rounded-md bg-gray-50 text-gray-700 px-2.5 py-1 border border-gray-200">
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-gray-600"><path className="fill-current" d="M12 2a10 10 0 100 20 10 10 0 000-20zM11 7h2v6h-2V7zm0 8h2v2h-2v-2z"/></svg>
                        <span className="text-xs">No Application Found</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <h3 className="text-lg font-semibold text-slate-900">{c.title}</h3>
              )}
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">Explore opportunities and resources tailored for alumni.</p>
              {c.title === "Success Story" ? (
                <Link href="/alumni-success" className="mt-4 inline-flex items-center justify-center px-4 py-2.5 w-full rounded-lg text-white text-sm font-medium bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 touch-manipulation">
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
                  initialStatus={isAdmin ? "delivered" : cardStatus === "active" ? "delivered" : cardStatus === "rejected" ? "rejected" : cardStatus === "pending" ? "pending" : null}
                />
              ) : c.title === "Mentorship Session" ? (
                <>
                  {/* Mentorship status indicator for alumni */}
                  {mentorshipStatusError ? (
                    <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-rose-50 text-rose-700 px-2.5 py-1 border border-rose-200">
                      <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-rose-600"><path className="fill-current" d="M12 2a10 10 0 100 20 10 10 0 000-20zm3 12l-3-3-3 3 3-3-3-3 3 3 3-3-3 3 3 3z"/></svg>
                      <span className="text-xs">{mentorshipStatusError}</span>
                    </div>
                  ) : mentorshipStatus === "applied" ? (
                    <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-amber-50 text-amber-700 px-2.5 py-1 border border-amber-200">
                      <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-amber-600"><path className="fill-current" d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 11H11V7h2v6zm0 4H11v-2h2v2z"/></svg>
                      <span className="text-xs">Mentorship Status: Applied</span>
                    </div>
                  ) : mentorshipStatus === "conducted" ? (
                    <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-emerald-50 text-emerald-700 px-2.5 py-1 border border-emerald-200">
                      <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-emerald-600"><path className="fill-current" d="M9 16.17l-3.88-3.88L3 14.41 9 20.41 21 8.41 18.88 6.29z"/></svg>
                      <span className="text-xs">Mentorship Status: Conducted</span>
                    </div>
                  ) : null}
                  {mentorshipStatus === "applied" ? (
                    <button
                      type="button"
                      disabled
                      aria-disabled
                      className="mt-4 inline-flex items-center justify-center px-4 py-2.5 w-full rounded-lg text-white text-sm font-medium bg-gray-300 cursor-not-allowed"
                    >
                      Already Applied
                    </button>
                  ) : (
                    <Link
                      href={sapId ? `/alumni-profile?sapid=${encodeURIComponent(sapId)}&modal=mentorship` : `/alumni-profile?modal=mentorship`}
                      className="mt-4 inline-flex items-center justify-center px-4 py-2.5 w-full rounded-lg text-white text-sm font-medium bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      {c.action}
                    </Link>
                  )}
                </>
              ) : (
                <Link
                  href={sapId ? `/alumni-profile?sapid=${encodeURIComponent(sapId)}&modal=card` : `/alumni-profile?modal=card`}
                  className="mt-4 inline-flex items-center justify-center px-4 py-2.5 w-full rounded-lg text-white text-sm font-medium bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {c.action}
                </Link>
              )}
            </div>
          </div>
        ))}
        {modal === "mentorship" && (
          <dialog open className="fixed inset-0  flex items-center mt-20 justify-center rounded-lg">
            <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
              <div className="flex items-center justify-between border-b p-4">
                <h2 className="text-lg font-semibold text-slate-900">Apply for Mentorship Session</h2>
                <Link
                  aria-label="Close"
                  href={sapId ? `/alumni-profile?sapid=${encodeURIComponent(sapId)}` : `/alumni-profile`}
                  className="rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100"
                >
                  Close
                </Link>
              </div>
              <div className="p-4 ">
                <MentorshipForm />
              </div>
            </div>
          </dialog>
        )}
        {modal === "card" && (
          <dialog open className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40" aria-modal="true" role="dialog">
            <div className="w-full max-w-3xl rounded-lg bg-white shadow-xl transition-all duration-300 ease-out">
              <div className="flex items-center justify-between border-b p-4">
                <h2 className="text-lg font-semibold text-slate-900">Apply for Alumni Card</h2>
                <Link
                  aria-label="Close"
                  href={sapId ? `/alumni-profile?sapid=${encodeURIComponent(sapId)}` : `/alumni-profile`}
                  className="rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100"
                >
                  Close
                </Link>
              </div>
              <div className="p-4">
                <AlumniCardAction
                  alumniId={alumniId}
                  name={name}
                  sapId={sapId}
                  faculty={faculty}
                  department={dept}
                  program={program}
                  initialStatus={isAdmin ? "delivered" : cardStatus === "active" ? "delivered" : cardStatus === "rejected" ? "rejected" : cardStatus === "pending" ? "pending" : null}
                />
              </div>
            </div>
          </dialog>
        )}
      </div>
  </>
  );
}