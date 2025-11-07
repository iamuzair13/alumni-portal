import React from "react";
import Link from "next/link";

type Event = {
  id: string;
  date: string;
  title: string;
  venue: string;
  shortDescription: string;
  imageUrl?: string;
  category: string;
  organizer: string;
  cityCountry: string;
  shortHtml?: string;
  description: string;
  isFeatured: boolean;
  startTimeUTC?: string;
  endTimeUTC?: string;
};

function formatLocalDateTime(utcIso?: string): string {
  if (!utcIso) return "-";
  try {
    const d = new Date(utcIso);
    return d.toLocaleString([], { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return "-";
  }
}

export default function EventDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;

  // Frontend-only stub event based on ID; no backend integration
  const event: Event = {
    id,
    date: new Date().toISOString().slice(0, 10),
    title: `Event ${id}`,
    venue: "Main Hall",
    shortDescription: "This is a frontend-only event detail view.",
    imageUrl: `https://i.pravatar.cc/300?u=${encodeURIComponent(id)}`,
    category: "Seminar",
    organizer: "Alumni Office",
    cityCountry: "Lahore, Pakistan",
    shortHtml: "<b>Welcome</b> to the event details.",
    description: "Here you can place the full event description, agenda, and any relevant information. This page renders without backend integration.",
    isFeatured: false,
    startTimeUTC: new Date(Date.now() + 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z"),
    endTimeUTC: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z"),
  };

  return (
    <div className="p-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">{event.title}</h1>
          <Link href="/events" className="inline-flex items-center rounded-xl border border-gray-300 bg-slate-100 px-3 py-1.5 text-gray-700 text-sm hover:bg-gray-200 transition-colors dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300">Back</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-medium">Venue:</span> {event.venue}</p>
            <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-medium">Organizer:</span> {event.organizer}</p>
            <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-medium">Category:</span> {event.category}</p>
            <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-medium">Location:</span> {event.cityCountry}</p>
            <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-medium">Date:</span> {event.date}</p>
            <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-medium">Start:</span> {formatLocalDateTime(event.startTimeUTC)}</p>
            <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-medium">End:</span> {formatLocalDateTime(event.endTimeUTC)}</p>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div dangerouslySetInnerHTML={{ __html: event.shortHtml || "" }} />
              <p className="mt-2 text-gray-700 dark:text-gray-200 whitespace-pre-line">{event.description}</p>
            </div>
          </div>
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={event.imageUrl || "https://via.placeholder.com/300x200"} alt={`${event.title} image`} className="rounded-xl border border-gray-200 dark:border-gray-800 object-cover w-full h-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}