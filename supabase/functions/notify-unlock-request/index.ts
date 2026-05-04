// supabase/functions/notify-unlock-request/index.ts
// ============================================================
// Email notifications for period unlock-request workflow.
//
// Events:
//   request_submitted → super admins (to)
//   request_resolved  → requester (to)   decision='approved' | 'rejected'
//
// Provider: Resend (via RESEND_API_KEY). Falls back to logging-only.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSuperAdminEmails } from "../_shared/super-admin-cc.ts";
import { writeEdgeAuditLog } from "../_shared/audit-log.ts";
import { RequestPayloadSchema } from "./schema.ts";

interface NotificationPayload {
  type: "request_submitted" | "request_resolved";
  request_id: string;
  period_id?: string;
  period_name?: string;
  organization_id?: string;
  organization_name?: string;
  requester_user_id?: string;
  requester_name?: string;
  reason?: string;
  decision?: "approved" | "rejected";
  review_note?: string | null;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getServiceClientOrNull() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

async function sendViaResend(
  apiKey: string,
  to: string[],
  subject: string,
  body: string,
  html: string,
  from: string,
): Promise<{ ok: boolean; error?: string }> {
  const toArr = to.filter(Boolean);
  if (toArr.length === 0) return { ok: false, error: "No recipients" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to: toArr, subject, text: body, html }),
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

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function resolvePortalUrl(req: Request): string {
  const explicit = (Deno.env.get("NOTIFICATION_APP_URL") || "").trim();
  if (explicit) return explicit;

  try {
    const hostname = new URL(req.url).hostname.toLowerCase();
    const isDevHost = hostname === "localhost" || hostname.startsWith("127.") || hostname.startsWith("192.168.");
    if (isDevHost) return "http://localhost:5173";
  } catch {
    // ignore
  }
  return "https://vera-eval.app";
}

function buildScopeBlock(orgName: string, periodName: string): string {
  return `
    <div style="margin:0 0 18px; border:1px solid rgba(108,71,255,0.5); border-radius:16px; background:rgba(255,255,255,0.03); overflow:hidden;">
      <div style="padding:14px 18px;">
        <p style="margin:0; font-size:11px; line-height:1.3; letter-spacing:1.2px; color:#7c5cff; font-weight:700;">ORGANIZATION</p>
        <p style="margin:6px 0 0; font-size:16px; line-height:1.4; color:#f1f5f9; font-weight:700;">${escapeHtml(orgName)}</p>
      </div>
      <div style="padding:14px 18px; border-top:1px solid rgba(255,255,255,0.08);">
        <p style="margin:0; font-size:11px; line-height:1.3; letter-spacing:1.2px; color:#7c5cff; font-weight:700;">PERIOD</p>
        <p style="margin:6px 0 0; font-size:16px; line-height:1.4; color:#f1f5f9; font-weight:700;">${escapeHtml(periodName)}</p>
      </div>
    </div>`;
}

function buildHtmlTemplate(params: {
  title: string;
  intro: string;
  customRows: string[];
  bandGradient?: string;
}): string {
  const rowsHtml = params.customRows.join("");
  const band = params.bandGradient ?? "linear-gradient(90deg,#6c47ff,#a78bfa,#6c47ff)";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>${escapeHtml(params.title)}</title></head>
<body style="margin:0; padding:0; background-color:#0f0f1a; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0f0f1a; padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background:linear-gradient(160deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%); border-radius:16px; overflow:hidden; box-shadow:0 8px 40px rgba(0,0,0,0.5);">
        <tr><td style="background:${band}; height:4px; font-size:0; line-height:0;">&nbsp;</td></tr>
        <tr><td align="center" style="padding:40px 40px 20px;"><img src="https://vera-eval.app/vera_logo_dark.png" alt="VERA" width="120" style="display:block; border:0;" /></td></tr>
        <tr><td align="center" style="padding:8px 48px 12px;"><h1 style="margin:0; font-size:25px; font-weight:700; color:#ffffff; letter-spacing:-0.5px;">${escapeHtml(params.title)}</h1></td></tr>
        <tr><td align="center" style="padding:0 48px 20px;"><p style="margin:0; font-size:15px; line-height:1.7; color:#a0aec0;">${escapeHtml(params.intro)}</p></td></tr>
        ${rowsHtml}
        <tr><td style="padding:0 48px;"><div style="border-top:1px solid rgba(255,255,255,0.08); font-size:0;">&nbsp;</div></td></tr>
        <tr><td align="center" style="padding:16px 48px 30px;"><p style="margin:0; font-size:12px; color:#4a5568; line-height:1.6;">&copy; 2026 VERA. All rights reserved.</p></td></tr>
        <tr><td style="background:${band}; height:4px; font-size:0; line-height:0;">&nbsp;</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function getUserEmail(service: ReturnType<typeof getServiceClientOrNull>, userId: string): Promise<string> {
  if (!service || !userId) return "";
  try {
    const { data } = await service.auth.admin.getUserById(userId);
    return data?.user?.email || "";
  } catch {
    return "";
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    const validation = RequestPayloadSchema.safeParse(rawBody);
    if (!validation.success) {
      const issue = validation.error.issues[0];
      const field = issue?.path?.[0];
      const errorMsg = field
        ? `${String(field)}: ${issue.message}`
        : (issue?.message || "Invalid request payload");
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const payload = validation.data;

    const portalUrl = resolvePortalUrl(req);
    const service = getServiceClientOrNull();

    let subject = "";
    let body = "";
    let html = "";
    let to: string[] = [];

    const periodLabel = payload.period_name || "a period";
    const orgLabel = payload.organization_name || "an organization";
    const requesterLabel = payload.requester_name || "An admin";
    const reasonText = (payload.reason || "").trim();

    switch (payload.type) {
      case "request_submitted": {
        to = service ? await getSuperAdminEmails(service) : [];

        subject = `Unlock request: ${periodLabel} (${orgLabel})`;
        body = `${requesterLabel} has requested to unlock "${periodLabel}" in ${orgLabel}. Reason: ${reasonText || "(no reason)"}`;

        const scopeBlockReq = buildScopeBlock(orgLabel, periodLabel);
        html = buildHtmlTemplate({
          title: "Period Unlock Request",
          intro: "An org admin has requested to unlock a period that already has evaluation scores.",
          bandGradient: "linear-gradient(90deg,#d97706,#f59e0b,#d97706)",
          customRows: [
            `<tr><td style="padding:0 48px 4px;"><p style="margin:0; font-size:18px; font-weight:700; color:#ffffff;">${escapeHtml(requesterLabel)}</p></td></tr>`,
            `<tr><td style="padding:8px 48px 8px;">${scopeBlockReq}${reasonText ? `<p style="margin:14px 0 0; padding:12px 14px; font-size:13px; line-height:1.6; color:#cbd5e1; background:rgba(255,255,255,0.04); border-left:3px solid #a78bfa; border-radius:6px;"><strong style="color:#f1f5f9;">Reason:</strong> ${escapeHtml(reasonText)}</p>` : ""}</td></tr>`,
            `<tr><td style="padding:10px 48px 20px;"><p style="margin:0; font-size:12px; line-height:1.6; color:#4a5568;">Approving an unlock bypasses the fairness guard. Existing scores remain but may become inconsistent if structural fields (weights, rubric bands, outcome mappings) are changed.</p></td></tr>`,
            `<tr><td align="center" style="padding:4px 48px 28px;"><a href="${escapeHtml(`${portalUrl}/admin/unlock-requests`)}" style="display:inline-block; background:linear-gradient(135deg,#6c47ff,#a78bfa); color:#ffffff; text-decoration:none; font-size:16px; font-weight:600; padding:14px 36px; border-radius:50px; letter-spacing:0.3px; box-shadow:0 4px 20px rgba(108,71,255,0.45);">Review Request &rarr;</a></td></tr>`,
          ],
        });
        break;
      }

      case "request_resolved": {
        const requesterEmail = await getUserEmail(service, payload.requester_user_id || "");
        if (requesterEmail) to = [requesterEmail];

        const decision = payload.decision === "approved" ? "approved" : "rejected";
        const note = (payload.review_note || "").trim();

        subject = `Unlock request ${decision}: ${periodLabel}`;
        body = `Your unlock request for "${periodLabel}" was ${decision}.${note ? ` Note: ${note}` : ""}`;

        const bandGradient = decision === "approved"
          ? "linear-gradient(90deg,#16a34a,#4ade80,#16a34a)"
          : "linear-gradient(90deg,#dc2626,#f87171,#dc2626)";
        const accent = decision === "approved" ? "#4ade80" : "#f87171";
        const decisionPill = decision === "approved" ? "APPROVED" : "REJECTED";
        const explanationText = decision === "approved"
          ? "The period is now unlocked. Labels and descriptions can be edited; structural fields remain read-only until the next QR is generated. Re-generate the QR code to re-freeze the rubric when you are done."
          : "The period stays locked. If you still need to unlock, submit a new request with additional context.";
        const ctaRow = decision === "approved"
          ? `<tr><td align="center" style="padding:4px 48px 28px;"><a href="${escapeHtml(`${portalUrl}/admin/periods`)}" style="display:inline-block; background:linear-gradient(135deg,#6c47ff,#a78bfa); color:#ffffff; text-decoration:none; font-size:16px; font-weight:600; padding:14px 36px; border-radius:50px; letter-spacing:0.3px; box-shadow:0 4px 20px rgba(108,71,255,0.45);">Open Periods &rarr;</a></td></tr>`
          : "";

        const scopeBlockRes = buildScopeBlock(orgLabel, periodLabel);
        html = buildHtmlTemplate({
          title: decision === "approved" ? "Unlock Approved" : "Unlock Rejected",
          intro: decision === "approved"
            ? "Your unlock request has been approved."
            : "Your unlock request has been rejected.",
          bandGradient,
          customRows: [
            `<tr><td style="padding:0 48px 4px;"><p style="margin:0 0 6px; font-size:11px; line-height:1.3; letter-spacing:1.2px; font-weight:700; color:${accent};">${decisionPill}</p></td></tr>`,
            `<tr><td style="padding:0 48px 8px;">${scopeBlockRes}${note ? `<p style="margin:14px 0 0; padding:12px 14px; font-size:13px; line-height:1.6; color:#cbd5e1; background:rgba(255,255,255,0.04); border-left:3px solid #a78bfa; border-radius:6px;"><strong style="color:#f1f5f9;">Review note:</strong> ${escapeHtml(note)}</p>` : ""}</td></tr>`,
            `<tr><td style="padding:14px 48px 20px;"><p style="margin:0; font-size:12px; line-height:1.6; color:#4a5568;">${escapeHtml(explanationText)}</p></td></tr>`,
            ctaRow,
          ],
        });
        break;
      }
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromAddr = Deno.env.get("NOTIFICATION_FROM") || "VERA <noreply@vera-eval.app>";
    let sent = false;
    let sendError = "";

    if (resendKey && to.length > 0) {
      const result = await sendViaResend(resendKey, to, subject, body, html || body, fromAddr);
      sent = result.ok;
      sendError = result.error || "";
    } else {
      sendError = !resendKey ? "RESEND_API_KEY not configured" : "No recipient email resolved";
    }

    const logEntry = {
      type: payload.type,
      request_id: payload.request_id,
      to,
      subject,
      sent,
      error: sendError || undefined,
    };
    console.log("Notification result:", JSON.stringify(logEntry));

    try {
      await writeEdgeAuditLog(req, {
        action: "notification.unlock_request",
        organization_id: payload.organization_id || null,
        resource_type: "unlock_requests",
        resource_id: payload.request_id,
        actor_type: "admin",
        details: {
          type: payload.type,
          recipients: to,
          sent,
          error: sendError || null,
          period_name: payload.period_name || null,
          organization_name: payload.organization_name || null,
          decision: payload.decision || null,
        },
      });
    } catch (auditErr) {
      console.error("audit write failed (notification.unlock_request):", (auditErr as Error)?.message);
    }

    return new Response(
      JSON.stringify({ ok: true, sent, error: sendError || undefined }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("Notification error:", (e as Error).message);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
