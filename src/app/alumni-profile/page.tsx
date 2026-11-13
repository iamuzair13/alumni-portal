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
import Alert from "@/components/ui/alert/Alert";
import { computeLoginBanner, isAdminUser, isSuperAdminUser, isViewerUser } from "@/lib/alumniProfile";
import { canViewAlumni } from "@/lib/rbac";
import { type MentorshipStatus } from "./status";
import ProfileDetailsServer from "./ProfileDetailsServer";
import ProfileHero from "@/components/alumni/profile/ProfileHero";
import AlumniCardPanel from "@/components/alumni/profile/AlumniCardPanel";
import Hub from "@/components/alumni/profile/HubTabs";
import OverviewTab from "@/components/alumni/profile/tabs/OverviewTab";
import BenefitsTab from "@/components/alumni/profile/tabs/BenefitsTab";
import ProfileTab from "@/components/alumni/profile/tabs/ProfileTab";
import EngagementTab from "@/components/alumni/profile/tabs/EngagementTab";
import UpdatesTab from "@/components/alumni/profile/tabs/UpdatesTab";
import AllBenefitsTab from "@/components/alumni/profile/tabs/AllBenefitsTab";
import { Suspense } from "react";
import { Lock } from "lucide-react";
import { Notice } from "@/components/alumni/profile/hub-ui";
import KpiStrip, { type KpiValues } from "@/components/alumni/profile/KpiStrip";import ChangeApprovalNotice from "@/components/alumni/profile/ChangeApprovalNotice";
import {
  type MembershipSummary,
  type MerchantSummary,
  type ScholarshipSummary,
} from "@/components/alumni/profile/BenefitsBento";
import { formatCardValidityMonthYear, resolveAlumniCardValidityRaw } from "@/lib/cardValidity";
import { pickAlumniProfilePhotoFilename } from "@/lib/alumniProfilePhoto";
import { resolvePreferredCardImage } from "@/lib/alumniCardImage";

type Profile = {
  alumniname: string | null;
  gender: string | null;
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
  cnicpassport?: string | null;
  medal?: string | null;
};

