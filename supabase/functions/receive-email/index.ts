// supabase/functions/receive-email/index.ts
// ============================================================
// Resend inbound email webhook receiver.
// Resend POSTs parsed email payloads here when an email arrives
// at any @vera-eval.app address.
//
// Actions:
//   1. Stores email in `received_emails` table (DB inspection)
//
// Auth: verify_jwt=false — Resend doesn't send Supabase JWTs.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Resend inbound payload shape:
  // { type: "email.received", created_at: string, data: { from, to, subject, text, html, ... } }
  const data = (payload.data ?? payload) as Record<string, unknown>;

  const from_address = typeof data.from === "string" ? data.from : null;
  const to_raw = data.to;
  const to_address = Array.isArray(to_raw)
    ? (to_raw as string[]).join(", ")
    : typeof to_raw === "string"
    ? to_raw
    : null;
  const subject = typeof data.subject === "string" ? data.subject : null;
  const text_body = typeof data.text === "string" ? data.text : null;
  const html_body = typeof data.html === "string" ? data.html : null;

  // 1. Store in DB
  const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { error } = await service.from("received_emails").insert({
    from_address,
    to_address,
    subject,
    text_body,
    html_body,
    raw_payload: payload,
  });

  if (error) {
    console.error("receive-email: DB insert failed:", error.message);
  }

  console.log(`receive-email: stored from=${from_address} subject=${subject}`);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
