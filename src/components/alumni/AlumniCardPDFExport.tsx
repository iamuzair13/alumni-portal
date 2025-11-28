"use client";

import { useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { DownloadIcon } from "@/icons";
import toast from "react-hot-toast";

type Props = {
  cardRef: React.RefObject<HTMLDivElement | null>;
  studentName: string;
  disabled?: boolean;
};

export default function AlumniCardPDFExport({ cardRef, studentName, disabled = false }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleExportPDF = async () => {
    if (!cardRef.current || isGenerating) return;

    try {
      setIsGenerating(true);
      const loadingToast = toast.loading("Generating PDF...");

      // Capture the card element as canvas
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true,
      });

      // Create PDF with dimensions matching the canvas
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
        unit: "pt",
        format: [canvas.width, canvas.height],
      });

      // Add image to PDF
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);

      // Generate filename
      const filename = `${(studentName || "alumni-card").replace(/\s+/g, "-").toLowerCase()}-card.pdf`;

      // Save PDF
      pdf.save(filename);

      toast.dismiss(loadingToast);
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
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF. Please try again.", {
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
      {isGenerating ? "Generating PDF..." : "Export PDF"}
    </button>
  );
}

