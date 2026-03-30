import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/alumniProfile";

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

    const roleRows = await sql/* sql */`
      SELECT id, leadership_type, role_name, role_description, office_term_governance_html, code_of_ethics, compliance_declaration
      FROM public.leadership_roles
      WHERE leadership_type = ${type}
        AND role_name = ${role}
      LIMIT 1
    `;

    const roleRow = (roleRows?.[0] as Record<string, unknown> | undefined) ?? null;

    const rows = await sql/* sql */`
      SELECT
        c.id,
        c.label,
        c.description,
        c.is_mandatory,
        c.sort_order,
        c.criterion_score,
        c.has_textbox,
        c.textbox_label,
        c.is_textbox_required
      FROM public.leadership_roles r
      JOIN public.leadership_role_criteria c ON c.role_id = r.id
      WHERE r.leadership_type = ${type}
        AND r.role_name = ${role}
      ORDER BY c.sort_order ASC, c.id ASC
    `;

    return NextResponse.json(
      {
        role: roleRow,
        roleDescription: roleRow ? String(roleRow.role_description ?? "") : "",
        officeTermGovernanceHtml: roleRow ? String((roleRow as any).office_term_governance_html ?? "") : "",
        codeOfEthics: roleRow ? String((roleRow as any).code_of_ethics ?? "") : "",
        complianceDeclaration: roleRow ? String((roleRow as any).compliance_declaration ?? "") : "",
        items: rows,
      },
      { status: 200 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch leadership criteria";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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
      label?: string;
      description?: string | null;
      isMandatory?: boolean;
      hasTextbox?: boolean;
      textboxLabel?: string | null;
      isTextboxRequired?: boolean;
      sortOrder?: number;
      criterionScore?: number;
    };

    const type = parseLeadershipType(body.type ?? null);
    const role = parseRoleName(body.role ?? null);
    const label = String(body.label ?? "").trim();
    const description = body.description === null || body.description === undefined ? null : String(body.description);
    const isMandatory = Boolean(body.isMandatory);
    const hasTextbox = Boolean(body.hasTextbox);
    const isTextboxRequired = Boolean(body.isTextboxRequired);
    const sortOrder = Number.isFinite(body.sortOrder as number) ? Number(body.sortOrder) : 0;
    const criterionScoreRaw = (body as any).criterionScore;
    const criterionScoreNum = Number(criterionScoreRaw);
    const criterionScore = Number.isFinite(criterionScoreNum) ? Math.trunc(criterionScoreNum) : NaN;
    const textboxLabel =
      body.textboxLabel === undefined || body.textboxLabel === null
        ? null
        : String(body.textboxLabel).trim() || null;

    if (!type || !role) {
      return NextResponse.json({ error: "Invalid type or role" }, { status: 400 });
    }

    if (!label) {
      return NextResponse.json({ error: "Label is required" }, { status: 400 });
    }

    if (!Number.isFinite(criterionScore) || criterionScore < 1) {
      return NextResponse.json({ error: "Criterion score is required and must be a positive integer" }, { status: 400 });
    }

    const roleRows = await sql/* sql */`
      SELECT id
      FROM public.leadership_roles
      WHERE leadership_type = ${type}
        AND role_name = ${role}
      LIMIT 1
    `;

    const roleId = Number((roleRows?.[0] as { id?: unknown } | undefined)?.id ?? 0);
    if (!roleId) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    const rows = await sql/* sql */`
      INSERT INTO public.leadership_role_criteria (
        role_id,
        label,
        description,
        is_mandatory,
        has_textbox,
        textbox_label,
        is_textbox_required,
        sort_order,
        criterion_score,
        created_at,
        updated_at
      )
      VALUES (
        ${roleId},
        ${label},
        ${description},
        ${isMandatory},
        ${hasTextbox},
        ${textboxLabel},
        ${isTextboxRequired},
        ${sortOrder},
        ${criterionScore},
        NOW(),
        NOW()
      )
      RETURNING
        id,
        label,
        description,
        is_mandatory,
        has_textbox,
        textbox_label,
        is_textbox_required,
        sort_order,
        criterion_score
    `;

    return NextResponse.json({ item: rows?.[0] ?? null }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create criteria";
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
      id?: number;
      label?: string;
      description?: string | null;
      isMandatory?: boolean;
      hasTextbox?: boolean;
      textboxLabel?: string | null;
      isTextboxRequired?: boolean;
      sortOrder?: number;
      criterionScore?: number;
    };

    const id = Number(body.id);
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const label = body.label === undefined ? undefined : String(body.label).trim();
    if (label !== undefined && !label) {
      return NextResponse.json({ error: "Label cannot be empty" }, { status: 400 });
    }

    const setLabel = body.label !== undefined;
    const labelValue = setLabel ? String(body.label ?? "").trim() : "";
    if (setLabel && !labelValue) {
      return NextResponse.json({ error: "Label cannot be empty" }, { status: 400 });
    }

    const setDescription = Object.prototype.hasOwnProperty.call(body, "description");
    const descriptionValue = setDescription ? (body.description === null ? null : String(body.description ?? "")) : null;

    const setMandatory = body.isMandatory !== undefined;
    const mandatoryValue = setMandatory ? Boolean(body.isMandatory) : false;

    const setHasTextbox = body.hasTextbox !== undefined;
    const hasTextboxValue = setHasTextbox ? Boolean(body.hasTextbox) : false;

    const setTextboxLabel = Object.prototype.hasOwnProperty.call(body, "textboxLabel");
    const textboxLabelValue = setTextboxLabel
      ? body.textboxLabel === null || body.textboxLabel === undefined
        ? null
        : String(body.textboxLabel).trim() || null
      : null;

    const setIsTextboxRequired = Object.prototype.hasOwnProperty.call(body, "isTextboxRequired");
    const isTextboxRequiredValue = setIsTextboxRequired ? Boolean(body.isTextboxRequired) : false;

    const setSort = body.sortOrder !== undefined;
    const sortValueRaw = setSort ? Number(body.sortOrder) : 0;
    const sortValue = Number.isFinite(sortValueRaw) ? sortValueRaw : 0;

    const setScore = Object.prototype.hasOwnProperty.call(body, "criterionScore");
    const scoreValueRaw = setScore ? Number((body as any).criterionScore) : NaN;
    const scoreValue = Number.isFinite(scoreValueRaw) ? Math.trunc(scoreValueRaw) : NaN;
    if (setScore && (!Number.isFinite(scoreValue) || scoreValue < 1)) {
      return NextResponse.json({ error: "Criterion score must be a positive integer" }, { status: 400 });
    }

    const rows = await sql/* sql */`
      UPDATE public.leadership_role_criteria
      SET
        label = CASE WHEN ${setLabel} THEN ${labelValue} ELSE label END,
        description = CASE WHEN ${setDescription} THEN ${descriptionValue} ELSE description END,
        is_mandatory = CASE WHEN ${setMandatory} THEN ${mandatoryValue} ELSE is_mandatory END,
        has_textbox = CASE WHEN ${setHasTextbox} THEN ${hasTextboxValue} ELSE has_textbox END,
        textbox_label = CASE WHEN ${setTextboxLabel} THEN ${textboxLabelValue} ELSE textbox_label END,
        is_textbox_required = CASE WHEN ${setIsTextboxRequired} THEN ${isTextboxRequiredValue} ELSE is_textbox_required END,
        sort_order = CASE WHEN ${setSort} THEN ${sortValue} ELSE sort_order END,
        criterion_score = CASE WHEN ${setScore} THEN ${scoreValue} ELSE criterion_score END,
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING
        id,
        label,
        description,
        is_mandatory,
        has_textbox,
        textbox_label,
        is_textbox_required,
        sort_order,
        criterion_score
    `;

    return NextResponse.json({ item: rows?.[0] ?? null }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update criteria";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await sql/* sql */`
      DELETE FROM public.leadership_role_criteria
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete criteria";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
