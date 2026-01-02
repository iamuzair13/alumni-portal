"use client";

import { useRef } from "react";
import AlumniCardTemplate from "./AlumniCardTemplate";
import AlumniCardPDFExport from "./AlumniCardPDFExport";

type AlumniCardTemplateWrapperProps = {
  studentName: string;
  department: string;
  faculty: string;
  alumniId: string;
  validity?: string;
  photoUrl?: string | null;
  cardImage?: string | null;
  cardStatus?: string | null; // Card status from database: "Pending", "Process", "Active", "Delivered", "Onhold"
};

export default function AlumniCardTemplateWrapper({
  studentName,
  department,
  faculty,
  alumniId,
  validity,
  photoUrl,
  cardImage,
  cardStatus,
}: AlumniCardTemplateWrapperProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Show download button for Active, Delivered, In-Process, or Pending status
  const normalizedStatus = cardStatus ? String(cardStatus).trim().toUpperCase() : "";
  const canDownload = normalizedStatus === "ACTIVE" || normalizedStatus === "DELIVERED" || normalizedStatus === "PROCESS" || normalizedStatus === "PENDING";

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
              validity,
              photoUrl,
              cardImage,
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
          validity={validity}
          photoUrl={photoUrl}
          cardImage={cardImage}
        />
      </div>
    </div>
  );
}

