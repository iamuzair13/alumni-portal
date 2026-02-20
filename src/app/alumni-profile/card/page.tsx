"use client";
import { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAlumniFullDetails } from "@/app/queries/alumni-profile";
import AppHeader from "@/layout/AppHeader";
import BackButton from "@/components/ui/BackButton";
import { Toaster } from "react-hot-toast";
import PageBanner from "@/components/ui/PageBanner";
import AlumniCardForm from "@/components/forms/alumni-card";

function CardApplicationContent() {
  const searchParams = useSearchParams();
  const safeSearchParams = searchParams ?? new URLSearchParams();
  const sapIdFromParams = safeSearchParams.get("sapid");
  const [sapId, setSapId] = useState(sapIdFromParams || "");
  
  // Try to get SAP ID from session if not in params
  useEffect(() => {
    if (!sapId) {
      // Fetch current user's SAP ID from API
      fetch("/api/alumni/current-sapid")
        .then(res => res.json())
        .then(data => {
          if (data.sapid) {
            setSapId(data.sapid);
          }
        })
        .catch(() => {
          // If API fails, try to get from URL or show error
        });
    }
  }, [sapId]);
  
  const { data, isLoading, error } = useAlumniFullDetails(sapId || undefined);

  if (isLoading) {
    return (
      <>
        <AppHeader />
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <PageBanner title="Apply for Alumni Card" />
          <div className="container mx-auto px-4 py-8">
            <div className="max-w-4xl mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
                <p className="text-center text-gray-600 dark:text-gray-400">Loading...</p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <AppHeader />
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <PageBanner title="Apply for Alumni Card" />
          <div className="container mx-auto px-4 py-8">
            <div className="max-w-4xl mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
                <p className="text-center text-red-600 dark:text-red-400">
                  {error ? "Error loading alumni data. Please try again." : "Alumni data not found."}
                </p>
                <div className="mt-4 flex justify-center">
                  <BackButton />
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  const alumniId = String(data.alumniid || "");
  const name = data.alumniname || "";
  const faculty = data.facultyname || "";
  const department = data.departmentname || "";

  return (
    <>
      <AppHeader />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <PageBanner title="Apply for Alumni Card" />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-4">
              <BackButton />
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 md:p-8">
              <AlumniCardForm
                alumniId={alumniId}
                name={name}
                sapId={sapId}
                faculty={faculty}
                department={department}
              />
            </div>
          </div>
        </div>
      </div>
      <Toaster position="top-right" />
    </>
  );
}

export default function CardApplicationPage() {
  return (
    <Suspense
      fallback={
        <>
          <AppHeader />
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <PageBanner title="Apply for Alumni Card" />
            <div className="container mx-auto px-4 py-8">
              <div className="max-w-4xl mx-auto">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
                  <p className="text-center text-gray-600 dark:text-gray-400">Loading...</p>
                </div>
              </div>
            </div>
          </div>
        </>
      }
    >
      <CardApplicationContent />
    </Suspense>
  );
}

