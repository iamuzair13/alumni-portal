import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { handleCorsPreflight, addCorsHeaders } from "@/lib/cors";
import {
  EXTERNAL_SUCCESS_STORY_BASE_WHERE,
  EXTERNAL_SUCCESS_STORY_SELECT,
  mapExternalSuccessStoryDetail,
  type ExternalSuccessStoryRow,
} from "@/lib/alumniStoriesPublic";

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

/**
 * GET /api/external/success-stories/{id}
 * Full details for a single approved alumni success story.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const storyId = parseInt(id, 10);

    if (isNaN(storyId) || storyId < 1) {
      const response = NextResponse.json(
        { data: null, error: "Invalid story ID" },
        { status: 400 }
      );
      return addCorsHeaders(response, request);
    }

    const rows = await sql/* sql */`
      ${EXTERNAL_SUCCESS_STORY_SELECT}
      WHERE ${EXTERNAL_SUCCESS_STORY_BASE_WHERE}
        AND s.id = ${storyId}
      LIMIT 1
    `;

    const row = (rows as unknown as ExternalSuccessStoryRow[])[0];
    if (!row) {
      const response = NextResponse.json(
        { data: null, error: "Story not found" },
        { status: 404 }
      );
      return addCorsHeaders(response, request);
    }

    const data = mapExternalSuccessStoryDetail(request, row);
    const response = NextResponse.json({ data, error: null });
    return addCorsHeaders(response, request);
  } catch (error) {
    const response = NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
    return addCorsHeaders(response, request);
  }
}
