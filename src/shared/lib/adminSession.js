import { KEYS } from "@/shared/storage/keys";

let inMemoryDeviceId = null;

function generateDeviceId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `dev_${crypto.randomUUID()}`;
  }
  const random = Math.random().toString(36).slice(2, 12);
  return `dev_${Date.now().toString(36)}_${random}`;
}

export function getAdminDeviceId() {
  if (inMemoryDeviceId) return inMemoryDeviceId;

  try {
    const stored = localStorage.getItem(KEYS.ADMIN_DEVICE_ID);
    if (stored) {
      inMemoryDeviceId = stored;
      return stored;
    }

    const created = generateDeviceId();
    localStorage.setItem(KEYS.ADMIN_DEVICE_ID, created);
    inMemoryDeviceId = created;
    return created;
  } catch {
    const fallback = generateDeviceId();
    inMemoryDeviceId = fallback;
    return fallback;
  }
}

export function parseUserAgent(userAgentRaw) {
  const ua = String(userAgentRaw || "");

  let browser = "Unknown";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\//i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = "Safari";

  let os = "Unknown";
  if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  return { browser, os };
}

export function maskIpAddress(ipRaw) {
  const ip = String(ipRaw || "").trim();
  if (!ip) return "Unknown";

  const ipv4Parts = ip.split(".");
  if (
    ipv4Parts.length === 4 &&
    ipv4Parts.every((part) => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255)
  ) {
    return `${ipv4Parts[0]}.${ipv4Parts[1]}.${ipv4Parts[2]}.xxx`;
  }

  if (ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean);
    if (parts.length >= 2) {
      return `${parts.slice(0, 2).join(":")}:xxxx:xxxx`;
    }
  }

  return "Unknown";
}

export function normalizeCountryCode(codeRaw) {
  const code = String(codeRaw || "").trim().toUpperCase();
  if (!code) return "Unknown";
  if (!/^[A-Z]{2}$/.test(code)) return "Unknown";
  return code;
}

export function getAuthMethodLabelFromSession(session, user) {
  const provider = session?.user?.app_metadata?.provider;
  const providers = session?.user?.app_metadata?.providers;
  const normalized = Array.isArray(providers) && providers.length > 0
    ? providers
    : [provider].filter(Boolean);

  if (normalized.length === 0) {
    return user?.email ? "Email" : "Unknown";
  }

  const labelMap = {
    email: "Email",
    google: "Google",
    github: "GitHub",
    apple: "Apple",
    phone: "Phone",
  };

  return normalized
    .map((item) => labelMap[item] || String(item).charAt(0).toUpperCase() + String(item).slice(1))
    .join(" + ");
}

