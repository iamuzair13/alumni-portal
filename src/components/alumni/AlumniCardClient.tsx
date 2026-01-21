"use client";

import { useCardStatus } from "@/app/queries/fetch-card-status";
import AlumniCardTemplate from "./AlumniCardTemplate";

type AlumniCardClientProps = {
  studentName: string;
  department: string;
  faculty: string;
  alumniId: string;
  sapId: string;
  validity?: string;
  photoUrl?: string | null; // Profile image from tbl_alumni.image1
  initialCardImage?: string | null; // Initial card image from server (for SSR)
};

import { computeValidityISOFromAppliedAt, formatCardValidityMonthYear } from "@/lib/cardValidity";

export default function AlumniCardClient({
  studentName,
  department,
  faculty,
  alumniId,
  sapId,
  validity,
  photoUrl,
  initialCardImage,
}: AlumniCardClientProps) {
  // Fetch card data client-side so it can be invalidated when admin downloads
  const { data: cardData, isLoading } = useCardStatus(sapId);

  // Use card_image from tblcard if available, otherwise fall back to initialCardImage or photoUrl
  const cardImage = cardData?.card_image ?? cardData?.cardpicture ?? initialCardImage ?? null;

  // Compute validity: if delivered, show 3 years after createdat; else fallback to provided validity
  let computedValidity = validity;
  if (cardData?.status?.toLowerCase() === "delivered") {
    if (cardData.validity_date) {
      computedValidity = formatCardValidityMonthYear(cardData.validity_date);
    } else if (cardData.createdat) {
      computedValidity = computeValidityISOFromAppliedAt(cardData.createdat, 3) ?? computedValidity;
    }
  }

  return (
    <AlumniCardTemplate
      studentName={studentName}
      department={department}
      faculty={faculty}
      alumniId={alumniId}
      validity={computedValidity}
      photoUrl={photoUrl}
      cardImage={cardImage}
    />
  );
}
