export const dynamic = "force-dynamic";
import type { Viewport } from "next";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import AppHeader from "@/layout/AppHeader";
import Alert from "@/components/ui/alert/Alert";
import { computeLoginBanner } from "@/lib/alumniProfile";
import BackButton from "@/components/ui/BackButton";
import PageBanner from "@/components/ui/PageBanner";
import Link from "next/link";
import ChapterCard from "./ChapterCard";

type Chapter = {
  id: number;
  national_chapter: string | null;
  international_chapter: string | null;
  chapter_image: string | null;
  description: string | null;
  chapter_whatsapp: string | null;
  is_active: boolean | null;
};

type AlumniProfileSearchParams = { sapid?: string };

async function getAlumniChapters(searchParams: AlumniProfileSearchParams) {
  const sapid = searchParams?.sapid ? String(searchParams.sapid) : undefined;
  try {
    const session = await auth();
    
    // Get SAP ID from session first, then from search params
    const sessionSapid = session?.user ? ((session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid).trim() : undefined) : undefined;
    const email = session?.user?.email ? String(session.user.email) : undefined;
    
    let alumniId: number | null = null;
    
    // Get alumni ID
    if (sapid || sessionSapid) {
      const sapIdToUse = sapid || sessionSapid;
      if (sapIdToUse) {
        const rows = await sql/* sql */`
          SELECT alumniid FROM public.tbl_alumni 
          WHERE sapid = ${sapIdToUse} 
          LIMIT 1`;
        if (rows[0]) {
          alumniId = rows[0].alumniid;
        }
      }
    } else if (email) {
      const rows = await sql/* sql */`
        SELECT alumniid FROM public.tbl_alumni 
        WHERE personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email}
        ORDER BY alumniid DESC LIMIT 1`;
      if (rows[0]) {
        alumniId = rows[0].alumniid;
      }
    }
    
    if (!alumniId) {
      return { chapters: [], error: null };
    }
    
    // Get user's chapters from alumni_chapter table (now stores chapter IDs)
    const chapterRows = await sql/* sql */`
      SELECT "chapter1", "chapter2", "chapter3"
      FROM public.alumni_chapter
      WHERE id = ${alumniId}
      LIMIT 1`;
    
    const chapterRec = chapterRows[0] as { chapter1?: number | null; chapter2?: number | null; chapter3?: number | null } | undefined;
    
    if (!chapterRec) {
      return { chapters: [], error: null };
    }
    
    // Collect unique chapter IDs (handle both numeric and string types)
    const chapterIds: number[] = [];
    const seen = new Set<number>();
    
    [chapterRec.chapter1, chapterRec.chapter2, chapterRec.chapter3].forEach(ch => {
      if (ch !== null && ch !== undefined) {
        // Convert to number if it's a string
        const chapterId = typeof ch === 'number' ? ch : (typeof ch === 'string' ? parseFloat(ch) : Number(ch));
        if (!isNaN(chapterId) && chapterId > 0 && !seen.has(chapterId)) {
          seen.add(chapterId);
          chapterIds.push(chapterId);
        }
      }
    });
    
    if (chapterIds.length === 0) {
      return { chapters: [], error: null };
    }
    
    // Fetch chapter details from tblchapters using IDs
    type ChapterRow = {
      id: number;
      national_chapter: string | null;
      international_chapter: string | null;
      chapter_image: string | null;
      description: string | null;
      chapter_whatsapp: string | null;
      is_active: boolean | null;
    };
    
    // Build query with IN clause - handle empty array case
    let chapterDetails: ChapterRow[] = [];
    if (chapterIds.length > 0) {
      // The postgres library handles arrays automatically when passed directly
      // Convert numeric IDs to integers to match the id column type
      const intIds = chapterIds.map(id => Math.floor(id));
      chapterDetails = await sql<ChapterRow[]>/* sql */`
      SELECT id, national_chapter, international_chapter, chapter_image, description, chapter_whatsapp, is_active
      FROM public.tblchapters
        WHERE id = ANY(${intIds})
      ORDER BY COALESCE(national_chapter, international_chapter)
    `;
    }
    
    // Build chapters array from fetched details
    const chapters: Chapter[] = chapterDetails.map((ch) => ({
      id: ch.id,
      national_chapter: ch.national_chapter,
      international_chapter: ch.international_chapter,
      chapter_image: ch.chapter_image,
      description: ch.description,
      chapter_whatsapp: ch.chapter_whatsapp,
      is_active: ch.is_active,
    }));
    
    // Sort: national chapters first, then international
    chapters.sort((a, b) => {
      const aIsNational = !!a.national_chapter;
      const bIsNational = !!b.national_chapter;
      if (aIsNational && !bIsNational) return -1;
      if (!aIsNational && bIsNational) return 1;
      return 0;
    });
    
    return { chapters, error: null };
  } catch (e) {
    return { 
      chapters: [], 
      error: e instanceof Error ? e.message : "Failed to load chapters" 
    };
  }
}

export default async function MyChaptersPage({ searchParams }: { searchParams: Promise<AlumniProfileSearchParams> }) {
  const sp = await searchParams;
  const session = await auth();
  const { chapters, error } = await getAlumniChapters(sp);
  
  // Get SAP ID for the apply button link
  const sessionSapid = session?.user ? ((session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid).trim() : undefined) : undefined;
  const sapId = sp?.sapid || sessionSapid;

  return (
    <>
      <div className="bg-slate-100 overflow-x-hidden min-h-screen">
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
        {error && (
          <div className="mt-4">
            <Alert variant="error" title="Error Loading Chapters" message={error} />
          </div>
        )}
        <PageBanner title="My Chapters" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <BackButton />
                <h1 className="text-3xl font-bold text-slate-900">My Alumni Chapters</h1>
              </div>
            </div>

            {chapters.length === 0 ? (
              <div className="text-center py-12">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-16 h-16 mx-auto text-gray-400 mb-4">
                  <path className="fill-current" d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 9a7 7 0 0114 0H5zm14.5-9.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM3.5 11.5a2.5 2.5 0 115 0 2.5 2.5 0 01-5 0zM22 21h-3.5a5.5 5.5 0 00-3.9-5.2 6.97 6.97 0 013.4-.8A4.5 4.5 0 0122 19.5V21zM5.5 21H2v-1.5A4.5 4.5 0 016.6 15a6.97 6.97 0 013.4.8A5.5 5.5 0 005.5 21z"/>
                </svg>
                <p className="text-gray-600 text-lg">You are not currently a member of any alumni chapter.</p>
                <p className="text-gray-500 text-sm mt-2">
                  Join a chapter to connect with other alumni in your area!
                </p>
                <Link 
                  href={sapId ? `/alumni-profile/chapters?sapid=${encodeURIComponent(sapId)}` : `/alumni-profile/chapters`}
                  className="mt-6 inline-flex items-center px-6 py-3 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  Apply for Chapters
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {chapters.map((chapter, index) => (
                    <ChapterCard key={chapter.id || `chapter-${index}`} chapter={chapter} />
                  ))}
                </div>
                
                <div className="mt-8 pt-8 border-t border-gray-200">
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link
                      href={sapId ? `/alumni-profile/chapter-leadership?sapid=${encodeURIComponent(sapId)}` : `/alumni-profile/chapter-leadership`}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                      </svg>
                      Apply for Leadership
                    </Link>
                  <Link
                    href={sapId ? `/alumni-profile/chapters?sapid=${encodeURIComponent(sapId)}` : `/alumni-profile/chapters`}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
                    </svg>
                    Apply to Other Chapters
                  </Link>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

