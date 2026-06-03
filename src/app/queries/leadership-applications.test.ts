import { afterEach, describe, expect, it, vi } from "vitest";
import { getLeadershipApplications, leadershipApplicationsKey } from "./leadership-applications";

describe("leadership applications query contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses all/all as default key values", () => {
    expect(leadershipApplicationsKey({})).toEqual([
      "leadership-applications",
      "all",
      "all",
      "all",
      "all",
      "",
      "0",
      0,
    ]);
  });

  it("sends category and status query params when selected", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getLeadershipApplications({
      type: "chapter",
      category: "national",
      status: "approved",
      role: "president",
      search: "alice",
      hasAdditionalAchievements: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = String(fetchMock.mock.calls[0][0]);
    expect(requestUrl).toContain("/api/leadership/applications?");
    expect(requestUrl).toContain("type=chapter");
    expect(requestUrl).toContain("category=national");
    expect(requestUrl).toContain("status=approved");
    expect(requestUrl).toContain("role=president");
    expect(requestUrl).toContain("search=alice");
    expect(requestUrl).toContain("hasAdditionalAchievements=1");
  });

  it("omits category/status when set to all", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getLeadershipApplications({
      category: "all",
      status: "all",
      role: "all",
      type: "all",
    });

    const requestUrl = String(fetchMock.mock.calls[0][0]);
    expect(requestUrl).not.toContain("category=");
    expect(requestUrl).not.toContain("status=");
    expect(requestUrl).not.toContain("role=");
    expect(requestUrl).not.toContain("type=");
  });
});
