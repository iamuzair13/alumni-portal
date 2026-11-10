/**
 * S1 — credential fields must never appear in serialized route responses.
 *
 * The mock sql returns rows that DO contain `password`, `password_hash`,
 * `reset_token` and nested credential keys — exactly what `SELECT a.*` used to
 * fetch. Every response is deep-scanned: no key whose name matches a known
 * credential field may exist at any depth.
 *
 * These tests FAIL on the pre-fix code (a.* queries + deliberate
 * `password: ...` response fields) and pass after it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "node:path";
import { NextRequest } from "next/server";
import { authzState, sessionFor, urlForRoute, paramsForRoute, type Identity, type Handler } from "./helpers/authz";
import {
  stripSensitive,
  ALUMNI_DETAIL_COLUMNS,
  ALUMNI_EXPORT_COLUMNS,
  ALUMNI_LIST_COLUMNS,
  ALUMNI_SELF_COLUMNS,
} from "@/lib/alumniColumns";

// ─── Mocks ──────────────────────────────────────────────────────────────────

/**
 * Rows the fake DB returns for ANY query — deliberately packed with
 * credential-looking keys (what `SELECT a.*` used to fetch).
 */
const hoisted = vi.hoisted(() => {
  const result: Record<string, unknown>[] = [
    {
      alumniid: 2,
      sapid: "SAP-B-001",
      registrationno: "REG-B-1",
      alumniname: "Leaky Row",
      personalemail: "alumni.b@test.local",
      officialemail: "b.official@test.local",
      universityemail: "b.uni@test.local",
      faculty: null,
      department: null,
      program: null,
      password: "hunter2",
      password_hash: "$2b$10$deadbeef",
      reset_token: "reset-secret",
      deep: { nested: { password: "nested-leak", password_hash: "h" } },
      tags: [{ password: "in-array" }],
      // users-table shaped fields (users routes reuse the same rows)
      userid: 999,
      id: 999,
      email: "victim@test.local",
      type: "viewer",
      firstname: "Victim",
    },
  ];
  const sqlMock = Object.assign(
    async (_strings: unknown, ..._vals: unknown[]) => result as unknown[],
    {
      unsafe: async () => result as unknown[],
      begin: async (fn: (tx: unknown) => unknown) => fn(sqlMock),
      end: async () => {},
      join: (parts: unknown[]) => parts,
      array: (v: unknown) => v,
      json: (v: unknown) => v,
      file: async () => result as unknown[],
    }
  );
  return { sqlMock, sqlState: { result } };
});
const sqlState = hoisted.sqlState;

vi.mock("@/lib/dbconnect", () => ({
  sql: hoisted.sqlMock,
  retryDbOperation: async (op: () => Promise<unknown>) => op(),
}));

vi.mock("@/lib/auth", () => ({
  auth: async () => sessionFor(authzState.identity),
  signIn: async () => {},
  signOut: async () => {},
}));

vi.mock("@/lib/email", () => ({
  sendEmail: async () => true,
  sendEmailDetailed: async () => ({ ok: true }),
}));

