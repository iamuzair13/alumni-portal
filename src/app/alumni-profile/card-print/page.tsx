"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
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
const maleFrontTemplate = "/images/cards/alumni-card-male.jpeg";
const femaleFrontTemplate = "/images/cards/alumni-card-female.jpeg";
const backTemplate = "/images/cards/alumni-card-back.jpeg";

type AlumniCardData = {
  studentName: string;
  department: string;
  faculty: string;
  alumniId: string;
  campus?: string | null;
  passingYear?: number | string | null;
  gender?: string | null;
  sapId?: string | null;
  registrationNo?: string | null;
  validity?: string | null;
  appliedAt?: string | null;
  photoUrl?: string | null;
  cardImage?: string | null;
  cnicPassport?: string | null;
};

function CardPrintPageContent() {
  const searchParams = useSearchParams();
  const safeSearchParams = searchParams ?? new URLSearchParams();
  const sapId = safeSearchParams.get("sapid") || "";
  const autoDownload = safeSearchParams.get("download") === "1";
  
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
  const hasAutoDownloadedRef = useRef(false);

  const infoTextClass = (() => {
    const g = String(cardData?.gender ?? "").trim().toLowerCase();
    const isMale = g === "male" || g === "m";
    return isMale ? "text-[#0f7a3a]" : "text-white";
  })();

  const getFrontTemplate = () => {
    const g = String(cardData?.gender ?? "").trim().toLowerCase();
    if (g === "female" || g === "f") return femaleFrontTemplate;
    if (g === "male" || g === "m") return maleFrontTemplate;
    return maleFrontTemplate;
  };

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
          campus: alumni.campusname || null,
          passingYear: alumni.yearofending ?? null,
          gender: alumni.gender || null,
          sapId: alumni.sapid || null,
          registrationNo: alumni.registrationno || null,
          validity: validity,
          appliedAt: appliedAt,
          photoUrl: alumni.image1 || null,
          cardImage: cardImage,
          cnicPassport: alumni.cnicpassport || null,
        });
      } catch (err) {

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

  const preloadImage = (src: string) => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = src;
    });
  };

  const handleDownloadPDF = useCallback(async () => {
    if (!frontSideRef.current || !backSideRef.current || isGenerating || !cardData) return;

    let originalAlumniTransform: string | null = null;

    try {
      setIsGenerating(true);

      // Ensure fonts are loaded before rasterizing (prevents text shifting in canvas/PDF)
      if (typeof document !== "undefined" && "fonts" in document) {
        try {
          const fonts = (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts;
          if (fonts?.ready) {
            await fonts.ready;
          }
        } catch {
          // ignore
        }
      }

      // Ensure images are loaded before rasterizing
      await Promise.all([
        preloadImage(getFrontTemplate()),
        preloadImage(backTemplate),
        preloadImage(getPhotoUrl()),
      ]);

      if (alumniInfoRef.current) {
        originalAlumniTransform = alumniInfoRef.current.style.transform;
        alumniInfoRef.current.style.transform = "translateY(-6px)";
      }

      // Capture front side
      const frontRect = frontSideRef.current.getBoundingClientRect();
      const frontCanvas = await html2canvas(frontSideRef.current, {
        scale: Math.max(2, Math.ceil((typeof window !== "undefined" ? window.devicePixelRatio : 2) || 2)),
        backgroundColor: null, // Transparent background to avoid white space
        useCORS: true,
        allowTaint: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        width: Math.round(frontRect.width),
        height: Math.round(frontRect.height),
      });

      // Capture back side
      const backRect = backSideRef.current.getBoundingClientRect();
      const backCanvas = await html2canvas(backSideRef.current, {
        scale: Math.max(2, Math.ceil((typeof window !== "undefined" ? window.devicePixelRatio : 2) || 2)),
        backgroundColor: null, // Transparent background to avoid white space
        useCORS: true,
        allowTaint: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        width: Math.round(backRect.width),
        height: Math.round(backRect.height),
      });

      // Create PDF using the exact rendered pixel size of the card.
      // This avoids any stretching caused by cm->pt conversion mismatches.
      const pageWidthPx = Math.round(frontRect.width);
      const pageHeightPx = Math.round(frontRect.height);

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [pageWidthPx, pageHeightPx],
      });

      const frontImageData = frontCanvas.toDataURL("image/png");
      pdf.addImage(frontImageData, "PNG", 0, 0, pageWidthPx, pageHeightPx);

      pdf.addPage([pageWidthPx, pageHeightPx], "landscape");
      const backImageData = backCanvas.toDataURL("image/png");
      pdf.addImage(backImageData, "PNG", 0, 0, pageWidthPx, pageHeightPx);

      const filename = `${(cardData.studentName || "alumni-card").replace(/\s+/g, "-")}.pdf`;
      pdf.save(filename.toLowerCase());
    } finally {
      if (alumniInfoRef.current) {
        alumniInfoRef.current.style.transform = originalAlumniTransform ?? "";
      }
      setIsGenerating(false);
    }
  }, [cardData, isGenerating]);

  useEffect(() => {
    if (!autoDownload || !cardData) return;
    if (hasAutoDownloadedRef.current) return;
    if (isGenerating) return;

    hasAutoDownloadedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        await handleDownloadPDF();
        if (!cancelled) {
          window.setTimeout(() => {
            window.close();
          }, 500);
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [autoDownload, cardData, handleDownloadPDF, isGenerating]);

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
              width: "322px",
              height: "197px",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getFrontTemplate()}
              alt="Alumni card front template"
              className="w-full h-full object-cover"
              style={{
                borderRadius: "8px",
              }}
            />

            {/* Student Name */}
            <div className={`absolute left-[7%] right-[45%] top-[31%] flex flex-col gap-0.5 ${infoTextClass} flex flex-col justify-start items-start`}>
              <span className="text-[12px] leading-tight tracking-tight">
                {cardData.studentName || "Alumni Name"}
              </span>
            </div>

            {/* Alumni ID, Campus, Validity */}
            <div
              ref={alumniInfoRef}
              className={`absolute top-[44%] left-[23%] flex flex-col justify-start items-start gap-0.1 ${infoTextClass}`}
            >
              <span className="text-[11px] font-medium">{cardData.cnicPassport || "Passport"}</span>
              <span className="text-[10px] font-medium">{cardData.alumniId || "UOL-AL-0000"}</span>
              <span className="text-[10px] font-medium">{cardData.campus || "Campus"}</span>
              <span className="text-[10px] font-medium">{formattedValidity() || "Validity"}</span>
            </div>

            {/* Department | Passing Year and Faculty */}
            <div className={`absolute left-[7%] bottom-[10%] right-[35%] ${infoTextClass} flex flex-col justify-start items-start`}>
              <div className="text-[8px] font-medium leading-tight ">
                {cardData.department || "Department"}
                {cardData.passingYear ? ` | ${cardData.passingYear}` : ""}
              </div>
              <div className="text-[8px] font-medium leading-tight opacity-95">
                {cardData.faculty || "Faculty"}
              </div>
            </div>

            {/* Photo */}
            <div className="absolute right-[14%] top-[28%] flex  w-[20%] items-center justify-center overflow-hidden rounded-sm">
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
              width: "322px",
              height: "197px",
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
