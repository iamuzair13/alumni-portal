import { jsPDF } from "jspdf";
import { readFileSync } from "fs";
import { join } from "path";

// Helper function to get logo as base64
function getLogoBase64(): string {
  try {
    const logoPath = join(process.cwd(), "public", "images", "logo", "logo.png");
    const logoBuffer = readFileSync(logoPath);
    return `data:image/png;base64,${logoBuffer.toString("base64")}`;
  } catch (error) {
    return "";
  }
}

export interface ScholarshipApplicationData {
  alumniName: string;
  discountType: string;
  applyingFor: string;
  degreeTitle: string;
  kinshipRelation?: string | null;
  kinshipFirstName?: string | null;
  kinshipLastName?: string | null;
  kinshipName?: string | null; // Keep for backward compatibility
}

 export interface MembershipApplicationData {
   alumniName: string;
   membershipType: string;
   gymMembershipMonth?: string | null;
   swimmingPoolMembershipMonth?: string | null;
 }

export function generateScholarshipPDF(data: ScholarshipApplicationData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 50;
      const maxWidth = pageWidth - 2 * margin;
      let yPosition = margin;

      // Add logo on top right
      const logoBase64 = getLogoBase64();
      if (logoBase64) {
        try {
          const logoWidth = 40;
          const logoHeight = 20;
          const logoX = pageWidth - margin - logoWidth;
          const logoY = margin;
          doc.addImage(logoBase64, "PNG", logoX, logoY, logoWidth, logoHeight);
          yPosition = logoY + logoHeight + 15;
        } catch (logoError) {
          yPosition = margin + 10;
        }
      } else {
        yPosition = margin + 10;
      }

      // Draw a line under the header
      doc.setDrawColor(0, 102, 51); // Green color matching logo
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 15;

      // Header text (left aligned)
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 102, 51); // Green color
      doc.text("Alumni Scholarship Application", margin, yPosition);
      yPosition += 10;

      // Date (right aligned)
      const date = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0); // Black
      const dateText = `Date: ${date}`;
      const dateWidth = doc.getTextWidth(dateText);
      doc.text(dateText, pageWidth - margin - dateWidth, yPosition);
      yPosition += 20;

      // Helper function to add text with word wrapping
      const addText = (text: string, fontSize: number, isBold: boolean = false, align: "left" | "center" | "right" = "left", spacing: number = 5) => {
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        doc.setTextColor(0, 0, 0); // Black
        const lines = doc.splitTextToSize(text, maxWidth);
        const xPos = align === "center" ? pageWidth / 2 : align === "right" ? pageWidth - margin : margin;
        doc.text(lines, xPos, yPosition, { align, maxWidth });
        yPosition += lines.length * (fontSize * 0.4) + spacing;
      };

      // Salutation
      addText("Dear Concern,", 12, false, "left", 8);

      // Main content
      addText(`I, ${data.alumniName}, an alumnus of UOL, am applying for ${getDiscountLabel(data.discountType)}.`, 12, false, "left", 8);

      // Conditional content based on discount type
      if (data.discountType === "kinship") {
        const relation = data.kinshipRelation || "family member";
        // Use firstName and lastName if available, otherwise fall back to kinshipName
        const firstName = data.kinshipFirstName || "";
        const lastName = data.kinshipLastName || "";
        const name = firstName && lastName 
          ? `${firstName} ${lastName}` 
          : data.kinshipName || "beneficiary";
        const discountPercent = "15%";
        const pronoun = relation.toLowerCase().includes("sister")
          ? "She"
          : relation.toLowerCase().includes("brother")
          ? "He"
          : "She/He";
        addText(`I am applying for my ${relation}, ${name}. ${pronoun} can avail ${discountPercent} discount.`, 12, false, "left", 8);
      } else if (data.discountType === "masters-phd") {
        const discountPercent = data.applyingFor === "Masters" ? "50%" : "25%";
        addText(`I can avail ${discountPercent} discount for my ${data.applyingFor} program.`, 12, false, "left", 8);
      } else if (data.discountType === "masters-collaboration") {
        addText("I am eligible to apply for the Masters Scholarship via UOL International Collaborations.", 12, false, "left", 8);
      }

      addText(`Degree Title: ${data.degreeTitle}`, 12, false, "left", 8);
      addText("Please approve so that the applicant can proceed with the admission process.", 12, false, "left", 15);
      
      // Closing
      addText("Regards,", 12, false, "left", 8);
      addText(data.alumniName, 12, true, "left", 10);

      // Add footer line
      const footerY = pageHeight - 30;
      doc.setDrawColor(0, 102, 51);
      doc.setLineWidth(0.5);
      doc.line(margin, footerY, pageWidth - margin, footerY);
      
      // Footer text
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100); // Gray
      const footerText = "Office of Alumni Relations | University of Lahore";
      const footerWidth = doc.getTextWidth(footerText);
      doc.text(footerText, (pageWidth - footerWidth) / 2, footerY + 8);

      // Convert to buffer
      const pdfOutput = doc.output("arraybuffer");
      const buffer = Buffer.from(pdfOutput);
      resolve(buffer);
    } catch (error) {
      reject(error);
    }
  });
}

 export function generateMembershipPDF(data: MembershipApplicationData): Promise<Buffer> {
   return new Promise((resolve, reject) => {
     try {
       const doc = new jsPDF();
       const pageWidth = doc.internal.pageSize.getWidth();
       const pageHeight = doc.internal.pageSize.getHeight();
       const margin = 50;
       const maxWidth = pageWidth - 2 * margin;
       let yPosition = margin;

       const logoBase64 = getLogoBase64();
       if (logoBase64) {
         try {
           const logoWidth = 40;
           const logoHeight = 20;
           const logoX = pageWidth - margin - logoWidth;
           const logoY = margin;
           doc.addImage(logoBase64, "PNG", logoX, logoY, logoWidth, logoHeight);
           yPosition = logoY + logoHeight + 15;
         } catch (logoError) {
           yPosition = margin + 10;
         }
       } else {
         yPosition = margin + 10;
       }

       doc.setDrawColor(0, 102, 51);
       doc.setLineWidth(0.5);
       doc.line(margin, yPosition, pageWidth - margin, yPosition);
       yPosition += 15;

       doc.setFontSize(18);
       doc.setFont("helvetica", "bold");
       doc.setTextColor(0, 102, 51);
       doc.text("Alumni Membership Application", margin, yPosition);
       yPosition += 10;

       const date = new Date().toLocaleDateString("en-US", {
         year: "numeric",
         month: "long",
         day: "numeric",
       });
       doc.setFontSize(11);
       doc.setFont("helvetica", "normal");
       doc.setTextColor(0, 0, 0);
       const dateText = `Date: ${date}`;
       const dateWidth = doc.getTextWidth(dateText);
       doc.text(dateText, pageWidth - margin - dateWidth, yPosition);
       yPosition += 20;

       const addText = (
         text: string,
         fontSize: number,
         isBold: boolean = false,
         align: "left" | "center" | "right" = "left",
         spacing: number = 5
       ) => {
         doc.setFontSize(fontSize);
         doc.setFont("helvetica", isBold ? "bold" : "normal");
         doc.setTextColor(0, 0, 0);
         const lines = doc.splitTextToSize(text, maxWidth);
         const xPos = align === "center" ? pageWidth / 2 : align === "right" ? pageWidth - margin : margin;
         doc.text(lines, xPos, yPosition, { align, maxWidth });
         yPosition += lines.length * (fontSize * 0.4) + spacing;
       };

       addText("Dear Concern,", 12, false, "left", 8);

       addText(
         `I, ${data.alumniName}, an alumnus of UOL, am applying for ${data.membershipType} membership.`,
         12,
         false,
         "left",
         8
       );

       if (data.gymMembershipMonth) {
         addText(`Gym Membership Month: ${data.gymMembershipMonth}`, 12, false, "left", 8);
       }
       if (data.swimmingPoolMembershipMonth) {
         addText(`Swimming Pool Membership Month: ${data.swimmingPoolMembershipMonth}`, 12, false, "left", 8);
       }

       addText("Please approve so that the applicant can proceed with the process.", 12, false, "left", 15);

       addText("Regards,", 12, false, "left", 8);
       addText(data.alumniName, 12, true, "left", 10);

       const footerY = pageHeight - 30;
       doc.setDrawColor(0, 102, 51);
       doc.setLineWidth(0.5);
       doc.line(margin, footerY, pageWidth - margin, footerY);

       doc.setFontSize(9);
       doc.setFont("helvetica", "normal");
       doc.setTextColor(100, 100, 100);
       const footerText = "Office of Alumni Relations | University of Lahore";
       const footerWidth = doc.getTextWidth(footerText);
       doc.text(footerText, (pageWidth - footerWidth) / 2, footerY + 8);

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

export interface LeadershipApplicationPDFData {
  leadershipType: "chapter" | "association";
  status: string;
  position: string;
  applicant: {
    name: string;
    sapId: string;
    registrationNo?: string | null;
    email: string;
    faculty?: string | null;
    department?: string | null;
    program?: string | null;
  };
  criteria: Array<{
    label: string;
    description?: string | null;
    isMandatory: boolean;
    alumniConfirmed: boolean;
    adminConfirmed: boolean;
  }>;
  additionalAchievements?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  rejectionReason?: string | null;
}

export function generateLeadershipApplicationPDF(data: LeadershipApplicationPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 40;
      const maxWidth = pageWidth - 2 * margin;
      let y = margin;

      const logoBase64 = getLogoBase64();
      if (logoBase64) {
        try {
          const logoWidth = 40;
          const logoHeight = 20;
          const logoX = pageWidth - margin - logoWidth;
          const logoY = margin;
          doc.addImage(logoBase64, "PNG", logoX, logoY, logoWidth, logoHeight);
          y = logoY + logoHeight + 12;
        } catch {
          y = margin + 10;
        }
      } else {
        y = margin + 10;
      }

      doc.setDrawColor(0, 102, 51);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 14;

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 102, 51);
      doc.text("Leadership Application", margin, y);
      y += 8;

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);

      const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const dateText = `Date: ${date}`;
      doc.text(dateText, pageWidth - margin - doc.getTextWidth(dateText), y);
      y += 16;

      const addText = (text: string, fontSize: number, isBold: boolean = false, spacing: number = 6) => {
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        doc.setTextColor(0, 0, 0);
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, margin, y, { maxWidth });
        y += lines.length * (fontSize * 0.42) + spacing;
        if (y > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
      };

      const labelValue = (label: string, value: string) => {
        addText(`${label}: ${value}`, 11, false, 4);
      };

      addText(`Applicant: ${data.applicant.name || "-"}`, 12, true, 6);
      labelValue("Leadership Type", data.leadershipType === "chapter" ? "Chapter" : "Association");
      labelValue("Role", data.position || "-");
      labelValue("Status", String(data.status || "pending"));
      if (data.createdAt) labelValue("Created At", String(data.createdAt));
      if (data.updatedAt) labelValue("Updated At", String(data.updatedAt));
      if (data.rejectionReason) labelValue("Rejection Reason", String(data.rejectionReason));

      const idLine = data.applicant.sapId
        ? `SAP ID: ${data.applicant.sapId}`
        : data.applicant.registrationNo
          ? `Registration No: ${data.applicant.registrationNo}`
          : "";
      if (idLine) addText(idLine, 11, false, 4);
      if (data.applicant.email) addText(`Email: ${data.applicant.email}`, 11, false, 4);
      if (data.applicant.faculty) addText(`Faculty: ${data.applicant.faculty}`, 11, false, 4);
      if (data.applicant.department) addText(`Department: ${data.applicant.department}`, 11, false, 4);
      if (data.applicant.program) addText(`Program: ${data.applicant.program}`, 11, false, 8);

      addText("Criteria", 12, true, 6);
      if (!data.criteria || data.criteria.length === 0) {
        addText("No criteria found.", 11, false, 10);
      } else {
        data.criteria.forEach((c, idx) => {
          const flags = `${c.isMandatory ? "Mandatory" : "Optional"} | Alumni: ${c.alumniConfirmed ? "Yes" : "No"} | Admin: ${c.adminConfirmed ? "Yes" : "No"}`;
          addText(`${idx + 1}. ${c.label}`, 11, true, 2);
          if (c.description) addText(String(c.description), 10, false, 2);
          addText(flags, 10, false, 8);
        });
      }

      addText("Additional Achievements", 12, true, 6);
      addText(String(data.additionalAchievements || "No additional achievements provided."), 11, false, 10);

      const footerY = pageHeight - 24;
      doc.setDrawColor(0, 102, 51);
      doc.setLineWidth(0.5);
      doc.line(margin, footerY, pageWidth - margin, footerY);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      const footerText = "Office of Alumni Relations | University of Lahore";
      const footerWidth = doc.getTextWidth(footerText);
      doc.text(footerText, (pageWidth - footerWidth) / 2, footerY + 8);

      const pdfOutput = doc.output("arraybuffer");
      const buffer = Buffer.from(pdfOutput);
      resolve(buffer);
    } catch (error) {
      reject(error);
    }
  });
}

