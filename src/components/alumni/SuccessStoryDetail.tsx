import Link from "next/link";
import Image from "next/image";
import StoryBodyContent from "@/components/alumni/StoryBodyContent";
import StoryStatusBadge from "@/components/alumni/StoryStatusBadge";
import { normalizeStoryStatus } from "@/lib/alumniStories";

export type SuccessStoryDetailData = {
  id: string;
  title: string;
  name: string;
  program: string;
  session: string;
  date: string;
  shortDescription: string;
  imageUrl: string;
  status?: string;
  rejectionReason?: string | null;
  criteriaHighlight?: string | null;
  criteriaInspires?: string | null;
  criteriaReplicable?: boolean | null;
  achievements?: string | null;
  signatureConfirmed?: boolean | null;
  signatureConfirmedAt?: string | null;
};

type Props = {
  story: SuccessStoryDetailData;
  backHref: string;
  backLabel?: string;
  editHref?: string | null;
  editLabel?: string;
  className?: string;
  showStatusBanner?: boolean;
  adminActions?: React.ReactNode;
  /** When true, shows the submission criteria panel (admin review views). */
  showSubmissionCriteria?: boolean;
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
  showStatusBanner = false,
  adminActions,
  showSubmissionCriteria = false,
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
  const status = normalizeStoryStatus(story.status);
  const showBanner = showStatusBanner && status !== "approved";
  const hasCriteria =
    Boolean(story.criteriaHighlight?.trim()) ||
    Boolean(story.criteriaInspires?.trim()) ||
    Boolean(story.achievements?.trim()) ||
    story.criteriaReplicable === true ||
    story.criteriaReplicable === false ||
    story.signatureConfirmed === true;

  const criteriaValue = (value: string | null | undefined) =>
    value?.trim() ? value.trim() : "Not provided";

  const replicableLabel =
    story.criteriaReplicable === true
      ? "Yes"
      : story.criteriaReplicable === false
        ? "No"
        : "Not provided";

  const toolbar = (
    <div className="flex items-center justify-between gap-4">
      <Link
        href={backHref}
        className="inline-flex items-center rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="mr-2 h-4 w-4 fill-current">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
        {backLabel}
      </Link>
      {story.status && (
        <StoryStatusBadge status={story.status} className="bg-white/90 backdrop-blur-sm" />
      )}
    </div>
  );

  const titleBlock = (
    <div className="min-w-0 flex-1">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">
        Alumni Success Story
      </p>
      <h1 className="text-2xl font-bold leading-tight text-white sm:text-3xl md:text-4xl lg:text-5xl">{title}</h1>
      {story.achievements?.trim() && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-yellow-300/40 bg-yellow-400/10 px-3 py-1.5 backdrop-blur-sm">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4 fill-yellow-300">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <span className="text-sm font-semibold text-yellow-100">{story.achievements.trim()}</span>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/90">
        {story.name && <span className="font-medium">{story.name}</span>}
        {story.program && (
          <>
            <span className="hidden text-white/40 sm:inline">•</span>
            <span>{story.program}</span>
          </>
        )}
        {story.session && (
          <>
            <span className="hidden text-white/40 sm:inline">•</span>
            <span>Session {story.session}</span>
          </>
        )}
        <span className="hidden text-white/40 sm:inline">•</span>
        <time dateTime={story.date}>{formattedDate}</time>
      </div>
    </div>
  );

  return (
    <article
      className={`overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900 ${className}`}
    >
      {/* Hero banner */}
      <div className="relative min-h-[280px] overflow-hidden md:min-h-[320px]">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-blue-900 to-indigo-950" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />

        <div className="relative z-10 flex min-h-[280px] flex-col p-6 md:min-h-[320px] md:p-10">
          {toolbar}

          <div className="mt-6 flex flex-1 flex-col items-stretch gap-6 md:mt-8 md:flex-row md:items-center md:justify-between md:gap-10">
            {titleBlock}

            {imageSrc && (
              <div className="flex shrink-0 justify-center md:justify-end">
                <div className="overflow-hidden rounded-xl border border-white/25 bg-black/25 p-1 shadow-xl backdrop-blur-sm">
                  <Image
                    src={imageSrc}
                    alt={title}
                    width={400}
                    height={500}
                    className="block h-auto max-h-[180px] w-auto max-w-[160px] object-contain object-center sm:max-h-[220px] sm:max-w-[200px] md:max-h-[260px] md:max-w-[240px]"
                    unoptimized
                    priority
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status banner for alumni owner */}
      {showBanner && (
        <div
          className={`border-b px-6 py-4 md:px-10 ${
            status === "pending"
              ? "border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/20"
              : "border-rose-200 bg-rose-50 dark:border-rose-800/50 dark:bg-rose-900/20"
          }`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p
                className={`text-sm font-semibold ${
                  status === "pending"
                    ? "text-amber-900 dark:text-amber-200"
                    : "text-rose-900 dark:text-rose-200"
                }`}
              >
                {status === "pending"
                  ? "Your story is pending review"
                  : "Your story was not approved"}
              </p>
              <p
                className={`mt-1 text-sm ${
                  status === "pending"
                    ? "text-amber-800/80 dark:text-amber-300/80"
                    : "text-rose-800/80 dark:text-rose-300/80"
                }`}
              >
                {status === "pending"
                  ? "It will appear publicly once an administrator approves it."
                  : story.rejectionReason || "Please revise your story and submit again."}
              </p>
            </div>
            {editHref && status === "not-approved" && (
              <Link
                href={editHref}
                className="inline-flex shrink-0 items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
              >
                Revise Story
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Admin review panel */}
      {adminActions && <div className="border-b border-gray-200 px-6 py-4 md:px-10 dark:border-gray-700">{adminActions}</div>}

      {showSubmissionCriteria && (
        <div className="border-b border-gray-200 bg-slate-50 px-6 py-6 md:px-10 dark:border-gray-700 dark:bg-gray-800/40">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Submission Criteria</h2>
          {!hasCriteria ? (
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              No submission criteria recorded for this story.
            </p>
          ) : (
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="font-medium text-gray-700 dark:text-gray-300">Achievements</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">
                  {criteriaValue(story.achievements)}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-700 dark:text-gray-300">
                  What does the story highlight? An innovative approach, exceptional achievement, or inspiring journey.
                </dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">
                  {criteriaValue(story.criteriaHighlight)}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-700 dark:text-gray-300">
                  Does your story inspire, motivate, or encourage others to take action? If yes, how?
                </dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">
                  {criteriaValue(story.criteriaInspires)}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-700 dark:text-gray-300">
                  Does your story provide valuable lessons, practical knowledge, or a model that others can replicate?
                </dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">{replicableLabel}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-700 dark:text-gray-300">Alumni signature</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">
                  {story.signatureConfirmed ? (
                    <>
                      I, <span className="font-semibold">{story.name}</span>, confirm this story is true and authorize
                      its publication.
                      {story.signatureConfirmedAt
                        ? ` Confirmed on ${new Date(story.signatureConfirmedAt).toLocaleString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}.`
                        : ""}
                    </>
                  ) : (
                    "Not confirmed"
                  )}
                </dd>
              </div>
            </dl>
          )}
        </div>
      )}

      {/* Article body */}
      <div className="px-6 py-8 md:px-10 md:py-12">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 flex items-center justify-between gap-4 border-b border-gray-100 pb-6 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-lg font-bold text-white">
                {story.name?.charAt(0).toUpperCase() || "A"}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{story.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {[story.program, story.session ? `Session ${story.session}` : null].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
            {editHref && (
              <Link
                href={editHref}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                </svg>
                {editLabel}
              </Link>
            )}
          </div>

          <StoryBodyContent
            html={story.shortDescription}
            className="prose prose-lg dark:prose-invert max-w-none"
          />
        </div>
      </div>

      {/* Footer branding */}
      <footer className="border-t border-gray-100 bg-gray-50 px-6 py-4 text-center text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400 md:px-10">
        Alumni Success Story · University of Lahore
      </footer>
    </article>
  );
}
