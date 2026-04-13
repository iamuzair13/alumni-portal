import type { AnalyticsModule } from "./types";

type TableRef = { schema: "public"; table: string };

export type ModuleSource =
  | {
      kind: "table";
      table: TableRef;
      timestampColumn: string;
      whereSql?: string; // must be safe constant fragment
    }
  | {
      kind: "union";
      // must yield a single column named "ts" of type timestamp/timestamptz
      unionSql: string; // safe constant SQL built from whitelisted identifiers only
    };

export const MODULES: ReadonlyArray<Exclude<AnalyticsModule, "dashboard">> = [
  "alumni",
  "alumni_cards",
  "alumni_talks",
  "alumni_chapters",
  "alumni_association",
  "scholarships",
  "memberships",
  "leadership",
  "jobs",
] as const;

export const moduleRegistry: Record<Exclude<AnalyticsModule, "dashboard">, ModuleSource> = {
  alumni: {
    kind: "table",
    table: { schema: "public", table: "tbl_alumni" },
    timestampColumn: "todaydate",
  },
  jobs: {
    kind: "table",
    table: { schema: "public", table: "tbljobs" },
    timestampColumn: "created_at",
  },
  memberships: {
    kind: "table",
    table: { schema: "public", table: "alumni_memberships" },
    timestampColumn: "created_at",
  },
  scholarships: {
    kind: "table",
    table: { schema: "public", table: "alumni_scholarships" },
    timestampColumn: "created_at",
  },
  alumni_talks: {
    kind: "table",
    table: { schema: "public", table: "alumni_talk_sessions" },
    timestampColumn: "created_at",
  },
  alumni_cards: {
    kind: "table",
    table: { schema: "public", table: "tblcard" },
    timestampColumn: "createdat",
  },
  alumni_association: {
    kind: "table",
    table: { schema: "public", table: "tbl_faculties" },
    timestampColumn: "created_at",
  },
  alumni_chapters: {
    kind: "table",
    table: { schema: "public", table: "tblchapters" },
    // NOTE: this may not exist in your DB; service will validate and throw 400 if missing.
    timestampColumn: "created_at",
    // If you later want only active chapters, uncomment:
    // whereSql: "is_active = true",
  },
  leadership: {
    kind: "union",
    unionSql:
      // Safe constant: all identifiers are hardcoded.
      // Produces a single column `ts` for the analytics service.
      `(
        SELECT cl.created_at AS ts FROM public.chapter_leadership cl WHERE cl.created_at IS NOT NULL
        UNION ALL
        SELECT ass.createddatetime AS ts FROM public.tblalumniassociation ass WHERE ass.createddatetime IS NOT NULL
      )`,
  },
};

