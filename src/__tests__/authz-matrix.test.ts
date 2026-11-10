/**
 * T0.1 — Authorization matrix snapshot.
 *
 * Enumerates every `src/app/api/**\/route.ts`, invokes each exported method
 * as anonymous / alumniA / alumniB / viewer / admin / superadmin, and records
 * the HTTP status code. Results are compared against the committed snapshot at
 * `src/__tests__/snapshots/authz-matrix.snapshot.json`; a readable table is
 * written to `docs/security/authz-matrix.md`.
 *
 * Regenerate after an INTENTIONAL auth change:
 *   UPDATE_AUTHZ_MATRIX=1 npm test -- authz-matrix
 *
 * The `sql` client, `auth()`, email and the ERP client are all mocked — this
 * measures authorization behavior only, not data correctness.
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  collectMatrixEntry,
  listRouteFiles,
  matrixToMarkdown,
  METHODS,
  IDENTITY_ORDER,
  type Matrix,
} from "./helpers/authz";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const sqlMock = Object.assign(
  async (_strings: unknown, ..._vals: unknown[]) => [] as unknown[],
  {
    unsafe: async () => [] as unknown[],
    begin: async (fn: (tx: unknown) => unknown) => fn(sqlMock),
    end: async () => {},
    join: (parts: unknown[]) => parts,
    array: (v: unknown) => v,
    json: (v: unknown) => v,
    file: async () => [] as unknown[],
  }
);

vi.mock("@/lib/dbconnect", () => ({
  sql: sqlMock,
  retryDbOperation: async (op: () => Promise<unknown>) => op(),
  getDbQueryStats: () => ({ count: 0, totalMs: 0, entries: [] }),
  resetDbQueryStats: () => {},
}));

vi.mock("@/lib/auth", async () => {
  const helpers = await import("./helpers/authz");
  const notImpl = async () => new Response("next-auth stub", { status: 200 });
  return {
    auth: async () => helpers.sessionFor(helpers.authzState.identity),
    signIn: async () => {},
    signOut: async () => {},
    handlers: { GET: notImpl, POST: notImpl },
  };
});

vi.mock("@/lib/email", async () => {
  const actual = (await vi.importActual("@/lib/email")) as Record<string, unknown>;
  return new Proxy(actual, {
    get(target, prop) {
      const v = target[prop as keyof typeof target];
      if (typeof v === "function") {
        if (prop === "sendEmailDetailed") return async () => ({ ok: true });
        return async () => true;
      }
      return v;
    },
  });
});

vi.mock("@/lib/erpClient", () => ({
  erpClient: new Proxy(
    {},
    {
      get: () => async () => ({ success: false, error: "NOT_FOUND", data: null }),
    }
  ),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: () => undefined,
    getAll: () => [],
    set: () => {},
    delete: () => {},
    has: () => false,
  }),
  draftMode: async () => ({ isEnabled: false }),
}));

// ─── Snapshot handling ───────────────────────────────────────────────────────

const UPDATE = process.env.UPDATE_AUTHZ_MATRIX === "1";
const SNAPSHOT_DIR = path.resolve(process.cwd(), "src/__tests__/snapshots");
const SNAPSHOT_JSON = path.join(SNAPSHOT_DIR, "authz-matrix.snapshot.json");
const MATRIX_MD = path.resolve(process.cwd(), "docs/security/authz-matrix.md");

// ─── Tests ──────────────────────────────────────────────────────────────────

const files = listRouteFiles();
const matrix: Matrix = {};

describe("authorization matrix", () => {
  beforeAll(() => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const rel = path
      .relative(path.resolve(process.cwd(), "src/app"), file)
      .replace(/\\/g, "/")
      .replace(/\/route\.tsx?$/, "");
    it(`collects ${rel}`, async () => {
      const { route, entry } = await collectMatrixEntry(file);
      matrix[route] = entry;
    }, 60_000);
  }

  it("matches the committed baseline", () => {
    const json = JSON.stringify(matrix, null, 2);
    if (UPDATE) {
      fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
      fs.mkdirSync(path.dirname(MATRIX_MD), { recursive: true });
      fs.writeFileSync(SNAPSHOT_JSON, json + "\n", "utf8");
      fs.writeFileSync(MATRIX_MD, matrixToMarkdown(matrix), "utf8");
      console.log(
        `Wrote ${SNAPSHOT_JSON} and ${MATRIX_MD} (${Object.keys(matrix).length} routes)`
      );
      return;
    }

    expect(fs.existsSync(SNAPSHOT_JSON)).toBe(true);
    const committed = JSON.parse(fs.readFileSync(SNAPSHOT_JSON, "utf8")) as Matrix;

    const diffs: string[] = [];
    const allRoutes = new Set([...Object.keys(matrix), ...Object.keys(committed)]);
    for (const route of [...allRoutes].sort()) {
      const cur = matrix[route];
      const prev = committed[route];
      if (!prev) {
        diffs.push(`${route}: NEW ROUTE (no baseline)`);
        continue;
      }
      if (!cur) {
        diffs.push(`${route}: REMOVED from baseline`);
        continue;
      }
      for (const method of METHODS) {
        const curRow = cur[method];
        const prevRow = prev[method];
        if (!curRow && prevRow) {
          diffs.push(`${route} ${method}: removed`);
          continue;
        }
        if (curRow && !prevRow) {
          diffs.push(`${route} ${method}: new method`);
          continue;
        }
        if (!curRow || !prevRow) continue;
        for (const identity of IDENTITY_ORDER) {
          if (curRow[identity] !== prevRow[identity]) {
            diffs.push(
              `${route} ${method} ${identity}: ${String(prevRow[identity])} -> ${String(
                curRow[identity]
              )}`
            );
          }
        }
      }
    }

    if (diffs.length) {
      console.error(
        `\nAuthorization matrix changed (${diffs.length} diffs). ` +
          `If intentional, run UPDATE_AUTHZ_MATRIX=1 npm test -- authz-matrix\n` +
          diffs.map((d) => `  ${d}`).join("\n")
      );
    }
    expect(diffs).toEqual([]);
  });
});
