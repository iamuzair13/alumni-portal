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
import { redirect } from "next/navigation";
import type { CardStatus } from "./status";
import AppHeader from "@/layout/AppHeader";
import Alert from "@/components/ui/alert/Alert";
import { computeLoginBanner, isAdminUser, isSuperAdminUser, isViewerUser } from "@/lib/alumniProfile";
import { canViewAlumni } from "@/lib/rbac";
import { deriveMentorshipStatus, type MentorshipStatus } from "./status";
import ProfileDetailsClient from "./ProfileDetailsClient";
import ProfileDetailsServer from "./ProfileDetailsServer";
import PageBanner from "@/components/ui/PageBanner";
import AlumniCardTemplate from "@/components/alumni/AlumniCardTemplate";
import NetworkingEngagementSection from "@/components/ui/NetworkingEngagementSection";
import BenefitCard from "@/components/ui/BenefitCard";
import RenewCardButton from "@/components/alumni/RenewCardButton";

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
    const canView = canViewAlumni(session?.user); // Includes admins, superadmins, and viewers
    const isAdmin = isAdminUser(session?.user) || isSuperAdminUser(session?.user);
    const sessionAlumniId =
      session?.user && (session.user as { userId?: number | null })?.userId
        ? Number((session.user as { userId?: number | null }).userId)
        : undefined;
    
    if (sapid && canView) {
      // Admins and viewers can view profiles by SAP ID (with RBAC restrictions applied in API)
      const rows = await sql/* sql */`
        SELECT 
          a.alumniname, 
          a.image1, 
          a.image2, 
          a.campusname, 
          COALESCE(f.faculty_name, a.facultyname) as facultyname,
          COALESCE(d.department_name, a.departmentname) as departmentname,
          COALESCE(p.program_name, a.degreetitle) as degreetitle,
          a.yearofending, 
          a.facebook, 
          a.instagram, 
          a.youtube, 
          a.linkedin, 
          a.contactno
        FROM public.tbl_alumni a
        LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
        LEFT JOIN public.tbl_departments d ON d.id = a.department
        LEFT JOIN public.tbl_programs p ON p.id = a.program
        WHERE a.sapid = ${sapid} 
        LIMIT 1`;
      return rows[0] as Profile | undefined;
    }
    
    // If admin/viewer and no sapid provided, return undefined (they need to specify sapid to view profiles)
    if (canView) {
      return undefined;
    }

    // Alumni: always load by the authenticated alumniid (never trust ?sapid=)
    if (sessionAlumniId) {
      const rows = await sql/* sql */`
        SELECT 
          a.alumniname, 
          a.image1, 
          a.image2, 
          a.campusname, 
          COALESCE(f.faculty_name, a.facultyname) as facultyname,
          COALESCE(d.department_name, a.departmentname) as departmentname,
          COALESCE(p.program_name, a.degreetitle) as degreetitle,
          a.yearofending, 
          a.facebook, 
          a.instagram, 
          a.youtube, 
          a.linkedin, 
          a.contactno
        FROM public.tbl_alumni a
        LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
        LEFT JOIN public.tbl_departments d ON d.id = a.department
        LEFT JOIN public.tbl_programs p ON p.id = a.program
        WHERE a.alumniid = ${sessionAlumniId} 
        LIMIT 1`;
      if (rows[0]) return rows[0] as Profile | undefined;
    }
    
    // First try to get SAP ID from session (if alumni logged in with SAP ID)
    // Get SAP ID or registration number from session
    const sessionSapid = session?.user ? ((session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid).trim() : undefined) : undefined;
    const sessionRegNo = session?.user ? ((session.user as { registrationno?: string | null })?.registrationno ? String((session.user as { registrationno?: string | null }).registrationno).trim() : undefined) : undefined;
    
    if (sessionSapid) {
      const rows = await sql/* sql */`
        SELECT 
          a.alumniname, 
          a.image1, 
          a.image2, 
          a.campusname, 
          COALESCE(f.faculty_name, a.facultyname) as facultyname,
          COALESCE(d.department_name, a.departmentname) as departmentname,
          COALESCE(p.program_name, a.degreetitle) as degreetitle,
          a.yearofending, 
          a.facebook, 
          a.instagram, 
          a.youtube, 
          a.linkedin, 
          a.contactno
        FROM public.tbl_alumni a
        LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
        LEFT JOIN public.tbl_departments d ON d.id = a.department
        LEFT JOIN public.tbl_programs p ON p.id = a.program
        WHERE a.sapid = ${sessionSapid} 
        LIMIT 1`;
      if (rows[0]) return rows[0] as Profile | undefined;
    }
    
    if (sessionRegNo) {
      const rows = await sql/* sql */`
        SELECT 
          a.alumniname, 
          a.image1, 
          a.image2, 
          a.campusname, 
          COALESCE(f.faculty_name, a.facultyname) as facultyname,
          COALESCE(d.department_name, a.departmentname) as departmentname,
          COALESCE(p.program_name, a.degreetitle) as degreetitle,
          a.yearofending, 
          a.facebook, 
          a.instagram, 
          a.youtube, 
          a.linkedin, 
          a.contactno
        FROM public.tbl_alumni a
        LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
        LEFT JOIN public.tbl_departments d ON d.id = a.department
        LEFT JOIN public.tbl_programs p ON p.id = a.program
        WHERE a.registrationno = ${sessionRegNo} 
        LIMIT 1`;
      if (rows[0]) return rows[0] as Profile | undefined;
    }

    return undefined;
  } catch {
    return undefined;
  }
}


