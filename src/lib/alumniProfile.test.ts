import { describe, it, expect } from "vitest";
import type { Session } from "next-auth";
import { computeLoginBanner, isAdminUser } from "./alumniProfile";

describe("isAdminUser", () => {
  it("returns true for staff type", () => {
    const user = { email: "admin@example.com", type: "staff" } as unknown as Session["user"];
    expect(isAdminUser(user)).toBe(true);
  });
  it("returns false for alumni type", () => {
    const user = { email: "a@example.com", type: "alumni" } as unknown as Session["user"];
    expect(isAdminUser(user)).toBe(false);
  });
  it("returns false for missing type", () => {
    const user = { email: "x@example.com" } as unknown as Session["user"];
    expect(isAdminUser(user)).toBe(false);
  });
});

describe("computeLoginBanner", () => {
  it("shows banner when not signed in", () => {
    const res = computeLoginBanner(null);
    expect(res.show).toBe(true);
  });
  it("allows staff without banner", () => {
    const res = computeLoginBanner({ email: "admin@example.com", type: "staff" } as unknown as Session["user"]);
    expect(res.show).toBe(false);
  });
  it("allows alumni without banner", () => {
    const res = computeLoginBanner({ email: "a@example.com", type: "alumni" } as unknown as Session["user"]);
    expect(res.show).toBe(false);
  });
  it("blocks non-alumni types", () => {
    const res = computeLoginBanner({ email: "u@example.com", type: "student" } as unknown as Session["user"]);
    expect(res.show).toBe(true);
  });
});