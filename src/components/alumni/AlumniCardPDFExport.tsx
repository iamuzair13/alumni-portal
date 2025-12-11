"use client";

import { useState } from "react";
import { DownloadIcon } from "@/icons";
import toast from "react-hot-toast";

type Props = {
  cardRef: React.RefObject<HTMLDivElement | null>;
  studentName: string;
  disabled?: boolean;
  // Customization options
  cardData?: {
    studentName: string;
    department: string;
    faculty: string;
    alumniId: string;
    validity?: string;
    photoUrl?: string | null;
    cardImage?: string | null;
  };
};

/**
 * Customizable styles for the alumni card export
 * 
 * To customize text sizes, image sizes, padding, and margins:
 * 1. Modify the values below
 * 2. Text sizes: Adjust nameSize, departmentSize, facultySize, idSize, validitySize
 * 3. Image sizes: Adjust photoWidth and photoHeight
 * 4. Padding: Adjust namePadding, departmentPadding, facultyPadding, idPadding, validityPadding, cardPadding
 * 5. Positioning: Adjust nameTop, nameLeft, idBottom, idLeft, photoTop, photoRight
 * 
 * All values use CSS units (px, em, rem, %, etc.)
 */
const CUSTOM_STYLES = {
  // Text sizes
  nameSize: "24px",           // Student name font size
  departmentSize: "20px",      // Department font size
  facultySize: "20px",         // Faculty font size
  idSize: "16px",              // Alumni ID font size
  validitySize: "16px",         // Validity font size
  
  // Image sizes
  photoWidth: "140px",         // Photo width
  photoHeight: "180px",         // Photo height
  
  // Padding and margins
  namePadding: "8px 0 0 16px",        // Name padding (vertical horizontal)
  departmentPadding: "18px 0 0 16px", // Department padding
  facultyPadding: "24px 0 0 16px",    // Faculty padding
  idPadding: "2px 0",         // ID padding
  validityPadding: "2px 0",   // Validity padding
  photoMargin: "60px -35px 0 0",           // Photo margin
  cardPadding: "20px",         // Overall card padding around the card container
  
  // Positioning adjustments (absolute positioning from edges)
  nameTop: "70px",            // Name top position from top of card
  nameLeft: "12px",            // Name left position from left of card
  idBottom: "115px",            // ID bottom position from bottom of card
  idLeft: "120px",              // ID left position from left of card
  photoTop: "28px",            // Photo top position from top of card
  photoRight: "100px",         // Photo right position from right of card
};

