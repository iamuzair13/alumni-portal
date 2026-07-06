import { sql } from "@/lib/dbconnect";
import { sanitizeStoryHtml, storyHtmlTextContent } from "@/lib/sanitizeStoryHtml";
import { toAbsoluteEventImageUrl } from "@/lib/uploadsImageUrl";

const EXCERPT_MAX_LENGTH = 320;

export const EXTERNAL_SUCCESS_STORY_BASE_WHERE = sql`
  s.alumnistories IS NOT NULL
  AND s.alumnistories != ''
  AND TRIM(s.alumnistories) != ''
  AND LENGTH(TRIM(REGEXP_REPLACE(s.alumnistories, '<[^>]+>', '', 'g'))) > 0
  AND COALESCE(a.alumniname, '') != ''
  AND LOWER(COALESCE(s.status, 'pending')) = 'approved'
`;

export const EXTERNAL_SUCCESS_STORY_SELECT = sql`
  SELECT
    s.id,
    s.alumnistories,
    s.story_image,
    s.storytitle,
    s.createdat,
    a.alumniname,
    a.degreetitle,
    a.academicsession,
    a.yearofending,
    a.image1,
    COALESCE(f.faculty_name, a.facultyname) AS facultyname,
    COALESCE(d.department_name, a.departmentname) AS departmentname
  FROM public.tblalumnistories s
  INNER JOIN public.tbl_alumni a ON a.alumniid = s.alumniid
  LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
  LEFT JOIN public.tbl_departments d ON d.id = a.department
`;

export type ExternalSuccessStoryRow = {
  id: number;
  alumnistories: string | null;
  story_image: string | null;
  storytitle: string | null;
  createdat: string | null;
  alumniname: string | null;
  degreetitle: string | null;
  academicsession: string | null;
  yearofending: number | null;
  image1: string | null;
  facultyname: string | null;
  departmentname: string | null;
};

export type ExternalSuccessStoryListItem = {
  id: number;
  title: string;
  name: string;
  program: string;
  session: string;
  faculty: string;
  department: string;
  passingYear: number | null;
  publishedAt: string;
  excerpt: string;
  imageUrl: string;
};

export type ExternalSuccessStoryDetail = ExternalSuccessStoryListItem & {
  storyHtml: string;
  storyText: string;
};

export const EXTERNAL_SUCCESS_STORY_ORDER_COLUMNS: Record<string, string> = {
  createdat: "s.createdat",
  storytitle: "s.storytitle",
  id: "s.id",
};

function resolveStoryImageRaw(row: ExternalSuccessStoryRow): string {
  const storyImage = String(row.story_image ?? "").trim();
  if (storyImage && storyImage !== "null") return storyImage;
  const profileImage = String(row.image1 ?? "").trim();
  if (profileImage && profileImage !== "null") return profileImage;
  return "";
}

function buildExcerpt(html: string): string {
  const text = storyHtmlTextContent(html);
  if (text.length <= EXCERPT_MAX_LENGTH) return text;
  return `${text.slice(0, EXCERPT_MAX_LENGTH).trimEnd()}…`;
}

export function mapExternalSuccessStoryListItem(
  request: Request,
  row: ExternalSuccessStoryRow
): ExternalSuccessStoryListItem {
  const html = sanitizeStoryHtml(String(row.alumnistories ?? ""));
  return {
    id: Number(row.id),
    title: String(row.storytitle ?? row.alumniname ?? "").trim() || "Success Story",
    name: String(row.alumniname ?? "").trim(),
    program: String(row.degreetitle ?? "").trim(),
    session: String(row.academicsession ?? "").trim(),
    faculty: String(row.facultyname ?? "").trim(),
    department: String(row.departmentname ?? "").trim(),
    passingYear: row.yearofending != null ? Number(row.yearofending) : null,
    publishedAt: row.createdat ? new Date(row.createdat).toISOString() : new Date().toISOString(),
    excerpt: buildExcerpt(html),
    imageUrl: toAbsoluteEventImageUrl(request, resolveStoryImageRaw(row)),
  };
}

export function mapExternalSuccessStoryDetail(
  request: Request,
  row: ExternalSuccessStoryRow
): ExternalSuccessStoryDetail {
  const html = sanitizeStoryHtml(String(row.alumnistories ?? ""));
  const listItem = mapExternalSuccessStoryListItem(request, row);
  return {
    ...listItem,
    storyHtml: html,
    storyText: storyHtmlTextContent(html),
  };
}
