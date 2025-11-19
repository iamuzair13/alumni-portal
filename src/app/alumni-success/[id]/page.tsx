import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import AppHeader from "@/layout/AppHeader";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/dbconnect";

type DetailItem = {
  id: string;
  date: string;
  name: string;
  program: string;
  session: string;
  shortDescription: string;
  imageUrl: string;
};

function sanitizeHtml(input: string): string {
  // Remove script and style tags, but keep other safe HTML
  return String(input || "")
    .replace(/<script[^>]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*?>[\s\S]*?<\/style>/gi, "");
}

function sanitizeText(input: string): string {
  return String(input || "")
    .replace(/<script[^>]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const email = session?.user?.email ? String(session.user.email) : undefined;
  
  // Check if current user owns this story
  let isOwner = false;
  if (email) {
    try {
      const storyAlumniId = Number(id);
      const userRows = await sql/* sql */`
        SELECT alumniid FROM public.tbl_alumni 
        WHERE (personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email})
        AND alumniid = ${storyAlumniId}
        LIMIT 1`;
      isOwner = userRows.length > 0;
    } catch {
      isOwner = false;
    }
  }

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const base = `${proto}://${host}`;
  const res = await fetch(`${base}/api/alumni-stories/${encodeURIComponent(id)}`, { cache: "no-store" });
  
  if (!res.ok) {
    return (
      <>
        <div className="bg-slate-100 overflow-x-hidden min-h-screen">
          <div className="border bg-white relative z-50">
            <AppHeader />
          </div>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
              <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-700 mb-4">
                Failed to load story.
              </div>
              <Link href="/alumni-success" className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                ← Back to Stories
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  const data = (await res.json()) as DetailItem;
  const title = sanitizeText(data.name);
  const storyHtml = sanitizeHtml(data.shortDescription);
  const meta = {
    program: sanitizeText(data.program),
    session: sanitizeText(data.session),
    date: data.date ? new Date(data.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A',
  };

  return (
    <>
      <div className="bg-slate-100 overflow-x-hidden min-h-screen">
        <div className="border bg-white relative z-50">
          <AppHeader />
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Header Image */}
            {data.imageUrl && (
              <div className="relative h-64 w-full bg-gradient-to-br from-blue-50 to-indigo-100">
                <Image
                  src={data.imageUrl.startsWith('/') ? data.imageUrl : `/images/${data.imageUrl}`}
                  alt={title}
                  fill
                  className="object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
            )}

            <div className="p-6 md:p-8">
              {/* Back Button and Edit Button */}
              <div className="flex items-center justify-between mb-6">
                <Link 
                  href="/alumni-success" 
                  className="inline-flex items-center text-slate-700 hover:text-slate-900 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5 mr-2">
                    <path className="fill-current" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                  </svg>
                  Back to Stories
                </Link>
                {isOwner && (
                  <Link
                    href={`/alumni-success/${encodeURIComponent(id)}/edit`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                    </svg>
                    Edit Story
                  </Link>
                )}
              </div>

              {/* Title */}
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">{title}</h1>

              {/* Meta Information */}
              <div className="flex flex-wrap gap-4 mb-6 pb-6 border-b border-gray-200 text-sm text-slate-600">
                {meta.program && (
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-slate-400">
                      <path className="fill-current" d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
                    </svg>
                    <span className="font-medium">Program:</span> {meta.program}
                  </div>
                )}
                {meta.session && (
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-slate-400">
                      <path className="fill-current" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    <span className="font-medium">Session:</span> {meta.session}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-slate-400">
                    <path className="fill-current" d="M9 11H7v6h2v-6zm4 0h-2v6h2v-6zm4 0h-2v6h2v-6zm2.5-9H18V1h-2v1H8V1H6v1H4.5C3.67 2 3 2.67 3 3.5v17C3 21.33 3.67 22 4.5 22h15c.83 0 1.5-.67 1.5-1.5v-17C21 2.67 20.33 2 19.5 2zM19 20H5V9h14v13z"/>
                  </svg>
                  <span className="font-medium">Date:</span> {meta.date}
                </div>
              </div>

              {/* Complete Story Content */}
              <div 
                className="prose prose-slate max-w-none text-slate-700 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: storyHtml }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}