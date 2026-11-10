/**
 * Authorization test harness.
 *
 * Calls any route handler under `src/app/api/**` as one of several identities
 * and records only the HTTP status code. Used by `authz-matrix.test.ts` to
 * snapshot the CURRENT behavior (evidence for Phase 1) and to guard against
 * regressions afterwards.
 */
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import type { Session } from "next-auth";

export type Identity =
  | "anonymous"
  | "alumniA"
  | "alumniB"
  | "viewer"
  | "admin"
  | "superadmin";

export const IDENTITY_ORDER: Identity[] = [
  "anonymous",
  "alumniA",
  "alumniB",
  "viewer",
  "admin",
  "superadmin",
];

function makeSession(overrides: Record<string, unknown>): Session {
  return {
    user: {
      email: "unknown@test.local",
      name: "Test User",
      ...overrides,
    } as Session["user"],
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  } as Session;
}

/** Alumni A owns alumniid=1 / sapid "SAP-A-001"; B owns 2 / "SAP-B-001". */
export const ALUMNI_A = { userId: 1, sapid: "SAP-A-001", registrationno: "REG-A-1" };
export const ALUMNI_B = { userId: 2, sapid: "SAP-B-001", registrationno: "REG-B-1" };

export const IDENTITY_SESSIONS: Record<Identity, Session | null> = {
  anonymous: null,
  alumniA: makeSession({
    userId: ALUMNI_A.userId,
    type: "alumni",
    sapid: ALUMNI_A.sapid,
    registrationno: ALUMNI_A.registrationno,
    email: "alumni.a@test.local",
    name: "Alumni A",
  }),
  alumniB: makeSession({
    userId: ALUMNI_B.userId,
    type: "alumni",
    sapid: ALUMNI_B.sapid,
    registrationno: ALUMNI_B.registrationno,
    email: "alumni.b@test.local",
    name: "Alumni B",
  }),
  viewer: makeSession({
    userId: 101,
    type: "viewer",
    email: "viewer@test.local",
    name: "Viewer User",
  }),
  admin: makeSession({
    userId: 102,
    type: "admin",
    email: "admin@test.local",
    name: "Admin User",
  }),
  superadmin: makeSession({
    userId: 103,
    type: "superadmin",
    email: "superadmin@test.local",
    name: "Super Admin",
  }),
};

/** Mutable holder read by the mocked `auth()`. */
export const authzState = {
  identity: "anonymous" as Identity,
};

export function sessionFor(identity: Identity): Session | null {
  return IDENTITY_SESSIONS[identity];
}

// ─── Route discovery ─────────────────────────────────────────────────────────

const API_ROOT = path.resolve(process.cwd(), "src/app/api");

export function listRouteFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "route.ts" || entry.name === "route.tsx") out.push(full);
    }
  };
  walk(API_ROOT);
  return out.sort();
}

/** "src/app/api/alumni/[sapid]/route.ts" -> "/api/alumni/[sapid]" */
export function routePathFor(file: string): string {
  const rel = path.relative(path.resolve(process.cwd(), "src/app"), file);
  return "/" + rel.replace(/\\/g, "/").replace(/\/route\.tsx?$/, "");
}

// ─── Params / URL building ───────────────────────────────────────────────────

const SINGLE_PARAMS: Record<string, string> = {
  sapid: ALUMNI_B.sapid, // deliberately alumni B's id — tests IDOR for alumniA
  alumniId: String(ALUMNI_B.userId),
  userid: "999",
  id: "1",
  chapterId: "1",
  associationId: "1",
  slug: "test-slug",
};

export function paramsForRoute(routePath: string): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {};
  for (const seg of routePath.split("/")) {
    const m = seg.match(/^\[(\.\.\.)?([^\]]+)\]$/);
    if (!m) continue;
    const isCatchAll = !!m[1];
    const name = m[2];
    if (name === "nextauth") {
      params[name] = ["session"];
    } else if (isCatchAll) {
      params[name] = ["test.png"];
    } else {
      params[name] = SINGLE_PARAMS[name] ?? "1";
    }
  }
  return params;
}

