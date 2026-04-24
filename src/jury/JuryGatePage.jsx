// src/jury/JuryGatePage.jsx
// Jury access gate — shown when landing with ?t= token or no token.
// Verifies token against the active DB (determined by pathname: /demo/* → demo, else → prod).
// On success stores the access grant and navigates to the jury flow.

import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { ArrowLeft, Info, KeyRound, RefreshCw, ShieldOff } from "lucide-react";
import veraLogoDark from "../assets/vera_logo_dark.png";
import veraLogoWhite from "../assets/vera_logo_white.png";
import { listPeriods, listPeriodsPublic, listProjects, verifyEntryReference, verifyEntryToken } from "../shared/api";
import { setJuryAccess } from "../shared/storage";
import { setJuryPreload } from "./shared/juryPreloadCache";
import FbAlert from "../shared/ui/FbAlert";

/** Extract token from a pasted URL or raw code string. */
function extractToken(input) {
  const s = String(input || "").trim();
  try {
    const url = new URL(s, window.location.origin);
    return url.searchParams.get("t") || url.searchParams.get("eval") || s;
  } catch {
    return s;
  }
}

/** "demo-ORGCODE" shorthand → resolve period from public list. */
function readDemoAlias(token) {
  const s = String(token || "").trim().toLowerCase();
  if (!s.startsWith("demo-")) return null;
  const orgCode = s.slice("demo-".length).trim();
  return orgCode ? orgCode.toUpperCase() : null;
}

async function resolveDemoAliasGrant(token) {
  const orgCode = readDemoAlias(token);
  if (!orgCode) return null;
  const periods = await listPeriodsPublic();
  const all = periods || [];
  const byCode = all.filter(
    (p) => String(p?.organizations?.code || "").trim().toUpperCase() === orgCode
  );
  if (!byCode.length) return null;

  const preferred =
    byCode.find((p) => p?.is_locked && !p?.closed_at)
    || byCode[0];
  if (!preferred?.id) return null;

  return {
    ok: true,
    period_id: preferred.id,
    period_name: preferred.name || "",
    is_locked: preferred.is_locked ?? false,
    closed_at: preferred.closed_at ?? null,
  };
}

function isReferenceId(value) {
  const alnum = String(value || "").trim().replace(/[^A-Za-z0-9]/g, "");
  // Short alphanumeric codes (5–12 chars after stripping) → route to reference RPC.
  // UUIDs and full tokens are 32+ chars stripped so they fall through to verifyEntryToken.
  return alnum.length >= 5 && alnum.length <= 12;
}

function mapDenyMessage(result) {
  const code = String(result?.error_code || "");
  if (code === "token_expired")       return { title: "Token expired",        code, msg: "This access code has expired. Entry tokens are valid for 24 hours. Please request a new token from your coordinator." };
  if (code === "token_revoked")       return { title: "Token revoked",        code, msg: "This access code has been revoked. Please contact your evaluation coordinator for a new link." };
  if (code === "ambiguous_reference") return { title: "Ambiguous reference",  code, msg: "This reference ID matches multiple tokens. Please use the full access link from your invitation email." };
  if (code === "reference_not_found" || code === "invalid_reference")
    return { title: "Reference not found", code, msg: "Reference ID not found. Please use the full access link or scan the QR code provided." };
  return { title: "Access denied", code: "invalid_token", msg: "The link is invalid, expired, or has been revoked. Please check your invitation email or contact the registration desk." };
}

async function resolveAccessGrant(code) {
  const aliasGrant = await resolveDemoAliasGrant(code);
  if (aliasGrant) return aliasGrant;

  if (isReferenceId(code)) {
    try {
      return await verifyEntryReference(code);
    } catch {
      // Backward compatibility for DBs where reference RPC is not deployed yet.
    }
  }

  return await verifyEntryToken(code);
}

/** Minimum visible duration for the loading screen so users can see the check steps. */
const MIN_VERIFY_MS = 3500;

/**
 * Warm the preload cache while the loading screen is still visible.
 * Fires listPeriods + listProjects in parallel and stores the result so the
 * next screen (IdentityStep via useJuryLoading) can skip the duplicate fetch.
 */
