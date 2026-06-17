import Link from "next/link";
import Image from "next/image";
import StoryBodyContent from "@/components/alumni/StoryBodyContent";

export type SuccessStoryDetailData = {
  id: string;
  title: string;
  name: string;
  program: string;
  session: string;
  date: string;
  shortDescription: string;
  imageUrl: string;
};

type Props = {
  story: SuccessStoryDetailData;
  backHref: string;
  backLabel?: string;
  editHref?: string | null;
  editLabel?: string;
  className?: string;
};

function resolveImageSrc(imageUrl: string): string | null {
  const img = String(imageUrl || "").trim();
  if (!img || img === "null") return null;
  if (img.startsWith("http")) return img;
  if (img.startsWith("/")) return img;
  return `/images/${img}`;
}

export default function SuccessStoryDetail({
  story,
  backHref,
  backLabel = "Back to Stories",
  editHref,
  editLabel = "Edit Story",
  className = "",
}: Props) {
  const title = story.title?.trim() || story.name?.trim() || "Success Story";
  const imageSrc = resolveImageSrc(story.imageUrl);
  const formattedDate = story.date
    ? new Date(story.date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "N/A";

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden dark:bg-gray-900 dark:border-gray-700 ${className}`}>
      {imageSrc && (
        <div className="relative h-64 w-full bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-800 dark:to-gray-900">
          <Image
            src={imageSrc}
            alt={title}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      )}

      <div className="p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <Link
            href={backHref}
            className="inline-flex items-center text-slate-700 hover:text-slate-900 transition-colors dark:text-gray-300 dark:hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5 mr-2">
              <path className="fill-current" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </svg>
            {backLabel}
          </Link>
          {editHref && (
            <Link
              href={editHref}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
              </svg>
              {editLabel}
            </Link>
          )}
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2 dark:text-white">{title}</h1>
        {story.name && story.name !== title && (
          <p className="text-sm text-slate-500 mb-4 dark:text-gray-400">{story.name}</p>
        )}

        <div className="flex flex-wrap gap-4 mb-6 pb-6 border-b border-gray-200 text-sm text-slate-600 dark:border-gray-700 dark:text-gray-400">
          {story.program && (
            <div className="flex items-center gap-2">
              <span className="font-medium">Program:</span> {story.program}
            </div>
          )}
          {story.session && (
            <div className="flex items-center gap-2">
              <span className="font-medium">Session:</span> {story.session}
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="font-medium">Date:</span> {formattedDate}
          </div>
        </div>

        <StoryBodyContent html={story.shortDescription} />
      </div>
    </div>
  );
}