export function urlForRoute(routePath: string): string {
  const resolved = routePath
    .split("/")
    .map((seg) => {
      const m = seg.match(/^\[(\.\.\.)?([^\]]+)\]$/);
      if (!m) return seg;
      const isCatchAll = !!m[1];
      const name = m[2];
      if (name === "nextauth") return "session";
      if (isCatchAll) return "test.png";
      return encodeURIComponent(SINGLE_PARAMS[name] ?? "1");
    })
    .join("/");
  return `http://localhost${resolved}`;
}

// ─── Invocation ──────────────────────────────────────────────────────────────

export type Handler = (req: Request, ctx?: unknown) => Promise<Response> | Response;
export type RouteModule = Record<string, Handler | unknown>;

export async function loadRouteModule(file: string): Promise<RouteModule> {
  // Do NOT use pathToFileURL here — it percent-encodes the [param] segment
  // directories, which Vite then fails to resolve.
  return (await import(file.split(path.sep).join("/"))) as RouteModule;
}

export const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type Method = (typeof METHODS)[number];

const FORMDATA_ROUTES = /upload|bulk|image|document|application|membership|stories|picture/i;

function buildRequest(method: Method, url: string, routePath: string): NextRequest {
  const init: ConstructorParameters<typeof NextRequest>[1] = { method };
  if (method !== "GET") {
    if (FORMDATA_ROUTES.test(routePath)) {
      const fd = new FormData();
      fd.append("_test", "1");
      init.body = fd;
    } else {
      init.headers = { "content-type": "application/json" };
      init.body = JSON.stringify({});
    }
  }
  return new NextRequest(url, init);
}

const CALL_TIMEOUT_MS = 10_000;

/** Returns HTTP status code; "THROWN" if the handler itself throws. */
export async function invokeRoute(
  mod: RouteModule,
  method: Method,
  routePath: string
): Promise<number | "THROWN"> {
  const handler = mod[method];
  if (typeof handler !== "function") return -1; // method not exported
  const req = buildRequest(method, urlForRoute(routePath), routePath);
  const ctx = { params: Promise.resolve(paramsForRoute(routePath)) };
  try {
    const res = await Promise.race([
      Promise.resolve((handler as Handler)(req, ctx)),
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), CALL_TIMEOUT_MS)
      ),
    ]);
    return res instanceof Response ? res.status : -2;
  } catch (err) {
    if (err instanceof Error && err.message === "timeout") return 598;
    return "THROWN";
  }
}

// ─── Matrix types ────────────────────────────────────────────────────────────

export type MethodRow = Record<Identity, number | "THROWN" | "N/A">;
export type RouteEntry = Partial<Record<Method, MethodRow>>;
export type Matrix = Record<string, RouteEntry>;

export async function collectMatrixEntry(
  file: string
): Promise<{ route: string; entry: RouteEntry }> {
  const route = routePathFor(file);
  const mod = await loadRouteModule(file);
  const entry: RouteEntry = {};
  for (const method of METHODS) {
    if (typeof mod[method] !== "function") continue;
    const row = {} as MethodRow;
    for (const identity of IDENTITY_ORDER) {
      authzState.identity = identity;
      row[identity] = await invokeRoute(mod, method, route);
    }
    entry[method] = row;
  }
  return { route, entry };
}

export function matrixToMarkdown(matrix: Matrix): string {
  const routes = Object.keys(matrix).sort();
  const lines: string[] = [
    "# Authorization Matrix (baseline snapshot)",
    "",
    `Generated from ${routes.length} routes. Status codes only; "THRW" = handler threw`,
    `an unhandled exception; "598" = call timed out (>10 s).`,
    "",
    "| Route | Method | anonymous | alumniA | alumniB | viewer | admin | superadmin |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  const fmt = (v: number | "THROWN" | "N/A" | undefined) =>
    v === undefined ? "-" : v === "THROWN" ? "THRW" : String(v);
  for (const route of routes) {
    for (const method of METHODS) {
      const row = matrix[route][method];
      if (!row) continue;
      lines.push(
        `| ${route} | ${method} | ${IDENTITY_ORDER.map((i) => fmt(row[i])).join(" | ")} |`
      );
    }
  }
  lines.push("");
  return lines.join("\n");
}