async function getProfile(searchParams: { sapid?: string }) {
  const sapid = searchParams?.sapid ? String(searchParams.sapid) : undefined;
  try {
    const session = await auth();
    const canView = canViewAlumni(session?.user); // Includes admins, superadmins, and viewers
    const sessionAlumniId =
      session?.user && (session.user as { userId?: number | null })?.userId
        ? Number((session.user as { userId?: number | null }).userId)
        : undefined;
    
    if (sapid && canView) {
      // Admins and viewers can view profiles by SAP ID (with RBAC restrictions applied in API)
      const rows = await sql/* sql */`
        SELECT 
          a.alumniname, 
          a.gender,
          a.image1, 
          a.image2, 
          a.campusname, 
          f.faculty_name as facultyname,
          d.department_name as departmentname,
          p.program_name as degreetitle,
          a.yearofending, 
          a.facebook, 
          a.instagram, 
          a.youtube, 
          a.linkedin, 
          a.contactno,
          a.cnicpassport,
          a.medal
        FROM public.tbl_alumni a
        LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
        LEFT JOIN public.tbl_departments d ON d.id = a.department
        LEFT JOIN public.tbl_programs p ON p.id = a.program
        WHERE TRIM(COALESCE(a.sapid, '')) = ${sapid}
           OR TRIM(COALESCE(a.registrationno, '')) = ${sapid}
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
          a.gender,
          a.image1, 
          a.image2, 
          a.campusname, 
          f.faculty_name as facultyname,
          d.department_name as departmentname,
          p.program_name as degreetitle,
          a.yearofending, 
          a.facebook, 
          a.instagram, 
          a.youtube, 
          a.linkedin, 
          a.contactno,
          a.cnicpassport,
          a.medal
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
          a.gender,
          a.image1, 
          a.image2, 
          a.campusname, 
          f.faculty_name as facultyname,
          d.department_name as departmentname,
          p.program_name as degreetitle,
          a.yearofending, 
          a.facebook, 
          a.instagram, 
          a.youtube, 
          a.linkedin, 
          a.contactno,
          a.cnicpassport,
          a.medal
        FROM public.tbl_alumni a
        LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
        LEFT JOIN public.tbl_departments d ON d.id = a.department
        LEFT JOIN public.tbl_programs p ON p.id = a.program
        WHERE TRIM(COALESCE(a.sapid, '')) = ${sessionSapid}
        LIMIT 1`;
      if (rows[0]) return rows[0] as Profile | undefined;
    }
    
    if (sessionRegNo) {
      const rows = await sql/* sql */`
        SELECT 
          a.alumniname, 
          a.gender,
          a.image1, 
          a.image2, 
          a.campusname, 
          f.faculty_name as facultyname,
          d.department_name as departmentname,
          p.program_name as degreetitle,
          a.yearofending, 
          a.facebook, 
          a.instagram, 
          a.youtube, 
          a.linkedin, 
          a.contactno,
          a.cnicpassport,
          a.medal
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
  const cnicPassport = p?.cnicpassport ?? null;
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

  // Counts for individual profile cards
  let successStoryCount = 0;
  let alumniTalkCount = 0;
  let chapterMembershipCount = 0;
  if (alumniId) {
    try {
      const rows = await sql/* sql */`
        SELECT COUNT(*)::int AS count
        FROM public.tblalumnistories s
        WHERE s.alumniid = ${alumniId}
          AND s.alumnistories IS NOT NULL
          AND s.alumnistories != ''
          AND TRIM(s.alumnistories) != ''
          AND LOWER(COALESCE(s.status, 'pending')) = 'approved'
      `;
      successStoryCount = Number((rows[0] as { count?: number | string } | undefined)?.count ?? 0);
    } catch {
      successStoryCount = 0;
    }

    try {
      const rows = await sql/* sql */`
        SELECT COUNT(*)::int AS count
        FROM public.alumni_talk_sessions s
        WHERE s.alumniid = ${alumniId}
      `;
      alumniTalkCount = Number((rows[0] as { count?: number | string } | undefined)?.count ?? 0);
    } catch {
      alumniTalkCount = 0;
    }

    try {
      const rows = await sql/* sql */`
        SELECT
          (CASE WHEN ac."chapter1" IS NOT NULL THEN 1 ELSE 0 END +
           CASE WHEN ac."chapter2" IS NOT NULL THEN 1 ELSE 0 END +
           CASE WHEN ac."chapter3" IS NOT NULL THEN 1 ELSE 0 END
          )::int AS count
        FROM public.alumni_chapter ac
        WHERE ac.id = ${alumniId}
        LIMIT 1
      `;
      chapterMembershipCount = Number((rows[0] as { count?: number | string } | undefined)?.count ?? 0);
    } catch {
      chapterMembershipCount = 0;
    }
  }
  let cardStatus: CardStatus = "none";
  let cardStatusError: string | null = null;
let cardPicture: string | null = null;
let cardImageFile: string | null = null;
  let reasonOnhold: string | null = null;
  let cardComment: string | null = null;
  let validityDate: string | null = null;
  let cardDbStatusRaw: string | null = null;
  // Always check card status from database - don't auto-activate for admins or new users
  // New users should see "Apply" button until they actually apply for a card
  if (false) { // Disabled: was auto-setting to "active" for admins
    // This was causing new users to see active card instead of Apply button
    cardStatus = "active";
    cardStatusError = null;
  } else {
    try {
      if (sapId) {
        // Preload validation now uses sapid/registrationno to check existing tblcard association
        const cr = await sql/* sql */`
          SELECT c.status, c.cardpicture, c.card_image, c.reason_onhold, c.comment, c.validity_date, a.image1 AS alumni_image1, a.image2 AS alumni_image2 FROM public.tblcard c
          JOIN public.tbl_alumni a ON a.alumniid = c.alumniid
          WHERE TRIM(COALESCE(a.sapid, '')) = ${sapId}
             OR TRIM(COALESCE(a.registrationno, '')) = ${sapId}
          ORDER BY c.cardid DESC LIMIT 1`;
        const rawStatus = cr[0]?.status ? String(cr[0].status).trim() : "";
        const upperStatus = rawStatus.toUpperCase();
        cardPicture = resolvePreferredCardImage({
          cardPicture: cr[0]?.cardpicture ?? null,
          cardImage: cr[0]?.card_image ?? null,
          alumniImage2: (cr[0] as { alumni_image2?: string | null } | undefined)?.alumni_image2 ?? null,
          alumniImage1: (cr[0] as { alumni_image1?: string | null } | undefined)?.alumni_image1 ?? null,
        });
        cardImageFile = cardPicture;
        reasonOnhold = cr[0]?.reason_onhold ?? null;
        cardComment = cr[0]?.comment ?? null;
        validityDate = cr[0]?.validity_date ? String(cr[0].validity_date) : null;
        cardDbStatusRaw = cr[0]?.status ? String(cr[0].status).trim() : null;
        
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
        } else if (cr[0]) {
          // Unknown status but card record exists - treat as under review
          cardStatus = "under-review";
        } else {
          // No record found - no application
          cardStatus = "none";
        }
      }
    } catch (e) {
      cardStatusError = e instanceof Error ? e.message : "Failed to load card status";
    }
  }

  // Card template profile slot: latest alumni photo (tbl_alumni.image2, then image1)
  const profileImageFilename = pickAlumniProfilePhotoFilename(p?.image2, p?.image1) ?? undefined;
  const cardTemplateImageFilename = (() => {
    const raw = (cardImageFile ?? cardPicture) ?? null;
    if (raw && raw.trim() && raw.trim().toLowerCase() !== "null") {
      return raw.trim();
    }
    return undefined;
  })();

  // Delivered cards use stored `validity_date` when present; all other application statuses use policy expiry (May 2029).
  let validity: string | undefined = undefined;
  if (cardDbStatusRaw) {
    validity = formatCardValidityMonthYear(
      resolveAlumniCardValidityRaw({ status: cardDbStatusRaw, validityDate })
    );
  } else if (validityDate) {
    validity = formatCardValidityMonthYear(validityDate);
  } else {
    const validityYear = p?.yearofending ? p.yearofending + 5 : undefined;
    validity = validityYear ? `${validityYear}-12` : undefined;
  }
  // Mentorship application status for alumni users
  let mentorshipStatus: MentorshipStatus = "none";
  let mentorshipStatusError: string | null = null;
  if (!isAdmin) {
    try {
      if (alumniId) {
        const srows = await sql/* sql */`
          SELECT status FROM public.alumni_talk_sessions WHERE alumniid = ${alumniId} ORDER BY created_at DESC`;
        const statuses = (srows as unknown as Array<{ status?: string | null }>).map((r) => String(r.status ?? "").toLowerCase().trim());
        if (statuses.length === 0) {
          mentorshipStatus = "none";
        } else if (statuses.includes("conducted")) {
          mentorshipStatus = "conducted";
        } else {
          mentorshipStatus = "applied";
        }
      }
    } catch (e) {
      mentorshipStatusError = e instanceof Error ? e.message : "Failed to load mentorship status";
    }
  }

  if (typeof alumniTalkCount === "number" && alumniTalkCount <= 0) {
    mentorshipStatus = "none";
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
        // Fetch chapter IDs then resolve chapter names from tblchapters
        const chapterRows = await sql/* sql */`
          SELECT ac."chapter1", ac."chapter2", ac."chapter3"
          FROM public.alumni_chapter ac
          WHERE ac.id = ${alumniId}
          LIMIT 1
        `;

        const chapterRec = chapterRows[0] as {
          chapter1?: number | string | null;
          chapter2?: number | string | null;
          chapter3?: number | string | null;
        } | undefined;

        const chapterIds: number[] = [];
        const seenIds = new Set<number>();
        if (chapterRec) {
          [chapterRec.chapter1, chapterRec.chapter2, chapterRec.chapter3].forEach((ch) => {
            if (ch === null || ch === undefined) return;
            const chapterId = typeof ch === "number" ? ch : (typeof ch === "string" ? parseFloat(ch) : Number(ch));
            if (Number.isFinite(chapterId) && chapterId > 0) {
              const intId = Math.floor(chapterId);
              if (!seenIds.has(intId)) {
                seenIds.add(intId);
                chapterIds.push(intId);
              }
            }
          });
        }

        if (chapterIds.length > 0) {
          const chapterNameRows = await sql/* sql */`
            SELECT id, COALESCE(national_chapter, international_chapter) as chapter_name
            FROM public.tblchapters
            WHERE id = ANY(${chapterIds})
          `;
          const nameMap = new Map<number, string>();
          (chapterNameRows as unknown as Array<{ id: number; chapter_name: string | null }>).forEach((r) => {
            const nm = String(r.chapter_name ?? "").trim();
            if (nm) nameMap.set(Number(r.id), nm);
          });
          chapterIds.forEach((id) => {
            const nm = nameMap.get(id);
            if (nm) chapters.push(nm);
          });
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
        SELECT a.faculty_name AS title
        FROM public.tbl_faculties a
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
  let leadershipGovernanceHtml: string | null = null;
  
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
          leadershipInfo = {
            type: "chapter",
            role: post,
            roleDisplay: post,
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
            leadershipInfo = {
              type: "association",
              role: role,
              roleDisplay: role,
            };
          }
        }
      }
    } catch (e) {
      leadershipError = e instanceof Error ? e.message : "Failed to load leadership information";
    }
  }

  const mapLeadershipRoleToRoleName = (rawRole: string): "president" | "vice_president" | "coordinator" | null => {
    const s = String(rawRole || "").trim().toLowerCase();
    if (!s) return null;
    if (s.includes("vice")) return "vice_president";
    if (s.includes("coordinator")) return "coordinator";
    if (s.includes("president")) return "president";
    return null;
  };

  if (leadershipInfo.type && leadershipInfo.roleDisplay) {
    try {
      const roleName = mapLeadershipRoleToRoleName(leadershipInfo.roleDisplay);
      if (roleName) {
        const governanceRows = await sql/* sql */`
          SELECT office_term_governance_html
          FROM public.leadership_roles
          WHERE leadership_type = ${leadershipInfo.type}
            AND role_name = ${roleName}
          LIMIT 1
        `;
        const governanceRec = governanceRows?.[0] as { office_term_governance_html?: string | null } | undefined;
        const html = String(governanceRec?.office_term_governance_html ?? "").trim();
        leadershipGovernanceHtml = html ? html : null;
      }
    } catch {
      leadershipGovernanceHtml = null;
    }
  }

  // Benefit summaries for the bento grid — three independent aggregates run in
  // parallel; each degrades to an empty summary on error so the page never
  // fails because a benefit count could not be computed.
  let scholarshipSummary: ScholarshipSummary = { count: 0, approved: 0, pending: 0, maxDiscountPct: null };
  let membershipSummary: MembershipSummary = { count: 0, approved: 0, pending: 0, facilities: [] };
  let merchantSummary: MerchantSummary = { count: 0, maxPct: 0, topNames: [] };
  if (alumniId) {
    await Promise.all([
      (async () => {
        try {
          const rows = await sql/* sql */`
            SELECT
              COUNT(*)::int AS count,
              COUNT(*) FILTER (WHERE LOWER(COALESCE(s.status, 'pending')) = 'approved')::int AS approved,
              COUNT(*) FILTER (WHERE LOWER(COALESCE(s.status, 'pending')) IN ('pending', 'under-review', 'under_review'))::int AS pending,
              MAX(s.applied_discount_percent)::float AS max_discount
            FROM public.alumni_scholarships s
            WHERE s.alumniid = ${alumniId}
          `;
          const r = rows[0] as { count?: number; approved?: number; pending?: number; max_discount?: number | null } | undefined;
          if (r) {
            scholarshipSummary = {
              count: Number(r.count ?? 0),
              approved: Number(r.approved ?? 0),
              pending: Number(r.pending ?? 0),
              maxDiscountPct: typeof r.max_discount === "number" && Number.isFinite(r.max_discount) ? r.max_discount : null,
            };
          }
        } catch {
          // keep default summary
        }
      })(),
      (async () => {
        try {
          const rows = await sql/* sql */`
            SELECT
              COUNT(*)::int AS count,
              COUNT(*) FILTER (WHERE LOWER(COALESCE(am.status, 'pending')) = 'approved')::int AS approved,
              COUNT(*) FILTER (WHERE LOWER(COALESCE(am.status, 'pending')) IN ('pending', 'under-review', 'under_review'))::int AS pending,
              ARRAY_AGG(DISTINCT am.facility_type) FILTER (WHERE am.facility_type IS NOT NULL) AS facilities
            FROM public.alumni_memberships am
            WHERE am.alumniid = ${alumniId}
          `;
          const r = rows[0] as { count?: number; approved?: number; pending?: number; facilities?: string[] | null } | undefined;
          if (r) {
            membershipSummary = {
              count: Number(r.count ?? 0),
              approved: Number(r.approved ?? 0),
              pending: Number(r.pending ?? 0),
              facilities: Array.isArray(r.facilities) ? r.facilities.filter((f): f is string => !!f) : [],
            };
          }
        } catch {
          // keep default summary
        }
      })(),
      (async () => {
        try {
          const rows = await sql/* sql */`
            SELECT
              COUNT(*)::int AS count,
              MAX(m.discount_pct)::float AS max_pct,
              (ARRAY_AGG(m.business_name ORDER BY m.discount_pct DESC))[1:3] AS top_names
            FROM public.merchants m
            WHERE m.status = 'active'
              AND (m.end_date IS NULL OR m.end_date >= CURRENT_DATE)
          `;
          const r = rows[0] as { count?: number; max_pct?: number | null; top_names?: string[] | null } | undefined;
          if (r) {
            merchantSummary = {
              count: Number(r.count ?? 0),
              maxPct: typeof r.max_pct === "number" && Number.isFinite(r.max_pct) ? Math.round(r.max_pct) : 0,
              topNames: Array.isArray(r.top_names) ? r.top_names.filter((n): n is string => !!n) : [],
            };
          }
        } catch {
          // keep default summary
        }
      })(),
    ]);
  }

  // Global portal KPI counts for the strip at the top of the hub. Same
  // aggregate style as the bento summaries — each query degrades
  // independently so one failure cannot blank the strip.
  let kpiValues: KpiValues = {
    verified: null,
    medalists: null,
    cards: null,
    scholarships: null,
    memberships: null,
    leaderships: null,
    merchants: null,
  };
  if (alumniId) {
    await Promise.all([
      (async () => {
        try {
          const rows = await sql/* sql */`
            SELECT
              COUNT(*) FILTER (WHERE LOWER(COALESCE(verify, '')) = 'true')::int AS verified,
              COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(medal, ''))) IN ('gold medalist', 'silver medalist', 'bronze medalist'))::int AS medalists
            FROM public.tbl_alumni`;
          const r = rows[0] as { verified?: number; medalists?: number } | undefined;
          kpiValues.verified = Number(r?.verified ?? 0);
          kpiValues.medalists = Number(r?.medalists ?? 0);
        } catch {
          // keep null
        }
      })(),
      (async () => {
        try {
          const rows = await sql/* sql */`
            SELECT COUNT(*)::int AS c FROM public.tblcard
            WHERE UPPER(TRIM(COALESCE(status, ''))) IN ('ACTIVE', 'DELIVERED')`;
          kpiValues.cards = Number((rows[0] as { c?: number } | undefined)?.c ?? 0);
        } catch {
          // keep null
        }
      })(),
      (async () => {
        try {
          const rows = await sql/* sql */`
            SELECT COUNT(*)::int AS c FROM public.alumni_scholarships
            WHERE LOWER(COALESCE(status, 'pending')) = 'approved'`;
          kpiValues.scholarships = Number((rows[0] as { c?: number } | undefined)?.c ?? 0);
        } catch {
          // keep null
        }
      })(),
      (async () => {
        try {
          const rows = await sql/* sql */`
            SELECT COUNT(*)::int AS c FROM public.alumni_memberships`;
          kpiValues.memberships = Number((rows[0] as { c?: number } | undefined)?.c ?? 0);
        } catch {
          // keep null
        }
      })(),
      (async () => {
        try {
          const rows = await sql/* sql */`
            SELECT
              (SELECT COUNT(*)::int FROM public.chapter_leadership)
              + (SELECT COUNT(*)::int FROM public.tblalumniassociation) AS c`;
          kpiValues.leaderships = Number((rows[0] as { c?: number } | undefined)?.c ?? 0);
        } catch {
          // keep null
        }
      })(),
    ]);
    kpiValues.merchants = merchantSummary.count;
  }

  const cardIssued = cardStatus === "active" || cardStatus === "received";
  const hubTabs = [
    { key: "overview", label: "Overview" },
    { key: "benefits", label: "Benefits" },
    { key: "profile", label: "Profile" },
    { key: "engagement", label: "Engagement" },
    { key: "updates", label: "Updates" },
    { key: "all-benefits", label: "All Benefits" },
  ];
  const encSapId = encodeURIComponent(sapId || "");
  const profileTabHref = sapId
    ? `/alumni-profile?sapid=${encSapId}&tab=profile`
    : "/alumni-profile?tab=profile";

  return (
    <>
    <div className="bg-gray-100 overflow-x-hidden dark:bg-gray-950">
      
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
      {sapId ? (
        <section className="w-full max-w-7xl mx-auto mt-5 sm:mt-7 px-3 sm:px-4 md:px-6 lg:px-8 pb-10" aria-label="Alumni profile hub">
          <ProfileHero
            name={name}
            avatar={avatar}
            sapId={sapId}
            memberId={sapId || (alumniId ? `UOL-AL-${alumniId}` : "")}
            program={p?.degreetitle ?? ""}
            department={dept}
            faculty={faculty}
            graduationYear={p?.yearofending ?? null}
            campus={p?.campusname ?? null}
            isVerified={isVerified}
            cardStatus={cardStatus}
            cardValidity={validity}
            leadershipRole={leadershipInfo.roleDisplay}
            chapters={chapters}
            associationTitle={associationTitle}
            socials={{
              facebook: p?.facebook,
              instagram: p?.instagram,
              linkedin: p?.linkedin,
              youtube: p?.youtube,
            }}
            profileTabHref={profileTabHref}
            isViewer={isViewer}
            cardPanel={
              <AlumniCardPanel
                cardStatus={cardStatus}
                cardStatusError={cardStatusError ?? null}
                reasonOnhold={reasonOnhold ?? null}
                cardComment={cardComment ?? null}
                name={name}
                department={dept}
                faculty={faculty}
                campus={p?.campusname ?? null}
                passingYear={p?.yearofending ?? null}
                sapId={sapId || ""}
                alumniId={alumniId}
                gender={p?.gender ?? null}
                cnicPassport={cnicPassport}
                validity={validity ?? ""}
                validityDate={validityDate ?? null}
                photoUrl={profileImageFilename ?? null}
                initialCardImage={cardTemplateImageFilename ?? null}
                medal={p?.medal ?? null}
                isViewer={isViewer}
              />
            }
          />
          <div className="mt-4">
            <KpiStrip data={kpiValues} />
          </div>
          <div className="mt-2 flex flex-col gap-2">
            {cardStatus === "none" && !isViewer && (
              <Notice variant="warning" icon={<Lock />}>
                Alumni card is required to avail these benefits.
              </Notice>
            )}
            <ChangeApprovalNotice sapId={sapId} />
          </div>
          <div className="mt-5">
            <Suspense fallback={null}>
              <Hub
                tabs={hubTabs}
                panels={{
                  overview: (
                    <OverviewTab
                      sapId={sapId}
                      cardStatus={cardStatus}
                      cardValidity={validity}
                      cardIssued={cardIssued}
                      isViewer={isViewer}
                      scholarships={scholarshipSummary}
                      memberships={membershipSummary}
                      merchants={merchantSummary}
                      chapters={chapters}
                      engagement={{
                        stories: successStoryCount,
                        talks: alumniTalkCount,
                        mentorship: mentorshipStatus,
                        leadershipRole: leadershipInfo.roleDisplay,
                      }}
                    />
                  ),
                  benefits: <BenefitsTab sapId={sapId} />,
                  profile: (
                    <ProfileTab
                      sapId={sapId}
                      chapters={chapters}
                      isVerified={isVerified}
                      chaptersError={chaptersError}
                      associationTitle={associationTitle}
                      associationError={associationError}
                      leadershipInfo={leadershipInfo}
                      leadershipError={leadershipError}
                      leadershipGovernanceHtml={leadershipGovernanceHtml}
                    />
                  ),
                  engagement: (
                    <EngagementTab
                      sapId={sapId}
                      mentorshipStatus={mentorshipStatus}
                      mentorshipStatusError={mentorshipStatusError}
                      successStoryCount={successStoryCount}
                      alumniTalkCount={alumniTalkCount}
                      chapterMembershipCount={chapterMembershipCount}
                      associationTitle={associationTitle}
                    />
                  ),
                  updates: <UpdatesTab />,
                  "all-benefits": (
                    <AllBenefitsTab
                      sapId={sapId}
                      cardStatus={cardStatus}
                      scholarshipsTotal={scholarshipSummary.count}
                      membershipsTotal={membershipSummary.count}
                      merchantsActive={merchantSummary.count}
                      chaptersCount={chapters.length}
                      storiesCount={successStoryCount}
                      talksCount={alumniTalkCount}
                    />
                  ),
                }}
              />
            </Suspense>
          </div>
        </section>
      ) : null}

      {!sapId && canView ? (
        <section className="w-full max-w-7xl mx-auto mt-5 sm:mt-7 px-3 sm:px-4 md:px-6 lg:px-8 pb-10" aria-label="Select alumni profile">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 text-center dark:border-blue-900 dark:bg-blue-950/40">
            <h3 className="text-lg font-semibold text-blue-900 mb-2 dark:text-blue-200">Select an Alumni Profile</h3>
            <p className="text-blue-700 mb-4 dark:text-blue-300">To view an alumni profile, please select a profile from the alumni list or use the URL with a SAP ID parameter.</p>
            <Link href="/dashboard" className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Go to Alumni List</Link>
          </div>
        </section>
      ) : !sapId ? (
        <section className="w-full max-w-7xl mx-auto mt-5 sm:mt-7 px-3 sm:px-4 md:px-6 lg:px-8 pb-10" aria-label="Alumni profile details">
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
            leadershipGovernanceHtml={leadershipGovernanceHtml}
          />
        </section>
      ) : null}
    </div>
      
  </>
  );
}