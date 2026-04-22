"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import AppHeader from "@/layout/AppHeader";
import { eventImageUrlFromStored } from "@/lib/uploadsImageUrl";
import { useQuery } from "@tanstack/react-query";

type EventDetail = {
  id: string;
  category: string;
  type: string | null;
  title: string;
  shortDescription: string;
  description: string;
  fromDate: string | null;
  toDate: string | null;
  eventTime: string | null;
  images: string[];
  startTimeUTC?: string;
  endTimeUTC?: string;
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return "N/A";
  return timeStr;
}

async function fetchEvent(id: string): Promise<EventDetail> {
  const res = await fetch(`/api/events/${id}`, { cache: "no-store" });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to fetch event" }));
    throw new Error(error.error || `Failed to fetch: ${res.status}`);
  }
  return res.json();
}

export default function EventDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [brokenImageKeys, setBrokenImageKeys] = useState<Set<string>>(() => new Set());

  const markImageBroken = (filename: string) => {
    setBrokenImageKeys((prev) => {
      if (prev.has(filename)) return prev;
      const next = new Set(prev);
      next.add(filename);
      return next;
    });
  };

  const {
    data: event,
    isLoading,
    isError,
    error,
  } = useQuery<EventDetail, Error>({
    queryKey: ["event", id],
    queryFn: () => fetchEvent(id),
    enabled: !!id,
    staleTime: 0, // Always fetch fresh data
    refetchOnWindowFocus: true,
  });

  const images = event?.images || [];

  // Reset selected image when event changes
  useEffect(() => {
    if (images.length > 0) {
      setSelectedImageIndex(0);
    }
  }, [images.length]);

  useEffect(() => {
    setBrokenImageKeys(new Set());
  }, [id]);

  if (isLoading) {
    return (
      <>
        <div className="bg-slate-100 overflow-x-hidden min-h-screen">
          <div className="border bg-white relative z-50">
            <AppHeader />
          </div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
              <div className="animate-pulse space-y-6">
                <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-64 bg-gray-200 rounded-lg"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                  <div className="h-4 bg-gray-200 rounded w-4/6"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (isError || !event) {
    return (
      <>
        <div className="bg-slate-100 overflow-x-hidden min-h-screen">
          <div className="border bg-white relative z-50">
            <AppHeader />
          </div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
              <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-700 mb-4">
                <p className="font-semibold">Error loading event</p>
                <p className="text-sm mt-1">{error?.message || "Event not found"}</p>
              </div>
              <Link
                href="/events"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Events
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  const mainImage = images[selectedImageIndex] || images[0];
  const hasMultipleImages = images.length > 1;
  const mainImageSrc = mainImage ? eventImageUrlFromStored(mainImage) : "";
  const mainImageBroken = mainImage ? brokenImageKeys.has(mainImage) : true;

  return (
    <>
      <div className="bg-slate-100 overflow-x-hidden min-h-screen">
        <div className="border bg-white relative z-50">
          <AppHeader />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-8">
          {/* Back Button */}
          <div className="mb-6">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Events
            </Link>
          </div>

          {/* Main Content Card */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 px-6 py-8 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="inline-block mb-3">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 capitalize">
                      {event.category || "Event"}
                    </span>
                  </div>
                  <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                    {event.title || "Event Details"}
                  </h1>
                  <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
                    {event.shortDescription}
                  </p>
                </div>
              </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-6 md:p-8">
              {/* Main Content - Left Side */}
              <div className="lg:col-span-2 space-y-6">
                {/* Event Details Card */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Event Information
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">From Date</p>
                        <p className="text-base font-semibold text-gray-900 dark:text-white">{formatDate(event.fromDate)}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">To Date</p>
                        <p className="text-base font-semibold text-gray-900 dark:text-white">{formatDate(event.toDate)}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Event Time</p>
                        <p className="text-base font-semibold text-gray-900 dark:text-white">{formatTime(event.eventTime)}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Category</p>
                        <p className="text-base font-semibold text-gray-900 dark:text-white capitalize">{event.category || "N/A"}</p>
                      </div>
                    </div>
                    {event.type && (
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Type</p>
                          <p className="text-base font-semibold text-gray-900 dark:text-white">
                            {event.type === "past" ? "Past" : event.type === "upcoming" ? "Up-Coming" : event.type}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description Section */}
                {event.description && (
                  <div className="prose prose-lg dark:prose-invert max-w-none">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Description</h2>
                    <div className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                      {event.description}
                    </div>
                  </div>
                )}
              </div>

              {/* Image Gallery - Right Side */}
              <div className="lg:col-span-1">
                <div className="sticky top-8 space-y-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Event Images</h2>
                  
                  {/* Main Image */}
                  {mainImage ? (
                    <div className="relative group">
                      <div
                        className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 cursor-pointer hover:border-blue-500 transition-all duration-200"
                        onClick={() => hasMultipleImages && setIsImageModalOpen(true)}
                      >
                        {mainImageBroken || !mainImageSrc ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500 text-sm p-4 text-center">
                            Image unavailable
                          </div>
                        ) : (
                        <Image
                          src={mainImageSrc}
                          alt={`${event.title} - Image ${selectedImageIndex + 1}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 400px"
                          priority
                          unoptimized
                          onError={() => markImageBroken(mainImage)}
                        />
                        )}
                        {hasMultipleImages && (
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <svg className="w-12 h-12 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>
                      {hasMultipleImages && (
                        <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-medium">
                          {selectedImageIndex + 1} / {images.length}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <div className="text-center">
                        <svg className="w-16 h-16 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm text-gray-500 dark:text-gray-400">No images available</p>
                      </div>
                    </div>
                  )}

                  {/* Thumbnail Gallery */}
                  {hasMultipleImages && images.length > 1 && (
                    <div className="grid grid-cols-4 gap-2">
                      {images.map((image, idx) => {
                        const thumbSrc = eventImageUrlFromStored(image);
                        const thumbBroken = brokenImageKeys.has(image);
                        return (
                        <button
                          key={`${image}-${idx}`}
                          onClick={() => setSelectedImageIndex(idx)}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                            selectedImageIndex === idx
                              ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900"
                              : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                          }`}
                        >
                          {thumbBroken || !thumbSrc ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-[10px] text-gray-500">
                              —
                            </div>
                          ) : (
                          <Image
                            src={thumbSrc}
                            alt={`Thumbnail ${idx + 1}`}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 25vw, 100px"
                            unoptimized
                            onError={() => markImageBroken(image)}
                          />
                          )}
                        </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Modal for Full-Screen View */}
      {isImageModalOpen && mainImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setIsImageModalOpen(false)}
        >
          <div className="relative max-w-7xl max-h-full">
            <button
              onClick={() => setIsImageModalOpen(false)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
              aria-label="Close"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="relative w-full h-[90vh]">
              {mainImageBroken || !mainImageSrc ? (
                <div className="flex h-full items-center justify-center text-white/80">
                  Image unavailable
                </div>
              ) : (
              <Image
                src={mainImageSrc}
                alt={`${event.title} - Full View`}
                fill
                className="object-contain"
                sizes="100vw"
                priority
                unoptimized
                onError={() => markImageBroken(mainImage)}
              />
              )}
            </div>

            {hasMultipleImages && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white p-3 rounded-full transition-colors"
                  aria-label="Previous image"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white p-3 rounded-full transition-colors"
                  aria-label="Next image"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm font-medium">
                  {selectedImageIndex + 1} / {images.length}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
