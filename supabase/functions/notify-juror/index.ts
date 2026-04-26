// supabase/functions/notify-juror/index.ts
// ============================================================
// Sends a progress-aware evaluation reminder email to a juror.
//
// Auth:
//   Bearer token → auth.getUser → org_admin OR super_admin membership.
//
// Body: { juror_id: string, period_id: string }
//
// Email:
//   Subject: Evaluation Reminder — {periodLabel}
//   Body: juror name, X/Y progress, eval link + QR code.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { writeEdgeAuditLog } from "../_shared/audit-log.ts";
import {
  RequestPayloadSchema,
  SuccessResponseSchema,
  ValidationErrorResponseSchema,
  InternalErrorResponseSchema,
} from "./schema.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function sendViaResend(
  apiKey: string,
  to: string,
  subject: string,
  html: string,
  from: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!to) return { ok: false, error: "No recipient email" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: `Resend ${res.status}: ${err}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function resolvePortalUrl(req: Request): string {
  const explicit = (Deno.env.get("NOTIFICATION_APP_URL") || "").trim();
  if (explicit) return explicit;

  let hostname = "";
  try { hostname = new URL(req.url).hostname.toLowerCase(); } catch { /* noop */ }
  const isLocal = hostname === "localhost" || hostname.startsWith("127.") || hostname.startsWith("192.168.");
  if (isLocal) {
    const dev = (Deno.env.get("NOTIFICATION_APP_URL_DEV") || "").trim();
    return dev || `http://localhost:5173`;
  }
  const prod = (Deno.env.get("NOTIFICATION_APP_URL_PROD") || "").trim();
  return prod || "https://vera-eval.app";
}

