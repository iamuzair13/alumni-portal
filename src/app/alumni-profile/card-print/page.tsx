"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { flushSync } from "react-dom";
import { useSearchParams } from "next/navigation";
import { Roboto } from "next/font/google";
import html2canvas from "html2canvas";
import JsBarcode from "jsbarcode";
import jsPDF from "jspdf";
import { computeValidityISOFromAppliedAt } from "@/lib/cardValidity";
import { pickAlumniProfilePhotoFilename } from "@/lib/alumniProfilePhoto";
import { uploadsImageUrl } from "@/lib/uploadsImageUrl";
import AlumniCardTemplate from "@/components/alumni/AlumniCardTemplate";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const maleFrontTemplate = "/images/cards/alumni-card-male.jpeg";
const femaleFrontTemplate = "/images/cards/alumni-card-female.jpeg";
const backTemplate = "/images/cards/UOL-Alumni-Card-Artworks-Revised-Curve-png-back.png";

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

async function fetchCardPrintPayload(sapId: string): Promise<AlumniCardData> {
  const res = await fetch(`/api/alumni/${encodeURIComponent(sapId)}/full-details`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch alumni data");
  }

  const data = await res.json();
  const alumni = data.item;

  let cardRes: Response | undefined;
  try {
    cardRes = await fetch(`/api/alumni-cards/by-sap/${encodeURIComponent(sapId)}`, {
      cache: "no-store",
    });
  } catch {
    // Card row is optional (validity / dates only; photo comes from tbl_alumni)
  }

  const profileFilename = pickAlumniProfilePhotoFilename(alumni.image2, alumni.image1);

  let validity: string | null = null;
  let appliedAt: string | null = null;
  if (cardRes?.ok) {
    const cardJson = await cardRes.json();
    appliedAt = cardJson.card?.createdat || null;
    validity = cardJson.card?.validity_date || computeValidityISOFromAppliedAt(appliedAt) || null;
    const resolvedCardImage =
      cardJson.card?.card_image ||
      cardJson.card?.cardpicture ||
      null;
    if (resolvedCardImage) {
      return {
        studentName: alumni.alumniname || "",
        department: alumni.departmentname || "",
        faculty: alumni.facultyname || "",
        alumniId: alumni.sapid || alumni.registrationno || "UOL-AL-0000",
        campus: alumni.campusname || null,
        passingYear: alumni.yearofending ?? null,
        gender: alumni.gender || null,
        sapId: alumni.sapid || null,
        registrationNo: alumni.registrationno || null,
        validity,
        appliedAt,
        photoUrl: profileFilename,
        cardImage: resolvedCardImage,
        cnicPassport: alumni.cnicpassport || null,
      };
    }
  }

  return {
    studentName: alumni.alumniname || "",
    department: alumni.departmentname || "",
    faculty: alumni.facultyname || "",
    alumniId: alumni.sapid || alumni.registrationno || "UOL-AL-0000",
    campus: alumni.campusname || null,
    passingYear: alumni.yearofending ?? null,
    gender: alumni.gender || null,
    sapId: alumni.sapid || null,
    registrationNo: alumni.registrationno || null,
    validity,
    appliedAt,
    photoUrl: profileFilename,
    cardImage: null,
    cnicPassport: alumni.cnicpassport || null,
  };
}

function resolveProfileImageUrlForPreload(photoUrl: string | null | undefined, cacheBust?: number): string {
  const raw = String(photoUrl ?? "").trim();
  let path: string;
  if (!raw || raw.toLowerCase() === "null" || raw.toLowerCase() === "undefined") {
    path = uploadsImageUrl("person.jpg");
  } else if (raw.startsWith("http://") || raw.startsWith("https://")) {
    path = raw;
  } else if (raw.startsWith("/api/uploads/images/")) {
    path = raw;
  } else if (/^\/images\/[^/]+$/u.test(raw)) {
    path = uploadsImageUrl(raw);
  } else if (raw.startsWith("/")) {
    path = raw;
  } else {
    path = uploadsImageUrl(raw);
  }
  if (cacheBust && !path.startsWith("data:")) {
    return `${path}${path.includes("?") ? "&" : "?"}t=${cacheBust}`;
  }
  return path;
}

