import { beforeEach, describe, expect, it, vi } from "vitest";
import { KEYS } from "@/shared/storage/keys";

describe("adminSession utils", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("creates a stable device id and persists it", async () => {
    const { getAdminDeviceId } = await import("@/shared/lib/adminSession");

    const id1 = getAdminDeviceId();
    const id2 = getAdminDeviceId();

    expect(id1).toBeTruthy();
    expect(id1).toBe(id2);
    expect(localStorage.getItem(KEYS.ADMIN_DEVICE_ID)).toBe(id1);
  });

  it("parses browser and OS from common user agents", async () => {
    const { parseUserAgent } = await import("@/shared/lib/adminSession");

    expect(parseUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"))
      .toEqual({ browser: "Chrome", os: "macOS" });

    expect(parseUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edg/123.0.0.0"))
      .toEqual({ browser: "Edge", os: "Windows" });

    expect(parseUserAgent("Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0"))
      .toEqual({ browser: "Firefox", os: "Linux" });

    expect(parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"))
      .toEqual({ browser: "Safari", os: "iOS" });

    expect(parseUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"))
      .toEqual({ browser: "Chrome", os: "Android" });
  });

  it("masks IPv4 and returns Unknown for invalid input", async () => {
    const { maskIpAddress } = await import("@/shared/lib/adminSession");

    expect(maskIpAddress("203.0.113.24")).toBe("203.0.113.xxx");
    expect(maskIpAddress("bad-value")).toBe("Unknown");
    expect(maskIpAddress(null)).toBe("Unknown");
  });
});

