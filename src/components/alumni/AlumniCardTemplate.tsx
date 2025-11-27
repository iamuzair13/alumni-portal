"use client";

import { Roboto } from "next/font/google";

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
          {photoUrl ? (
            <img
              src={photoUrl || "./images/person.jpg"}
              alt={studentName || "Alumni"}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs">
              No Photo
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

