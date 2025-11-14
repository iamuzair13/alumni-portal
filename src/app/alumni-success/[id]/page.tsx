import ComponentCard from "@/components/common/ComponentCard";
import Link from "next/link";
import { headers } from "next/headers";

type DetailItem = {
  id: string;
  date: string;
  name: string;
  program: string;
  session: string;
  shortDescription: string;
  imageUrl: string;
};

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
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const base = `${proto}://${host}`;
  const res = await fetch(`${base}/api/alumni-stories/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (!res.ok) {
    return (
      <ComponentCard title="Story Details">
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-700">Failed to load story.</div>
        <Link href="/alumni-success" className="mt-4 inline-block px-4 py-2 rounded-lg bg-blue-600 text-white">Back</Link>
      </ComponentCard>
    );
  }
  const data = (await res.json()) as DetailItem;
  const title = sanitizeText(data.name);
  const desc = sanitizeText(data.shortDescription);
  const meta = {
    program: sanitizeText(data.program),
    session: sanitizeText(data.session),
    date: sanitizeText(data.date),
  };

  return (
    <ComponentCard title="Story Details">
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-6">
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          <p className="mt-3 text-slate-700">{desc}</p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-slate-600">
            <div><span className="font-medium">Program:</span> {meta.program}</div>
            <div><span className="font-medium">Session:</span> {meta.session}</div>
            <div><span className="font-medium">Date:</span> {new Date(meta.date).toLocaleDateString()}</div>
          </div>
          <div className="mt-6">
            <Link href="/alumni-success" className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Back</Link>
          </div>
        </div>
      </div>
    </ComponentCard>
  );
}