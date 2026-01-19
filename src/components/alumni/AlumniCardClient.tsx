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

  return (
    <AlumniCardTemplate
      studentName={studentName}
      department={department}
      faculty={faculty}
      alumniId={alumniId}
      validity={validity}
      photoUrl={photoUrl}
      cardImage={cardImage}
    />
  );
}
