import { NextResponse } from "next/server";
import { sql, retryDbOperation } from "@/lib/dbconnect";
import {
  storyServerSchema,
  storyAlumniSelfSubmitWithoutSapSchema,
  adminEditSchema,
  parseStoryCriteriaFromBody,
  parseStoryCriteriaResponsesFromBody,
  normalizeStoryStatus,
  isStoryApproved,
  isStoryOwner,
  type StoryCriteriaResponseInput,
  type ServerStoryPayload,
  type AlumniSubmitStoryPayload,
  type AdminEditStoryPayload,
  sapIdNumericRegex,
} from "@/lib/alumniStories";
import {
  lookupAlumniForStorySubmit,
  injectResolvedStorySapId,
} from "@/lib/alumniStorySubmit";
import { auth } from "@/lib/auth";
import { canModify, isSuperAdminUser } from "@/lib/alumniProfile";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { getUploadsImagesDir } from "@/lib/uploadsDir";
import { sanitizeStoryHtml } from "@/lib/sanitizeStoryHtml";
import { pickAlumniContactEmail } from "@/lib/successStoryEmailContent";

type StoryDetailRow = {
  id: number;
  alumniid: number;
  alumnistories: string | null;
  story_image: string | null;
  status: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  createdat: string | null;
  storytitle: string | null;
  criteria_highlight: string | null;
  criteria_inspires: string | null;
  criteria_replicable: boolean | null;
  achievements: string | null;
  signature_confirmed: boolean | null;
  signature_confirmed_at: string | null;
  alumniname: string | null;
  degreetitle: string | null;
  academicsession: string | null;
  image1: string | null;
  sapid: string | null;
  personalemail: string | null;
  officialemail: string | null;
  universityemail: string | null;
};

export type StoryCriteriaResponseDetail = {
  criterion_id: number;
  label: string;
  response: string;
};