function buildReminderEmail(params: {
  jurorName: string;
  orgName: string;
  institution: string;
  periodLabel: string;
  completed: number;
  total: number;
  evalUrl: string;
  qrUrl: string;
  logoUrl?: string;
}): string {
  const { jurorName, orgName, institution, periodLabel, completed, total, evalUrl, qrUrl, logoUrl } = params;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const remaining = total - completed;

  const logo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="VERA" width="120" style="display:block;border:0;" />`
    : `<img src="https://vera-eval.app/vera_logo_dark.png" alt="VERA" width="120" style="display:block;border:0;" />`;

  const scopeBlock = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background:rgba(108,71,255,0.08);border:1px solid rgba(108,71,255,0.25);border-radius:12px;margin:0 0 16px;">
      ${institution ? `<tr><td style="padding:10px 16px;border-bottom:1px solid rgba(255,255,255,0.06);">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.8px;color:#6c47ff;font-weight:600;margin-bottom:3px;">Organization</div>
        <div style="font-size:14px;color:#f1f5f9;font-weight:600;">${escapeHtml(institution)}</div>
      </td></tr>` : ""}
      <tr><td style="padding:10px 16px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.8px;color:#6c47ff;font-weight:600;margin-bottom:3px;">Evaluation Period</div>
        <div style="font-size:14px;color:#f1f5f9;font-weight:600;">${escapeHtml(periodLabel)}</div>
      </td></tr>
    </table>`;

  const progressBar = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:10px;margin:0 0 16px;">
      <tr><td style="padding:14px 16px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.8px;color:#a0aec0;margin-bottom:8px;">Evaluation Progress</div>
        <div style="background:rgba(255,255,255,0.08);border-radius:99px;height:8px;overflow:hidden;margin-bottom:8px;">
          <div style="background:linear-gradient(90deg,#6c47ff,#a78bfa);height:8px;width:${pct}%;border-radius:99px;"></div>
        </div>
        <div style="font-size:13px;color:#a0aec0;">
          <strong style="color:#f1f5f9;">${completed}</strong> of <strong style="color:#f1f5f9;">${total}</strong> projects completed
          ${remaining > 0 ? ` &mdash; <span style="color:#f59e0b;">${remaining} remaining</span>` : ` &mdash; <span style="color:#34d399;">All done!</span>`}
        </div>
      </td></tr>
    </table>`;

  const cta = `<a href="${escapeHtml(evalUrl)}"
    style="display:inline-block;background:linear-gradient(135deg,#6c47ff,#a78bfa);color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:14px 36px;border-radius:50px;letter-spacing:0.3px;box-shadow:0 4px 20px rgba(108,71,255,0.45);">
    Continue Evaluation &rarr;
  </a>`;

  const qrBlock = `
    <div style="text-align:center;margin-top:24px;">
      <p style="margin:0 0 10px;font-size:12px;color:#4a5568;">Or scan the QR code to open on your device</p>
      <div style="display:inline-block;background:#eef2f8;border-radius:12px;padding:8px;border:1.5px solid rgba(15,23,42,0.13);box-shadow:0 4px 16px rgba(0,0,0,0.25);">
        <div style="background:#ffffff;border-radius:6px;line-height:0;">
          <img src="${escapeHtml(qrUrl)}" alt="QR Code" width="140" height="140" style="display:block;" />
        </div>
      </div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Evaluation Reminder</title>
</head>
<body style="margin:0;padding:0;background-color:#0f0f1a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0f0f1a;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0"
        style="max-width:600px;width:100%;background:linear-gradient(160deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%);border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.5);">
        <tr><td style="background:linear-gradient(90deg,#6c47ff,#a78bfa,#6c47ff);height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td align="center" style="padding:40px 40px 20px;">${logo}</td></tr>
        <tr><td align="center" style="padding:8px 48px 12px;">
          <h1 style="margin:0;font-size:25px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Evaluation Reminder</h1>
        </td></tr>
        <tr><td align="center" style="padding:0 48px 20px;">
          <p style="margin:0;font-size:15px;line-height:1.7;color:#a0aec0;">Hello, <strong style="color:#f1f5f9;">${escapeHtml(jurorName)}</strong>. Please complete your pending jury evaluations.</p>
        </td></tr>
        <tr><td style="padding:0 48px 8px;">
          ${scopeBlock}
          ${progressBar}
          <p style="margin:0 0 8px;font-size:14px;line-height:1.7;color:#a0aec0;text-align:justify;text-justify:inter-word;">
            Please access the evaluation platform to complete the remaining assessments. Your evaluations are important for the final ranking and accreditation report.
          </p>
        </td></tr>
        <tr><td align="center" style="padding:16px 48px 24px;">${cta}</td></tr>
        <tr><td style="padding:0 48px;">${qrBlock}</td></tr>
        <tr><td style="padding:16px 48px 0;"><div style="border-top:1px solid rgba(255,255,255,0.08);font-size:0;">&nbsp;</div></td></tr>
        <tr><td align="center" style="padding:16px 48px 30px;">
          <p style="margin:0;font-size:12px;color:#4a5568;line-height:1.6;">&copy; 2026 VERA. All rights reserved.</p>
        </td></tr>
        <tr><td style="background:linear-gradient(90deg,#6c47ff,#a78bfa,#6c47ff);height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json(401, { error: "Missing bearer token" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json(500, { error: "Supabase environment not configured." });
  }

  // Resolve caller identity
  const authClient = createClient(supabaseUrl, anonKey);
  const { data: userData, error: userErr } = await authClient.auth.getUser(token);
  const userId = userData?.user?.id || null;
  if (userErr || !userId) {
    return json(401, { error: "Unauthorized", details: userErr?.message || "User not found" });
  }

  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Must be org_admin or super_admin
  const { data: membership } = await service
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", userId)
    .in("role", ["org_admin", "super_admin"])
    .limit(1)
    .maybeSingle();

  if (!membership) return json(403, { error: "Admin access required." });

  let body: { juror_id?: string; period_id?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const validation = RequestPayloadSchema.safeParse(body);
  if (!validation.success) {
    const errorMsg = validation.error.issues[0]?.message || "Invalid request payload";
    return json(400, { error: errorMsg });
  }
  const { juror_id, period_id } = validation.data;

  // Fetch juror
  const { data: juror, error: jurorErr } = await service
    .from("jurors")
    .select("juror_name, email")
    .eq("id", juror_id)
    .single();
  if (jurorErr || !juror) return json(404, { error: "Juror not found" });
  if (!juror.email) return json(422, { error: "Juror has no email address" });

  // Fetch period + org
  const { data: period, error: periodErr } = await service
    .from("periods")
    .select("id, name, organization_id")
    .eq("id", period_id)
    .single();
  if (periodErr || !period) return json(404, { error: "Period not found" });

  // Fetch org
  const { data: org } = await service
    .from("organizations")
    .select("name, institution")
    .eq("id", period.organization_id)
    .maybeSingle();

  // Fetch active entry token
  const { data: tokenRow } = await service
    .from("entry_tokens")
    .select("token_plain")
    .eq("period_id", period_id)
    .eq("is_revoked", false)
    .limit(1)
    .maybeSingle();

  // Count total projects in period
  const { count: totalProjects } = await service
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("period_id", period_id);

  // Count juror's completed score sheets (status = submitted)
  const { count: completedProjects } = await service
    .from("score_sheets")
    .select("id", { count: "exact", head: true })
    .eq("period_id", period_id)
    .eq("juror_id", juror_id)
    .eq("status", "submitted");

  const portalUrl = resolvePortalUrl(req);
  const evalUrl = tokenRow?.token_plain
    ? `${portalUrl}?eval=${encodeURIComponent(tokenRow.token_plain)}`
    : portalUrl;
  const qrLogoUrl = "https://vera-eval.app/vera_logo_white.png";
  const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(evalUrl)}&size=220&ecLevel=H&dark=1e3a5f&light=ffffff&dotStyle=rounded&finderStyle=rounded&finderDotStyle=dot&centerImageUrl=${encodeURIComponent(qrLogoUrl)}&centerImageSizeRatio=0.46`;

  const html = buildReminderEmail({
    jurorName: juror.juror_name || "Juror",
    orgName: org?.name || "",
    institution: org?.institution || "",
    periodLabel: period.name || period_id,
    completed: completedProjects || 0,
    total: totalProjects || 0,
    evalUrl,
    qrUrl,
    logoUrl: Deno.env.get("NOTIFICATION_LOGO_URL") || "",
  });

  const subject = `Evaluation Reminder — ${period.name || "Evaluation Period"}`;
  const resendKey = Deno.env.get("RESEND_API_KEY") || "";
  const fromAddr = Deno.env.get("NOTIFICATION_FROM") || "VERA <noreply@vera-eval.app>";

  let sent = false;
  let sendError = "";

  if (resendKey) {
    const result = await sendViaResend(resendKey, juror.email, subject, html, fromAddr);
    sent = result.ok;
    sendError = result.error || "";
  } else {
    sendError = "RESEND_API_KEY not configured";
  }

  console.log("notify-juror:", JSON.stringify({ juror_id, period_id, to: juror.email, sent, error: sendError || undefined }));

  try {
    await writeEdgeAuditLog(req, {
      action: "notification.juror_reminder",
      organization_id: period.organization_id || null,
      user_id: userId,
      resource_type: "jurors",
      resource_id: juror_id,
      details: {
        period_id,
        period_label: period.name,
        juror_email: juror.email,
        completed: completedProjects || 0,
        total: totalProjects || 0,
        sent,
        error: sendError || null,
      },
    });
  } catch (auditErr) {
    console.error("audit write failed (notification.juror_reminder):", (auditErr as Error)?.message);
  }

  if (!sent) {
    return json(500, { ok: false, sent: false, error: sendError || "Failed to send email" });
  }

  return json(200, { ok: true, sent: true });
});
