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
  isAdmin?: boolean;
};

export default function AlumniCardTemplateWrapper({
  studentName,
  department,
  faculty,
  alumniId,
  validity,
  photoUrl,
  cardImage,
  isAdmin = false,
}: AlumniCardTemplateWrapperProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      {isAdmin && (
        <div className="mb-4 flex justify-end">
          <AlumniCardPDFExport 
            cardRef={cardRef} 
            studentName={studentName}
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

