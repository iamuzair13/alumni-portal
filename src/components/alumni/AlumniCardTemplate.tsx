"use client";

import { Roboto } from "next/font/google";
import { useState, useMemo, useEffect } from "react";
import { formatCardValidityMonthYear } from "@/lib/cardValidity";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

// Images from public folder are referenced as URL strings
const maleFrontTemplate = "/images/cards/UOL-Alumni-Card-Artworks-Revised-Curve-png-04.png";
const femaleFrontTemplate = "/images/cards/UOL-Alumni-Card-Artworks-Revised-Curve-png-04.png";

type AlumniCardTemplateProps = {
  studentName: string;
  department: string;
  faculty: string;
  campus?: string | null;
  passingYear?: number | string | null;
  alumniId: string;
  gender?: string | null;
  cnicPassport?: string | null;
  validity?: string; // Format: YYYY-MM or MM/YYYY
  photoUrl?: string | null; // Profile/thumbnail image filename or path
  cardImage?: string | null; // Dedicated card image filename or path
};

export default function AlumniCardTemplate({
  studentName,
  department,
  faculty,
  campus,
  passingYear,
  alumniId,
  gender,
  cnicPassport,
  validity,
  photoUrl,
  cardImage,
}: AlumniCardTemplateProps) {
  const [imageIndex, setImageIndex] = useState(0);

  const infoTextClass = useMemo(() => {
    const g = String(gender ?? "").trim().toLowerCase();
    const isMale = g === "male" || g === "m";
    return isMale ? "text-[#163D30]" : "text-[#163D30]";
  }, [gender]);

  const frontTemplate = useMemo(() => {
    const g = String(gender ?? "").trim().toLowerCase();
    if (g === "female" || g === "f") return femaleFrontTemplate;
    if (g === "male" || g === "m") return maleFrontTemplate;
    return maleFrontTemplate;
  }, [gender]);

  const normalizeImagePath = (raw: string | null | undefined): string | null => {
    if (!raw) return null;
    let imagePath = raw.trim();
    if (!imagePath || imagePath.toLowerCase() === "null" || imagePath.toLowerCase() === "undefined") {
      return null;
    }
    // Remove old path references
    imagePath = imagePath.replace(/\/tumbnail\//g, "/");
    imagePath = imagePath.replace(/\/alumni-images\/thumbnail\//g, "/");
    imagePath = imagePath.replace(/\/alumni-images\/card\//g, "/");
    if (imagePath.startsWith("/") || imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
      return imagePath;
    }
    if (!imagePath.includes("/")) {
      // Uploaded images are served via API route
      return `/api/uploads/images/${imagePath}`;
    }
    return imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
  };

  const imageCandidates = useMemo(() => {
    const candidates: string[] = [];
    
    // Priority 1: Check "card" directory and "card_image" column in tblcard
    // Only add if cardImage (from card_image column) has a value
    const cardImageStr = cardImage ? String(cardImage).trim() : "";
    if (cardImageStr && cardImageStr.toLowerCase() !== "null" && cardImageStr.toLowerCase() !== "undefined") {
      const cardImg = normalizeImagePath(cardImageStr);
      if (cardImg) {
        candidates.push(cardImg); // /images/alumni-images/card/{cardImage}
      }
    }
    
    // Priority 2: Check "thumbnail" directory and "image1" column in tbl_alumni
    // Only add if photoUrl (from image1 column) has a value
    const photoUrlStr = photoUrl ? String(photoUrl).trim() : "";
    if (photoUrlStr && photoUrlStr.toLowerCase() !== "null" && photoUrlStr.toLowerCase() !== "undefined") {
      const thumbnail = normalizeImagePath(photoUrlStr);
      if (thumbnail) {
        candidates.push(thumbnail); // /images/alumni-images/thumbnail/{photoUrl}
      }
    }
    
    // Priority 3: Fallback image (always include)
    candidates.push("/images/person.jpg");
    
    // Debug logging (remove in production if needed)
    if (typeof window !== "undefined") {

    }
    
    return candidates;
  }, [cardImage, photoUrl]);

  useEffect(() => {
    setImageIndex(0);
    // Debug logging
    if (typeof window !== "undefined") {

    }
  }, [photoUrl, cardImage]);

  const activeImageSrc = imageCandidates[imageIndex] || "/images/person.jpg";
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.currentTarget;

    setImageIndex((prev) => {
      const next = prev + 1;
      if (next < imageCandidates.length) {

        return next;
      }

      return prev; // Stay on last candidate (fallback)
    });
  };
  // Format validity date
  // validity can be in MM/YYYY format (from database validity_date) or YYYY-MM format (computed fallback)
  const formattedValidity = formatCardValidityMonthYear(validity ?? null);

  return (
    <div className={`${roboto.className} w-full`}>
      {/* Front of Card Only */}
      <div 
        className="relative overflow-hidden rounded-lg shadow-md"
        style={{
          width: "321.26px",
          height: "212.03px",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={frontTemplate}
          alt="Alumni card front template"
          className="w-full h-full object-cover"
          style={{
            borderRadius: "8px",
          }}
        />

        {/* Student Name, Department, Faculty */}
        <div className={`absolute left-[7%] right-[45%] top-[33%] flex flex-col gap-0.5 ${infoTextClass}  justify-start items-start   w-full`}>
          <span className="text-[11px] font-bold  leading-tight tracking-tight">
            {studentName || "Alumni Name"}
          </span>
        </div>

        {/* Alumni ID and Validity */}
        <div className={`absolute top-[42%] left-[25%] flex flex-col gap-[3px] justify-start items-start ${infoTextClass}`}>
          <div className="h-[14px] text-[10px] font-medium leading-[14px]">
            {cnicPassport || "CNIC/Passport Missing"}
          </div>
          <div className="h-[14px] text-[10px] font-medium leading-[14px]">
            {alumniId || "UOL-AL-0000"}
          </div>
          <div className="h-[14px] text-[10px] font-medium leading-[14px]">
            {campus || "Campus Missing"}
          </div>
          <div className="h-[14px] text-[10px] font-medium leading-[14px]">
            {formattedValidity || "Validity Missing"}
          </div>
        </div>

        <div className={`absolute left-[7%] w-full bottom-[10%] right-[35%] ${infoTextClass} flex flex-col justify-start items-start`}>
          <div className="text-[8px] font-medium leading-tight ">
            {department || "Department"}
            {passingYear ? ` | ${passingYear}` : ""}
          </div>
          <div className="text-[8px] font-medium leading-tight opacity-95">
            {faculty || "Faculty"}
          </div>
        </div>


        {/* Photo */}
        <div className="absolute right-[12%] top-[24%] flex  w-[25%] items-center justify-center overflow-hidden rounded-sm bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={`${activeImageSrc}-${imageIndex}`}
            src={activeImageSrc}
            alt={studentName || "Alumni"}
            className="h-[110px] w-[80px]"
            onError={handleImageError}
            onLoad={() => {
              if (typeof window !== "undefined") {

              }
            }}
            style={{ display: "block" }}
          />
        </div>
      </div>
    </div>
  );
}

