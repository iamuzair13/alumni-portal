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
  validity?: string; // Format: YYYY-MM or MM/YYYY
  photoUrl?: string | null; // Profile/thumbnail image filename or path
  cardImage?: string | null; // Dedicated card image filename or path
};

export default function AlumniCardTemplate({
  studentName,
  department,
  faculty,
  alumniId,
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
      console.log("[AlumniCardTemplate] Image candidates:", {
        cardImage,
        photoUrl,
        cardImageStr,
        photoUrlStr,
        candidates,
        cardImageNormalized: cardImageStr ? normalizeImagePath(cardImageStr) : null,
        photoUrlNormalized: photoUrlStr ? normalizeImagePath(photoUrlStr) : null,
      });
    }
    
    return candidates;
  }, [cardImage, photoUrl]);

  useEffect(() => {
    setImageIndex(0);
    // Debug logging
    if (typeof window !== "undefined") {
      console.log("[AlumniCardTemplate] Image props changed:", { cardImage, photoUrl });
    }
  }, [photoUrl, cardImage]);

  const activeImageSrc = imageCandidates[imageIndex] || "/images/person.jpg";
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.currentTarget;
    console.warn("[AlumniCardTemplate] Image failed to load:", {
      src: target.src,
      index: imageIndex,
      totalCandidates: imageCandidates.length,
      candidates: imageCandidates,
    });
    setImageIndex((prev) => {
      const next = prev + 1;
      if (next < imageCandidates.length) {
        console.log("[AlumniCardTemplate] Trying next image candidate:", imageCandidates[next]);
        return next;
      }
      console.warn("[AlumniCardTemplate] All image candidates failed, using fallback");
      return prev; // Stay on last candidate (fallback)
    });
  };
  // Format validity date
  // validity can be in MM/YYYY format (from database validity_date) or YYYY-MM format (computed fallback)
  const formattedValidity = formatCardValidityMonthYear(validity ?? null);

  return (
    <div className={`${roboto.className} w-full`}>
      {/* Front of Card Only */}
      <div className="relative w-full overflow-hidden rounded-lg shadow-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={frontTemplate}
          alt="Alumni card front template"
          className="w-full h-auto object-contain"
        />

        <div className="absolute left-3 right-[35%] top-11 flex flex-col justify-center items-start  gap-0.8 text-[13px] leading-tight text-[#0f7a3a]">
          <span className="text-[12px] font-semibold tracking-tight">
            {studentName || "Alumni Name"}
          </span>
          <span className=" text-[10px] leading-tight flex justify-start items-start text-left">
            {department || "Department"}
          </span>
          <span className=" text-[10px]">
            {faculty || "Faculty"}
          </span>
        </div>

        <div className="absolute bottom-12 left-20 flex flex-col text-[8px] font-medium text-[#0f7a3a]">
          <span>{alumniId || "UOL-AL-0000"}</span>
          <span>{formattedValidity}</span>
        </div>

        <div className="absolute right-[20px] top-6 flex h-[120px] w-[100x] items-center justify-center overflow-hidden rounded bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={`${activeImageSrc}-${imageIndex}`}
            src={activeImageSrc}
            alt={studentName || "Alumni"}
            className="h-full w-full object-cover"
            onError={handleImageError}
            onLoad={() => {
              if (typeof window !== "undefined") {
                console.log("[AlumniCardTemplate] Image loaded successfully:", activeImageSrc);
              }
            }}
            style={{ display: "block" }}
          />
        </div>
      </div>
    </div>
  );
}

