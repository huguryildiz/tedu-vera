import fs from "fs";
import path from "path";
import { config } from "dotenv";

config({ path: ".env.e2e.local", override: true });
config({ path: ".env.local", override: false });

async function loginAndSave(
  supabaseUrl: string,
  anonKey: string,
  baseURL: string,
  email: string,
  password: string,
  outPath: string,
): Promise<void> {
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`globalSetup auth failed for ${email}: ${res.status} ${text}`);
  }

  const session = await res.json();
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;

  const sessionValue = {
    access_token: session.access_token,
    token_type: "bearer",
    expires_in: session.expires_in,
    refresh_token: session.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + session.expires_in,
    user: session.user,
  };

  const state = {
    cookies: [],
    origins: [
      {
        origin: baseURL,
        localStorage: [
          { name: storageKey, value: JSON.stringify(sessionValue) },
          { name: "vera.admin_tour_done", value: "1" },
          { name: "admin.remember_me", value: "true" },
        ],
      },
    ],
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(state, null, 2));
}

async function globalSetup(): Promise<void> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const baseURL = process.env.E2E_BASE_URL || "http://localhost:5174";
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  const tenantEmail = process.env.E2E_TENANT_ADMIN_EMAIL;
  const tenantPassword = process.env.E2E_TENANT_ADMIN_PASSWORD;

  if (!supabaseUrl || !anonKey) {
    throw new Error("globalSetup: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required");
  }
  if (!adminEmail || !adminPassword) {
    throw new Error("globalSetup: E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required");
  }

  await loginAndSave(supabaseUrl, anonKey, baseURL, adminEmail, adminPassword, "e2e/.auth/admin.json");

  if (tenantEmail && tenantPassword) {
    await loginAndSave(supabaseUrl, anonKey, baseURL, tenantEmail, tenantPassword, "e2e/.auth/tenant.json");
  }
}

export default globalSetup;
