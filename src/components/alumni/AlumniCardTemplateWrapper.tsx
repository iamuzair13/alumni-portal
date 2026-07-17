"use client";

import { useRef } from "react";
import AlumniCardTemplate from "./AlumniCardTemplate";
import AlumniCardPDFExport from "./AlumniCardPDFExport";

type AlumniCardTemplateWrapperProps = {
  studentName: string;
  department: string;
  faculty: string;
  alumniId: string;
  cnicPassport?: string | null;
  validity?: string;
  photoUrl?: string | null;
  cardImage?: string | null;
  medal?: string | null;
  cardStatus?: string | null; // Card status from database: "UnderReview", "UnderPrinting", "Active", "Onhold", "Delivered"
};

export default function AlumniCardTemplateWrapper({
  studentName,
  department,
  faculty,
  alumniId,
  cnicPassport,
  validity,
  photoUrl,
  cardImage,
  medal,
  cardStatus,
}: AlumniCardTemplateWrapperProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Download button available for ALL statuses (fixed rendering issue)
  const canDownload = true;

  return (
    <div>
      {canDownload && (
        <div className="mb-4 flex justify-end">
          <AlumniCardPDFExport 
            cardRef={cardRef} 
            studentName={studentName}
            cardData={{
              studentName,
              department,
              faculty,
              alumniId,
              cnicPassport,
              validity,
              photoUrl,
              cardImage,
              medal,
            }}
          />
        </div>
      )}
      <div ref={cardRef}>
        <AlumniCardTemplate
          studentName={studentName}
          department={department}
          faculty={faculty}
          alumniId={alumniId}
          cnicPassport={cnicPassport}
          validity={validity}
          photoUrl={photoUrl}
          cardImage={cardImage}
          medal={medal}
        />
      </div>
    </div>
  );
}

