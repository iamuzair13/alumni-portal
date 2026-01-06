"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Roboto } from "next/font/google";
import html2canvas from "html2canvas";
import JsBarcode from "jsbarcode";
import jsPDF from "jspdf";
import { computeValidityISOFromAppliedAt, formatCardValidityMonthYear } from "@/lib/cardValidity";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

// Images from public folder
const frontTemplate = "/images/cards/alumni-card-front.jpg";
const backTemplate = "/images/cards/alumni-card-back.jpg";

type AlumniCardData = {
  studentName: string;
  department: string;
  faculty: string;
  alumniId: string;
  sapId?: string | null;
  registrationNo?: string | null;
  validity?: string | null;
  appliedAt?: string | null;
  photoUrl?: string | null;
  cardImage?: string | null;
};

function CardPrintPageContent() {
  const searchParams = useSearchParams();
  const sapId = searchParams.get("sapid") || "";
  
  const [cardData, setCardData] = useState<AlumniCardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const previewRef = useRef<HTMLDivElement>(null);
  const frontSideRef = useRef<HTMLDivElement>(null);
  const backSideRef = useRef<HTMLDivElement>(null);
  const sapBarcodeRef = useRef<SVGSVGElement>(null);
  const regBarcodeRef = useRef<SVGSVGElement>(null);
  const alumniInfoRef = useRef<HTMLDivElement>(null);

  // Fetch alumni data
  useEffect(() => {
    const fetchAlumniData = async () => {
      if (!sapId) {
        setError("SAP ID is required");
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/alumni/${encodeURIComponent(sapId)}/full-details`, {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Failed to fetch alumni data");
        }

        const data = await res.json();
        const alumni = data.item;

        // Fetch card data
        let cardRes;
        try {
          cardRes = await fetch(`/api/alumni-cards/by-sap/${encodeURIComponent(sapId)}`, {
            cache: "no-store",
          });
        } catch {
          // Card data is optional
        }

        let cardImage: string | null = null;
        let validity: string | null = null;
        let appliedAt: string | null = null;
        if (cardRes?.ok) {
          const cardData = await cardRes.json();
          cardImage = cardData.card?.card_image || null;
          appliedAt = cardData.card?.createdat || null;
          validity = cardData.card?.validity_date || computeValidityISOFromAppliedAt(appliedAt) || null;
        }

        setCardData({
          studentName: alumni.alumniname || "",
          department: alumni.departmentname || "",
          faculty: alumni.facultyname || "",
          alumniId: alumni.sapid || alumni.registrationno || "UOL-AL-0000",
          sapId: alumni.sapid || null,
          registrationNo: alumni.registrationno || null,
          validity: validity,
          appliedAt: appliedAt,
          photoUrl: alumni.image1 || null,
          cardImage: cardImage,
        });
      } catch (err) {
        console.error("Error fetching alumni data:", err);
        setError(err instanceof Error ? err.message : "Failed to load card data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlumniData();
  }, [sapId]);

  // Generate barcode - only one at a time (prefer SAP ID, fallback to registration number)
  useEffect(() => {
    if (!cardData) return;

    // Determine which barcode to show (prefer SAP ID)
    const barcodeValue = cardData.sapId || cardData.registrationNo || "00000000";
    const barcodeRef = cardData.sapId ? sapBarcodeRef : regBarcodeRef;

    if (barcodeRef.current && barcodeValue) {
      try {
        JsBarcode(barcodeRef.current, barcodeValue.trim(), {
          format: "CODE128B",
          displayValue: false,
          lineColor: "#000",
          background: "transparent",
          height: 180,
          width: 8,
          margin: 0,
        });
      } catch {
        if (barcodeRef.current) {
          barcodeRef.current.innerHTML = "";
        }
      }
    }
  }, [cardData]);

  const formattedValidity = () => formatCardValidityMonthYear(cardData?.validity);

  const getPhotoUrl = () => {
    if (cardData?.cardImage) {
      const cardImg = String(cardData.cardImage).trim();
      if (cardImg && cardImg.toLowerCase() !== "null" && cardImg.toLowerCase() !== "undefined") {
        if (cardImg.startsWith("/") || cardImg.startsWith("http")) {
          return cardImg;
        }
        return `/images/${cardImg}`;
      }
    }
    if (cardData?.photoUrl) {
      const photo = String(cardData.photoUrl).trim();
      if (photo && photo.toLowerCase() !== "null" && photo.toLowerCase() !== "undefined") {
        if (photo.startsWith("/") || photo.startsWith("http")) {
          return photo;
        }
        return `/images/${photo}`;
      }
    }
    return "/images/person.jpg";
  };

  const handleDownloadPDF = async () => {
    if (!frontSideRef.current || !backSideRef.current || isGenerating || !cardData) return;

    let originalAlumniTransform: string | null = null;

    try {
      setIsGenerating(true);
      if (alumniInfoRef.current) {
        originalAlumniTransform = alumniInfoRef.current.style.transform;
        alumniInfoRef.current.style.transform = "translateY(-6px)";
      }

      // Card dimensions: 8.5cm width x 5.2cm height
      // Convert cm to points: 1cm = 28.35pt
      const cardWidthPt = 8.5 * 28.35;  // 240.975pt
      const cardHeightPt = 5.2 * 28.35; // 147.42pt

      // Capture front side
      const frontCanvas = await html2canvas(frontSideRef.current, {
        scale: 2,
        backgroundColor: null, // Transparent background to avoid white space
        useCORS: true,
        allowTaint: true,
        logging: false,
      });

      // Capture back side
      const backCanvas = await html2canvas(backSideRef.current, {
        scale: 2,
        backgroundColor: null, // Transparent background to avoid white space
        useCORS: true,
        allowTaint: true,
        logging: false,
      });

      // Create PDF with exact card dimensions (8.5cm x 5.2cm in points)
      const pdf = new jsPDF({
        orientation: "landscape", // Width > Height
        unit: "pt",
        format: [cardWidthPt, cardHeightPt],
      });

      // Add front side to first page (exact dimensions, no offsets)
      const frontImageData = frontCanvas.toDataURL("image/png");
      pdf.addImage(frontImageData, "PNG", 0, 0, cardWidthPt, cardHeightPt);

      // Add back side to second page (exact dimensions)
      pdf.addPage([cardWidthPt, cardHeightPt], "landscape");
      const backImageData = backCanvas.toDataURL("image/png");
      pdf.addImage(backImageData, "PNG", 0, 0, cardWidthPt, cardHeightPt);

      const filename = `${(cardData.studentName || "alumni-card").replace(/\s+/g, "-")}.pdf`;
      pdf.save(filename.toLowerCase());
    } finally {
      if (alumniInfoRef.current) {
        alumniInfoRef.current.style.transform = originalAlumniTransform ?? "";
      }
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading card data...</p>
        </div>
      </div>
    );
  }

  if (error || !cardData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-red-600">Error: {error || "Failed to load card data"}</p>
          <button
            onClick={() => window.close()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${roboto.className} min-h-screen bg-gray-100 py-8`}>
      {/* Control Buttons */}
      <div className="fixed top-4 right-4 z-50 flex gap-2 print:hidden">
        <button
          onClick={handleDownloadPDF}
          disabled={isGenerating}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          {isGenerating ? "Generating..." : "Download PDF"}
        </button>
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-lg"
        >
          Print
        </button>
        <button
          onClick={() => window.close()}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 shadow-lg"
        >
          Close
        </button>
      </div>

      {/* Card Preview */}
      <div className="flex flex-col items-center gap-8 px-4">
        <div
          ref={previewRef}
          className="flex flex-col items-center gap-10 bg-white p-10 rounded-lg shadow-lg"
        >
          {/* Front Side */}
          <div 
            ref={frontSideRef} 
            className="relative overflow-hidden rounded-lg"
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
            <div className="absolute left-[1%] right-[45%] top-[25%] flex flex-col gap-1 text-[#0f7a3a]">
              <span className="text-[11px] font-semibold leading-tight tracking-tight">
                {cardData.studentName || "Alumni Name"}
              </span>
              <span className="text-[9px] font-semibold leading-tight">
                {cardData.department || "Department"}
              </span>
              <span className="text-[8px] font-semibold leading-tight">
                {cardData.faculty || "Faculty"}
              </span>
            </div>

            {/* Alumni ID and Validity */}
            <div
              ref={alumniInfoRef}
              className="absolute bottom-[28%] left-[20%] flex flex-col gap-0.5 text-[#0f7a3a]"
            >
              <span className="text-[8px] font-medium">{cardData.alumniId || "UOL-AL-0000"}</span>
              <span className="text-[8px] font-medium">{formattedValidity()}</span>
            </div>

            {/* Photo */}
            <div className="absolute right-[4%] top-[16%] flex h-[70%] w-[32%] items-center justify-center overflow-hidden rounded-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getPhotoUrl()}
                alt={cardData.studentName || "Student"}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/images/person.jpg";
                }}
              />
            </div>
          </div>

          {/* Back Side */}
          <div 
            ref={backSideRef} 
            className="relative overflow-hidden rounded-lg"
            style={{
              width: "8.5cm",
              height: "5.2cm",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={backTemplate}
              alt="Alumni card back template"
              className="w-full h-full object-cover"
              style={{
                borderRadius: "8px",
              }}
            />

            {/* Barcode Container - Rotated 90 degrees - Only one barcode at a time */}
            {(cardData.sapId || cardData.registrationNo) && (
              <div
                className="absolute -right-[120px] top-[119px] flex h-[60px] w-[300px] items-stretch bg-white"
                style={{
                  transform: "rotate(90deg)",
                  transformOrigin: "center",
                  paddingTop: "4px",
                  paddingBottom: "4px",
                }}
              >
                <svg
                  ref={cardData.sapId ? sapBarcodeRef : regBarcodeRef}
                  className="h-full w-full origin-center"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white;
          }
          .print\\:hidden {
            display: none;
          }
          @page {
            margin: 0;
            size: auto;
          }
        }
      `}</style>
    </div>
  );
}

export default function CardPrintPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <CardPrintPageContent />
    </Suspense>
  );
}
