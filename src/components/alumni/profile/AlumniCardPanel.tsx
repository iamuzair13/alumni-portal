import Link from "next/link";
import AlumniCardClient from "@/components/alumni/AlumniCardClient";
import AlumniCardExpiryClient from "@/components/alumni/AlumniCardExpiryClient";
import SubmitRevisionButton from "@/components/alumni/SubmitRevisionButton";
import UpdateAlumniCardPictureButton from "@/components/alumni/UpdateAlumniCardPictureButton";
import { CreditCard } from "lucide-react";
import type { CardStatus } from "@/app/alumni-profile/status";

export type AlumniCardPanelProps = {
  cardStatus: CardStatus;
  cardStatusError: string | null;
  reasonOnhold: string | null;
  cardComment: string | null;
  name: string;
  department: string;
  faculty: string;
  campus: string | null;
  passingYear: number | null;
  sapId: string;
  alumniId: string;
  gender: string | null;
  cnicPassport: string | null;
  validity: string;
  validityDate: string | null;
  photoUrl: string | null;
  initialCardImage: string | null;
  medal: string | null;
  isViewer: boolean;
};

const CHIP_STYLES: Record<string, string> = {
  error: "border-error-300/40 bg-error-400/15 text-error-200",
  success: "border-emerald-300/40 bg-emerald-400/15 text-emerald-200",
  warning: "border-amber-300/40 bg-amber-400/15 text-amber-200",
  info: "border-sky-300/40 bg-sky-400/15 text-sky-200",
  neutral: "border-white/20 bg-white/10 text-white/85",
};

export default function AlumniCardPanel({
  cardStatus,
  cardStatusError,
  reasonOnhold,
  cardComment,
  name,
  department,
  faculty,
  campus,
  passingYear,
  sapId,
  alumniId,
  gender,
  cnicPassport,
  validity,
  validityDate,
  photoUrl,
  initialCardImage,
  medal,
  isViewer,
}: AlumniCardPanelProps) {
  const cardIssued = cardStatus === "active" || cardStatus === "received";

  const statusChip = cardStatusError
    ? CHIP_STYLES.error
    : cardStatus === "received" || cardStatus === "active"
      ? CHIP_STYLES.success
      : cardStatus === "inprocess" || cardStatus === "under-review"
        ? CHIP_STYLES.info
        : cardStatus === "onhold"
          ? CHIP_STYLES.error
          : cardStatus === "full"
            ? CHIP_STYLES.warning
            : CHIP_STYLES.neutral;

  const statusLabel = cardStatusError
    ? cardStatusError
    : cardStatus === "received"
      ? "Received"
      : cardStatus === "active"
        ? "Active"
        : cardStatus === "inprocess"
          ? "In-Process"
          : cardStatus === "onhold"
            ? "On Hold"
            : cardStatus === "under-review"
              ? "Under Review"
              : cardStatus === "full"
                ? "Full"
                : "No Application";

  return (
    <div
      className="rounded-2xl border border-white/15 bg-white/10 p-4 text-center shadow-inner backdrop-blur-sm"
      aria-label="Alumni card"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <CreditCard className="h-4 w-4 shrink-0 text-amber-300/90" aria-hidden />
          <h3 className="truncate text-base font-bold text-white sm:text-lg">Alumni Card</h3>
        </div>
        <div role="status" aria-live="polite" className="shrink-0">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${statusChip}`}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {cardIssued && (
        <div className="mt-3">
          <AlumniCardClient
            studentName={name}
            department={department}
            faculty={faculty}
            campus={campus}
            passingYear={passingYear}
            alumniId={sapId || "UOL-AL-0000"}
            sapId={sapId || ""}
            gender={gender}
            cnicPassport={cnicPassport}
            validity={validity}
            photoUrl={photoUrl}
            initialCardImage={initialCardImage}
            medal={medal}
          />
        </div>
      )}

      {!cardIssued && (
        <div className="mt-3">
          {cardStatus === "under-review" ? (
            <p className="text-xs text-sky-200/90">Your application is under review.</p>
          ) : cardStatus === "inprocess" ? (
            <p className="text-xs text-sky-200/90">Your application is in process.</p>
          ) : cardStatus === "onhold" ? (
            <div className="text-xs text-error-200">
              <p className="font-medium mb-1">Your application is on hold.</p>
              {reasonOnhold && (
                <p className="text-[10px] mt-1 italic bg-error-400/15 border border-error-300/30 rounded px-2 py-1">
                  Reason: {reasonOnhold}
                </p>
              )}
              {cardComment && (
                <div className="mt-2 p-2 bg-error-400/15 border border-error-300/30 rounded-md">
                  <p className="font-medium text-error-100 mb-1">Note:</p>
                  <p>{cardComment}</p>
                </div>
              )}
              {!cardComment && <p className="mt-1">Please contact us for more information.</p>}
            </div>
          ) : cardStatus === "full" ? (
            <p className="text-xs text-amber-200/90">Application capacity is currently full. Please try later.</p>
          ) : (
            <p className="text-xs text-white/70">Start your application to get your alumni card.</p>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {cardIssued && (
          <Link
            href={sapId ? `/alumni-profile/card-print?sapid=${encodeURIComponent(sapId)}` : `/alumni-profile/card-print`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center rounded-lg bg-accent-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 sm:text-sm"
            aria-label="Download alumni card as PDF"
          >
            Download Card (PDF)
          </Link>
        )}
        {cardIssued && (
          <AlumniCardExpiryClient
            sapId={sapId || ""}
            fallbackValidity={validityDate ?? validity ?? null}
            alumniId={alumniId}
            name={name}
            faculty={faculty}
            department={department}
          />
        )}
        {cardStatus === "under-review" && (
          <>
            <button
              type="button"
              disabled
              aria-disabled
              className="inline-flex w-full items-center justify-center rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white/60 cursor-not-allowed sm:text-sm"
            >
              Under review
            </button>
            {!isViewer && !!sapId && <UpdateAlumniCardPictureButton sapId={sapId} />}
          </>
        )}
        {cardStatus === "inprocess" && (
          <button
            type="button"
            disabled
            aria-disabled
            className="inline-flex w-full items-center justify-center rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white/60 cursor-not-allowed sm:text-sm"
          >
            In-Process
          </button>
        )}
        {cardStatus === "onhold" && (
          <>
            <button
              type="button"
              disabled
              aria-disabled
              className="inline-flex w-full items-center justify-center rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white/60 cursor-not-allowed sm:text-sm"
            >
              Application on hold
            </button>
            {!!sapId && <SubmitRevisionButton sapId={sapId} />}
            {!isViewer && !!sapId && <UpdateAlumniCardPictureButton sapId={sapId} />}
          </>
        )}
        {cardStatus === "full" && (
          <button
            type="button"
            disabled
            aria-disabled
            className="inline-flex w-full items-center justify-center rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white/60 cursor-not-allowed sm:text-sm"
          >
            Capacity Full
          </button>
        )}
        {cardStatus === "none" && !isViewer && (
          <Link
            href={sapId ? `/alumni-profile/card?sapid=${encodeURIComponent(sapId)}` : `/alumni-profile/card`}
            className="inline-flex w-full items-center justify-center rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-accent-950 transition-colors hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 sm:text-sm"
          >
            Apply now
          </Link>
        )}
      </div>
    </div>
  );
}
