import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/alumniProfile";
import SuccessStoryDetail from "@/components/alumni/SuccessStoryDetail";

type DetailItem = {
  id: string;
  date: string;
  title: string;
  name: string;
  program: string;
  session: string;
  shortDescription: string;
  imageUrl: string;
};

export default async function AdminStoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const isSuperAdmin = isSuperAdminUser(session?.user);

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const base = `${proto}://${host}`;
  const res = await fetch(`${base}/api/alumni-stories/${encodeURIComponent(id)}`, { cache: "no-store" });

  if (!res.ok) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-700 mb-4">
          Failed to load story.
        </div>
        <Link href="/alumni-stories?tab=viewStories" className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
          Back to Stories
        </Link>
      </div>
    );
  }

  const data = (await res.json()) as DetailItem;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <SuccessStoryDetail
        story={data}
        backHref="/alumni-stories?tab=viewStories"
        backLabel="Back to Stories"
        editHref={isSuperAdmin ? `/alumni-stories/${encodeURIComponent(id)}/edit` : null}
      />
    </div>
  );
}
