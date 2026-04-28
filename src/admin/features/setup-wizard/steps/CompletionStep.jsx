import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/auth";
import { useToast } from "@/shared/hooks/useToast";
import QRCodeStyling from "qr-code-styling";
import veraLogo from "@/assets/vera_logo.png";
import FbAlert from "@/shared/ui/FbAlert";
import {
  generateEntryToken,
  checkPeriodReadiness,
  publishPeriod,
  getSecurityPolicy,
} from "@/shared/api";
import {
  Check,
  CheckCircle2,
  Copy,
  QrCode,
  Zap,
  ArrowRight,
  Download,
  Loader2,
} from "lucide-react";

const QR_TTL_LABELS = { "12h": "12 hours", "24h": "24 hours", "48h": "48 hours", "7d": "7 days" };

// Celebratory confetti burst for the completion screen — mirrors jury DoneStep.
function useConfetti() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#3b82f6", "#60a5fa", "#6366f1", "#a5b4fc", "#22c55e", "#4ade80", "#f1f5f9"];
    const particles = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: -10 - Math.random() * 100,
      r: 3 + Math.random() * 4,
      d: 1 + Math.random() * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 3,
      tiltAngle: 0,
      opacity: 1,
    }));

    let frame = 0;
    const totalFrames = 140;
    let rafId;

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.tiltAngle += 0.07;
        p.y += p.d;
        p.x += p.vx;
        const tilt = Math.sin(p.tiltAngle) * 8;
        if (frame > 80) p.opacity = Math.max(0, 1 - (frame - 80) / 60);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r, p.r * 0.5, tilt, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      frame++;
      if (frame < totalFrames) rafId = requestAnimationFrame(draw);
    }

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, []);
  return canvasRef;
}

// Map a readiness check key from rpc_admin_check_period_readiness to the
// wizard step that owns that data. Used by CompletionScreen to render
// "Fix now" shortcuts that jump straight back to the offending step.
function readinessCheckToStep(check) {
  if (!check) return null;
  if (check.startsWith("criteria") || check === "weights") return 3;
  if (check === "no_framework" || check.startsWith("outcome")) return 3;
  if (check === "no_projects") return 4;
  if (check === "no_jurors") return 5;
  return null;
}

