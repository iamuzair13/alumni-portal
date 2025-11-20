export const dynamic = "force-dynamic";
import type { Viewport } from "next";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

import MentorshipForm from "@/components/forms/MentorshipForm";
import { auth } from "@/lib/auth";
import AppHeader from "@/layout/AppHeader";
import Alert from "@/components/ui/alert/Alert";
import { computeLoginBanner } from "@/lib/alumniProfile";
import { sql } from "@/lib/dbconnect";
import BackButton from "@/components/ui/BackButton";

type AlumniProfileSearchParams = { sapid?: string };

async function getSapId(searchParams: { sapid?: string }) {
  const sapid = searchParams?.sapid ? String(searchParams.sapid) : undefined;
  if (sapid) return sapid;
  const session = await auth();
  const email = session?.user?.email ? String(session.user.email) : undefined;
  if (!email) return "";
  try {
    const sapRows = await sql/* sql */`
      SELECT sapid FROM public.tbl_alumni 
      WHERE personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email}
      ORDER BY alumniid DESC LIMIT 1`;
    return String(sapRows[0]?.sapid ?? "");
  } catch {
    return "";
  }
}

export default async function MentorshipPage({ searchParams }: { searchParams: Promise<AlumniProfileSearchParams> }) {
  const sp = await searchParams;
  const session = await auth();
  await getSapId(sp);

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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-slate-900">Apply for Mentorship Session</h1>
              <BackButton />
            </div>
            <MentorshipForm />
          </div>
        </div>
      </div>
    </>
  );
}

