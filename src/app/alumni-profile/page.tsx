export const dynamic = "force-dynamic";
import type { Viewport } from "next";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

import { sql } from "@/lib/dbconnect";
import Link from "next/link";
import { auth } from "@/lib/auth";
import type { CardStatus } from "./status";
import AppHeader from "@/layout/AppHeader";
import Alert from "@/components/ui/alert/Alert";
import { computeLoginBanner, isAdminUser } from "@/lib/alumniProfile";
import { deriveMentorshipStatus, type MentorshipStatus } from "./status";
import ProfileDetailsClient from "./ProfileDetailsClient";
import ProfileDetailsServer from "./ProfileDetailsServer";
import PageBanner from "@/components/ui/PageBanner";
import AlumniCardTemplate from "@/components/alumni/AlumniCardTemplate";

type Profile = {
  alumniname: string | null;
  image1: string | null;
  image2: string | null;
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
    const session = await auth();
    const isAdmin = isAdminUser(session?.user);
    
    if (sapid) {
      // Admins can view any profile by SAP ID, regardless of verification status
      const rows = await sql/* sql */`
        SELECT alumniname, image1, image2, campusname, facultyname, departmentname, degreetitle, yearofending, facebook, instagram, youtube, linkedin, contactno
        FROM public.tbl_alumni WHERE sapid = ${sapid} LIMIT 1`;
      return rows[0] as Profile | undefined;
    }
    
    // If admin and no sapid provided, return undefined (admins need to specify sapid to view profiles)
    if (isAdmin) {
      return undefined;
    }
    
    // First try to get SAP ID from session (if alumni logged in with SAP ID)
    const sessionSapid = session?.user ? ((session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid).trim() : undefined) : undefined;
    if (sessionSapid) {
      const rows = await sql/* sql */`
        SELECT alumniname, image1, image2, campusname, facultyname, departmentname, degreetitle, yearofending, facebook, instagram, youtube, linkedin, contactno
        FROM public.tbl_alumni WHERE sapid = ${sessionSapid} LIMIT 1`;
      if (rows[0]) return rows[0] as Profile | undefined;
    }
    
    // Fallback to email lookup (backward compatibility) - only for alumni users
    const email = session?.user?.email ? String(session.user.email) : undefined;
    if (!email) return undefined;
    const rows = await sql/* sql */`
      SELECT alumniname, image1, image2, campusname, facultyname, departmentname, degreetitle, yearofending, facebook, instagram, youtube, linkedin, contactno
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
  
  // Normalize avatar path for Next.js Image component
  // Priority: database image2 (most recent) > image1 > Google image > default
  const rawAvatar = (p?.image2 && p.image2.trim() !== "") ? p.image2 : ((p?.image1 && p.image1.trim() !== "") ? p.image1 : (googleImage ?? "/images/person.jpg"));
  const avatar = (() => {
    // If empty or falsy, return default image
    if (!rawAvatar || rawAvatar.trim() === "" || rawAvatar === "null" || rawAvatar === "undefined") {
      return "/images/person.jpg";
    }
    
    let trimmedPath = rawAvatar.trim();
    
    // Fix typo: replace "tumbnail" with "thumbnail" if present
    trimmedPath = trimmedPath.replace(/\/tumbnail\//g, "/thumbnail/");
    
    // If already a valid path (starts with / or http), return as-is
    if (trimmedPath.startsWith("/") || trimmedPath.startsWith("http://") || trimmedPath.startsWith("https://")) {
      return trimmedPath;
    }
    // If it's just a filename, prepend the alumni images thumbnail directory
    // Images are stored in /public/images/alumni-images/thumbnail/(imagename.extention)
    if (!trimmedPath.includes("/")) {
      return `/images/alumni-images/thumbnail/${trimmedPath}`;
    }
    // If it's a relative path without leading slash, add it
    return `/${trimmedPath}`;
  })();
  const faculty = p?.facultyname ?? "";
  const dept = p?.departmentname ?? "";
  const program = p?.degreetitle ?? "";
  const contact = p?.contactno ?? "";
  // Get SAP ID from session first, then from search params, then from email lookup
  const sessionSapid = session?.user ? ((session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid).trim() : undefined) : undefined;
  const email = session?.user?.email ? String(session.user.email) : undefined;
  
  let sapRows: Array<{ alumniid: number; sapid: string }> = [];
  let sapError: string | null = null;
  
  // If we have SAP ID from session, use it directly
  if (sessionSapid) {
    try {
      sapRows = await sql/* sql */`
        SELECT alumniid, sapid FROM public.tbl_alumni 
        WHERE sapid = ${sessionSapid} LIMIT 1`;
    } catch (e) {
      sapError = e instanceof Error ? e.message : "Failed to load SAP ID from session";
    }
  } else if (email) {
    // Fallback to email lookup (backward compatibility)
    try {
      sapRows = await sql/* sql */`
        SELECT alumniid, sapid FROM public.tbl_alumni 
        WHERE personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email}
        ORDER BY alumniid DESC LIMIT 1`;
    } catch (e) {
      sapError = e instanceof Error ? e.message : "Failed to load SAP ID";
    }
  }
  
  const sapId = String(sapRows[0]?.sapid ?? sp?.sapid ?? sessionSapid ?? "").trim();
  const alumniId = String(sapRows[0]?.alumniid ?? "");
  let cardStatus: CardStatus = "none";
  let cardStatusError: string | null = null;
let cardPicture: string | null = null;
let cardImageFile: string | null = null;
  if (isAdmin) {
    cardStatus = "active";
    cardStatusError = null;
  } else {
    try {
      if (sapId) {
        // Preload validation now uses sapid to check existing tblcard association
        const cr = await sql/* sql */`
          SELECT c.status, c.cardpicture, c.card_image FROM public.tblcard c
          JOIN public.tbl_alumni a ON a.alumniid = c.alumniid
          WHERE a.sapid = ${sapId}
          ORDER BY c.cardid DESC LIMIT 1`;
        const raw = String(cr[0]?.status ?? "").toLowerCase().trim();
        cardPicture = cr[0]?.cardpicture ?? null;
        cardImageFile = cr[0]?.card_image ?? null;
        // Map database statuses to CardStatus
        if (raw === "delivered") {
          cardStatus = "active";
        } else if (raw === "rejected") {
          cardStatus = "rejected";
        } else if (raw === "pending") {
          cardStatus = "pending";
        } else if (raw === "full") {
          cardStatus = "full";
        } else if (raw && cr[0]) {
          // If there's a record but status is unknown, default to pending
          cardStatus = "pending";
        } else {
          // No record found - no application
          cardStatus = "none";
        }
      }
    } catch (e) {
      cardStatusError = e instanceof Error ? e.message : "Failed to load card status";
    }
  }

  // Card template images: prefer thumbnail/profile image first, then dedicated card image
  const profileImageFilename = (() => {
    if (p?.image1 && p.image1.trim() && p.image1.trim().toLowerCase() !== "null") {
      return p.image1.trim();
    }
    return undefined;
  })();
  const cardTemplateImageFilename = (() => {
    const raw = (cardImageFile ?? cardPicture) ?? null;
    if (raw && raw.trim() && raw.trim().toLowerCase() !== "null") {
      return raw.trim();
    }
    return undefined;
  })();

  // Calculate validity from yearofending (add 5 years as default validity)
  const validityYear = p?.yearofending ? p.yearofending + 5 : undefined;
  const validity = validityYear ? `${validityYear}-12` : undefined;
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

  // Fetch chapters for verified alumni (both for alumni and admin views)
  let chapters: string[] = [];
  let chaptersError: string | null = null;
  let isVerified: boolean = false;
  if (alumniId) {
    try {
      // Check if alumni is verified and fetch chapters
      const verifyRows = await sql/* sql */`
        SELECT verify FROM public.tbl_alumni WHERE alumniid = ${alumniId} LIMIT 1`;
      const verifyValue = verifyRows[0]?.verify;
      // Alumni is verified if verify is not null, not 'pending', and not empty string
      // For admins, always show chapters if they exist (regardless of verification status)
      isVerified = isAdmin || (verifyValue !== null && 
                   verifyValue !== undefined && 
                   String(verifyValue).trim().toLowerCase() !== 'pending' && 
                   String(verifyValue).trim() !== '');
      
      if (isVerified || isAdmin) {
        const chapterRows = await sql/* sql */`
          SELECT "chapter1", "chapter2", "chapter3"
          FROM public.alumni_chapter
          WHERE id = ${alumniId}
          LIMIT 1`;
        const chapterRec = chapterRows[0] as { chapter1?: string | null; chapter2?: string | null; chapter3?: string | null } | undefined;
        if (chapterRec) {
          if (chapterRec.chapter1) chapters.push(String(chapterRec.chapter1));
          if (chapterRec.chapter2) chapters.push(String(chapterRec.chapter2));
          if (chapterRec.chapter3) chapters.push(String(chapterRec.chapter3));
        }
        // Remove duplicate chapters (case-insensitive) while preserving original case
        const seen = new Set<string>();
        chapters = chapters
          .map(ch => ch.trim())
          .filter(ch => {
            if (!ch || ch === "") return false;
            const lower = ch.toLowerCase();
            if (seen.has(lower)) {
              return false; // Duplicate, filter it out
            }
            seen.add(lower);
            return true; // Keep this one
          });
      }
    } catch (e) {
      chaptersError = e instanceof Error ? e.message : "Failed to load chapters";
    }
  }

  // Fetch association membership for alumni
  let associationTitle: string | null = null;
  let associationError: string | null = null;
  if (alumniId) {
    try {
      const associationRows = await sql/* sql */`
        SELECT a.title
        FROM public.tbl_associations a
        INNER JOIN public.tbl_alumni al ON al.association_id = a.id
        WHERE al.alumniid = ${alumniId}
        LIMIT 1`;
      const associationRec = associationRows[0] as { title?: string | null } | undefined;
      if (associationRec?.title) {
        associationTitle = String(associationRec.title).trim();
        if (associationTitle === "" || associationTitle.toLowerCase() === "null") {
          associationTitle = null;
        }
      }
    } catch (e) {
      associationError = e instanceof Error ? e.message : "Failed to load association membership";
    }
  }
  return (
    <>
    <div className=" bg-slate-100 overflow-x-hidden">
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
      <PageBanner title="My Profile" />

        {/* 2. Main Content Container (Max-width and Padding) */}
        {/* This container centers and holds the profile details and ID card. */}
        <div className="min-w-screen bg-slate-100 mx-auto mt-16  px-4 sm:px-6 md:px-8 lg:px-10">
          <div className="flex flex-col bg-white rounded-lg md:flex-row lg:flex-row mt-12 sm:-mt-16 md:-mt-16 gap-6 md:gap-8 p-4 sm:p-6 md:p-8">

            <div className="w-full flex min-w-0 order-1">
                {sapId && sapId.trim() ? (
                  <ProfileDetailsClient sapId={sapId} chapters={chapters} isVerified={isVerified} chaptersError={chaptersError} associationTitle={associationTitle} associationError={associationError} />
                ) : isAdmin ? (
                  <div className="w-full p-8 text-center">
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
                      <h3 className="text-lg font-semibold text-blue-900 mb-2">Select an Alumni Profile</h3>
                      <p className="text-blue-700 mb-4">
                        To view an alumni profile, please select a profile from the alumni list or use the URL with a SAP ID parameter.
                      </p>
                      <Link
                        href="/"
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Go to Alumni List
                      </Link>
                    </div>
                  </div>
                ) : (
                  <ProfileDetailsServer
                    name={name}
                    avatar={avatar}
                    sapId={sapId || ""}
                    contact={contact}
                    faculty={faculty}
                    dept={dept}
                    program={program}
                    facebook={p?.facebook}
                    instagram={p?.instagram}
                    youtube={p?.youtube}
                    linkedin={p?.linkedin}
                    chapters={chapters}
                    isVerified={isVerified}
                    chaptersError={chaptersError}
                    associationTitle={associationTitle}
                    associationError={associationError}
                  />
                )}
                </div>
                  <div className="w-full md:w-1/3 lg:w-1/4 flex-shrink-0 pt-8 md:pt-10 mt-8 md:mt-0 order-2">
                    <div className={`shadow-sm border rounded-lg overflow-hidden text-center lg:mt-0 ${
                      cardStatus === "active" 
                        ? "bg-green-100 border-gray-100" 
                        : cardStatus === "pending" 
                        ? "bg-amber-50 border-amber-200" 
                        : cardStatus === "rejected" 
                        ? "bg-rose-50 border-rose-200" 
                        : cardStatus === "full" 
                        ? "bg-sky-50 border-sky-200" 
                        : "bg-gray-50 border-gray-200"
                    }`} aria-label="Alumni card">
                      <div className="p-6">
                        <div className="flex items-center justify-center gap-2 mb-3">
                          <h3 className={`text-xl font-bold ${
                            cardStatus === "active" 
                              ? "text-indigo-600" 
                              : cardStatus === "pending" 
                              ? "text-amber-700" 
                              : cardStatus === "rejected" 
                              ? "text-rose-700" 
                              : cardStatus === "full" 
                              ? "text-sky-700" 
                              : "text-gray-700"
                          }`}>Alumni Card</h3>
                          <div role="status" aria-live="polite">
                            {cardStatusError ? (
                              <div className="inline-flex items-center gap-1 rounded-md bg-rose-50 text-rose-700 px-2 py-0.5 border border-rose-200">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-rose-600"><path className="fill-current" d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 14H11v-2h2v2zm0-4H11V7h2v5z"/></svg>
                                <span className="text-xs">{cardStatusError}</span>
                              </div>
                            ) : cardStatus === "active" ? (
                              <div className="inline-flex items-center gap-1 rounded-md bg-emerald-50 text-emerald-700 px-2 py-0.5 border border-emerald-200">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-emerald-600"><path className="fill-current" d="M9 16.17l-3.88-3.88L3 14.41 9 20.41 21 8.41 18.88 6.29z"/></svg>
                                <span className="text-xs">Active</span>
                              </div>
                            ) : cardStatus === "rejected" ? (
                              <div className="inline-flex items-center gap-1 rounded-md bg-rose-50 text-rose-700 px-2 py-0.5 border border-rose-200">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-rose-600"><path className="fill-current" d="M12 2a10 10 0 100 20 10 10 0 000-20zm3 12l-3-3-3 3 3-3-3-3 3 3 3-3-3 3 3 3z"/></svg>
                                <span className="text-xs">On hold</span>
                              </div>
                            ) : cardStatus === "pending" ? (
                              <div className="inline-flex items-center gap-1 rounded-md bg-amber-50 text-amber-700 px-2 py-0.5 border border-amber-200">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-amber-600"><path className="fill-current" d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 11H11V7h2v6zm0 4H11v-2h2v2z"/></svg>
                                <span className="text-xs">Pending</span>
                              </div>
                            ) : cardStatus === "full" ? (
                              <div className="inline-flex items-center gap-1 rounded-md bg-sky-50 text-sky-700 px-2 py-0.5 border border-sky-200">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-sky-600"><path className="fill-current" d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 11H11V7h2v6zm0 4H11v-2h2v2z"/></svg>
                                <span className="text-xs">Full</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 rounded-md bg-gray-50 text-gray-700 px-2 py-0.5 border border-gray-200">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-gray-600"><path className="fill-current" d="M12 2a10 10 0 100 20 10 10 0 000-20zM11 7h2v6h-2V7zm0 8h2v2h-2v-2z"/></svg>
                                <span className="text-xs">No Application</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {cardStatus === "active" ? (
                          <>
                            <div className="mt-4">
                              <AlumniCardTemplate
                                studentName={name}
                                department={dept}
                                faculty={faculty}
                                alumniId={sapId || "UOL-AL-0000"}
                                validity={validity}
                                photoUrl={profileImageFilename}
                                cardImage={cardTemplateImageFilename}
                              />
                            </div>
                            {validity && (() => {
                              // Parse validity date (format: "YYYY-12" means December of that year)
                              const [year] = validity.split("-").map(Number);
                              // Create date for last day of December (December 31st of that year)
                              const expiryDate = new Date(year, 11, 31); // December 31st (month is 0-indexed, so 11 = December)
                              expiryDate.setHours(0, 0, 0, 0); // Set to start of day for comparison
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              const isExpired = today > expiryDate;
                              const formattedExpiry = expiryDate.toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              });
                              
                              return (
                                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                  <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                      Card Expiry Date:
                                    </span>
                                    <span className={`text-sm font-semibold ${
                                      isExpired 
                                        ? "text-rose-600 dark:text-rose-400" 
                                        : "text-gray-900 dark:text-gray-100"
                                    }`}>
                                      {formattedExpiry}
                                    </span>
                                  </div>
                                  {isExpired && (
                                    <Link
                                      href={sapId ? `/alumni-profile/card?sapid=${encodeURIComponent(sapId)}` : `/alumni-profile/card`}
                                      className="mt-3 inline-flex items-center justify-center px-4 py-2.5 w-full rounded-lg text-white text-sm font-medium bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                                    >
                                      <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M23 4v6h-6"></path>
                                        <path d="M1 20v-6h6"></path>
                                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                                      </svg>
                                      Renew Card
                                    </Link>
                                  )}
                                </div>
                              );
                            })()}
                          </>
                        ) : (
                          <>
                            <div className="mt-4">
                              {cardStatus === "pending" ? (
                                <p className="text-xs text-amber-700">Your application is under review.</p>
                              ) : cardStatus === "rejected" ? (
                                <p className="text-xs text-rose-700">Your application is on hold. Please contact us for more information.</p>
                              ) : cardStatus === "full" ? (
                                <p className="text-xs text-sky-700">Application capacity is currently full. Please try later.</p>
                              ) : (
                                <p className="text-xs text-gray-700 mb-3">Start your application to get your alumni card.</p>
                              )}
                            </div>
                            {cardStatus === "pending" ? (
                            <button
                              type="button"
                              disabled
                              aria-disabled
                              className="mt-3 inline-flex items-center justify-center px-4 py-2.5 w-full rounded-lg text-white text-sm font-medium bg-gray-300 cursor-not-allowed"
                            >
                              Under review
                            </button>
                          ) : cardStatus === "rejected" ? (
                            <div className="mt-3 space-y-2">
                              <button
                                type="button"
                                disabled
                                aria-disabled
                                className="inline-flex items-center justify-center px-4 py-2.5 w-full rounded-lg text-white text-sm font-medium bg-gray-300 cursor-not-allowed"
                              >
                                Application on hold
                              </button>
                              <button
                                type="button"
                                className="inline-flex items-center justify-center px-4 py-2.5 w-full rounded-lg text-white text-sm font-medium bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 transition-colors"
                                aria-label="Contact Management"
                              >
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                </svg>
                                Contact Us
                              </button>
                            </div>
                          ) : cardStatus === "full" ? (
                            <button
                              type="button"
                              disabled
                              aria-disabled
                              className="mt-3 inline-flex items-center justify-center px-4 py-2.5 w-full rounded-lg text-white text-sm font-medium bg-gray-300 cursor-not-allowed"
                            >
                              Capacity Full
                            </button>
                          ) : cardStatus === "none" ? (
                            <Link
                              href={sapId ? `/alumni-profile/card?sapid=${encodeURIComponent(sapId)}` : `/alumni-profile/card`}
                              className="mt-3 inline-flex items-center justify-center px-4 py-2.5 w-full rounded-lg text-white text-sm font-medium bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              Apply now
                            </Link>
                          ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
          </div>

          {/* B. Alumni ID Card (Fixed width on larger screens) */}
        </div>
      </div>
      <div className="p-10 text-slate-900 bg-slate-100">
        <h4 className="text-2xl font-bold text-slate-900 mb-6">Networking & Engagement</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 bg-slate-100 gap-6">
          {[
            {
              title: "Success Story",
              decription: "Share your story and inspire the next generation of UOL.",
              action: "Share",
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
              decription: "Keep your UOL connection alive by joining national and international alumni chapters.",
              action: "View",
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
              
          
              <div className="p-4 text-center flex flex-col justify-between min-h-[12rem]">
                <h3 className="text-lg font-semibold text-slate-900">{c.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{c.decription}</p>
                {c.title === "Success Story" ? (
                  <Link href="/alumni-success" className="mt-4 inline-flex items-center justify-center px-4 py-2.5 w-full rounded-lg text-white text-sm font-medium bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 touch-manipulation">
                    {c.action}
                  </Link>
                ) : c.title === "Alumni Talk" ? (
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
                        href={sapId ? `/alumni-profile/mentorship?sapid=${encodeURIComponent(sapId)}` : `/alumni-profile/mentorship`}
                        className="mt-4 inline-flex items-center justify-center px-4 py-2.5 w-full rounded-lg text-white text-sm font-medium bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        {c.action}
                      </Link>
                    )}
                  </>
                ) : c.title === "Alumni Chapters" ? (
                  <Link
                    href={sapId ? `/alumni-profile/my-chapters?sapid=${encodeURIComponent(sapId)}` : `/alumni-profile/my-chapters`}
                    className="mt-4 inline-flex items-center justify-center px-4 py-2.5 w-full rounded-lg text-white text-sm font-medium bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {c.action}
                  </Link>
                ) : c.title === "Alumni Association" ? (
                  <Link
                    href={sapId ? `/alumni-profile/association?sapid=${encodeURIComponent(sapId)}` : `/alumni-profile/association`}
                    className="mt-4 inline-flex items-center justify-center px-4 py-2.5 w-full rounded-lg text-white text-sm font-medium bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {c.action}
                  </Link>
                ) : (
                  <Link
                    href={sapId ? `/alumni-profile/card?sapid=${encodeURIComponent(sapId)}` : `/alumni-profile/card`}
                    className="mt-4 inline-flex items-center justify-center px-4 py-2.5 w-full rounded-lg text-white text-sm font-medium bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {c.action}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>


      <div className="p-10 bg-slate-100">
        <h2 className="text-2xl font-bold text-slate-900 mb-3 flex items-center gap-3">
          Perks &amp; Benefits
          <span className="ml-3 px-3 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700 font-medium border border-yellow-200">
            Alumni card is required to avail these benefits
          </span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[
            {
              title: "Academic Benefits",
              description: "Avail special tuition and admission discounts offered to UOL alumni.",
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 fill-indigo-700" viewBox="0 0 24 24">
                  <path d="M21 4H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H3V6h18v12z"/>
                  <path d="M7 8h10v2H7zm0 4h7v2H7z"/>
                </svg>
              ),
              slug: "academic-benefits",
            },
            {
              title: "Healthcare Benefits",
              description: "Avail comprehensive health insurance and wellness programs as an alumni member.",
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 fill-emerald-700" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              ),
              slug: "healthcare-benefits",
            },
            {
              title: "Identity & Inclusion",
              description: "Avail UOL library access (on-campus &amp; online) and a permanent UOL alumni email.",
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 fill-purple-700" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                </svg>
              ),
              slug: "identity-inclusion",
            },
            {
              title: "Campus Facilities and Memberships",
              description: "Enjoy access to gym, sports facilities, and exclusive campus amenities.",
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 fill-blue-700" viewBox="0 0 24 24">
                  <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
                </svg>
              ),
              slug: "campus-facilities",
            },
            {
              title: "Merchant and Business Promotions",
              description: "Exclusive partner discounts and offers available for alumni with the Alumni Card.",
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 fill-orange-700" viewBox="0 0 24 24">
                  <path d="M7 18c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM1 2v2h2l3.6 7.59-1.35 2.45c-.15.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12L8.1 13h7.45c.75 0 1.41-.41 1.75-1.03L21.7 4H5.21l-.94-2H1zm16 16c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                </svg>
              ),
              slug: "merchant-promotions",
            },
            {
              title: "Career and Mentorship",
              description: " Avail exclusive career and professional development opportunities.",
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 fill-teal-700" viewBox="0 0 24 24">
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                </svg>
              ),
              slug: "career-mentorship",
            },
            {
              title: "Chapters & Engagement Events",
              description: "You can join chapters based on their city or country to connect locally and globally.",
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 fill-rose-700" viewBox="0 0 24 24">
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                </svg>
              ),
              slug: "chapters-events",
            },
            {
              title: "Recognition",
              description: " Avail opportunities to be honored for achievements via awards and spotlights.",
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 fill-amber-700" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              ),
              slug: "recognition",
            },
          ].map((benefit, idx) => (
            <Link
              key={idx}
              href={`/alumni-profile/benefits/${benefit.slug}`}
              className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden hover:shadow-md transition-shadow duration-200 cursor-pointer"
            >
              <div className="p-6">
                <div>
                  {benefit.icon}
                </div>
                <div className="mt-4">
                  <h4 className="text-base font-semibold text-slate-900">{benefit.title}</h4>
                  <p className="mt-2 text-sm text-slate-500 leading-relaxed">{benefit.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      
  </>
  );
}