type AlumniProfileSearchParams = { sapid?: string; modal?: string };


export default async function Page({ searchParams }: { searchParams: Promise<AlumniProfileSearchParams> }) {
  const session = await auth();
  
  // Redirect to signin if no session
  if (!session?.user) {
    redirect("/signin");
  }
  
  const sp = await searchParams;
  let p: Profile | undefined;
  let profileError: string | null = null;
  try {
    p = await getProfile(sp);
  } catch (e) {
    profileError = e instanceof Error ? e.message : "Failed to load profile";
  }
  const canView = canViewAlumni(session?.user); // Includes admins, superadmins, and viewers
  const isAdmin = isAdminUser(session?.user) || isSuperAdminUser(session?.user);
  const isViewer = isViewerUser(session?.user);
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
    
    // Remove old path references
    trimmedPath = trimmedPath.replace(/\/tumbnail\//g, "/");
    trimmedPath = trimmedPath.replace(/\/alumni-images\/thumbnail\//g, "/");
    trimmedPath = trimmedPath.replace(/\/alumni-images\/card\//g, "/");
    
    // If already a valid path (starts with / or http), return as-is
    if (trimmedPath.startsWith("/") || trimmedPath.startsWith("http://") || trimmedPath.startsWith("https://")) {
      return trimmedPath;
    }
    // If it's just a filename, prepend the images directory
    // Images are stored in /public/images/(imagename.extention)
    if (!trimmedPath.includes("/")) {
      return `/images/${trimmedPath}`;
    }
    // If it's a relative path without leading slash, add it
    return `/${trimmedPath}`;
  })();
  const faculty = p?.facultyname ?? "";
  const dept = p?.departmentname ?? "";
  const contact = p?.contactno ?? "";
  // Get SAP ID or registration number from session first, then (admin/viewer-only) from search params
  const sessionSapid = session?.user ? ((session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid).trim() : undefined) : undefined;
  const sessionRegNo = session?.user ? ((session.user as { registrationno?: string | null })?.registrationno ? String((session.user as { registrationno?: string | null }).registrationno).trim() : undefined) : undefined;
  const sessionAlumniId =
    session?.user && (session.user as { userId?: number | null })?.userId
      ? Number((session.user as { userId?: number | null }).userId)
      : undefined;
  const requestedSapid = canView && sp?.sapid ? String(sp.sapid).trim() : undefined;
  
  let sapRows: Array<{ alumniid: number; sapid: string }> = [];
  let sapError: string | null = null;
  
  // If admin requested a specific profile, use it
  if (requestedSapid) {
    try {
      sapRows = await sql/* sql */`
        SELECT alumniid, sapid FROM public.tbl_alumni 
        WHERE sapid = ${requestedSapid} LIMIT 1`;
    } catch (e) {
      sapError = e instanceof Error ? e.message : "Failed to load SAP ID (admin request)";
    }
  } else if (sessionAlumniId) {
    try {
      sapRows = await sql/* sql */`
        SELECT alumniid, sapid FROM public.tbl_alumni
        WHERE alumniid = ${sessionAlumniId} LIMIT 1`;
    } catch (e) {
      sapError = e instanceof Error ? e.message : "Failed to load alumni record from session";
    }
  } else if (sessionSapid) {
    // If we have SAP ID from session, use it directly
    try {
      sapRows = await sql/* sql */`
        SELECT alumniid, sapid FROM public.tbl_alumni 
        WHERE sapid = ${sessionSapid} LIMIT 1`;
    } catch (e) {
      sapError = e instanceof Error ? e.message : "Failed to load SAP ID from session";
    }
  } else if (sessionRegNo) {
    // If we have registration number from session, use it
    try {
      sapRows = await sql/* sql */`
        SELECT alumniid, sapid FROM public.tbl_alumni 
        WHERE registrationno = ${sessionRegNo} LIMIT 1`;
    } catch (e) {
      sapError = e instanceof Error ? e.message : "Failed to load SAP ID from registration number";
    }
  }
  
  // Use SAP ID if available, otherwise use registration number as identifier
  // The API endpoints support both SAP ID and registration number
  // For admins/viewers viewing a specific profile, prioritize the requested sapid from query params
  // If admin/viewer requested a specific profile but database query failed, still use requestedSapid
  // (the API will handle validation and access control)
  const sapId = String(
    (canView && requestedSapid && requestedSapid.trim()) ? requestedSapid.trim() :
    sapRows[0]?.sapid ?? 
    sessionSapid ?? 
    sessionRegNo ?? 
    ""
  ).trim();
  const alumniId = String(sapRows[0]?.alumniid ?? "");
  let cardStatus: CardStatus = "none";
  let cardStatusError: string | null = null;
let cardPicture: string | null = null;
let cardImageFile: string | null = null;
  let reasonOnhold: string | null = null;
  let cardComment: string | null = null;
  let validityDate: string | null = null;
  // Always check card status from database - don't auto-activate for admins or new users
  // New users should see "Apply" button until they actually apply for a card
  if (false) { // Disabled: was auto-setting to "active" for admins
    // This was causing new users to see active card instead of Apply button
    cardStatus = "active";
    cardStatusError = null;
  } else {
    try {
      if (sapId) {
        // Preload validation now uses sapid to check existing tblcard association
        const cr = await sql/* sql */`
          SELECT c.status, c.cardpicture, c.card_image, c.reason_onhold, c.comment, c.validity_date FROM public.tblcard c
          JOIN public.tbl_alumni a ON a.alumniid = c.alumniid
          WHERE a.sapid = ${sapId}
          ORDER BY c.cardid DESC LIMIT 1`;
        const rawStatus = cr[0]?.status ? String(cr[0].status).trim() : "";
        const upperStatus = rawStatus.toUpperCase();
        cardPicture = cr[0]?.cardpicture ?? null;
        cardImageFile = cr[0]?.card_image ?? null;
        reasonOnhold = cr[0]?.reason_onhold ?? null;
        cardComment = cr[0]?.comment ?? null;
        validityDate = cr[0]?.validity_date ? String(cr[0].validity_date) : null;
        
        // Map database statuses to CardStatus
        // Database values: "UnderReview", "UnderPrinting", "Active", "Delivered", "Onhold", "Pending" (legacy)
        if (upperStatus === "DELIVERED") {
          cardStatus = "received"; // Show as "Received" in profile
        } else if (upperStatus === "ACTIVE") {
          cardStatus = "active"; // Show as "Active" only if not delivered
        } else if (upperStatus === "PROCESS" || upperStatus === "UNDERPRINTING") {
          cardStatus = "inprocess"; // Show as "In-Process"
        } else if (upperStatus === "ONHOLD") {
          cardStatus = "onhold"; // Show as "On Hold" with reason
        } else if (upperStatus === "UNDERREVIEW" || upperStatus === "UNDER-REVIEW" || upperStatus === "PENDING" || (!rawStatus && cr[0])) {
          cardStatus = "under-review"; // Show as "Under Review"
        } else if (rawStatus === "full") {
          cardStatus = "full";
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

  // Use validity_date from database if available, otherwise calculate from yearofending (add 5 years as default validity)
  let validity: string | undefined = undefined;
  if (validityDate) {
    // Format validity_date (YYYY-MM-DD) to MM/YYYY for display
    const date = new Date(validityDate);
    if (!isNaN(date.getTime())) {
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      validity = `${month}/${year}`;
    }
  } else {
    // Fallback: Calculate validity from yearofending (add 5 years as default validity)
  const validityYear = p?.yearofending ? p.yearofending + 5 : undefined;
    validity = validityYear ? `${validityYear}-12` : undefined;
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
      // For admins/viewers, always show chapters if they exist (regardless of verification status)
      isVerified = canView || (verifyValue !== null && 
                   verifyValue !== undefined && 
                   String(verifyValue).trim().toLowerCase() !== 'pending' && 
                   String(verifyValue).trim() !== '');
      
      if (isVerified || canView) {
        // Join with tblchapters to get chapter names
        const chapterRows = await sql/* sql */`
          SELECT 
            ac."chapter1",
            ac."chapter2",
            ac."chapter3",
            COALESCE(c1.national_chapter, c1.international_chapter) as chapter1_name,
            COALESCE(c2.national_chapter, c2.international_chapter) as chapter2_name,
            COALESCE(c3.national_chapter, c3.international_chapter) as chapter3_name
          FROM public.alumni_chapter ac
          LEFT JOIN public.tblchapters c1 ON c1.id = ac."chapter1"
          LEFT JOIN public.tblchapters c2 ON c2.id = ac."chapter2"
          LEFT JOIN public.tblchapters c3 ON c3.id = ac."chapter3"
          WHERE ac.id = ${alumniId}
          LIMIT 1`;
        const chapterRec = chapterRows[0] as { 
          chapter1?: number | null; 
          chapter2?: number | null; 
          chapter3?: number | null;
          chapter1_name?: string | null;
          chapter2_name?: string | null;
          chapter3_name?: string | null;
        } | undefined;
        if (chapterRec) {
          if (chapterRec.chapter1_name) chapters.push(String(chapterRec.chapter1_name));
          if (chapterRec.chapter2_name) chapters.push(String(chapterRec.chapter2_name));
          if (chapterRec.chapter3_name) chapters.push(String(chapterRec.chapter3_name));
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

  // Fetch leadership information for alumni
  type LeadershipInfo = {
    type: "chapter" | "association" | null;
    role: string | null;
    roleDisplay: string | null;
  };
  
  let leadershipInfo: LeadershipInfo = { type: null, role: null, roleDisplay: null };
  let leadershipError: string | null = null;
  
  if (alumniId) {
    try {
      // Check for chapter leadership first
      const chapterLeadershipRows = await sql/* sql */`
        SELECT cl.post, cl.status
        FROM public.chapter_leadership cl
        INNER JOIN public.tbl_alumni a ON a.chapter_leadership = cl.id
        WHERE a.alumniid = ${alumniId} AND cl.status = 'approved'
        LIMIT 1
      `;
      
      if (chapterLeadershipRows && chapterLeadershipRows.length > 0) {
        const post = String(chapterLeadershipRows[0]?.post || "").trim();
        if (post) {
          // Map role to display name for chapter leadership
          const chapterRoleMap: Record<string, string> = {
            "President": "Chapter President",
            "Vice President": "Chapter Vice President",
            "Coordinator": "Chapter Coordinator",
          };
          
          leadershipInfo = {
            type: "chapter",
            role: post,
            roleDisplay: chapterRoleMap[post] || post,
          };
        }
      } else {
        // Check for association leadership
        const associationLeadershipRows = await sql/* sql */`
          SELECT ass.q3 as role, ass.status
          FROM public.tblalumniassociation ass
          INNER JOIN public.tbl_alumni a ON a.association_job = ass.id
          WHERE a.alumniid = ${alumniId} AND ass.status = 'approved'
          LIMIT 1
        `;
        
        if (associationLeadershipRows && associationLeadershipRows.length > 0) {
          const role = String(associationLeadershipRows[0]?.role || "").trim();
          if (role) {
            // Map role to display name
            const roleMap: Record<string, string> = {
              "President": "Association President",
              "Vice President": "Association Vice President",
              "Coordinator": "Association Coordinator",
            };
            
            leadershipInfo = {
              type: "association",
              role: role,
              roleDisplay: roleMap[role] || role,
            };
          }
        }
      }
    } catch (e) {
      leadershipError = e instanceof Error ? e.message : "Failed to load leadership information";
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
        <div className="w-full bg-slate-100 mx-auto mt-8 sm:mt-12 md:mt-16 px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10">
          <div className="flex flex-col bg-white rounded-lg md:flex-row lg:flex-row mt-8 sm:mt-10 md:-mt-16 gap-4 sm:gap-6 md:gap-8 p-3 sm:p-4 md:p-6 lg:p-8">

            <div className="w-full flex min-w-0 order-1">
                {sapId && sapId.trim() ? (
                  <ProfileDetailsClient sapId={sapId} chapters={chapters} isVerified={isVerified} chaptersError={chaptersError} associationTitle={associationTitle} associationError={associationError} leadershipInfo={leadershipInfo} leadershipError={leadershipError} />
                ) : canView ? (
                  <div className="w-full p-8 text-center">
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
                      <h3 className="text-lg font-semibold text-blue-900 mb-2">Select an Alumni Profile</h3>
                      <p className="text-blue-700 mb-4">
                        To view an alumni profile, please select a profile from the alumni list or use the URL with a SAP ID parameter.
                      </p>
                      <Link
                        href="/dashboard"
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
                    facebook={p?.facebook}
                    instagram={p?.instagram}
                    youtube={p?.youtube}
                    linkedin={p?.linkedin}
                    chapters={chapters}
                    isVerified={isVerified}
                    chaptersError={chaptersError}
                    associationTitle={associationTitle}
                    associationError={associationError}
                    leadershipInfo={leadershipInfo}
                    leadershipError={leadershipError}
                  />
                )}
                </div>
                  <div className="w-full md:w-1/3 lg:w-1/4 flex-shrink-0 pt-4 sm:pt-6 md:pt-8 lg:pt-10 mt-4 sm:mt-6 md:mt-0 order-2">
                    <div className={`shadow-sm border rounded-lg overflow-hidden text-center lg:mt-0 ${
                      cardStatus === "received" 
                        ? "bg-green-100 border-gray-100" 
                        : cardStatus === "active" 
                        ? "bg-emerald-50 border-emerald-200" 
                        : cardStatus === "under-review" 
                        ? "bg-amber-50 border-amber-200" 
                        : cardStatus === "inprocess"
                        ? "bg-blue-50 border-blue-200"
                        : cardStatus === "onhold" 
                        ? "bg-rose-50 border-rose-200" 
                        : cardStatus === "full" 
                        ? "bg-sky-50 border-sky-200" 
                        : "bg-gray-50 border-gray-200"
                    }`} aria-label="Alumni card">
                      <div className="p-4 sm:p-5 md:p-6">
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-3">
                          <h3 className={`text-lg sm:text-xl font-bold ${
                            cardStatus === "received" 
                              ? "text-green-700" 
                              : cardStatus === "active" 
                              ? "text-emerald-700" 
                              : cardStatus === "under-review" 
                              ? "text-amber-700" 
                              : cardStatus === "inprocess"
                              ? "text-blue-700"
                              : cardStatus === "onhold" 
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
                            ) : cardStatus === "received" ? (
                              <div className="inline-flex items-center gap-1 rounded-md bg-green-50 text-green-700 px-2 py-0.5 border border-green-200">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-green-600"><path className="fill-current" d="M9 16.17l-3.88-3.88L3 14.41 9 20.41 21 8.41 18.88 6.29z"/></svg>
                                <span className="text-xs">Received</span>
                              </div>
                            ) : cardStatus === "active" ? (
                              <div className="inline-flex items-center gap-1 rounded-md bg-emerald-50 text-emerald-700 px-2 py-0.5 border border-emerald-200">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-emerald-600"><path className="fill-current" d="M9 16.17l-3.88-3.88L3 14.41 9 20.41 21 8.41 18.88 6.29z"/></svg>
                                <span className="text-xs">Active</span>
                              </div>
                            ) : cardStatus === "inprocess" ? (
                              <div className="inline-flex items-center gap-1 rounded-md bg-blue-50 text-blue-700 px-2 py-0.5 border border-blue-200">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-blue-600"><path className="fill-current" d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 11H11V7h2v6zm0 4H11v-2h2v2z"/></svg>
                                <span className="text-xs">In-Process</span>
                              </div>
                            ) : cardStatus === "onhold" ? (
                              <div className="inline-flex items-center gap-1 rounded-md bg-rose-50 text-rose-700 px-2 py-0.5 border border-rose-200">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-rose-600"><path className="fill-current" d="M12 2a10 10 0 100 20 10 10 0 000-20zm3 12l-3-3-3 3 3-3-3-3 3 3 3-3-3 3 3 3z"/></svg>
                                <span className="text-xs">On Hold</span>
                              </div>
                            ) : cardStatus === "under-review" ? (
                              <div className="inline-flex items-center gap-1 rounded-md bg-amber-50 text-amber-700 px-2 py-0.5 border border-amber-200">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-amber-600"><path className="fill-current" d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 11H11V7h2v6zm0 4H11v-2h2v2z"/></svg>
                                <span className="text-xs">Under Review</span>
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
                        {cardStatus === "received" || cardStatus === "active" ? (
                          <>
                            <div className="mt-3 sm:mt-4">
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
                            {(() => {
                              // Check expiration using validity_date from database, fallback to computed validity
                              let expiryDate: Date | null = null;
                              let isExpired = false;
                              
                              if (validityDate) {
                                // Parse validity_date from database (format: YYYY-MM-DD)
                                expiryDate = new Date(validityDate);
                                expiryDate.setHours(0, 0, 0, 0);
                              } else if (validity) {
                                // Fallback to computed validity (format: "YYYY-12")
                              const [year] = validity.split("-").map(Number);
                                expiryDate = new Date(year, 11, 31); // December 31st
                                expiryDate.setHours(0, 0, 0, 0);
                              }
                              
                              if (expiryDate) {
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                                isExpired = today > expiryDate;
                              }
                              
                              const formattedExpiry = expiryDate ? expiryDate.toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              }) : "Not set";
                              
                              return (
                                <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 mb-2 sm:mb-3">
                                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                      Card Expiry Date:
                                    </span>
                                    <span className={`text-xs sm:text-sm font-semibold ${
                                      isExpired 
                                        ? "text-rose-600 dark:text-rose-400" 
                                        : "text-gray-900 dark:text-gray-100"
                                    }`}>
                                      {formattedExpiry}
                                    </span>
                                  </div>
                                  {isExpired && (
                                    <RenewCardButton
                                      alumniId={alumniId}
                                      name={name}
                                      sapId={sapId || ""}
                                      faculty={faculty}
                                      department={dept}
                                    />
                                  )}
                                </div>
                              );
                            })()}
                          </>
                        ) : (
                          <>
                            <div className="mt-3 sm:mt-4">
                              {cardStatus === "under-review" ? (
                                <p className="text-xs text-amber-700">Your application is under review.</p>
                              ) : cardStatus === "inprocess" ? (
                                <p className="text-xs text-blue-700">Your application is in process.</p>
                              ) : cardStatus === "onhold" ? (
                                <div className="text-xs text-rose-700">
                                  <p className="font-medium mb-1">Your application is on hold.</p>
                                  {reasonOnhold && (
                                    <p className="text-[10px] mt-1 italic bg-rose-50 border border-rose-200 rounded px-2 py-1">
                                      Reason: {reasonOnhold}
                                    </p>
                                  )}
                                  {cardComment && (
                                    <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded-md">
                                      <p className="font-medium text-rose-800 mb-1">Note:</p>
                                      <p className="text-rose-700">{cardComment}</p>
                                    </div>
                                  )}
                                  {!cardComment && <p className="mt-1">Please contact us for more information.</p>}
                                </div>
                              ) : cardStatus === "full" ? (
                                <p className="text-xs text-sky-700">Application capacity is currently full. Please try later.</p>
                              ) : (
                                <p className="text-xs text-gray-700 mb-2 sm:mb-3">Start your application to get your alumni card.</p>
                              )}
                            </div>
                            {cardStatus === "under-review" ? (
                            <button
                              type="button"
                              disabled
                              aria-disabled
                              className="mt-2 sm:mt-3 inline-flex items-center justify-center px-3 sm:px-4 py-2 sm:py-2.5 w-full rounded-lg text-white text-xs sm:text-sm font-medium bg-gray-300 cursor-not-allowed"
                            >
                              Under review
                            </button>
                          ) : cardStatus === "inprocess" ? (
                            <button
                              type="button"
                              disabled
                              aria-disabled
                              className="mt-2 sm:mt-3 inline-flex items-center justify-center px-3 sm:px-4 py-2 sm:py-2.5 w-full rounded-lg text-white text-xs sm:text-sm font-medium bg-gray-300 cursor-not-allowed"
                            >
                              In-Process
                            </button>
                          ) : cardStatus === "onhold" ? (
                            <div className="mt-2 sm:mt-3 space-y-2">
                              <button
                                type="button"
                                disabled
                                aria-disabled
                                className="inline-flex items-center justify-center px-3 sm:px-4 py-2 sm:py-2.5 w-full rounded-lg text-white text-xs sm:text-sm font-medium bg-gray-300 cursor-not-allowed"
                              >
                                Application on hold
                              </button>
                              <button
                                type="button"
                                className="inline-flex items-center justify-center px-3 sm:px-4 py-2 sm:py-2.5 w-full rounded-lg text-white text-xs sm:text-sm font-medium bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 transition-colors"
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
                              className="mt-2 sm:mt-3 inline-flex items-center justify-center px-3 sm:px-4 py-2 sm:py-2.5 w-full rounded-lg text-white text-xs sm:text-sm font-medium bg-gray-300 cursor-not-allowed"
                            >
                              Capacity Full
                            </button>
                          ) : cardStatus === "none" ? (
                            !isViewer && (
                            <Link
                              href={sapId ? `/alumni-profile/card?sapid=${encodeURIComponent(sapId)}` : `/alumni-profile/card`}
                              className="mt-2 sm:mt-3 inline-flex items-center justify-center px-3 sm:px-4 py-2 sm:py-2.5 w-full rounded-lg text-white text-xs sm:text-sm font-medium bg-[#183D32] hover:bg-[#0e241d] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              Apply now
                            </Link>
                            )
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
      <div className="px-3 py-6 sm:px-4 sm:py-8 md:px-6 md:py-10 lg:px-10 text-slate-900 bg-slate-100">
        <h4 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 mb-4 sm:mb-5 md:mb-6">Networking & Engagement</h4>
        <NetworkingEngagementSection
          sapId={sapId}
          mentorshipStatus={mentorshipStatus}
          mentorshipStatusError={mentorshipStatusError}
        />
      </div>



      <div className="px-3 py-6 sm:px-4 sm:py-8 md:px-6 md:py-10 lg:px-10 bg-slate-100">
        <div className="mb-4 sm:mb-6 md:mb-8">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 mb-2 sm:mb-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          Perks &amp; Benefits
            <span className="px-3 py-1 sm:px-4 sm:py-1.5 text-xs sm:text-sm rounded-full bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-800 font-semibold border-2 border-yellow-300 shadow-sm">
            Alumni card is required to avail these benefits
          </span>
        </h2>
          <p className="text-sm sm:text-base md:text-lg text-slate-600 mt-2">Explore exclusive benefits and opportunities available to UOL alumni members.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 md:gap-6">
          <BenefitCard
            title="Academic Benefits"
            description="Avail special tuition and admission discounts offered to UOL alumni."
            slug="academic-benefits"
            gradient="from-indigo-50 to-indigo-100"
            borderColor="border-indigo-200"
            iconBg="bg-indigo-100"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 fill-indigo-600" viewBox="0 0 24 24">
                <path d="M21 4H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H3V6h18v12z"/>
                <path d="M7 8h10v2H7zm0 4h7v2H7z"/>
              </svg>
            }
          />
          <BenefitCard
            title="Healthcare Benefits"
            description="Avail comprehensive health insurance and wellness programs as an alumni member."
            slug="healthcare-benefits"
            gradient="from-emerald-50 to-emerald-100"
            borderColor="border-emerald-200"
            iconBg="bg-emerald-100"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 fill-emerald-600" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            }
          />
          <BenefitCard
            title="Campus Facilities and Memberships"
            description="Enjoy access to gym, sports facilities, and exclusive campus amenities."
            slug="campus-facilities"
            gradient="from-blue-50 to-blue-100"
            borderColor="border-blue-200"
            iconBg="bg-blue-100"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 fill-blue-600" viewBox="0 0 24 24">
                <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
              </svg>
            }
          />
          <BenefitCard
            title="Merchant and Business Promotions"
            description="Exclusive partner discounts and offers available for alumni with the Alumni Card."
            slug="merchant-promotions"
            gradient="from-orange-50 to-orange-100"
            borderColor="border-orange-200"
            iconBg="bg-orange-100"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 fill-orange-600" viewBox="0 0 24 24">
                <path d="M7 18c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM1 2v2h2l3.6 7.59-1.35 2.45c-.15.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12L8.1 13h7.45c.75 0 1.41-.41 1.75-1.03L21.7 4H5.21l-.94-2H1zm16 16c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            }
          />
          <BenefitCard
            title="Career and Mentorship"
            description=" Avail exclusive career and professional development opportunities."
            slug="career-mentorship"
            gradient="from-teal-50 to-teal-100"
            borderColor="border-teal-200"
            iconBg="bg-teal-100"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 fill-teal-600" viewBox="0 0 24 24">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
              </svg>
            }
          />
          <BenefitCard
            title="Chapters & Engagement Events"
            description="You can join chapters based on their city or country to connect locally and globally."
            slug="chapters-events"
            gradient="from-rose-50 to-rose-100"
            borderColor="border-rose-200"
            iconBg="bg-rose-100"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 fill-rose-600" viewBox="0 0 24 24">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
              </svg>
            }
          />
          <BenefitCard
            title="Identity, Inclusion & Recognition"
            description=" Avail opportunities to be honored for achievements via awards and spotlights."
            slug="recognition"
            gradient="from-amber-50 to-amber-100"
            borderColor="border-amber-200"
            iconBg="bg-amber-100"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 fill-amber-600" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            }
          />
        </div>
      </div>
      
  </>
  );
}