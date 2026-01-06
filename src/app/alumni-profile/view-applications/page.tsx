"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import AppHeader from "@/layout/AppHeader";
import BackButton from "@/components/ui/BackButton";
import PageBanner from "@/components/ui/PageBanner";
import { Toaster } from "react-hot-toast";

type ScholarshipApplication = {
  id: number;
  type: "scholarship";
  createdAt: string | null;
  kinshipFirstName: string | null;
  kinshipLastName: string | null;
  kinshipCnic: string | null;
  applyFor: string | null;
  degreeTitle: string | null;
  status: string;
  rejectionReason: string | null;
};

type MembershipApplication = {
  id: number;
  type: "membership";
  createdAt: string | null;
  gymMembershipMonth: string | null;
  swimmingPoolMembershipMonth: string | null;
  status: string;
  rejectionReason: string | null;
};

type Application = ScholarshipApplication | MembershipApplication;

type ApplicationsResponse = {
  items: Application[];
};

async function getApplications(sapid: string): Promise<ApplicationsResponse> {
  const url = `/api/alumni/${encodeURIComponent(sapid)}/scholarships`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to fetch applications (${res.status})`);
  }
  return res.json();
}

function ViewApplicationsContent() {
  const searchParams = useSearchParams();
  const sapid = searchParams.get("sapid") || "";

  const { data, isLoading, error } = useQuery<ApplicationsResponse, Error>({
    queryKey: ["alumni-scholarship-applications", sapid],
    queryFn: () => getApplications(sapid),
    enabled: !!sapid,
    staleTime: 2 * 60 * 1000,
  });

  const applications = data?.items ?? [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            Approved
          </span>
        );
      case "not-approved":
        return (
          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
            Not Approved
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            Pending
          </span>
        );
    }
  };

  return (
    <>
      <AppHeader />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <PageBanner title="My Scholarship Applications" />
        <div className="container mx-auto px-4 py-6 sm:py-8">
          <div className="mb-4 sm:mb-6">
            <BackButton />
          </div>

          {isLoading && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 sm:p-8">
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="ml-3 text-gray-600 dark:text-gray-400">Loading applications...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 sm:p-8">
              <div className="text-center py-8">
                <p className="text-red-600 dark:text-red-400 font-medium">
                  {error.message || "Failed to load applications"}
                </p>
              </div>
            </div>
          )}

          {!isLoading && !error && applications.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 sm:p-8">
              <div className="text-center py-12">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
                  No Applications Found
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  You haven't submitted any applications yet.
                </p>
              </div>
            </div>
          )}

          {!isLoading && !error && applications.length > 0 && (
            <div className="space-y-4 sm:space-y-6">
              {applications.map((app) => (
                <div
                  key={`${app.type}-${app.id}`}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {app.type === "scholarship" ? "Scholarship" : "Membership"} Application #{app.id}
                        </h3>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          app.type === "scholarship"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                        }`}>
                          {app.type === "scholarship" ? "Scholarship" : "Membership"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Submitted on:{" "}
                        {app.createdAt
                          ? new Date(app.createdAt).toLocaleDateString("en-PK", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "N/A"}
                      </p>
                    </div>
                    <div>{getStatusBadge(app.status)}</div>
                  </div>

                  {app.type === "scholarship" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                          Applying For
                        </label>
                        <p className="text-sm text-gray-900 dark:text-gray-100">
                          {app.applyFor || "N/A"}
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                          Degree Title
                        </label>
                        <p className="text-sm text-gray-900 dark:text-gray-100">
                          {app.degreeTitle || "N/A"}
                        </p>
                      </div>

                      {app.kinshipFirstName && (
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                            Kinship Name
                          </label>
                          <p className="text-sm text-gray-900 dark:text-gray-100">
                            {app.kinshipFirstName} {app.kinshipLastName || ""}
                          </p>
                        </div>
                      )}

                      {app.kinshipCnic && (
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                            Kinship CNIC
                          </label>
                          <p className="text-sm text-gray-900 dark:text-gray-100">
                            {app.kinshipCnic}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      {app.gymMembershipMonth && (
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                            Gym Membership Month
                          </label>
                          <p className="text-sm text-gray-900 dark:text-gray-100">
                            {app.gymMembershipMonth}
                          </p>
                        </div>
                      )}

                      {app.swimmingPoolMembershipMonth && (
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                            Swimming Pool Membership Month
                          </label>
                          <p className="text-sm text-gray-900 dark:text-gray-100">
                            {app.swimmingPoolMembershipMonth}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {app.status === "not-approved" && app.rejectionReason && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <label className="block text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide mb-2">
                        Rejection Reason
                      </label>
                      <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg p-3 sm:p-4">
                        <p className="text-sm text-rose-800 dark:text-rose-200">
                          {app.rejectionReason}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <Toaster position="top-right" />
    </>
  );
}

export default function ViewApplicationsPage() {
  return (
    <Suspense
      fallback={
        <>
          <AppHeader />
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <PageBanner title="My Applications" />
            <div className="container mx-auto px-4 py-6 sm:py-8">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 sm:p-8">
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="ml-3 text-gray-600 dark:text-gray-400">Loading...</span>
                </div>
              </div>
            </div>
          </div>
        </>
      }
    >
      <ViewApplicationsContent />
    </Suspense>
  );
}

