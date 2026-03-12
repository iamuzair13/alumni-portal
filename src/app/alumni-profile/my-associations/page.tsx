export const dynamic = "force-dynamic";
import type { Viewport } from "next";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/layout/AppHeader";
import Alert from "@/components/ui/alert/Alert";
import { computeLoginBanner } from "@/lib/alumniProfile";
import BackButton from "@/components/ui/BackButton";
import PageBanner from "@/components/ui/PageBanner";
import Link from "next/link";

type Association = {
  id: number;
  title: string;
  description: string | null;
  dean: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
};

type AlumniProfileSearchParams = { sapid?: string };

async function getAlumniAssociation(searchParams: AlumniProfileSearchParams) {
  const sapid = searchParams?.sapid ? String(searchParams.sapid) : undefined;
  try {
    const session = await auth();
    
    // Get SAP ID from session first, then from search params
    const sessionSapid = session?.user ? ((session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid).trim() : undefined) : undefined;
    const sessionRegNo = session?.user ? ((session.user as { registrationno?: string | null })?.registrationno ? String((session.user as { registrationno?: string | null }).registrationno).trim() : undefined) : undefined;
    const sessionUserId = session?.user ? Number((session.user as { userId?: number | null }).userId) : NaN;
    const email = session?.user?.email ? String(session.user.email) : undefined;
    
    let alumniId: number | null = null;
    
    // Get alumni ID
    if (Number.isFinite(sessionUserId) && sessionUserId > 0) {
      alumniId = sessionUserId;
    } else if (sapid || sessionSapid || sessionRegNo) {
      const idToUse = (sapid || sessionSapid || sessionRegNo) as string;
      const rows = await sql/* sql */`
        SELECT alumniid FROM public.tbl_alumni
        WHERE sapid = ${idToUse}
           OR registrationno = ${idToUse}
        LIMIT 1`;
      if (rows[0]) {
        alumniId = rows[0].alumniid;
      }
    } else if (email) {
      if (!email.includes("@")) {
        return { association: null, error: null };
      }
      const rows = await sql/* sql */`
        SELECT alumniid FROM public.tbl_alumni 
        WHERE personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email}
        ORDER BY alumniid DESC LIMIT 1`;
      if (rows[0]) {
        alumniId = rows[0].alumniid;
      }
    }
    
    if (!alumniId) {
      return { association: null, error: null };
    }
    
    // Get user's association from tbl_alumni
    const associationRows = await sql/* sql */`
      SELECT 
        a.association_id,
        assoc.title,
        assoc.description,
        assoc.dean,
        assoc.phone,
        assoc.email,
        assoc.address
      FROM public.tbl_alumni a
      LEFT JOIN public.tbl_associations assoc ON assoc.id = a.association_id
      WHERE a.alumniid = ${alumniId}
      LIMIT 1`;
    
    if (associationRows.length === 0 || !associationRows[0].association_id) {
      return { association: null, error: null };
    }
    
    const association: Association = {
      id: Number(associationRows[0].association_id),
      title: String(associationRows[0].title || ""),
      description: associationRows[0].description ? String(associationRows[0].description) : null,
      dean: associationRows[0].dean ? String(associationRows[0].dean) : null,
      phone: associationRows[0].phone ? String(associationRows[0].phone) : null,
      email: associationRows[0].email ? String(associationRows[0].email) : null,
      address: associationRows[0].address ? String(associationRows[0].address) : null,
    };
    
    return { association, error: null };
  } catch (e) {
    return { 
      association: null, 
      error: e instanceof Error ? e.message : "Failed to load association" 
    };
  }
}

