"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Roboto } from "next/font/google";
import html2canvas from "html2canvas";
import JsBarcode from "jsbarcode";
import jsPDF from "jspdf";

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
  validity?: string;
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

        let cardImage = null;
        let validity = null;
        if (cardRes?.ok) {
          const cardData = await cardRes.json();
          cardImage = cardData.card?.card_image || null;
          validity = cardData.card?.validity_date || null;
        }

        setCardData({
          studentName: alumni.alumniname || "",
          department: alumni.departmentname || "",
          faculty: alumni.facultyname || "",
          alumniId: alumni.sapid || alumni.registrationno || "UOL-AL-0000",
          sapId: alumni.sapid || null,
          registrationNo: alumni.registrationno || null,
          validity: validity,
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

  const formattedValidity = () => {
    if (!cardData?.validity) return "MM/YYYY";
    if (cardData.validity.includes("/")) {
      return cardData.validity;
    }
    const date = new Date(`${cardData.validity}-01T00:00:00`);
    if (Number.isNaN(date.getTime())) return cardData.validity;
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${month}/${year}`;
  };

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
    if (!previewRef.current || isGenerating || !cardData) return;

    let originalAlumniTransform: string | null = null;

    try {
      setIsGenerating(true);
      if (alumniInfoRef.current) {
        originalAlumniTransform = alumniInfoRef.current.style.transform;
        alumniInfoRef.current.style.transform = "translateY(-6px)";
      }

      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true,
      });

      const imageData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
        unit: "pt",
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(imageData, "PNG", 0, 0, canvas.width, canvas.height);
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
          <div className="relative w-full max-w-[550px] overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={frontTemplate}
              alt="Alumni card front template"
              width={550}
              height={740}
              className="w-full h-auto object-cover"
            />

            <div className="absolute left-6 right-[40%] top-18 flex flex-col gap-2 text-[15px] leading-tight text-[#0f7a3a]">
              <span className="text-lg font-semibold tracking-tight">
                {cardData.studentName || "Alumni Name"}
              </span>
              <span className="font-semibold text-lg leading-tight">
                {cardData.department || "Department"}
              </span>
              <span className="font-semibold text-medium">
                {cardData.faculty || "Faculty"}
              </span>
            </div>

            <div
              ref={alumniInfoRef}
              className="absolute bottom-[87px] left-28 flex flex-col text-sm font-medium text-[#0f7a3a]"
            >
              <span>{cardData.alumniId || "UOL-AL-0000"}</span>
              <span>{formattedValidity()}</span>
            </div>

            <div className="absolute right-[42px] top-[50px] flex h-[214px] w-[158px] items-center justify-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getPhotoUrl()}
                alt={cardData.studentName || "Student"}
                width={150}
                height={195}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/images/person.jpg";
                }}
              />
            </div>
          </div>

          {/* Back Side */}
          <div className="relative aspect-7/4 w-full max-w-[520px] overflow-hidden rounded-3xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={backTemplate}
              alt="Alumni card back template"
              width={520}
              height={740}
              className="object-cover"
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
