"use client";

import { useCardStatus } from "@/app/queries/fetch-card-status";
import { computeValidityISOFromAppliedAt, formatCardValidityMonthYear } from "@/lib/cardValidity";
import RenewCardButton from "@/components/alumni/RenewCardButton";

type Props = {
  sapId: string;
  fallbackValidity: string | null;
  alumniId: string;
  name: string;
  faculty: string;
  department: string;
};

function computeExpiryDate(raw: string | null): Date | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;

  if (v.includes("/")) {
    const [mmRaw, yyyyRaw] = v.split("/");
    const month = Number(mmRaw);
    const year = Number(yyyyRaw);
    if (!Number.isNaN(month) && !Number.isNaN(year) && month >= 1 && month <= 12) {
      return new Date(Date.UTC(year, month, 0));
    }
    return null;
  }

  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(v);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day) && month >= 1 && month <= 12) {
      return new Date(Date.UTC(year, month - 1, day));
    }
    return null;
  }

  const ym = /^(\d{4})-(\d{2})$/u.exec(v);
  if (ym) {
    const year = Number(ym[1]);
    const month = Number(ym[2]);
    if (!Number.isNaN(year) && !Number.isNaN(month) && month >= 1 && month <= 12) {
      return new Date(Date.UTC(year, month, 0));
    }
    return null;
  }

  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  }

  return null;
}

export default function AlumniCardExpiryClient({ sapId, fallbackValidity, alumniId, name, faculty, department }: Props) {
  const { data: cardData } = useCardStatus(sapId);

  let rawValidity = fallbackValidity;

  if (cardData?.status?.toLowerCase() === "delivered") {
    if (cardData.validity_date) {
      rawValidity = cardData.validity_date;
    } else if (cardData.createdat) {
      rawValidity = computeValidityISOFromAppliedAt(cardData.createdat, 3) ?? rawValidity;
    }
  }

  const formattedExpiry = rawValidity ? formatCardValidityMonthYear(rawValidity) : "Not set";

  const expiryDate = computeExpiryDate(rawValidity);
  let isExpired = false;
  if (expiryDate) {
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    isExpired = todayUTC > expiryDate;
  }

  return (
    <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 mb-2 sm:mb-3">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Card Expiry Date:</span>
        <span
          className={`text-xs sm:text-sm font-semibold ${
            isExpired ? "text-rose-600 dark:text-rose-400" : "text-gray-900 dark:text-gray-100"
          }`}
        >
          {formattedExpiry}
        </span>
      </div>
      {isExpired && (
        <RenewCardButton
          alumniId={alumniId}
          name={name}
          sapId={sapId}
          faculty={faculty}
          department={department}
        />
      )}
    </div>
  );
}