export function generateUpskillPDF(data: UpskillApplicationData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 50;
      const maxWidth = pageWidth - 2 * margin;
      let yPosition = margin;

      // Add logo on top right
      const logoBase64 = getLogoBase64();
      if (logoBase64) {
        try {
          const logoWidth = 40;
          const logoHeight = 20;
          const logoX = pageWidth - margin - logoWidth;
          const logoY = margin;
          doc.addImage(logoBase64, "PNG", logoX, logoY, logoWidth, logoHeight);
          yPosition = logoY + logoHeight + 15;
        } catch (logoError) {
          yPosition = margin + 10;
        }
      } else {
        yPosition = margin + 10;
      }

      // Draw a line under the header
      doc.setDrawColor(0, 102, 51); // Green color matching logo
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 15;

      // Header text (left aligned)
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 102, 51); // Green color
      doc.text("Upskill & Reskill Course Application", margin, yPosition);
      yPosition += 10;

      // Date (right aligned)
      const date = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0); // Black
      const dateText = `Date: ${date}`;
      const dateWidth = doc.getTextWidth(dateText);
      doc.text(dateText, pageWidth - margin - dateWidth, yPosition);
      yPosition += 20;

      // Helper function to add text with word wrapping
      const addText = (text: string, fontSize: number, isBold: boolean = false, align: "left" | "center" | "right" = "left", spacing: number = 5) => {
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        doc.setTextColor(0, 0, 0); // Black
        const lines = doc.splitTextToSize(text, maxWidth);
        const xPos = align === "center" ? pageWidth / 2 : align === "right" ? pageWidth - margin : margin;
        doc.text(lines, xPos, yPosition, { align, maxWidth });
        yPosition += lines.length * (fontSize * 0.4) + spacing;
      };

      // Salutation
      addText("Dear Concern,", 12, false, "left", 8);

      // Main content
      addText(`I, ${data.alumniName}, an alumnus of UOL, am applying for the ${data.courseName} offered by the ${data.departmentName} with 15% discount.`, 12, false, "left", 8);
      addText("Please approve my application so I can proceed with enrollment in this course/program.", 12, false, "left", 15);
      
      // Closing
      addText("Regards,", 12, false, "left", 8);
      addText(data.alumniName, 12, true, "left", 10);

      // Add footer line
      const footerY = pageHeight - 30;
      doc.setDrawColor(0, 102, 51);
      doc.setLineWidth(0.5);
      doc.line(margin, footerY, pageWidth - margin, footerY);
      
      // Footer text
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100); // Gray
      const footerText = "Office of Alumni Relations | University of Lahore";
      const footerWidth = doc.getTextWidth(footerText);
      doc.text(footerText, (pageWidth - footerWidth) / 2, footerY + 8);

      // Convert to buffer
      const pdfOutput = doc.output("arraybuffer");
      const buffer = Buffer.from(pdfOutput);
      resolve(buffer);
    } catch (error) {
      reject(error);
    }
  });
}
