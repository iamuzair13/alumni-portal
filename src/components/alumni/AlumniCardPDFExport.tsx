"use client";

import { useState } from "react";
import { DownloadIcon } from "@/icons";
import toast from "react-hot-toast";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type Props = {
  cardRef: React.RefObject<HTMLDivElement | null>;
  studentName: string;
  disabled?: boolean;
  /** Run after loading state starts — e.g. refetch alumni photo and update parent state before html2canvas */
  beforeExport?: () => Promise<void>;
  // Customization options
  cardData?: {
    studentName: string;
    department: string;
    faculty: string;
    alumniId: string;
    cnicPassport?: string | null;
    validity?: string;
    photoUrl?: string | null;
    cardImage?: string | null;
  };
};

export default function AlumniCardPDFExport({ cardRef, studentName, disabled = false, beforeExport, cardData }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleExportPDF = async () => {
    if (!cardRef.current || isGenerating) return;

    try {
      setIsGenerating(true);
      const loadingToast = toast.loading("Generating PDF...");

      await beforeExport?.();

      const photoEl = cardRef.current?.querySelector('[data-testid="alumni-card-photo"]') as HTMLImageElement | null;
      if (photoEl && (!photoEl.complete || photoEl.naturalHeight === 0)) {
        await new Promise<void>((resolve) => {
          const t = window.setTimeout(() => resolve(), 10000);
          const done = () => {
            window.clearTimeout(t);
            resolve();
          };
          photoEl.addEventListener("load", done, { once: true });
          photoEl.addEventListener("error", done, { once: true });
        });
      }

      // Get card data from ref or props
      // Extract data from the card element or use provided cardData
      let exportData = cardData;
      if (!exportData) {
        // For now, use the provided studentName and extract what we can
        exportData = {
          studentName: studentName,
          department: "Department", // Will be extracted from actual card
          faculty: "Faculty",
          alumniId: "UOL-AL-0000",
          validity: undefined,
          photoUrl: null,
          cardImage: null,
        };
      }

      toast.dismiss(loadingToast);

      // Ensure fonts are loaded (prevents text shifting)
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

      const templateRoot = cardRef.current.firstElementChild as HTMLElement | null;
      const cardSurface = (templateRoot?.firstElementChild as HTMLElement | null) ?? null;
      const exportEl = cardSurface ?? (cardRef.current as unknown as HTMLElement);

      const rect = exportEl.getBoundingClientRect();
      const canvas = await html2canvas(exportEl, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
        allowTaint: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });

      const imgData = canvas.toDataURL("image/png");
      const pageWidthPx = Math.round(rect.width);
      const pageHeightPx = Math.round(rect.height);

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [pageWidthPx, pageHeightPx],
      });

      pdf.addImage(imgData, "PNG", 0, 0, pageWidthPx, pageHeightPx);
      const filename = `${(exportData.studentName || "alumni-card").replace(/\s+/g, "-").toLowerCase()}-card.pdf`;
      pdf.save(filename);

      toast.success("PDF generated successfully!", {
        duration: 3000,
        style: {
          background: '#d1fae5',
          color: '#065f46',
          padding: '16px',
          borderRadius: '8px',
        },
      });
    } catch (error) {

      toast.error("Failed to open export view. Please try again.", {
        duration: 4000,
        style: {
          background: '#fee2e2',
          color: '#991b1b',
          padding: '16px',
          borderRadius: '8px',
        },
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleExportPDF}
      disabled={disabled || isGenerating}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#007bff] hover:bg-[#006bff] rounded-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      aria-label="Export card as PDF"
    >
      <DownloadIcon className="w-4 h-4" />
      {isGenerating ? "Opening..." : "Export PDF"}
    </button>
  );
}

