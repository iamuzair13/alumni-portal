"use client";

import { Roboto } from "next/font/google";
import { useState, useMemo, useEffect } from "react";

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
  photoUrl?: string; // URL to the profile picture
};

export default function AlumniCardTemplate({
  studentName,
  department,
  faculty,
  alumniId,
  validity,
  photoUrl,
}: AlumniCardTemplateProps) {
  const [imageError, setImageError] = useState(false);
  
  // Normalize photo URL
  const normalizedPhotoUrl = useMemo(() => {
    if (imageError) return "/images/person.jpg";
    if (!photoUrl || !photoUrl.trim()) return "/images/person.jpg";
    
    let imagePath = photoUrl.trim();
    
    // Fix typo: replace "tumbnail" with "thumbnail" if present
    imagePath = imagePath.replace(/\/tumbnail\//g, "/thumbnail/");
    
    // If already a valid path (starts with / or http), return as-is
    if (imagePath.startsWith("/") || imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
      return imagePath;
    }
    
    // If it's just a filename, prepend the alumni images thumbnail directory
    // Images are stored in /public/images/alumni-images/thumbnail/(imagename.extention)
    if (!imagePath.includes("/")) {
      return `/images/alumni-images/thumbnail/${imagePath}`;
    }
    
    // If it's a relative path without leading slash, add it
    return `/${imagePath}`;
  }, [photoUrl, imageError]);
  
  // Reset image error when photoUrl changes
  useEffect(() => {
    if (photoUrl) {
      setImageError(false);
    }
  }, [photoUrl]);
  // Format validity date
  const formattedValidity = (() => {
    if (!validity) return "MM/YYYY";
    
    // Handle both YYYY-MM and MM/YYYY formats
    let date: Date;
    if (validity.includes("/")) {
      // MM/YYYY format
      const [month, year] = validity.split("/");
      date = new Date(`${year}-${month.padStart(2, "0")}-01T00:00:00`);
    } else {
      // YYYY-MM format
      date = new Date(`${validity}-01T00:00:00`);
    }
    
    if (Number.isNaN(date.getTime())) return validity;
    
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${month}/${year}`;
  })();

  return (
    <div className={`${roboto.className} w-full`}>
      {/* Front of Card Only */}
      <div className="relative w-full overflow-hidden rounded-lg shadow-md">
        <img
          src={frontTemplate}
          alt="Alumni card front template"
          className="w-full h-auto object-contain"
        />

        <div className="absolute left-3 right-[35%] top-11 flex flex-col justify-center items-start  gap-0.9 text-[13px] leading-tight text-[#0f7a3a]">
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

        <div className="absolute right-8 top-10 flex h-[180px] w-[135px] items-center justify-center overflow-hidden rounded">
          <img
            src={normalizedPhotoUrl}
            alt={studentName || "Alumni"}
            className="h-full w-full object-cover"
            onError={() => {
              // Set error state to trigger fallback to default image
              if (!imageError) {
                setImageError(true);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

