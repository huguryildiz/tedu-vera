const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHtml(input: string): string {
  return String(input || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildHtmlTemplate(params: {
  title: string;
  intro: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  logoUrl?: string;
}): string {
  const logo = params.logoUrl
    ? `<img src="${escapeHtml(params.logoUrl)}" alt="VERA" width="160" style="display:block; margin:0 auto; height:auto;" />`
    : `<div style="font-size:22px;font-weight:800;letter-spacing:-0.5px;"><span style="color:#f1f5f9;">V</span><span style="color:#93c5fd;">ERA</span></div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(params.title)}</title>
</head>
<body style="margin:0; padding:0; background-color:#0f0f1a; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0f0f1a; padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background:linear-gradient(160deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%); border-radius:16px; overflow:hidden; box-shadow:0 8px 40px rgba(0,0,0,0.5);">
          <tr><td style="background:linear-gradient(90deg,#6c47ff,#a78bfa,#6c47ff); height:4px; font-size:0; line-height:0;">&nbsp;</td></tr>
          <tr><td align="center" style="padding:40px 40px 20px;">${logo}</td></tr>
          <tr><td align="center" style="padding:8px 48px 12px;"><h1 style="margin:0; font-size:25px; font-weight:700; color:#ffffff; letter-spacing:-0.5px;">${escapeHtml(params.title)}</h1></td></tr>
          <tr><td align="center" style="padding:0 48px 20px;"><p style="margin:0; font-size:15px; line-height:1.7; color:#a0aec0;">${escapeHtml(params.intro)}</p></td></tr>
          <tr><td align="center" style="padding:0 48px 8px;"><p style="margin:0 0 8px; font-size:14px; line-height:1.7; color:#a0aec0;">${escapeHtml(params.body)}</p></td></tr>
          <tr><td align="center" style="padding:16px 48px 24px;"><a href="${escapeHtml(params.ctaUrl)}" style="display:inline-block; background:linear-gradient(135deg,#6c47ff,#a78bfa); color:#ffffff; text-decoration:none; font-size:16px; font-weight:600; padding:14px 36px; border-radius:50px; letter-spacing:0.3px; box-shadow:0 4px 20px rgba(108,71,255,0.45);">${escapeHtml(params.ctaLabel)} &rarr;</a></td></tr>
          <tr><td style="padding:0 48px;"><div style="border-top:1px solid rgba(255,255,255,0.08); font-size:0;">&nbsp;</div></td></tr>
          <tr><td align="center" style="padding:16px 48px 30px;"><p style="margin:0; font-size:12px; color:#4a5568; line-height:1.6;">&copy; 2026 VERA. All rights reserved.</p></td></tr>
          <tr><td style="background:linear-gradient(90deg,#6c47ff,#a78bfa,#6c47ff); height:4px; font-size:0; line-height:0;">&nbsp;</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendViaResend(
  apiKey: string,
  to: string,
  subject: string,
  text: string,
  html: string,
  from: string,
) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { type, email, token, org_name } = await req.json();
    const to = String(email || "").trim().toLowerCase();
    if (!to || !to.includes("@")) {
      return new Response(
        JSON.stringify({ error: "A valid email is required." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const resendKey = Deno.env.get("RESEND_API_KEY") || "";
    if (!resendKey) {
      return new Response(
        JSON.stringify({ error: "Email service not configured." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const appUrl = (Deno.env.get("NOTIFICATION_APP_URL") || "").trim() ||
      "https://vera-eval.app";
    const fromAddr = Deno.env.get("NOTIFICATION_FROM") ||
      "VERA <noreply@vera-eval.app>";
    const logoUrl = (Deno.env.get("NOTIFICATION_LOGO_URL") || "").trim();
    const orgName = String(org_name || "the organization");

    if (type === "added") {
      const subject = `You've been added to ${orgName} on VERA`;
      const text = `You now have admin access to ${orgName}. Log in to get started: ${appUrl}/login`;
      const html = buildHtmlTemplate({
        title: `Welcome to ${orgName}`,
        intro: `You now have admin access to ${orgName} on VERA.`,
        body: "Log in with your existing credentials to get started.",
        ctaLabel: "Go to VERA",
        ctaUrl: `${appUrl}/login`,
        logoUrl,
      });
      await sendViaResend(resendKey, to, subject, text, html, fromAddr);
    } else {
      const inviteUrl = `${appUrl}/invite/${token}`;
      const subject = `You're invited to join ${orgName} on VERA`;
      const text = `You've been invited to manage ${orgName} on VERA. Accept your invite: ${inviteUrl}`;
      const html = buildHtmlTemplate({
        title: `Join ${orgName}`,
        intro: `You've been invited to manage ${orgName} on VERA.`,
        body:
          "Click the button below to set your password and start managing your organization.",
        ctaLabel: "Accept Invite",
        ctaUrl: inviteUrl,
        logoUrl,
      });
      await sendViaResend(resendKey, to, subject, text, html, fromAddr);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
