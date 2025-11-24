import { jsPDF } from "jspdf";

export interface ScholarshipApplicationData {
  alumniName: string;
  discountType: string;
  applyingFor: string;
  degreeTitle: string;
  kinshipRelation?: string | null;
  kinshipName?: string | null;
}

export function generateScholarshipPDF(data: ScholarshipApplicationData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 50;
      const maxWidth = pageWidth - 2 * margin;
      let yPosition = margin;

      // Helper function to add text with word wrapping
      const addText = (text: string, fontSize: number, isBold: boolean = false, align: "left" | "center" | "right" = "left") => {
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, margin, yPosition, { align, maxWidth });
        yPosition += lines.length * (fontSize * 0.4) + 5;
      };

      // Header
      addText("University of Lahore", 20, true, "center");
      yPosition += 5;
      addText("Alumni Scholarship / Fee Discount Application", 16, false, "center");
      yPosition += 15;

      // Date
      const date = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      addText(`Date: ${date}`, 12, false, "right");
      yPosition += 10;

      // Salutation
      addText("Dear Concern,", 12);
      yPosition += 5;

      // Main content
      addText(`I, ${data.alumniName}, an alumnus of UOL, am applying for ${getDiscountLabel(data.discountType)}.`, 12);
      yPosition += 5;

      // Conditional content based on discount type
      if (data.discountType === "kinship") {
        const relation = data.kinshipRelation || "family member";
        const name = data.kinshipName || "beneficiary";
        const discountPercent = "15%";
        const pronoun = relation.toLowerCase().includes("sister")
          ? "She"
          : relation.toLowerCase().includes("brother")
          ? "He"
          : "She/He";
        addText(`I am applying for my ${relation}, ${name}. ${pronoun} can avail ${discountPercent} discount.`, 12);
      } else if (data.discountType === "masters-phd") {
        const discountPercent = data.applyingFor === "Masters" ? "50%" : "25%";
        addText(`I can avail ${discountPercent} discount for my ${data.applyingFor} program.`, 12);
      } else if (data.discountType === "masters-collaboration") {
        addText("I am eligible to apply for the Masters Scholarship via UOL International Collaborations.", 12);
      }

      yPosition += 5;
      addText(`Degree Title: ${data.degreeTitle}`, 12);
      yPosition += 5;
      addText("Please approve so that the applicant can proceed with the admission process.", 12);
      yPosition += 10;
      addText("Regards,", 12);
      yPosition += 5;
      addText(data.alumniName, 12);

      // Convert to buffer
      const pdfOutput = doc.output("arraybuffer");
      const buffer = Buffer.from(pdfOutput);
      resolve(buffer);
    } catch (error) {
      reject(error);
    }
  });
}

function getDiscountLabel(discountType: string): string {
  switch (discountType) {
    case "kinship":
      return "Kinship Discount";
    case "masters-phd":
      return "Masters/PhD Discount";
    case "masters-collaboration":
      return "Masters Scholarships via UOL International Collaborations";
    default:
      return "Scholarship/Discount";
  }
}

export interface UpskillApplicationData {
  alumniName: string;
  courseName: string;
  departmentName: string;
}

export function generateUpskillPDF(data: UpskillApplicationData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 50;
      const maxWidth = pageWidth - 2 * margin;
      let yPosition = margin;

      // Helper function to add text with word wrapping
      const addText = (text: string, fontSize: number, isBold: boolean = false, align: "left" | "center" | "right" = "left") => {
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, margin, yPosition, { align, maxWidth });
        yPosition += lines.length * (fontSize * 0.4) + 5;
      };

      // Header
      addText("University of Lahore", 20, true, "center");
      yPosition += 5;
      addText("Upskill & Reskill Course Application", 16, false, "center");
      yPosition += 15;

      // Date
      const date = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      addText(`Date: ${date}`, 12, false, "right");
      yPosition += 10;

      // Salutation
      addText("Dear Concern,", 12);
      yPosition += 5;

      // Main content
      addText(`I, ${data.alumniName}, an alumnus of UOL, am applying for the ${data.courseName} offered by the ${data.departmentName} with 15% discount.`, 12);
      yPosition += 10;
      addText("Please approve my application so I can proceed with enrollment in this course/program.", 12);
      yPosition += 10;
      addText("Regards,", 12);
      yPosition += 5;
      addText(data.alumniName, 12);

      // Convert to buffer
      const pdfOutput = doc.output("arraybuffer");
      const buffer = Buffer.from(pdfOutput);
      resolve(buffer);
    } catch (error) {
      reject(error);
    }
  });
}