function mapStoryDetail(
  r: StoryDetailRow,
  responses: StoryCriteriaResponseDetail[],
  opts?: { includeContact?: boolean }
) {
  const detail = {
    id: String(r.id ?? ""),
    date: r.createdat ? new Date(r.createdat).toISOString() : new Date().toISOString(),
    title: String(r.storytitle ?? r.alumniname ?? ""),
    name: String(r.alumniname ?? ""),
    program: String(r.degreetitle ?? ""),
    session: String(r.academicsession ?? ""),
    shortDescription: String(r.alumnistories ?? ""),
    imageUrl: String(r.story_image ?? r.image1 ?? ""),
    status: normalizeStoryStatus(r.status),
    rejectionReason: r.rejection_reason ?? null,
    reviewedAt: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : null,
    criteriaHighlight: r.criteria_highlight ?? null,
    criteriaInspires: r.criteria_inspires ?? null,
    criteriaReplicable: r.criteria_replicable ?? null,
    achievements: r.achievements ?? null,
    signatureConfirmed: r.signature_confirmed ?? null,
    signatureConfirmedAt: r.signature_confirmed_at
      ? new Date(r.signature_confirmed_at).toISOString()
      : null,
    criteriaResponses: responses,
  };

  if (opts?.includeContact) {
    return {
      ...detail,
      alumniId: Number(r.alumniid),
      email: pickAlumniContactEmail(r.personalemail, r.officialemail, r.universityemail),
    };
  }

  return detail;
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    const { id } = await ctx.params;
    const storyId = Number(id);

    if (isNaN(storyId)) {
      return NextResponse.json({ message: "Invalid story ID" }, { status: 400 });
    }

    const rows = await retryDbOperation(
      async () =>
        await sql/* sql */`
      SELECT
        s.id,
        s.alumniid,
        s.alumnistories,
        s.story_image,
        s.status,
        s.rejection_reason,
        s.reviewed_at,
        s.createdat,
        s.storytitle,
        s.criteria_highlight,
        s.criteria_inspires,
        s.criteria_replicable,
        s.achievements,
        s.signature_confirmed,
        s.signature_confirmed_at,
        a.alumniname,
        a.degreetitle,
        a.academicsession,
        a.image1,
        a.sapid,
        a.personalemail,
        a.officialemail,
        a.universityemail
      FROM public.tblalumnistories s
      INNER JOIN public.tbl_alumni a ON a.alumniid = s.alumniid
      WHERE s.id = ${storyId}
        AND s.alumnistories IS NOT NULL
        AND s.alumnistories != ''
        AND TRIM(s.alumnistories) != ''
        AND a.alumniname IS NOT NULL
        AND TRIM(a.alumniname) != ''
      LIMIT 1`
    );

    const r = rows[0] as StoryDetailRow | undefined;

    if (!r) {
      return NextResponse.json(
        {
          message: "Story not found. This story may not exist or may have been removed.",
          error: "NOT_FOUND",
        },
        { status: 404 }
      );
    }

    const owner = isStoryOwner(session?.user, r);
    const staff = canModify(session?.user);

    if (!isStoryApproved(r.status) && !owner && !staff) {
      return NextResponse.json(
        {
          message: "Story not found. This story may not exist or may have been removed.",
          error: "NOT_FOUND",
        },
        { status: 404 }
      );
    }

    const responseRows = (await sql/* sql */`
      SELECT r.criterion_id, c.label, r.response
      FROM public.story_criteria_responses r
      JOIN public.story_criteria c ON c.id = r.criterion_id
      WHERE r.story_id = ${storyId}
      ORDER BY c.sort_order ASC, c.id ASC
    `) as Array<{ criterion_id: number; label: string; response: string }>;

    return NextResponse.json(mapStoryDetail(r, responseRows, { includeContact: staff }), { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch story";
    const isConnectionError =
      err instanceof Error &&
      (err.message.includes("CONNECT_TIMEOUT") ||
        err.message.includes("ETIMEDOUT") ||
        err.message.includes("timeout") ||
        (err as Error & { code?: string }).code === "CONNECT_TIMEOUT" ||
        (err as Error & { code?: string }).code === "ETIMEDOUT");

    if (isConnectionError) {
      return NextResponse.json(
        { error: "Database connection timeout. Please try again in a moment.", retryable: true },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const storyId = Number(id);

    if (isNaN(storyId)) {
      return NextResponse.json({ message: "Invalid story ID" }, { status: 400 });
    }

    const storyRows = await sql/* sql */`
      SELECT s.alumniid, a.sapid, a.personalemail, a.officialemail, a.universityemail
      FROM public.tblalumnistories s
      INNER JOIN public.tbl_alumni a ON a.alumniid = s.alumniid
      WHERE s.id = ${storyId}
      LIMIT 1
    `;

    if (!storyRows[0]) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const story = storyRows[0] as {
      alumniid: number;
      sapid: string | null;
      personalemail: string | null;
      officialemail: string | null;
      universityemail: string | null;
    };

    const alumniId = Number(story.alumniid);
    const isStaffEditor = canModify(session.user);
    const isOwner = isStoryOwner(session.user, story);

    if (!isStaffEditor && !isOwner) {
      return NextResponse.json(
        { error: "Forbidden: You can only update your own stories" },
        { status: 403 }
      );
    }

    if (isStaffEditor) {
      const accessFilter = await buildAccessFilterSQL(session, "");
      if (accessFilter.hasFilter && accessFilter.sql) {
        const accessCheck = await sql/* sql */`
          SELECT s.id
          FROM public.tblalumnistories s
          INNER JOIN public.tbl_alumni a ON a.alumniid = s.alumniid
          WHERE s.id = ${storyId}
            AND (${accessFilter.sql})
          LIMIT 1
        `;
        if (!accessCheck[0]) {
          return NextResponse.json({ error: "Story not found or access denied" }, { status: 404 });
        }
      }
    }

    const contentType = req.headers.get("content-type") || "";
    let rawPayload: Record<string, unknown>;
    let storyImageFilename: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const sapId = String(formData.get("sapId") || "");
      const name = String(formData.get("name") || "");
      const email = String(formData.get("email") || "");
      const faculty = String(formData.get("faculty") || "");
      const department = String(formData.get("department") || "");
      const passingYear = formData.get("passingYear") ? Number(formData.get("passingYear")) : null;
      const contactNumber = formData.get("contactNumber") ? String(formData.get("contactNumber")) : null;
      const storyTitle = String(formData.get("storyTitle") || "");
      const storyHtml = String(formData.get("storyHtml") || "");
      const imageFile = formData.get("storyImage") as File | null;
      const criteria = parseStoryCriteriaFromBody({
        criteriaHighlight: formData.get("criteriaHighlight"),
        criteriaInspires: formData.get("criteriaInspires"),
        criteriaReplicable: formData.get("criteriaReplicable"),
        achievements: formData.get("achievements"),
        signatureConfirmed: formData.get("signatureConfirmed"),
      });
      const criteriaResponses = parseStoryCriteriaResponsesFromBody({
        criteriaResponses: formData.get("criteriaResponses"),
      });

      if (imageFile && imageFile.size > 0) {
        const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
        if (!allowedTypes.includes(imageFile.type)) {
          return NextResponse.json(
            { error: "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed." },
            { status: 400 }
          );
        }

        const maxSize = 5 * 1024 * 1024;
        if (imageFile.size > maxSize) {
          return NextResponse.json({ error: "File size exceeds 5MB limit" }, { status: 400 });
        }

        const timestamp = Date.now();
        const extension = imageFile.name.split(".").pop() || "jpg";
        const baseFilename = `story-${timestamp}.${extension}`;
        storyImageFilename = baseFilename.length > 50 ? baseFilename.slice(0, 50) : baseFilename;

        const uploadsDir = getUploadsImagesDir();
        if (!existsSync(uploadsDir)) {
          await mkdir(uploadsDir, { recursive: true });
        }

        const filePath = join(uploadsDir, storyImageFilename);
        const bytes = await imageFile.arrayBuffer();
        await writeFile(filePath, Buffer.from(bytes));
      }

      rawPayload = {
        sapId,
        name,
        email,
        faculty,
        department,
        passingYear,
        contactNumber,
        storyTitle,
        storyHtml,
        ...criteria,
        criteriaResponses,
      };
    } else {
      const body = await req.json();
      rawPayload = {
        ...body,
        ...parseStoryCriteriaFromBody(body),
        criteriaResponses: parseStoryCriteriaResponsesFromBody(body),
      };
    }

    let preResolvedAlumni = null;
    if (!isStaffEditor) {
      preResolvedAlumni = await lookupAlumniForStorySubmit(
        session.user as { email?: string | null; sapid?: string | null; userId?: number | null },
        String(rawPayload.sapId ?? ""),
        String(rawPayload.email ?? "")
      );
      injectResolvedStorySapId(
        rawPayload,
        preResolvedAlumni,
        session.user as { email?: string | null; sapid?: string | null; userId?: number | null }
      );
    }

    const hasValidSapId = sapIdNumericRegex.test(String(rawPayload.sapId ?? "").trim());
    const baseSchema = isStaffEditor
      ? adminEditSchema
      : !preResolvedAlumni || hasValidSapId
        ? storyServerSchema
        : storyAlumniSelfSubmitWithoutSapSchema;

    const baseParsed = baseSchema.safeParse(rawPayload);
    if (!baseParsed.success) {
      return NextResponse.json({ message: "Validation failed", issues: baseParsed.error.format() }, { status: 422 });
    }

    let v: ServerStoryPayload | AlumniSubmitStoryPayload | AdminEditStoryPayload | Omit<AlumniSubmitStoryPayload, "sapId"> =
      baseParsed.data as ServerStoryPayload;

    // Load active criteria and validate dynamic responses for non-admin submissions.
    const activeCriteria = await sql/* sql */`
      SELECT id, label, is_required
      FROM public.story_criteria
      WHERE is_active = true
      ORDER BY sort_order ASC, id ASC
    ` as Array<{ id: number; label: string; is_required: boolean }>;

    const responseMap = new Map<number, string>();
    for (const r of ((v as ServerStoryPayload).criteriaResponses ?? [])) {
      responseMap.set(Number(r.criterion_id), String(r.response ?? ""));
    }

    const requiresCriteria = !isStaffEditor;
    const validationErrors: string[] = [];
    for (const c of activeCriteria) {
      const value = (responseMap.get(c.id) ?? "").trim();
      if (c.is_required && requiresCriteria && value === "") {
        validationErrors.push(`${c.label} is required`);
      } else if (value.length > 250) {
        validationErrors.push(`${c.label} must be 250 characters or fewer`);
      } else if (/[\r\n]/.test(value)) {
        validationErrors.push(`${c.label} must be a single line`);
      }
    }
    if (validationErrors.length > 0) {
      return NextResponse.json({ message: "Validation failed", errors: validationErrors }, { status: 422 });
    }

    const finalCriteriaResponses = activeCriteria.map((c) => ({
      criterion_id: c.id,
      response: (responseMap.get(c.id) ?? "").trim(),
    }));

    const criteriaHighlight: string | null =
      "criteriaHighlight" in v && v.criteriaHighlight ? String(v.criteriaHighlight).trim() : null;
    const criteriaInspires: string | null =
      "criteriaInspires" in v && v.criteriaInspires ? String(v.criteriaInspires).trim() : null;
    const criteriaReplicable: boolean | null =
      "criteriaReplicable" in v ? Boolean(v.criteriaReplicable) : null;
    const achievements: string | null =
      "achievements" in v && v.achievements ? String(v.achievements).trim() : null;
    const signatureConfirmed: boolean | null =
      "signatureConfirmed" in v ? Boolean(v.signatureConfirmed) : null;

    const cleanHtml = sanitizeStoryHtml(v.storyHtml);
    const resetModeration = !isStaffEditor;

    const updateQuery = storyImageFilename
      ? resetModeration
        ? sql/* sql */`
          UPDATE public.tblalumnistories
          SET alumnistories = ${cleanHtml},
              story_image = ${storyImageFilename},
              storytitle = ${v.storyTitle},
              createdat = NOW(),
              status = 'pending',
              rejection_reason = NULL,
              reviewed_by = NULL,
              reviewed_at = NULL,
              criteria_highlight = ${criteriaHighlight},
              criteria_inspires = ${criteriaInspires},
              criteria_replicable = ${criteriaReplicable},
              achievements = ${achievements},
              signature_confirmed = ${signatureConfirmed},
              signature_confirmed_at = ${signatureConfirmed === true ? sql`NOW()` : null}
          WHERE id = ${storyId}
          RETURNING id`
        : sql/* sql */`
          UPDATE public.tblalumnistories
          SET alumnistories = ${cleanHtml},
              story_image = ${storyImageFilename},
              storytitle = ${v.storyTitle},
              createdat = NOW(),
              criteria_highlight = ${criteriaHighlight},
              criteria_inspires = ${criteriaInspires},
              criteria_replicable = ${criteriaReplicable},
              achievements = ${achievements}
          WHERE id = ${storyId}
          RETURNING id`
      : resetModeration
        ? sql/* sql */`
          UPDATE public.tblalumnistories
          SET alumnistories = ${cleanHtml},
              storytitle = ${v.storyTitle},
              createdat = NOW(),
              status = 'pending',
              rejection_reason = NULL,
              reviewed_by = NULL,
              reviewed_at = NULL,
              criteria_highlight = ${criteriaHighlight},
              criteria_inspires = ${criteriaInspires},
              criteria_replicable = ${criteriaReplicable},
              achievements = ${achievements},
              signature_confirmed = ${signatureConfirmed},
              signature_confirmed_at = ${signatureConfirmed === true ? sql`NOW()` : null}
          WHERE id = ${storyId}
          RETURNING id`
        : sql/* sql */`
          UPDATE public.tblalumnistories
          SET alumnistories = ${cleanHtml},
              storytitle = ${v.storyTitle},
              createdat = NOW(),
              criteria_highlight = ${criteriaHighlight},
              criteria_inspires = ${criteriaInspires},
              criteria_replicable = ${criteriaReplicable},
              achievements = ${achievements}
          WHERE id = ${storyId}
          RETURNING id`;

    const result = await retryDbOperation(async () => await updateQuery);

    if (!result[0]) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const responsesToStore = finalCriteriaResponses.filter((resp) => resp.response !== "");
    if (responsesToStore.length > 0) {
      for (const resp of responsesToStore) {
        await sql/* sql */`
          INSERT INTO public.story_criteria_responses (story_id, criterion_id, response, created_at, updated_at)
          VALUES (${storyId}, ${resp.criterion_id}, ${resp.response}, NOW(), NOW())
          ON CONFLICT (story_id, criterion_id)
          DO UPDATE SET response = EXCLUDED.response, updated_at = NOW()
        `;
      }
    }

    if (isStaffEditor) {
      await sql/* sql */`
        UPDATE public.tbl_alumni
        SET alumniname = ${v.name},
            facultyname = ${v.faculty},
            departmentname = ${v.department},
            yearofending = ${v.passingYear ?? null},
            contactno = ${v.contactNumber ?? null},
            personalemail = ${v.email}
        WHERE alumniid = ${alumniId}`;
    } else if (v.contactNumber) {
      await sql/* sql */`
        UPDATE public.tbl_alumni
        SET contactno = ${v.contactNumber}
        WHERE alumniid = ${alumniId}`;
    }

    return NextResponse.json(
      {
        message: resetModeration ? "Story updated and submitted for review" : "Story updated successfully",
        id: String(storyId),
        status: resetModeration ? "pending" : undefined,
      },
      { status: 200 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update story";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden: Only super administrators can delete stories" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const storyId = Number(id);

    if (isNaN(storyId)) {
      return NextResponse.json({ message: "Invalid story ID" }, { status: 400 });
    }

    const res = await retryDbOperation(
      async () => await sql/* sql */`DELETE FROM public.tblalumnistories WHERE id = ${storyId} RETURNING id`
    );

    if (!res[0]) {
      return NextResponse.json({ message: "Story not found", error: "NOT_FOUND" }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete";
    const isConnectionError =
      err instanceof Error &&
      (err.message.includes("CONNECT_TIMEOUT") ||
        err.message.includes("ETIMEDOUT") ||
        err.message.includes("timeout") ||
        (err as Error & { code?: string }).code === "CONNECT_TIMEOUT" ||
        (err as Error & { code?: string }).code === "ETIMEDOUT");

    if (isConnectionError) {
      return NextResponse.json(
        { error: "Database connection timeout. Please try again in a moment.", retryable: true },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
