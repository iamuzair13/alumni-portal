import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/alumniProfile";
import { sql } from "@/lib/dbconnect";
import { jsPDF } from "jspdf";

type LeadershipType = "chapter" | "association";
type RoleName = "president" | "vice_president" | "coordinator";

type SectionKey = "role_description" | "code_of_ethics" | "compliance_declaration" | "office_term_governance";

function parseLeadershipType(v: string | null): LeadershipType | null {
  if (v === "chapter" || v === "association") return v;
  return null;
}

function parseRoleName(v: string | null): RoleName | null {
  if (v === "president" || v === "vice_president" || v === "coordinator") return v;
  return null;
}

function normalizeHtmlToText(html: string): string {
  return String(html || "")
    .replace(/\r\n/g, "\n")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/?p\b[^>]*>/gi, "\n")
    .replace(/<\/?div\b[^>]*>/gi, "\n")
    .replace(/<\/?h[1-6]\b[^>]*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(/<\/?(ul|ol)\b[^>]*>/gi, "\n")
    .replace(/<strong\b[^>]*>/gi, "")
    .replace(/<\/strong>/gi, "")
    .replace(/<b\b[^>]*>/gi, "")
    .replace(/<\/b>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function safeFilename(v: string): string {
  return String(v || "Document")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_\-]/g, "")
    .slice(0, 80);
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const type = parseLeadershipType(req.nextUrl.searchParams.get("type"));
    const role = parseRoleName(req.nextUrl.searchParams.get("role"));
    const section = String(req.nextUrl.searchParams.get("section") || "role_description") as SectionKey;

    if (!type || !role) {
      return NextResponse.json({ error: "type and role are required" }, { status: 400 });
    }

    if (section !== "role_description" && section !== "code_of_ethics" && section !== "compliance_declaration" && section !== "office_term_governance") {
      return NextResponse.json({ error: "Invalid section" }, { status: 400 });
    }

    const rows = await sql/* sql */`
      SELECT role_description, code_of_ethics, compliance_declaration, office_term_governance_html
      FROM public.leadership_roles
      WHERE leadership_type = ${type}
        AND role_name = ${role}
      LIMIT 1
    `;

    const row =
      (rows?.[0] as {
        role_description?: string | null;
        code_of_ethics?: string | null;
        compliance_declaration?: string | null;
        office_term_governance_html?: string | null;
      } | undefined) ??
      undefined;
    const html =
      section === "code_of_ethics"
        ? String(row?.code_of_ethics ?? "")
        : section === "compliance_declaration"
          ? String(row?.compliance_declaration ?? "")
          : section === "office_term_governance"
            ? String(row?.office_term_governance_html ?? "")
          : String(row?.role_description ?? "");

    const doc = new jsPDF("p", "pt", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const maxWidth = pageWidth - margin * 2;
    let y = margin;

    const ensureSpace = (needed: number) => {
      if (y + needed <= pageHeight - margin) return;
      doc.addPage();
      y = margin;
    };

    const addWrapped = (text: string, fontSize: number, bold: boolean, spacing: number) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(fontSize);
      const lines = doc.splitTextToSize(String(text || ""), maxWidth);
      const lineH = fontSize * 1.2;
      ensureSpace(lines.length * lineH + spacing);
      doc.text(lines, margin, y);
      y += lines.length * lineH + spacing;
    };

    const pdfTitle =
      section === "code_of_ethics"
        ? "Code of Ethics"
        : section === "compliance_declaration"
          ? "Compliance Declaration"
          : section === "office_term_governance"
            ? "Office Term & Related Governance"
          : "Role Description";
    addWrapped(pdfTitle, 16, true, 14);

    const bodyText = normalizeHtmlToText(html) || "-";
    addWrapped(bodyText, 11, false, 0);

    const pdf = doc.output("arraybuffer");

    const filename =
      section === "code_of_ethics"
        ? safeFilename(`Code_of_Ethics_${type}_${role}`) || "Code_of_Ethics"
        : section === "compliance_declaration"
          ? safeFilename(`Compliance_Declaration_${type}_${role}`) || "Compliance_Declaration"
          : section === "office_term_governance"
            ? safeFilename(`Office_Term_Governance_${type}_${role}`) || "Office_Term_Governance"
          : safeFilename(`Role_Description_${type}_${role}`) || "Role_Description";

    const body = new Uint8Array(pdf);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to generate PDF";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