export default function CompletionStep({ periodId, organizationId, isDemoMode, onDashboard, onPublished, onMarkSetupComplete, onNavigateStep }) {
  const confettiRef = useConfetti();
  const toast = useToast();
  const { isSuper } = useAuth();
  const [entryToken, setEntryToken] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [readinessIssues, setReadinessIssues] = useState([]);
  const [qrTtlLabel, setQrTtlLabel] = useState("24 hours");
  const qrInstance = useRef(null);
  const qrRef = useRef(null);

  // Preview readiness on mount so the user sees any blockers before clicking Generate.
  useEffect(() => {
    if (!periodId || entryToken) return;
    let cancelled = false;
    checkPeriodReadiness(periodId)
      .then((r) => {
        if (cancelled) return;
        const blockers = (r?.issues || []).filter((i) => i.severity === "required");
        setReadinessIssues(blockers);
      })
      .catch(() => { /* non-fatal — handleGenerate will surface any errors */ });
    return () => { cancelled = true; };
  }, [periodId, entryToken]);

  const entryUrl = entryToken
    ? `${window.location.origin}${isDemoMode ? "/demo" : ""}/eval?t=${encodeURIComponent(entryToken)}`
    : "";

  useEffect(() => {
    qrInstance.current = new QRCodeStyling({
      width: 200,
      height: 200,
      type: "svg",
      dotsOptions: { type: "extra-rounded", color: "#1e3a5f" },
      cornersSquareOptions: { type: "extra-rounded", color: "#1e3a5f" },
      cornersDotOptions: { type: "dot", color: "#2563eb" },
      backgroundOptions: { color: "#ffffff" },
      imageOptions: { crossOrigin: "anonymous", margin: 4, imageSize: 0.46 },
    });
  }, []);

  useEffect(() => {
    if (!qrInstance.current || !entryUrl) return;
    qrInstance.current.update({ data: entryUrl, image: veraLogo });
    if (qrRef.current) {
      qrRef.current.innerHTML = "";
      qrInstance.current.append(qrRef.current);
    }
  }, [entryUrl]);

  useEffect(() => {
    if (!isSuper) return;
    getSecurityPolicy()
      .then((p) => {
        const ttl = p?.qrTtl || "24h";
        setQrTtlLabel(QR_TTL_LABELS[ttl] ?? "24 hours");
      })
      .catch(() => {});
  }, [isSuper]);

  const handleDownloadQr = () => {
    if (!entryUrl) return;
    const hiRes = new QRCodeStyling({
      width: 800,
      height: 800,
      data: entryUrl,
      image: veraLogo,
      dotsOptions: { type: "extra-rounded", color: "#1e3a5f" },
      cornersSquareOptions: { type: "extra-rounded", color: "#1e3a5f" },
      cornersDotOptions: { type: "dot", color: "#2563eb" },
      backgroundOptions: { color: "#ffffff" },
      imageOptions: { crossOrigin: "anonymous", margin: 4, imageSize: 0.46 },
    });
    hiRes.download({ name: "vera-entry-token", extension: "png" });
  };

  const handleCopy = async () => {
    if (!entryUrl) return;
    try {
      await navigator.clipboard.writeText(entryUrl);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = entryUrl;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleGenerate = async () => {
    if (!periodId) {
      toast.error("No period selected");
      return;
    }
    setGenerating(true);
    try {
      const readiness = await checkPeriodReadiness(periodId);
      if (!readiness?.ok) {
        const blockers = (readiness?.issues || [])
          .filter((i) => i.severity === "required")
          .map((i) => i.msg)
          .join(" · ");
        toast.error(blockers ? `Cannot publish — ${blockers}` : "Period is not ready to publish");
        return;
      }
      const publishResult = await publishPeriod(periodId);
      if (publishResult && publishResult.ok === false) {
        toast.error("Failed to publish period");
        return;
      }
      const token = await generateEntryToken(periodId);
      setEntryToken(token);
      // Stamp organizations.setup_completed_at. Non-blocking: token is already
      // issued; the migration backfill will catch any failure on next admin login.
      if (organizationId) {
        try {
          await onMarkSetupComplete?.(organizationId);
        } catch (e) {
          console.warn("markSetupComplete failed (non-blocking):", e);
        }
      }
      toast.success("Period published — entry token ready");
      onPublished?.();
    } catch (err) {
      const msg = String(err?.message || "");
      if (msg.includes("period_not_published")) {
        toast.error("Period must be published before generating a token");
      } else {
        toast.error("Failed to generate entry token");
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <div className="sw-card sw-completion sw-fade-in" data-testid="wizard-completion">
        <div className="sw-completion-icon">
          <Check size={36} strokeWidth={2.5} />
        </div>
        <h2 className="sw-card-title">Setup complete!</h2>
        <p className="sw-card-desc">
          All steps are done. Generate the entry token to make your evaluation live — jurors will use it to access the gate.
        </p>

        <div className="sw-token">
          <div className="sw-token-head">
            <QrCode size={15} />
            <span>Entry Token</span>
          </div>

          {entryToken ? (
            <>
              <div className="sw-token-desc">
                Share this link with jurors. They'll use it to access the evaluation gate.
              </div>
              <div className="sw-token-card">
                <div className="sw-token-qr-wrap">
                  <div className="sw-token-qr" ref={qrRef} />
                  <button type="button" className="sw-qr-download" onClick={handleDownloadQr}>
                    <Download size={11} strokeWidth={2} />
                    Download
                  </button>
                </div>
                <div className="sw-token-body">
                  <div className="sw-token-status">
                    <span className="sw-token-status-dot" />
                    Active
                  </div>
                  <div className="sw-token-url">
                    <span className="sw-token-url-text">{entryUrl}</span>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className={`sw-token-copy${copied ? " is-copied" : ""}`}
                      aria-label={copied ? "Copied" : "Copy entry URL"}
                    >
                      {copied ? (
                        <>
                          <CheckCircle2 size={13} strokeWidth={2.25} />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} strokeWidth={2} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="sw-token-note">
                    Expires in {qrTtlLabel} · Scan to open on mobile
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="sw-token-desc">
                Jurors use this link to access your evaluation at the entry gate. Generate it to make your evaluation live.
              </div>
              {readinessIssues.length > 0 && (
                <div className="sw-readiness-block">
                  <FbAlert variant="danger" title="Cannot publish yet">
                    <ul className="sw-readiness-list">
                      {readinessIssues.map((issue, idx) => {
                        const step = readinessCheckToStep(issue.check);
                        return (
                          <li key={idx}>
                            <span>{issue.msg}</span>
                            {step && onNavigateStep && (
                              <button
                                type="button"
                                className="sw-readiness-fix"
                                onClick={() => onNavigateStep(step)}
                              >
                                Fix now <ArrowRight size={12} />
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </FbAlert>
                </div>
              )}
              <div className="sw-token-generate">
                <button
                  className="sw-btn sw-btn-primary"
                  data-testid="wizard-step-review-complete"
                  onClick={handleGenerate}
                  disabled={generating || readinessIssues.length > 0}
                >
                  {generating ? (
                    <><Loader2 size={15} className="sw-btn-spinner" /> Generating…</>
                  ) : (
                    <>Publish & Generate Entry Token <Zap size={15} /></>
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="sw-completion-actions">
          <button className="sw-btn sw-btn-ghost" onClick={onDashboard} data-testid="wizard-completion-dashboard">
            Go to Dashboard <ArrowRight size={15} />
          </button>
        </div>
      </div>
      <canvas
        ref={confettiRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 9999,
        }}
      />
    </>
  );
}
