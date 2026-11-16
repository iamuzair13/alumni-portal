"use client";

import { useEffect, useRef, useState } from "react";
import { useCardStatus } from "@/app/queries/fetch-card-status";
import AlumniCardTemplate from "./AlumniCardTemplate";

type AlumniCardClientProps = {
  studentName: string;
  department: string;
  faculty: string;
  campus?: string | null;
  passingYear?: number | string | null;
  alumniId: string;
  sapId: string;
  gender?: string | null;
  cnicPassport?: string | null;
  validity?: string;
  photoUrl?: string | null; // Profile image from tbl_alumni.image1
  initialCardImage?: string | null; // Initial card image from server (for SSR)
  medal?: string | null; // Medal type for card template selection
};

import { resolveAlumniCardValidityRaw, formatCardValidityMonthYear } from "@/lib/cardValidity";

export default function AlumniCardClient({
  studentName,
  department,
  faculty,
  campus,
  passingYear,
  alumniId,
  sapId,
  gender,
  cnicPassport,
  validity,
  photoUrl,
  initialCardImage,
  medal,
}: AlumniCardClientProps) {
  // Fetch card data client-side so it can be invalidated when admin downloads
  const { data: cardData, isLoading } = useCardStatus(sapId);

  // Use card_image from tblcard if available, otherwise fall back to initialCardImage or photoUrl
  const cardImage = cardData?.card_image ?? cardData?.cardpicture ?? initialCardImage ?? null;

  // Delivered cards use stored `validity_date` when set; other statuses use policy expiry (May 2029).
  let computedValidity = validity;
  if (cardData) {
    computedValidity = formatCardValidityMonthYear(
      resolveAlumniCardValidityRaw({
        status: cardData.status,
        validityDate: cardData.validity_date,
      })
    );
  }

  return (
    <ResponsiveCardScale>
      <AlumniCardTemplate
        studentName={studentName}
        department={department}
        faculty={faculty}
        campus={campus}
        passingYear={passingYear}
        alumniId={alumniId}
        gender={gender}
        cnicPassport={cnicPassport}
        validity={computedValidity}
        photoUrl={photoUrl}
        cardImage={cardImage}
        medal={medal}
      />
    </ResponsiveCardScale>
  );
}

// The card template renders at a fixed 332.26×212.03px geometry (every
// label is absolutely positioned in px), so on narrow panels it is scaled
// down rather than clipped — never scaled up past its natural size.
const CARD_W = 332.26;
const CARD_H = 212.03;

function ResponsiveCardScale({ children }: { children: React.ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const update = (w: number) => setScale(Math.min(1, w / CARD_W));
    update(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => update(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={hostRef}
      className="flex w-full justify-center overflow-hidden"
      style={{ height: CARD_H * scale }}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}>
        {children}
      </div>
    </div>
  );
}
