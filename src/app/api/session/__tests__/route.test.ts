import { describe, it, expect, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: {
      email: "admin@example.com",
      name: "Admin User",
      userId: 1,
      department: "IT",
      type: "admin",
      blocked: false,
      firstName: "Admin",
      lastName: "User",
    },
  })),
}));

import { GET } from "../route";

describe("/api/session endpoint", () => {
  it("returns authenticated session payload", async () => {
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.authenticated).toBe(true);
    expect(body.user?.email).toBe("admin@example.com");
    expect(body.user?.userId).toBe(1);
  });
});