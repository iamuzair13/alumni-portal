export const dynamic = "force-dynamic";
import type { Viewport } from "next";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

import React from "react";
import AppHeader from "@/layout/AppHeader";
import PageBanner from "@/components/ui/PageBanner";
import BackButton from "@/components/ui/BackButton";
import Alert from "@/components/ui/alert/Alert";
import { auth } from "@/lib/auth";
import { computeLoginBanner } from "@/lib/alumniProfile";
import AlumniTalksPageClient from "@/components/alumni/AlumniTalksPageClient";
import AlumniTalksApplyButton from "@/components/alumni/AlumniTalksApplyButton";

type AlumniProfileSearchParams = { sapid?: string };

export default async function AlumniTalksPage({ searchParams }: { searchParams: Promise<AlumniProfileSearchParams> }) {
  const sp = await searchParams;
  const session = await auth();

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

        <PageBanner title="Alumni Talks" />

        <div className="min-w-screen flex justify-center mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-8">
          <div className="w-full max-w-6xl">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 md:p-7">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <BackButton />
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Alumni Talks</h1>
                </div>

                <AlumniTalksApplyButton />
              </div>

              <AlumniTalksPageClient />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
