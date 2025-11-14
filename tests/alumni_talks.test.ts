import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/dbconnect", () => ({ sql: async () => [] }));
vi.mock("@/auth", () => ({ auth: async () => ({ user: { email: "test@example.com" } }) }));
import { validatePayload } from "../src/app/api/alumni/talks/validation";

describe("validatePayload", () => {
  it("accepts valid payload", () => {
    const v = validatePayload({
      major: "CS",
      areas: ["Networking", "Career Guidance"],
      topics: ["AI", "Cloud"],
      day: "Monday",
      time: "09:00-11:00",
    });
    expect(v.ok).toBe(true);
  });

  it("rejects weekend", () => {
    const v = validatePayload({
      major: "CS",
      areas: ["Networking"],
      topics: ["AI"],
      day: "Sunday",
      time: "10:00-11:00",
    });
    expect(v.ok).toBe(false);
    // @ts-expect-error
    expect(v.error).toBe("DAY_WEEKDAY_ONLY");
  });

  it("rejects invalid time format", () => {
    const v = validatePayload({ major: "CS", areas: ["Networking"], topics: ["AI"], day: "Tuesday", time: "9-10" });
    expect(v.ok).toBe(false);
    // @ts-expect-error
    expect(v.error).toBe("TIME_RANGE_INVALID");
  });

  it("rejects reversed time", () => {
    const v = validatePayload({ major: "CS", areas: ["Networking"], topics: ["AI"], day: "Wednesday", time: "12:00-10:00" });
    expect(v.ok).toBe(false);
    // @ts-expect-error
    expect(v.error).toBe("TIME_RANGE_ORDER");
  });
});