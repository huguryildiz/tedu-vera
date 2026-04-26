// supabase/functions/send-juror-pin-email/index.ts
// ============================================================
// Sends a juror's newly-generated PIN (and optionally the
// evaluation entry URL) via Resend. Called from the admin
// Jurors page after a PIN reset.
//
// Payload: { recipientEmail, jurorName, jurorAffiliation,
//            pin, tokenUrl?, periodName?, organizationId?, jurorId? }
//
// Email provider: Resend (via RESEND_API_KEY env var).
// Audit: notification.juror_pin written server-side after email send.
// ============================================================

import { writeEdgeAuditLog } from "../_shared/audit-log.ts";
import { requireAdminCaller } from "../_shared/admin-auth.ts";
import { RequestPayloadSchema, type RequestPayload } from "./schema.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sendViaResend(
  apiKey: string,
  to: string,
  subject: string,
  body: string,
  html: string,
  from: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to: [to], subject, text: body, html }),
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

function buildHtml(params: {
  jurorName: string;
  jurorAffiliation: string;
  organizationName: string;
  pin: string;
  tokenUrl: string;
  periodLabel: string;
  logoUrl: string;
}): string {
  const logo = params.logoUrl
    ? `<img src="${escapeHtml(params.logoUrl)}" alt="VERA" width="160" style="display:block;margin:0 auto;height:auto;" />`
    : `<img src="https://vera-eval.app/vera_logo_dark.png" alt="VERA" width="120" style="display:block; border:0;" />`;

  const pinDigits = params.pin.split("").map((d) =>
    `<span style="display:inline-block;width:52px;height:64px;line-height:64px;text-align:center;background:rgba(255,255,255,0.06);border:2px solid rgba(108,71,255,0.4);border-radius:8px;font-size:36px;font-weight:800;color:#ffffff;font-family:monospace;margin:0 4px;">${escapeHtml(d)}</span>`
  ).join("");

  const qrLogoUrl = "https://vera-eval.app/vera_logo_white.png";
  const qrUrl = params.tokenUrl
    ? `https://quickchart.io/qr?text=${encodeURIComponent(params.tokenUrl)}&size=220&ecLevel=H&dark=1e3a5f&light=ffffff&dotStyle=rounded&finderStyle=rounded&finderDotStyle=dot&centerImageUrl=${encodeURIComponent(qrLogoUrl)}&centerImageSizeRatio=0.46`
    : "";

  const ctaBlock = params.tokenUrl
    ? `<tr><td align="center" style="padding:8px 48px 20px;">
        <div style="display:inline-block;background:#eef2f8;border-radius:12px;padding:8px;border:1.5px solid rgba(15,23,42,0.13);box-shadow:0 4px 20px rgba(0,0,0,0.3);">
          <div style="background:#ffffff;border-radius:6px;line-height:0;">
            <img src="${qrUrl}" alt="Scan to join evaluation" width="180" height="180" style="display:block;" />
          </div>
        </div>
        <p style="margin:10px 0 0;font-size:12px;color:#718096;">Scan with your phone camera</p>
      </td></tr>
      <tr><td align="center" style="padding:4px 48px 28px;">
        <a href="${escapeHtml(params.tokenUrl)}" style="display:inline-block;background:linear-gradient(135deg,#6c47ff,#a78bfa);color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:14px 36px;border-radius:50px;letter-spacing:0.3px;box-shadow:0 4px 20px rgba(108,71,255,0.45);">Join Evaluation &rarr;</a>
      </td></tr>`
    : "";

  const scopeRows: Array<{ label: string; value: string }> = [];
  if (params.organizationName) scopeRows.push({ label: "ORGANIZATION", value: escapeHtml(params.organizationName) });
  if (params.periodLabel) scopeRows.push({ label: "PERIOD", value: escapeHtml(params.periodLabel) });
  const scopeBlock = scopeRows.length
    ? `<div style="margin:0 0 18px;border:1px solid rgba(108,71,255,0.5);border-radius:16px;background:rgba(255,255,255,0.03);overflow:hidden;">` +
      scopeRows.map((row, i) =>
        `<div style="padding:14px 18px;${i > 0 ? "border-top:1px solid rgba(255,255,255,0.08);" : ""}">` +
        `<p style="margin:0;font-size:11px;line-height:1.3;letter-spacing:1.2px;color:#7c5cff;font-weight:700;">${row.label}</p>` +
        `<p style="margin:6px 0 0;font-size:16px;line-height:1.4;color:#f1f5f9;font-weight:700;">${row.value}</p>` +
        `</div>`
      ).join("") +
      `</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Your VERA Evaluation PIN</title>
</head>
<body style="margin:0;padding:0;background-color:#0f0f1a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0f0f1a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:linear-gradient(160deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%);border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.5);">
          <tr><td style="background:linear-gradient(90deg,#6c47ff,#a78bfa,#6c47ff);height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr><td align="center" style="padding:40px 40px 20px;">${logo}</td></tr>
          <tr><td align="center" style="padding:8px 48px 12px;">
            <h1 style="margin:0;font-size:25px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Your Evaluation PIN</h1>
          </td></tr>
          <tr><td align="center" style="padding:0 48px 8px;">
            <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#a0aec0;">Hello, <strong style="color:#fff;">${escapeHtml(params.jurorName)}</strong>.</p>
          </td></tr>
          <tr><td style="padding:0 48px 8px;">
            ${scopeBlock}
            <p style="margin:0 0 8px;font-size:14px;line-height:1.7;color:#a0aec0;">Your jury evaluation PIN has been set. Use it to authenticate when you access the evaluation platform. Keep it confidential — it will not be shown again.</p>
          </td></tr>
          <tr><td align="center" style="padding:12px 48px 20px;">
            <div style="display:inline-block;padding:24px 20px;background:rgba(0,0,0,0.3);border-radius:12px;border:1px solid rgba(108,71,255,0.3);">
              ${pinDigits}
            </div>
            <p style="margin:12px 0 0;font-size:11px;color:#4a5568;">This PIN will not be shown again after this email.</p>
          </td></tr>
          ${ctaBlock}
          <tr><td style="padding:0 48px;"><div style="border-top:1px solid rgba(255,255,255,0.08);font-size:0;">&nbsp;</div></td></tr>
          <tr><td align="center" style="padding:16px 48px 30px;"><p style="margin:0;font-size:12px;color:#4a5568;line-height:1.6;">&copy; 2026 VERA. All rights reserved.</p></td></tr>
          <tr><td style="background:linear-gradient(90deg,#6c47ff,#a78bfa,#6c47ff);height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const body = await req.json();

    // Schema validation
    const parsed = RequestPayloadSchema.safeParse(body);
    if (!parsed.success) {
      const errorMessages = parsed.error.issues.map((i) => i.message).join(", ");
      return new Response(
        JSON.stringify({ error: errorMessages }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const payload: RequestPayload = parsed.data;

    const auth = await requireAdminCaller(req, payload.organizationId || null);
    if (!auth.ok) {
      return new Response(
        JSON.stringify({ error: auth.error }),
        { status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const periodLabel = payload.periodName || "";
    const subject = periodLabel
      ? `Your VERA evaluation PIN — ${periodLabel}`
      : "Your VERA evaluation PIN";

    const textBody = [
      `Hello, ${payload.jurorName}.`,
      `Your jury evaluation PIN has been set${periodLabel ? ` for ${periodLabel}` : ""}.`,
      `PIN: ${payload.pin}`,
      "Use this PIN to authenticate when you access the evaluation platform. Keep it confidential — it will not be shown again.",
      payload.tokenUrl ? `Evaluation link: ${payload.tokenUrl}` : "",
    ].filter(Boolean).join("\n\n");

    const html = buildHtml({
      jurorName: payload.jurorName,
      jurorAffiliation: payload.jurorAffiliation || "",
      organizationName: payload.organizationName || "",
      pin: payload.pin,
      tokenUrl: payload.tokenUrl || "",
      periodLabel,
      logoUrl: Deno.env.get("NOTIFICATION_LOGO_URL") || "",
    });

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromAddr = Deno.env.get("NOTIFICATION_FROM") || "VERA <noreply@vera-eval.app>";
    let sent = false;
    let sendError = "";

    if (resendKey && payload.recipientEmail) {
      const result = await sendViaResend(resendKey, payload.recipientEmail, subject, textBody, html, fromAddr);
      sent = result.ok;
      sendError = result.error || "";
    } else {
      sendError = !resendKey ? "RESEND_API_KEY not configured" : "No recipient email";
    }

    console.log("send-juror-pin-email:", JSON.stringify({ to: payload.recipientEmail, jurorName: payload.jurorName, sent, error: sendError || undefined }));

    if (sent) {
      try {
        await writeEdgeAuditLog(req, {
          action: "notification.juror_pin",
          organization_id: payload.organizationId || null,
          resource_type: "jurors",
          resource_id: payload.jurorId || null,
          details: {
            recipientEmail: payload.recipientEmail,
            jurorName: payload.jurorName,
            periodName: payload.periodName ?? null,
          },
        });
      } catch (auditErr) {
        console.error("audit write failed (notification.juror_pin):", (auditErr as Error)?.message);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, sent, error: sendError || undefined }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("send-juror-pin-email error:", (e as Error).message);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
