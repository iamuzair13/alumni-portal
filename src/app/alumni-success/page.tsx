"use client";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import AppHeader from "@/layout/AppHeader";
import { useAlumniStories, type AlumniStoryItem } from "@/app/queries/fetch-alumni-stories";
import BackButton from "@/components/ui/BackButton";

type SuccessStory = {
  id: string;
  title: string;
  short: string;
  imageUrl?: string;
  program: string;
  session: string;
  date: string;
};

function sanitizeText(input: string): string {
  return String(input || "")
    .replace(/<script[^>]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function Page() {
  const { data, isLoading, isFetching, isError, error } = useAlumniStories();
  // Always ensure we have an array, even if data is undefined or error occurred
  // Since getAlumniStories returns empty array on errors, data should always be an array
  const storiesData = Array.isArray(data) ? data : [];
  const items: SuccessStory[] = storiesData.map((s: AlumniStoryItem) => ({
    id: s.id,
    title: sanitizeText(s.name),
    short: sanitizeText(s.shortDescription).slice(0, 200),
    imageUrl: s.imageUrl,
    program: sanitizeText(s.program),
    session: sanitizeText(s.session),
    date: s.date,
  }));

  return (
    <>
      <div className="bg-slate-100 overflow-x-hidden min-h-screen">
        <div className="border bg-white relative z-50">
          <AppHeader />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <BackButton />
                <h1 className="text-3xl font-bold text-slate-900">Alumni Success Stories</h1>
              </div>
              <Link 
                href="/alumni-success/new" 
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
                </svg>
                Add Story
              </Link>
            </div>

            {(isLoading || isFetching) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-64 rounded-xl bg-gray-200 animate-pulse" />
                ))}
              </div>
            )}

            {/* Show error only if there's a real error and we're not loading */}
            {isError && !isLoading && error && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-amber-700 mb-4">
                <div className="flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5 mt-0.5 flex-shrink-0">
                    <path className="fill-current" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                  </svg>
                  <div>
                    <p className="font-medium">Unable to load stories</p>
                    <p className="text-sm mt-1">{error?.message || "Please try again later or add your story below."}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Show empty state when no stories (whether from error or no data) */}
            {!isLoading && !isFetching && items.length === 0 && (
              <div className="text-center py-12">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-16 h-16 mx-auto text-gray-400 mb-4">
                  <path className="fill-current" d="M4 3h12a2 2 0 012 2v11a2 2 0 01-2 2H9l-5 3V5a2 2 0 012-2zm3 5h8v2H7V8zm0 4h8v2H7v-2z" />
                </svg>
                <p className="text-gray-600 text-lg">No success stories yet.</p>
                <p className="text-gray-500 text-sm mt-2">
                  {isError ? "Unable to load stories at the moment." : "Be the first to share your story!"}
                </p>
                <Link 
                  href="/alumni-success/new" 
                  className="mt-4 inline-flex items-center px-6 py-3 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5 mr-2 fill-current">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
                  </svg>
                  Add Your Story
                </Link>
              </div>
            )}

            {!isLoading && !isError && items.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {items.map((story) => (
                  <Link
                    key={story.id}
                    href={`/alumni-success/${encodeURIComponent(story.id)}`}
                    className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow duration-200 group"
                  >
                    <div className="relative h-48 bg-gradient-to-br from-blue-50 to-indigo-100 overflow-hidden">
                      {story.imageUrl ? (
                        <Image
                          src={story.imageUrl.startsWith('/') ? story.imageUrl : `/images/${story.imageUrl}`}
                          alt={story.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-200"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <svg role="img" aria-label="Story" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-16 h-16 text-blue-600">
                            <path className="fill-current" d="M4 3h12a2 2 0 012 2v11a2 2 0 01-2 2H9l-5 3V5a2 2 0 012-2zm3 5h8v2H7V8zm0 4h8v2H7v-2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <h3 className="text-lg font-semibold text-slate-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {story.title}
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed line-clamp-3 mb-3">
                        {story.short}
                      </p>
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
                        <span>{story.program || "N/A"}</span>
                        <span>{story.date ? new Date(story.date).toLocaleDateString() : ""}</span>
                      </div>
                      <div className="inline-flex items-center text-blue-600 font-medium text-sm group-hover:text-blue-700">
                        Read Full Story
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform">
                          <path className="fill-current" d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                        </svg>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}