export default function AlumniCardPDFExport({ cardRef, studentName, disabled = false, cardData }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleExportPDF = async () => {
    if (!cardRef.current || isGenerating) return;

    try {
      setIsGenerating(true);
      const loadingToast = toast.loading("Opening export view...");

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

      // Create a new window with customized card
      const printWindow = window.open("", "_blank", "width=800,height=600");
      if (!printWindow) {
        toast.error("Please allow popups to export the card");
        setIsGenerating(false);
        return;
      }

      // Format validity date
      const formatValidity = (validity?: string) => {
        if (!validity) return "MM/YYYY";
        if (validity.includes("/")) {
          return validity;
        }
        const date = new Date(`${validity}-01T00:00:00`);
        if (Number.isNaN(date.getTime())) return validity;
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        return `${month}/${year}`;
      };

      const formattedValidity = formatValidity(exportData.validity);
      
      // Determine photo URL
      const getPhotoUrl = () => {
        if (exportData.cardImage) {
          const cardImg = String(exportData.cardImage).trim();
          if (cardImg && cardImg.toLowerCase() !== "null" && cardImg.toLowerCase() !== "undefined") {
            if (cardImg.startsWith("/") || cardImg.startsWith("http")) {
              return cardImg;
            }
            return `/images/${cardImg}`;
          }
        }
        if (exportData.photoUrl) {
          const photo = String(exportData.photoUrl).trim();
          if (photo && photo.toLowerCase() !== "null" && photo.toLowerCase() !== "undefined") {
            if (photo.startsWith("/") || photo.startsWith("http")) {
              return photo;
            }
            return `/images/${photo}`;
          }
        }
        return "/images/person.jpg";
      };

      const photoUrl = getPhotoUrl();
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

      // Write HTML content with custom styles
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Alumni Card Export - ${exportData.studentName}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
              
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              
              body {
                font-family: 'Roboto', sans-serif;
                background: #f5f5f5;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                padding: ${CUSTOM_STYLES.cardPadding};
              }
              
              .card-container {
                position: relative;
                width: 100%;
                max-width: 600px;
                overflow: hidden;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              }
              
              .card-background {
                width: 100%;
                height: auto;
                display: block;
              }
              
              .card-content {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
              }
              
              .student-name {
                position: absolute;
                left: ${CUSTOM_STYLES.nameLeft};
                top: ${CUSTOM_STYLES.nameTop};
                font-size: ${CUSTOM_STYLES.nameSize};
                font-weight: 600;
                color: #0f7a3a;
                padding: ${CUSTOM_STYLES.namePadding};
                line-height: 1.2;
                max-width: 60%;
              }
              
              .department {
                position: absolute;
                left: ${CUSTOM_STYLES.nameLeft};
                top: calc(${CUSTOM_STYLES.nameTop} + 24px);
                font-size: ${CUSTOM_STYLES.departmentSize};
                color: #0f7a3a;
                padding: ${CUSTOM_STYLES.departmentPadding};
                line-height: 1.3;
                max-width: 60%;
              }
              
              .faculty {
                position: absolute;
                left: ${CUSTOM_STYLES.nameLeft};
                top: calc(${CUSTOM_STYLES.nameTop} + 44px);
                font-size: ${CUSTOM_STYLES.facultySize};
                color: #0f7a3a;
                padding: ${CUSTOM_STYLES.facultyPadding};
                line-height: 1.3;
                max-width: 60%;
              }
              
              .alumni-id {
                position: absolute;
                left: ${CUSTOM_STYLES.idLeft};
                bottom: ${CUSTOM_STYLES.idBottom};
                font-size: ${CUSTOM_STYLES.idSize};
                font-weight: 500;
                color: #0f7a3a;
                padding: ${CUSTOM_STYLES.idPadding};
                line-height: 1.2;
              }
              
              .validity {
                position: absolute;
                left: ${CUSTOM_STYLES.idLeft};
                bottom: calc(${CUSTOM_STYLES.idBottom} - 16px);
                font-size: ${CUSTOM_STYLES.validitySize};
                font-weight: 500;
                color: #0f7a3a;
                padding: ${CUSTOM_STYLES.validityPadding};
                line-height: 1.2;
              }
              
              .photo-container {
                position: absolute;
                right: ${CUSTOM_STYLES.photoRight};
                top: ${CUSTOM_STYLES.photoTop};
                width: ${CUSTOM_STYLES.photoWidth};
                height: ${CUSTOM_STYLES.photoHeight};
                overflow: hidden;
                border-radius: 4px;
                background: #f3f4f6;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: ${CUSTOM_STYLES.photoMargin};
              }
              
              .photo-image {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
              }
              
              .export-controls {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                padding: 16px;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                z-index: 1000;
              }
              
              .export-controls button {
                background: #007bff;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                margin: 5px;
                transition: background 0.2s;
              }
              
              .export-controls button:hover {
                background: #0056b3;
              }
              
              .export-controls button:disabled {
                background: #ccc;
                cursor: not-allowed;
              }
            </style>
          </head>
          <body>
            <div class="export-controls">
              <button onclick="exportToPDF()" id="exportBtn">Download PDF</button>
              <button onclick="window.print()">Print</button>
              <button onclick="window.close()">Close</button>
            </div>
            
            <div class="card-container" id="cardElement">
              <img src="${baseUrl}/images/cards/alumni-card-front.jpg" alt="Card Background" class="card-background" />
              <div class="card-content">
                <div class="student-name">${exportData.studentName || "Alumni Name"}</div>
                <div class="department">${exportData.department || "Department"}</div>
                <div class="faculty">${exportData.faculty || "Faculty"}</div>
                <div class="alumni-id">${exportData.alumniId || "UOL-AL-0000"}</div>
                <div class="validity">${formattedValidity}</div>
                <div class="photo-container">
                  <img src="${baseUrl}${photoUrl}" alt="${exportData.studentName}" class="photo-image" onerror="this.src='${baseUrl}/images/person.jpg'" />
                </div>
              </div>
            </div>
            
            <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
            <script>
              let isExporting = false;
              
              async function exportToPDF() {
                if (isExporting) return;
                isExporting = true;
                const btn = document.getElementById('exportBtn');
                btn.disabled = true;
                btn.textContent = 'Generating PDF...';
                
                try {
                  const cardElement = document.getElementById('cardElement');
                  const canvas = await html2canvas(cardElement, {
                    scale: 3,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true,
                    allowTaint: true,
      });

      const imgData = canvas.toDataURL("image/png");
                  const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
        unit: "pt",
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
                  const filename = "${(exportData.studentName || "alumni-card").replace(/\s+/g, "-").toLowerCase()}-card.pdf";
      pdf.save(filename);
                  
                  btn.textContent = 'Download PDF';
                  alert('PDF generated successfully!');
                } catch (error) {
                  console.error('Error generating PDF:', error);
                  alert('Failed to generate PDF. Please try again.');
                } finally {
                  isExporting = false;
                  btn.disabled = false;
                }
              }
            </script>
          </body>
        </html>
      `);
      
      printWindow.document.close();

      toast.dismiss(loadingToast);
      toast.success("Export view opened in new tab!", {
        duration: 3000,
        style: {
          background: '#d1fae5',
          color: '#065f46',
          padding: '16px',
          borderRadius: '8px',
        },
      });
    } catch (error) {
      console.error("Error opening export view:", error);
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