async function prefetchPeriodAndProjects(periodId) {
  if (!periodId) return;
  try {
    const [allPeriods, projectList] = await Promise.all([
      listPeriods().catch(() => null),
      listProjects(periodId, null).catch(() => null),
    ]);
    const periodInfo = (allPeriods || []).find((p) => p?.id === periodId) || null;
    setJuryPreload({
      periodId,
      periods: allPeriods,
      periodInfo,
      projectCount: Array.isArray(projectList) ? projectList.length : null,
    });
  } catch {
    // Non-fatal — useJuryLoading will re-fetch on mount.
  }
}

async function resolveAccessGrantWithMinDelay(code) {
  const verifyStart = Date.now();
  const res = await resolveAccessGrant(code);

  // If the token is valid, spend the remaining wait window prefetching
  // period + projects so the next screen lands with data in hand.
  if (res?.ok && res?.period_id) {
    const elapsed = Date.now() - verifyStart;
    const remaining = Math.max(0, MIN_VERIFY_MS - elapsed);
    await Promise.all([
      prefetchPeriodAndProjects(res.period_id),
      new Promise((r) => setTimeout(r, remaining)),
    ]);
  } else {
    // On failure, still hold the full window so the denied message doesn't flash.
    const elapsed = Date.now() - verifyStart;
    const remaining = Math.max(0, MIN_VERIFY_MS - elapsed);
    if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
  }
  return res;
}

