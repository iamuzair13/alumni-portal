"use client";

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
  );
}
