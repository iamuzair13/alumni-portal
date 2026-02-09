"use client";

import { Roboto } from "next/font/google";
import { useState, useMemo, useEffect } from "react";
import { formatCardValidityMonthYear } from "@/lib/cardValidity";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

// Images from public folder are referenced as URL strings
const frontTemplate = "/images/cards/alumni-card-front.jpg";

type AlumniCardTemplateProps = {
  studentName: string;
  department: string;
  faculty: string;
  alumniId: string;
  cnicPassport?: string | null;
  validity?: string; // Format: YYYY-MM or MM/YYYY
  photoUrl?: string | null; // Profile/thumbnail image filename or path
  cardImage?: string | null; // Dedicated card image filename or path
};

export default function AlumniCardTemplate({
  studentName,
  department,
  faculty,
  alumniId,
  cnicPassport,
  validity,
  photoUrl,
  cardImage,
}: AlumniCardTemplateProps) {
  const [imageIndex, setImageIndex] = useState(0);

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
      // Images are now stored directly in /images/
      return `/images/${imagePath}`;
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
          width: "8.5cm",
          height: "5.2cm",
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
        <div className="absolute left-[2%] right-[45%] top-[25%] flex flex-col gap-1 text-[#0f7a3a] flex flex-col justify-start items-start">
          <span className="text-[11px] font-semibold leading-tight tracking-tight">
            {studentName || "Alumni Name"}
          </span>
          <span className="text-[9px] font-semibold leading-tight">
            {department || "Department"}
          </span>
          <span className="text-[8px] font-semibold leading-tight">
            {faculty || "Faculty"}
          </span>
        </div>

        {/* Alumni ID and Validity */}
        <div className="absolute bottom-[28%] left-[20%] flex flex-col justify-start items-start gap-0.3 text-[#0f7a3a]">
          <span className="text-[8px] font-medium">{alumniId || "UOL-AL-0000"}</span>
          <span className="text-[8px] font-medium">{formattedValidity}</span>
        </div>

        {/* CNIC/Passport */}
        <div className="absolute bottom-[21%] left-[1%] flex flex-row justify-center items-center gap-8 text-[#0f7a3a]">
         <p className="text-[10px]">CNIC :</p> <span className="text-[8px] font-medium">{cnicPassport || ""}</span>
        </div>

        {/* Photo */}
        <div className="absolute right-[5%] top-[18%] flex  w-[30%] items-center justify-center overflow-hidden rounded-sm bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={`${activeImageSrc}-${imageIndex}`}
            src={activeImageSrc}
            alt={studentName || "Alumni"}
            className="h-full w-full object-cover"
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