export default function JuryGatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("t");

  const isDemo = location.pathname.startsWith("/demo");
  const juryBase = isDemo ? "/demo/jury" : "/jury";

  const [status, setStatus]     = useState(token ? "loading" : "missing");
  const [denyInfo, setDenyInfo] = useState(null);
  const [manualToken, setManual] = useState("");
  const [verifyingWhat, setVerifyingWhat] = useState("");
  const [loadingStep, setLoadingStep] = useState(0);
  const inputRef = useRef(null);

  // Progress the three check-step rows while the loading screen is visible.
  useEffect(() => {
    if (status !== "loading") return;
    setLoadingStep(0);
    const t1 = setTimeout(() => setLoadingStep(1), 900);
    const t2 = setTimeout(() => setLoadingStep(2), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [status, verifyingWhat]);

  function markDenied(info) {
    setDenyInfo(info || { title: "Access denied", code: "invalid_token", msg: "The link is invalid, expired, or has been revoked." });
    setStatus("denied");
  }

  function onGranted(grant) {
    setJuryAccess(grant.period_id, grant);
    navigate(`${juryBase}/identity`, { replace: true });
  }

  useEffect(() => {
    if (!token) return;
    let active = true;

    (async () => {
      try {
        const res = await resolveAccessGrantWithMinDelay(token);
        if (!active) return;
        if (res?.ok) {
          onGranted(res);
        } else {
          markDenied(mapDenyMessage(res));
        }
      } catch {
        if (active) markDenied();
      }
    })();

    return () => { active = false; };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleVerify(e) {
    e?.preventDefault?.();
    const raw = String(manualToken || "").trim();
    const t = extractToken(raw);
    if (!t) return;
    setVerifyingWhat(raw);
    setStatus("loading");
    setDenyInfo(null);
    try {
      const res = await resolveAccessGrantWithMinDelay(t);
      if (res?.ok) {
        onGranted(res);
      } else {
        markDenied(mapDenyMessage(res));
      }
    } catch {
      markDenied();
    }
  }

  function handleRetry() {
    setStatus("missing");
    setDenyInfo(null);
    setManual("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  /* ── Logomark (shared across all states) ── */
  const Logomark = (
    <div className="jg-logomark">
      <img src={veraLogoDark}  alt="VERA" className="jg-logo-img dark" />
      <img src={veraLogoWhite} alt="VERA" className="jg-logo-img light" />
    </div>
  );

  /* ── Loading state ── */
  if (status === "loading") {
    return (
      <div className="jury-screen jury-gate-screen">
        <div className="jury-step">
          {Logomark}
          <div className="jury-card dj-glass-card jury-gate-card scanning">
            <div className="jg-card-header">
              <div className="jg-icon-box loading">
                <div className="jg-spinner-ring" />
              </div>
              <div className="jg-title loading">Verifying Access…</div>
              <div className="jg-sub">Please wait while we validate your credentials.</div>
            </div>

            <div className="jg-loading-dots">
              <span /><span /><span />
            </div>

            <div className="jg-token-chip">
              <KeyRound size={13} className="jg-token-chip-icon" />
              <span className="jg-token-val">{verifyingWhat || window.location.href}</span>
            </div>

            <div className="jg-check-steps">
              <div className={`jg-check-step ${loadingStep >= 1 ? "done" : "active"}`}>
                <span className="jg-step-dot" />Token format valid
              </div>
              <div className={`jg-check-step ${loadingStep >= 2 ? "done" : loadingStep === 1 ? "active" : ""}`}>
                <span className="jg-step-dot" />Validating against database…
              </div>
              <div className={`jg-check-step ${loadingStep >= 2 ? "active" : ""}`}>
                <span className="jg-step-dot" />Resolving evaluation period
              </div>
            </div>

            <FbAlert variant="info" style={{ marginTop: 16 }}>
              This is a secure verification channel. Your credentials are validated server-side and never stored locally.
            </FbAlert>
          </div>

          <div className="login-footer" style={{ marginTop: 12 }}>
            <button type="button" className="jg-return-link" onClick={() => navigate("/", { replace: true })}>
              <ArrowLeft size={12} />
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Denied state ── */
  if (status === "denied") {
    return (
      <div className="jury-screen jury-gate-screen">
        <div className="jury-step">
          {Logomark}
          <div className="jury-card dj-glass-card jury-gate-card">
            <div className="jg-card-header">
              <div className="jg-icon-box denied">
                <div className="jg-icon-ring denied" />
                <ShieldOff size={20} strokeWidth={1.8} />
              </div>
              <div className="jg-title denied">Access Denied</div>
              <div className="jg-sub">We couldn't validate this access code.</div>
            </div>

            <div className="jg-divider" />

            <FbAlert
              variant="danger"
              title={
                <>
                  {denyInfo?.title || "Invalid token"}
                  {denyInfo?.code && <span className="jg-error-chip">{denyInfo.code}</span>}
                </>
              }
              style={{ marginBottom: 14 }}
            >
              {denyInfo?.msg}
            </FbAlert>

            <div className="jg-form">
              <div className="jg-input-wrap">
                <KeyRound size={14} className="jg-input-icon" />
                <input
                  ref={inputRef}
                  className="form-input jg-token-input"
                  placeholder="Paste a different access link or code…"
                  value={manualToken}
                  onChange={(e) => setManual(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <button
                type="button"
                className="jg-retry-btn"
                onClick={manualToken.trim() ? handleVerify : handleRetry}
              >
                <RefreshCw size={14} />
                Try a Different Code
              </button>
              <button type="button" className="jg-return-link" style={{ alignSelf: "center", marginTop: 2 }} onClick={() => navigate("/", { replace: true })}>
                &larr; Return Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Idle / manual entry state ── */
  return (
    <div className="jury-screen jury-gate-screen">
      <div className="jury-step">
        {Logomark}
        <div className="jury-card dj-glass-card jury-gate-card">
          <div className="jg-card-header">
            <div className="jg-icon-box">
              <div className="jg-icon-ring" />
              <KeyRound size={20} strokeWidth={1.8} />
            </div>
            <div className="jg-title">Enter Your Access Code</div>
            <div className="jg-sub">Paste the link from your invitation email, or type your access code below.</div>
          </div>

          <div className="jg-divider" />

          <form onSubmit={handleVerify} className="jg-form">
            <div className="jg-input-wrap">
              <KeyRound size={14} className="jg-input-icon" />
              <input
                ref={inputRef}
                data-testid="jury-token-input"
                className="form-input jg-token-input"
                placeholder="Paste your access link or code…"
                value={manualToken}
                onChange={(e) => setManual(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="jg-input-hint">
              <Info size={11} />
              Accepts full URL or short code&nbsp;
              <span className="jg-hint-chip">XXXX-XXXX</span>
            </div>
            <button
              type="submit"
              data-testid="jury-verify-btn"
              className="jg-verify-btn"
              disabled={!manualToken.trim()}
            >
              Verify Access
            </button>
          </form>

          <FbAlert variant="info" style={{ marginTop: 16 }}>
            If you are a walk-in juror, please contact the registration desk for assistance.
          </FbAlert>
        </div>

        <div className="login-footer" style={{ marginTop: 12 }}>
          <button type="button" className="jg-return-link" onClick={() => navigate("/", { replace: true })}>
            &larr; Return Home
          </button>
        </div>
      </div>
    </div>
  );
}