export default async function MyAssociationsPage({ searchParams }: { searchParams: Promise<AlumniProfileSearchParams> }) {
  const session = await auth();
  
  // Redirect to signin if no session
  if (!session?.user) {
    redirect("/signin");
  }
  
  const sp = await searchParams;
  const { association, error } = await getAlumniAssociation(sp);
  
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
            <Alert variant="error" title="Error Loading Association" message={error} />
          </div>
        )}
        <PageBanner title="My Association" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <BackButton />
                <h1 className="text-3xl font-bold text-slate-900">My Association</h1>
              </div>
            </div>

            {!association ? (
              <div className="text-center py-12">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-16 h-16 mx-auto text-gray-400 mb-4 fill-current">
                  <path d="M12 2L2 7v10h2v-2h2v2h2v-2h2v2h2v-2h2v2h2v-2h2v2h2V7L12 2zm0 2.5l6 2.5v2h-2V9h-2v2h-2V9h-2v2h-2V9H8v2H6V9H4v-2l6-2.5zM4 11h2v2H4v-2zm4 0h2v2H8v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z"/>
                </svg>
                <p className="text-gray-600 text-lg">You are not currently a member of any association.</p>
                <p className="text-gray-500 text-sm mt-2">
                  Join an association to connect with alumni from your faculty or department!
                </p>
                <Link 
                  href={sapId ? `/alumni-profile/association-membership?sapid=${encodeURIComponent(sapId)}` : `/alumni-profile/association-membership`}
                  className="mt-6 inline-flex items-center px-6 py-3 rounded-lg bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 transition-colors"
                >
                  Join an Association
                </Link>
              </div>
            ) : (
              <>
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl shadow-md border border-orange-200 overflow-hidden">
                  <div className="p-6 md:p-8">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">{association.title}</h2>
                        {association.description && (
                          <p className="text-gray-700 leading-relaxed mb-4">{association.description}</p>
                        )}
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-12 h-12 text-orange-600 fill-current flex-shrink-0 ml-4">
                        <path d="M12 2L2 7v10h2v-2h2v2h2v-2h2v2h2v-2h2v2h2v-2h2v2h2V7L12 2zm0 2.5l6 2.5v2h-2V9h-2v2h-2V9h-2v2h-2V9H8v2H6V9H4v-2l6-2.5zM4 11h2v2H4v-2zm4 0h2v2H8v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z"/>
                      </svg>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                      {association.dean && (
                        <div className="flex items-start gap-3">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5 text-gray-600 fill-current flex-shrink-0 mt-0.5">
                            <path d="M12 2a5 5 0 100 10 5 5 0 000-10zm0 12c-4.42 0-8 1.79-8 4v2h16v-2c0-2.21-3.58-4-8-4z"/>
                          </svg>
                          <div>
                            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Dean</p>
                            <p className="text-sm text-gray-900 font-medium">{association.dean}</p>
                          </div>
                        </div>
                      )}
                      
                      {association.email && (
                        <div className="flex items-start gap-3">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5 text-gray-600 fill-current flex-shrink-0 mt-0.5">
                            <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                          </svg>
                          <div>
                            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Email</p>
                            <a href={`mailto:${association.email}`} className="text-sm text-blue-600 hover:underline">{association.email}</a>
                          </div>
                        </div>
                      )}
                      
                      {association.phone && (
                        <div className="flex items-start gap-3">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5 text-gray-600 fill-current flex-shrink-0 mt-0.5">
                            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                          </svg>
                          <div>
                            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Phone</p>
                            <a href={`tel:${association.phone}`} className="text-sm text-blue-600 hover:underline">{association.phone}</a>
                          </div>
                        </div>
                      )}
                      
                      {association.address && (
                        <div className="flex items-start gap-3">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5 text-gray-600 fill-current flex-shrink-0 mt-0.5">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/>
                          </svg>
                          <div>
                            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Address</p>
                            <p className="text-sm text-gray-900">{association.address}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 pt-8 border-t border-gray-200">
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link
                      href={sapId ? `/alumni-profile/association-leadership?sapid=${encodeURIComponent(sapId)}` : `/alumni-profile/association-leadership`}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                      Apply for Leadership
                    </Link>
                    <Link
                      href={sapId ? `/alumni-profile/association-membership?sapid=${encodeURIComponent(sapId)}` : `/alumni-profile/association-membership`}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                      </svg>
                      Change Association
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