async function waitForAlumniCardPhoto(container: HTMLElement | null): Promise<void> {
  if (!container) return;
  const img = container.querySelector('[data-testid="alumni-card-photo"]') as HTMLImageElement | null;
  if (!img?.src) return;
  if (img.complete && img.naturalHeight > 0) return;
  await new Promise<void>((resolve) => {
    const timer = window.setTimeout(() => resolve(), 10000);
    const done = () => {
      window.clearTimeout(timer);
      resolve();
    };
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
  });
}

function CardPrintPageContent() {
  const searchParams = useSearchParams();
  const safeSearchParams = searchParams ?? new URLSearchParams();
  const sapId = safeSearchParams.get("sapid") || "";
  const autoDownload = safeSearchParams.get("download") === "1";
  
  const [cardData, setCardData] = useState<AlumniCardData | null>(null);
  const [pdfImageCacheBust, setPdfImageCacheBust] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const previewRef = useRef<HTMLDivElement>(null);
  const frontSideRef = useRef<HTMLDivElement>(null);
  const backSideRef = useRef<HTMLDivElement>(null);
  const sapBarcodeRef = useRef<SVGSVGElement>(null);
  const regBarcodeRef = useRef<SVGSVGElement>(null);
  const hasAutoDownloadedRef = useRef(false);

  // Fetch alumni + card metadata (photo always from tbl_alumni image2/image1 via fetchCardPrintPayload)
  useEffect(() => {
    const fetchAlumniData = async () => {
      if (!sapId) {
        setError("SAP ID is required");
        setIsLoading(false);
        return;
      }

      try {
        const payload = await fetchCardPrintPayload(sapId);
        setCardData(payload);
        setPdfImageCacheBust(0);
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
    if (!frontSideRef.current || !backSideRef.current || isGenerating || !sapId) return;

    try {
      setIsGenerating(true);

      // Always reload from DB so PDF uses current tbl_alumni image2/image1 (not tblcard or browser cache)
      const merged = await fetchCardPrintPayload(sapId);
      const bust = Date.now();
      flushSync(() => {
        setCardData(merged);
        setPdfImageCacheBust(bust);
      });

      const frontTpl = (() => {
        const g = String(merged.gender ?? "").trim().toLowerCase();
        if (g === "female" || g === "f") return femaleFrontTemplate;
        if (g === "male" || g === "m") return maleFrontTemplate;
        return maleFrontTemplate;
      })();

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

      const profilePhotoUrl = resolveProfileImageUrlForPreload(merged.photoUrl, bust);
      await Promise.all([
        preloadImage(frontTpl),
        preloadImage(backTemplate),
        preloadImage(profilePhotoUrl),
      ]);

      await waitForAlumniCardPhoto(frontSideRef.current);

      // Capture front side (new canvas each run — no reuse of prior PDF/canvas blobs)
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

      const filename = `${(merged.studentName || "alumni-card").replace(/\s+/g, "-")}.pdf`;
      pdf.save(filename.toLowerCase());
    } finally {
      setIsGenerating(false);
    }
  }, [sapId, isGenerating]);

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
          <div ref={frontSideRef}>
            <AlumniCardTemplate
              studentName={cardData.studentName}
              department={cardData.department}
              faculty={cardData.faculty}
              campus={cardData.campus ?? null}
              passingYear={cardData.passingYear ?? null}
              alumniId={cardData.alumniId}
              gender={cardData.gender ?? null}
              cnicPassport={cardData.cnicPassport ?? null}
              validity={cardData.validity ?? undefined}
              photoUrl={cardData.photoUrl ?? null}
              cardImage={cardData.cardImage ?? null}
              imageSrcCacheBust={pdfImageCacheBust || null}
            />
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
