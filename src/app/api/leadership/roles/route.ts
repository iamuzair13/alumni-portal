import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/alumniProfile";
import { logAdminAction } from "@/lib/adminActivityLog";

type LeadershipType = "chapter" | "association";
type RoleName = "president" | "vice_president" | "coordinator";

function parseLeadershipType(v: string | null): LeadershipType | null {
  if (v === "chapter" || v === "association") return v;
  return null;
}

function parseRoleName(v: string | null): RoleName | null {
  if (v === "president" || v === "vice_president" || v === "coordinator") return v;
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const type = parseLeadershipType(req.nextUrl.searchParams.get("type"));
    const role = parseRoleName(req.nextUrl.searchParams.get("role"));

    if (!type || !role) {
      return NextResponse.json({ error: "type and role are required" }, { status: 400 });
    }

    const rows = await sql/* sql */`
      SELECT id, leadership_type, role_name, role_description, office_term_governance_html, code_of_ethics, compliance_declaration
      FROM public.leadership_roles
      WHERE leadership_type = ${type}
        AND role_name = ${role}
      LIMIT 1
    `;

    return NextResponse.json({ role: rows?.[0] ?? null }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch role";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      type?: LeadershipType;
      role?: RoleName;
      roleDescription?: string | null;
      officeTermGovernanceHtml?: string | null;
      codeOfEthics?: string | null;
      complianceDeclaration?: string | null;
    };

    const type = parseLeadershipType(body.type ?? null);
    const role = parseRoleName(body.role ?? null);
    if (!type || !role) {
      return NextResponse.json({ error: "Invalid type or role" }, { status: 400 });
    }

    const setRoleDescription = Object.prototype.hasOwnProperty.call(body, "roleDescription");
    const roleDescription = setRoleDescription
      ? (body.roleDescription === null ? null : String(body.roleDescription ?? ""))
      : null;

    const setGovernance = Object.prototype.hasOwnProperty.call(body, "officeTermGovernanceHtml");
    const officeTermGovernanceHtml = setGovernance
      ? (body.officeTermGovernanceHtml === null ? null : String(body.officeTermGovernanceHtml ?? ""))
      : null;

    const setCodeOfEthics = Object.prototype.hasOwnProperty.call(body, "codeOfEthics");
    const codeOfEthics = setCodeOfEthics
      ? (body.codeOfEthics === null ? null : String(body.codeOfEthics ?? ""))
      : null;

    const setComplianceDeclaration = Object.prototype.hasOwnProperty.call(body, "complianceDeclaration");
    const complianceDeclaration = setComplianceDeclaration
      ? (body.complianceDeclaration === null ? null : String(body.complianceDeclaration ?? ""))
      : null;

    const rows = await sql/* sql */`
      UPDATE public.leadership_roles
      SET
          role_description = CASE WHEN ${setRoleDescription} THEN ${roleDescription} ELSE role_description END,
          office_term_governance_html = CASE WHEN ${setGovernance} THEN ${officeTermGovernanceHtml} ELSE office_term_governance_html END,
          code_of_ethics = CASE WHEN ${setCodeOfEthics} THEN ${codeOfEthics} ELSE code_of_ethics END,
          compliance_declaration = CASE WHEN ${setComplianceDeclaration} THEN ${complianceDeclaration} ELSE compliance_declaration END
      WHERE leadership_type = ${type}
        AND role_name = ${role}
      RETURNING id, leadership_type, role_name, role_description, office_term_governance_html, code_of_ethics, compliance_declaration
    `;

    await logAdminAction({
      session,
      req,
      input: {
        action: "settings.leadership_role_update",
        entityType: "leadership_roles",
        success: true,
        metadata: { type, role },
      },
    });

    return NextResponse.json({ role: rows?.[0] ?? null }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update role description";
    await logAdminAction({
      session: null,
      req,
      input: {
        action: "settings.leadership_role_update",
        entityType: "leadership_roles",
        success: false,
        errorMessage: msg,
      },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