vi.mock("@/lib/erpClient", () => ({
  erpClient: new Proxy({}, { get: () => async () => ({ success: false, error: "NOT_FOUND", data: null }) }),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: () => undefined, getAll: () => [], set: () => {}, delete: () => {}, has: () => false,
  }),
  draftMode: async () => ({ isEnabled: false }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SENSITIVE_KEY_RE = /^(password|password_hash|passwordhash|passwd|reset_token|resettoken|passwordresettoken|verification_token|verificationtoken)$/i;

/** Recursively collect paths of every sensitive-looking key in a JSON value. */
function sensitiveKeyPaths(value: unknown, base = "$", out: string[] = []): string[] {
  if (value !== null && typeof value === "object") {
    if (Array.isArray(value)) {
      value.forEach((v, i) => sensitiveKeyPaths(v, `${base}[${i}]`, out));
    } else {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (SENSITIVE_KEY_RE.test(k)) out.push(`${base}.${k}`);
        sensitiveKeyPaths(v, `${base}.${k}`, out);
      }
    }
  }
  return out;
}

type RouteModule = Record<string, Handler | unknown>;

async function loadRoute(relPath: string): Promise<RouteModule> {
  const file = path.resolve(process.cwd(), "src/app", relPath);
  return (await import(file.split(path.sep).join("/"))) as RouteModule;
}

async function callRoute(
  identity: Identity,
  routePath: string,
  mod: RouteModule,
  method = "GET"
): Promise<{ status: number; json: unknown }> {
  authzState.identity = identity;
  const handler = mod[method] as Handler | undefined;
  if (typeof handler !== "function") throw new Error(`${routePath} has no ${method}`);
  const req = new NextRequest(urlForRoute(routePath), { method });
  const ctx = { params: Promise.resolve(paramsForRoute(routePath)) };
  const res = await handler(req, ctx);
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

beforeEach(() => {
  if (sqlState.result.length === 0) {
    sqlState.result.push({ password: "hunter2" });
  }
});

// ─── Route matrix ────────────────────────────────────────────────────────────

const CASES: Array<{ route: string; file: string; identity: Identity }> = [
  { route: "/api/alumni/export", file: "api/alumni/export/route.ts", identity: "superadmin" },
  { route: "/api/alumni-cards/export", file: "api/alumni-cards/export/route.ts", identity: "superadmin" },
  { route: "/api/alumni/association/export", file: "api/alumni/association/export/route.ts", identity: "superadmin" },
  { route: "/api/alumni/chapters/export", file: "api/alumni/chapters/export/route.ts", identity: "superadmin" },
  { route: "/api/alumni/participation/export", file: "api/alumni/participation/export/route.ts", identity: "superadmin" },
  { route: "/api/alumni/[sapid]", file: "api/alumni/[sapid]/route.ts", identity: "superadmin" },
  { route: "/api/alumni/[sapid]/full-details", file: "api/alumni/[sapid]/full-details/route.ts", identity: "superadmin" },
  { route: "/api/users", file: "api/users/route.ts", identity: "superadmin" },
  { route: "/api/users/[userid]", file: "api/users/[userid]/route.ts", identity: "superadmin" },
  { route: "/api/users/current", file: "api/users/current/route.ts", identity: "admin" },
];

describe("credential fields never reach serialized responses", () => {
  for (const { route, file, identity } of CASES) {
    it(`GET ${route} as ${identity} contains no credential keys`, async () => {
      const mod = await loadRoute(file);
      const { status, json } = await callRoute(identity, route, mod, "GET");
      // These roles are allowed and the fake row always resolves — a non-200
      // would make the credential scan below vacuous.
      expect(status).toBe(200);
      const leaks = sensitiveKeyPaths(json);
      expect(leaks, `credential keys leaked in ${route}: ${leaks.join(", ")}`).toEqual([]);
    });
  }
});

// ─── stripSensitive unit coverage ───────────────────────────────────────────

describe("stripSensitive", () => {
  it("drops credential keys at any depth, including inside arrays", () => {
    const dirty = {
      name: "ok",
      password: "x",
      deep: { nested: { password_hash: "y", keep: 1 } },
      list: [{ reset_token: "z", v: 2 }, [null, { Verification_Token: "w" }]],
      when: new Date(0),
    };
    const clean = stripSensitive(dirty);
    expect(sensitiveKeyPaths(clean)).toEqual([]);
    expect((clean.deep.nested as { keep: number }).keep).toBe(1);
    expect((clean.list[0] as { v: number }).v).toBe(2);
    expect(clean.when).toBeInstanceOf(Date);
  });

  it("is case-insensitive and does not mutate the input", () => {
    const dirty = { PASSWORD: "x", inner: { ResetToken: "y" } };
    stripSensitive(dirty);
    expect(dirty.PASSWORD).toBe("x");
    expect(dirty.inner.ResetToken).toBe("y");
  });
});

// ─── Column lists never include credential fields ───────────────────────────

describe("alumni column allow-lists", () => {
  for (const [name, cols] of Object.entries({
    ALUMNI_DETAIL_COLUMNS,
    ALUMNI_EXPORT_COLUMNS,
    ALUMNI_LIST_COLUMNS,
    ALUMNI_SELF_COLUMNS,
  })) {
    it(`${name} contains no credential columns`, () => {
      const bad = cols.filter((c) => SENSITIVE_KEY_RE.test(c));
      expect(bad).toEqual([]);
    });
  }

  it("lists are non-empty and unique", () => {
    for (const cols of [
      ALUMNI_DETAIL_COLUMNS,
      ALUMNI_EXPORT_COLUMNS,
      ALUMNI_LIST_COLUMNS,
      ALUMNI_SELF_COLUMNS,
    ]) {
      expect(cols.length).toBeGreaterThan(50);
      expect(new Set(cols).size).toBe(cols.length);
    }
  });
});
