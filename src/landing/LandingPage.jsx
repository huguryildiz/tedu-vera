// size-ceiling-ok: retroactive violation — tracked for split in dedicated refactor session
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, KeyRound, Quote, Star, Icon, Loader2 } from "lucide-react";
import { useTheme } from "@/shared/theme/ThemeProvider";
import ProductShowcase from "./components/ProductShowcase";
import { getDemoClient } from "@/shared/lib/supabaseClient";
import veraLogoDark from "@/assets/vera_logo_dark.png";
import veraLogoWhite from "@/assets/vera_logo_white.png";
import navLogoDark from "@/assets/favicon/web-app-manifest-512x512.png";
import navLogoLight from "@/assets/favicon/favicon_light.png";
import juryStep1Dark from "@/assets/landing/jury-flow/step1-identity-dark.png";
import juryStep1Light from "@/assets/landing/jury-flow/step1-identity-light.png";
import juryStep2Dark from "@/assets/landing/jury-flow/step2-pin-dark.png";
import juryStep2Light from "@/assets/landing/jury-flow/step2-pin-light.png";
import juryStep3Dark from "@/assets/landing/jury-flow/step3-score-dark.png";
import juryStep3Light from "@/assets/landing/jury-flow/step3-score-light.png";
import juryStep4Dark from "@/assets/landing/jury-flow/step4-done-dark.png";
import juryStep4Light from "@/assets/landing/jury-flow/step4-done-light.png";

const JURY_FLOW_STEPS = [
  { label: "1 · Identity",    light: juryStep1Light, dark: juryStep1Dark, alt: "Jury identity step screenshot" },
  { label: "2 · Session PIN", light: juryStep2Light, dark: juryStep2Dark, alt: "Session PIN reveal screenshot" },
  { label: "3 · Score",       light: juryStep3Light, dark: juryStep3Dark, alt: "Scoring screen screenshot" },
  { label: "4 · Done",        light: juryStep4Light, dark: juryStep4Dark, alt: "Submission complete screenshot" },
];

const FALLBACK_STATS = {
  organizations: 6, evaluations: 468, jurors: 36, projects: 76,
  institutions: ["CanSat Competition", "Carnegie Mellon University", "IEEE", "TED University", "TEKNOFEST", "TUBITAK"],
};

// Reuse the shared demo Supabase client — avoids multiple GoTrueClient instances.
const demoClient = getDemoClient();

function useLandingStats() {
  const [stats, setStats] = useState(FALLBACK_STATS);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    demoClient.rpc("rpc_landing_stats").then(({ data }) => {
      if (data && typeof data === "object") setStats(data);
    }).catch(() => {});
  }, []);

  return stats;
}

const FALLBACK_FEEDBACK = { avg_rating: 0, total_count: 0, testimonials: [] };

function useLandingFeedback() {
  const [feedback, setFeedback] = useState(FALLBACK_FEEDBACK);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    demoClient.rpc("rpc_get_public_feedback").then(({ data }) => {
      if (data && typeof data === "object") setFeedback(data);
    }).catch(() => {});
  }, []);

  return feedback;
}

function useCountUp(target, duration = 1400) {
  const isE2E = import.meta.env.VITE_E2E;
  const [count, setCount] = useState(isE2E ? target : 0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    if (isE2E) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // easeOutExpo
            const eased = 1 - Math.pow(2, -10 * progress);
            setCount(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return { count, ref };
}

export function LandingPage() {
  const navigate = useNavigate();
  const demoToken = import.meta.env.VITE_DEMO_ENTRY_TOKEN;
  const isE2E = import.meta.env.VITE_E2E;
  const { theme } = useTheme();
  const stats = useLandingStats();
  const feedback = useLandingFeedback();
  const orgCount = useCountUp(stats.organizations);
  const evalCount = useCountUp(stats.evaluations);
  const jurorCount = useCountUp(stats.jurors);
  const projectCount = useCountUp(stats.projects);

  const [testimonialIdx, setTestimonialIdx] = useState(0);
  const testimonials = feedback.testimonials || [];
  const visibleTestimonial = testimonials[testimonialIdx] || null;
  const nextTestimonial = () => setTestimonialIdx((i) => (i + 1) % testimonials.length);
  const prevTestimonial = () => setTestimonialIdx((i) => (i - 1 + testimonials.length) % testimonials.length);

  // Auto-rotate testimonials every 6s (disabled in E2E to keep snapshots stable)
  useEffect(() => {
    if (testimonials.length <= 1) return;
    if (isE2E) return;
    const id = setInterval(nextTestimonial, 6000);
    return () => clearInterval(id);
  }, [testimonials.length]);

  const [openFaq, setOpenFaq] = useState([false, false, false, false, false, false]);

  const toggleFaq = (i) => {
    setOpenFaq((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  };

  useEffect(() => {
    const els = document.querySelectorAll(".reveal-section, .landing-steps");
    if (!els.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing">
      {/* Nav */}
      <nav className="landing-nav">
        <div className="landing-nav-logo">
          <div className="sb-logo-icon">
            <img src={theme === "dark" ? navLogoDark : navLogoLight} alt="V" />
          </div>
          <div className="sb-logo-text"><span>V</span>ERA</div>
        </div>
        <div className="landing-nav-links">
          <button className="nav-enter-code" onClick={() => navigate("/eval")}>
            <KeyRound size={13} strokeWidth={2} />
            Enter Code
          </button>
          <button className="nav-signin" data-testid="admin-landing-signin" onClick={() => navigate("/login")}>
            Sign In{" "}
            <Icon
              iconNode={[]}
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </Icon>
          </button>
        </div>
      </nav>
      {/* Hero */}
      <div className="landing-hero">
        <div className="landing-logo-mark">
          <img src={theme === "dark" ? veraLogoDark : veraLogoWhite} alt="VERA" />
        </div>
        <div className="landing-section-label" style={{ marginBottom: "24px" }}>
          <span>Visual Evaluation</span>{" "}
          <span className="sep" style={{ color: "rgba(255,255,255,0.15)", fontSize: "8px", lineHeight: 1 }}>·</span>{" "}
          <span>Reporting</span>{" "}
          <span className="sep" style={{ color: "rgba(255,255,255,0.15)", fontSize: "8px", lineHeight: 1 }}>·</span>{" "}
          <span>Analytics</span>
        </div>
        <h1 className="landing-h1">Evaluate anything<br /><em>Prove everything</em></h1>
        <p className="landing-desc">
          Structured jury scoring for exhibitions, competitions, and review panels. Configurable criteria, real-time data capture, and outcome reports your accreditation body trusts.
        </p>
        <div className="landing-ctas">
          <button className="btn-landing-primary" id="btn-try-demo" onClick={(e) => {
            const btn = e.currentTarget;
            btn.classList.add("dj-loading");
            setTimeout(() => {
              btn.classList.remove("dj-loading");
              navigate(demoToken ? `/demo/eval?t=${demoToken}` : "/eval");
            }, 500);
          }}>
            <Loader2 className="dj-btn-spinner" size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
            <span className="dj-normal-content" style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <Icon
                iconNode={[]}
                width="16"
                height="16"
                viewBox="0 0 20 20"
                fill="currentColor"
                style={{ opacity: 0.95 }}>
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </Icon>
              Experience Demo
            </span>
          </button>
          <button className="btn-landing-secondary" onClick={() => navigate("/demo")}>
            <Icon
              iconNode={[]}
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: 0.7 }}>
              <rect width="7" height="9" x="3" y="3" rx="1.5" />
              <rect width="7" height="5" x="14" y="3" rx="1.5" />
              <rect width="7" height="9" x="14" y="12" rx="1.5" />
              <rect width="7" height="5" x="3" y="16" rx="1.5" />
            </Icon>
            Explore Admin Panel
          </button>
        </div>
        <p className="landing-cta-hint">Interactive demo with real evaluation data — no sign-up required.</p>

        <div className="hero-showcase-container" style={{ marginTop: "40px", width: "100%", maxWidth: "1040px", position: "relative", zIndex: 10 }}>
          <ProductShowcase />
        </div>
      </div>
      {/* Mobile Mockup — 4 Phone Flow */}
      <section className="landing-mobile reveal-section">
        <div className="landing-section-label">
          <Icon
            iconNode={[]}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            style={{ opacity: 0.6 }}>
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <path d="M12 18h.01" />
          </Icon>
          The juror experience
        </div>
        <p style={{ color: "#94a3b8", fontSize: "15px", maxWidth: "520px", margin: "0 auto", lineHeight: 1.6 }}>
          No app to install, no training needed. Jurors scan a QR code, enter their name, and start scoring.
        </p>
        <div className="mobile-flow">
          {JURY_FLOW_STEPS.map((step, i) => (
            <React.Fragment key={step.label}>
              {i > 0 && <div className="mobile-flow-arrow">→</div>}
              <div>
                <div className="mobile-frame">
                  <div className="mobile-notch" />
                  <div className="mobile-inner">
                    <img
                      className="mobile-screenshot"
                      src={theme === "dark" ? step.dark : step.light}
                      alt={step.alt}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </div>
                <div className="mobile-step-label">{step.label}</div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </section>
      {/* Trust Band */}
      <section className="landing-trust reveal-section">
        <div className="landing-trust-proof">
          <div className="landing-proof-eyebrow">
            <Icon
              iconNode={[]}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: 0.6 }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </Icon>
            One platform — built for every evaluation
          </div>
          <div
            className="trust-feature-grid trust-feature-grid--six"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              e.currentTarget.style.setProperty('--spotlight-x', `${x}px`);
              e.currentTarget.style.setProperty('--spotlight-y', `${y}px`);
              e.currentTarget.style.setProperty('--spotlight-opacity', '1');
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.setProperty('--spotlight-opacity', '0');
            }}
          >
            <div className="trust-feature-card reveal-child">
              <div className="tfc-icon">
                <Icon
                  iconNode={[]}
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><path d="M12 18h.01" /></Icon>
              </div>
              <div className="tfc-body">
                <div className="tfc-title">Works on any device</div>
                <div className="tfc-desc">Mobile, tablet, or desktop — zero installation, zero friction.</div>
              </div>
            </div>
            <div className="trust-feature-card reveal-child">
              <div className="tfc-icon tfc-icon--green">
                <Icon
                  iconNode={[]}
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></Icon>
              </div>
              <div className="tfc-body">
                <div className="tfc-title">PIN-secured sessions</div>
                <div className="tfc-desc">Jurors authenticate with a single-use PIN — no accounts, no passwords.</div>
              </div>
            </div>
            <div className="trust-feature-card reveal-child">
              <div className="tfc-icon tfc-icon--amber">
                <Icon
                  iconNode={[]}
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></Icon>
              </div>
              <div className="tfc-body">
                <div className="tfc-title">
                  Real-time analytics
                  <span className="tfc-live-dot" aria-hidden="true" />
                </div>
                <div className="tfc-desc">Live dashboards update the moment a juror submits — no polling, no delay.</div>
              </div>
            </div>
            <div className="trust-feature-card reveal-child">
              <div className="tfc-icon tfc-icon--violet">
                <Icon
                  iconNode={[]}
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></Icon>
              </div>
              <div className="tfc-body">
                <div className="tfc-title">XLSX &amp; PDF export</div>
                <div className="tfc-desc">One-click reports formatted for committees, deans, and accreditors.</div>
              </div>
            </div>
            <div className="trust-feature-card reveal-child">
              <div className="tfc-icon tfc-icon--rose">
                <Icon
                  iconNode={[]}
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><path d="M14 2v6h6" /><path d="m9 15 2 2 4-4" /></Icon>
              </div>
              <div className="tfc-body">
                <div className="tfc-title">MÜDEK &amp; ABET ready</div>
                <div className="tfc-desc">Built-in outcome mapping and programme attainment rollups.</div>
              </div>
            </div>
            <div className="trust-feature-card trust-feature-card--context reveal-child">
              <div className="tfc-icon tfc-icon--cyan">
                <Icon
                  iconNode={[]}
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" />
                </Icon>
              </div>
              <div className="tfc-body">
                <div className="tfc-title">Every evaluation context</div>
                <div className="tfc-desc">University capstones, hackathons, TEKNOFEST &amp; CanSat, research grants, design exhibitions, and ABET / MÜDEK accreditation reviews.</div>
              </div>
            </div>
          </div>
        </div>
        <div className="landing-trust-divider" />
        <div className="landing-stats">
          <div className="landing-stat" ref={orgCount.ref}>
            <div className="landing-stat-value">{orgCount.count}</div>
            <div className="landing-stat-label">Organizations</div>
          </div>
          <div className="landing-stat" ref={evalCount.ref}>
            <div className="landing-stat-value">{evalCount.count.toLocaleString()}</div>
            <div className="landing-stat-label">Evaluations</div>
          </div>
          <div className="landing-stat" ref={jurorCount.ref}>
            <div className="landing-stat-value">{jurorCount.count}</div>
            <div className="landing-stat-label">Jurors</div>
          </div>
          <div className="landing-stat" ref={projectCount.ref}>
            <div className="landing-stat-value">{projectCount.count}</div>
            <div className="landing-stat-label">Projects Scored</div>
          </div>
        </div>
        <div className="landing-trust-sandbox">
          <span className="landing-proof-live-dot" />
          <span>All metrics sourced from live sandbox — explore real evaluation data anytime</span>
        </div>
      </section>
      {/* How it works */}
      <div className="landing-how" id="section-how">
        <div className="landing-section-label">
          <Icon
            iconNode={[]}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            style={{ opacity: 0.6 }}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </Icon>
          How it works
        </div>
        <div className="landing-steps">
          <div className="landing-step" style={{ "--step-i": 0 }}>
            <div className="step-number">1</div>
            <div className="step-icon">
              <Icon
                iconNode={[]}
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="4" />
                <path d="M7 7h4v4H7zM13 7h4v4h-4zM7 13h4v4H7zM13 15h4" />
              </Icon>
            </div>
            <h4>Set Up &amp; Share</h4>
            <p>Define criteria, add projects, invite jurors. Share a QR code or link — evaluators join in seconds.</p>
          </div>
          <div className="step-arrow" style={{ "--arrow-i": 0 }}>
            <Icon
              iconNode={[]}
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </Icon>
          </div>
          <div className="landing-step" style={{ "--step-i": 1 }}>
            <div className="step-number">2</div>
            <div className="step-icon">
              <Icon
                iconNode={[]}
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5">
                <path d="M12 20V4M4 12l8-8 8 8" />
                <path d="M8 16h8" />
              </Icon>
            </div>
            <h4>Score Live</h4>
            <p>Jurors evaluate on any device. Scores auto-save on every input — no paper forms, no data entry.</p>
          </div>
          <div className="step-arrow" style={{ "--arrow-i": 1 }}>
            <Icon
              iconNode={[]}
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </Icon>
          </div>
          <div className="landing-step" style={{ "--step-i": 2 }}>
            <div className="step-number">3</div>
            <div className="step-icon">
              <Icon
                iconNode={[]}
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5">
                <path d="M3 3v18h18" />
                <path d="M7 14l4-4 4 4 6-6" />
              </Icon>
            </div>
            <h4>Report &amp; Prove</h4>
            <p>Rankings, outcome attainment, analytics, and exports — accreditation-ready the moment scoring ends.</p>
          </div>
        </div>
      </div>
      {/* Comparison Table */}
      <section className="landing-compare reveal-section">
        <div className="landing-section-label">
          <Icon
            iconNode={[]}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            style={{ opacity: 0.6 }}>
            <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
          </Icon>
          How VERA compares
        </div>
        <table className="compare-table table-standard">
          <thead>
            <tr>
              <th></th>
              <th>Paper + Excel</th>
              <th>Google Forms</th>
              <th>Judgify</th>
              <th className="highlight">VERA</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Real-time mobile scoring</td><td className="ct-no">—</td><td className="ct-partial">~</td><td className="ct-yes">✓</td><td className="highlight ct-yes">✓</td></tr>
            <tr><td>Auto-save on every input</td><td className="ct-no">—</td><td className="ct-no">—</td><td className="ct-partial">~</td><td className="highlight ct-yes">✓</td></tr>
            <tr><td>Configurable rubric criteria</td><td className="ct-partial">~</td><td className="ct-partial">~</td><td className="ct-yes">✓</td><td className="highlight ct-yes">✓</td></tr>
            <tr><td>Programme outcome mapping</td><td className="ct-no">—</td><td className="ct-no">—</td><td className="ct-no">—</td><td className="highlight ct-yes">✓</td></tr>
            <tr><td>Accreditation-ready reports</td><td className="ct-no">—</td><td className="ct-no">—</td><td className="ct-no">—</td><td className="highlight ct-yes">✓</td></tr>
            <tr><td>Full audit trail</td><td className="ct-no">—</td><td className="ct-no">—</td><td className="ct-partial">~</td><td className="highlight ct-yes">✓</td></tr>
            <tr><td>Multi-organization isolation</td><td className="ct-no">—</td><td className="ct-no">—</td><td className="ct-yes">✓</td><td className="highlight ct-yes">✓</td></tr>
            <tr><td>No setup / training needed</td><td className="ct-yes">✓</td><td className="ct-yes">✓</td><td className="ct-partial">~</td><td className="highlight ct-yes">✓</td></tr>
          </tbody>
        </table>
      </section>
      {/* Social Proof */}
      <section className="landing-testimonial reveal-section">
        <div className="testimonial-module">

          {/* Section header */}
          <div className="landing-section-label" style={{ justifyContent: "center" }}>
            <Icon
              iconNode={[]}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              style={{ opacity: 0.6 }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </Icon>
            Trusted by evaluators
          </div>

          {/* Aggregate rating pill */}
          {feedback.total_count > 0 && (
            <div className="testimonial-aggregate">
              <div className="testimonial-agg-inner">
                <div className="testimonial-stars">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <Star
                      key={v}
                      size={21}
                      strokeWidth={0}
                      fill={v <= Math.round(feedback.avg_rating) ? "currentColor" : "currentColor"}
                      className={v <= Math.round(feedback.avg_rating) ? "star-filled" : "star-empty"}
                    />
                  ))}
                </div>
                <span className="testimonial-rating-text">{feedback.avg_rating}</span>
                <span className="testimonial-rating-sep" />
                <span className="testimonial-rating-count">
                  {feedback.total_count} reviews
                </span>
              </div>
            </div>
          )}

          {/* Testimonial card */}
          {visibleTestimonial ? (
            <div className="testimonial-card" key={testimonialIdx}>
              <div className="testimonial-quote-icon">
                <Quote size={20} strokeWidth={1.5} />
              </div>
              <blockquote className="testimonial-quote">{visibleTestimonial.comment}</blockquote>
              <div className="testimonial-author">
                <div className="testimonial-avatar">
                  {(visibleTestimonial.juror_name || "")
                    .split(" ")
                    .filter((w) => !/^(Prof\.|Dr\.|Assoc\.|Asst\.)$/.test(w))
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </div>
                <div className="testimonial-meta">
                  <div className="testimonial-name">{visibleTestimonial.juror_name}</div>
                  <div className="testimonial-role">{visibleTestimonial.affiliation}</div>
                </div>
                <div className="testimonial-author-stars">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <Star
                      key={v}
                      size={15}
                      strokeWidth={0}
                      fill="currentColor"
                      className={v <= visibleTestimonial.rating ? "star-filled" : "star-empty"}
                    />
                  ))}
                </div>
              </div>
              {testimonials.length > 1 && (
                <div className="testimonial-nav">
                  <button className="testimonial-nav-btn" onClick={prevTestimonial} aria-label="Previous">
                    <ChevronLeft size={14} strokeWidth={2.5} />
                  </button>
                  <div className="testimonial-dots">
                    {testimonials.map((_, i) => (
                      <button
                        key={i}
                        className={`testimonial-dot${i === testimonialIdx ? " active" : ""}`}
                        onClick={() => setTestimonialIdx(i)}
                        aria-label={`Testimonial ${i + 1}`}
                      />
                    ))}
                  </div>
                  <button className="testimonial-nav-btn" onClick={nextTestimonial} aria-label="Next">
                    <ChevronRight size={14} strokeWidth={2.5} />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="testimonial-card">
              <div className="testimonial-quote-icon">
                <Quote size={20} strokeWidth={1.5} />
              </div>
              <blockquote className="testimonial-quote">We evaluated 41 capstone projects with 19 jurors in under two hours. Scores were live, rankings were instant, and the accreditation report was ready before we left the building.</blockquote>
              <div className="testimonial-author">
                <div className="testimonial-avatar">AY</div>
                <div className="testimonial-meta">
                  <div className="testimonial-name">Prof. Ahmet Yilmaz</div>
                  <div className="testimonial-role">EE Department &middot; Poster Day Coordinator</div>
                </div>
              </div>
            </div>
          )}

        </div>
      </section>
      {/* FAQ */}
      <section className="landing-faq reveal-section">
        <div className="landing-section-label">
          <Icon
            iconNode={[]}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            style={{ opacity: 0.6 }}>
            <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" />
          </Icon>
          Common questions
        </div>
        <div className="faq-list">
          {[
            {
              q: "Is VERA free to use?",
              a: "VERA is free for academic departments and research groups. For large-scale commercial use or custom deployments, contact us for pricing.",
            },
            {
              q: "Can I define my own evaluation criteria?",
              a: "Yes. Each evaluation period has fully configurable criteria — labels, weights, max scores, rubric descriptions, and programme outcome mappings. You can use the built-in defaults or create domain-specific criteria from scratch.",
            },
            {
              q: "Which accreditation standards does VERA support?",
              a: "VERA supports MÜDEK and ABET programme outcome mapping out of the box. You can also define custom outcome frameworks for any accreditation body or internal quality standard.",
            },
            {
              q: "Do jurors need to install an app?",
              a: "No. VERA runs entirely in the browser. Jurors scan a QR code or click a link, enter their name, and start scoring. No downloads, no accounts, no training.",
            },
            {
              q: "What happens if a juror loses connection?",
              a: "Scores auto-save after every input. If disconnected, the juror can return using their 4-digit session PIN and resume exactly where they left off. No data is lost.",
            },
            {
              q: "Where is evaluation data stored?",
              a: "All data is stored in a secure Supabase (PostgreSQL) database with row-level security, role-based access controls, and a full audit trail. Each organization's data is completely isolated.",
            },
          ].map((item, i) => (
            <div
              key={item.q}
              className={`faq-item${openFaq[i] ? " open" : ""}`}
              onClick={() => toggleFaq(i)}
            >
              <div className="faq-q">
                {item.q}
                <Icon
                  iconNode={[]}
                  className="faq-chevron"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2">
                  <path d="m6 9 6 6 6-6" />
                </Icon>
              </div>
              <div className="faq-a">{item.a}</div>
            </div>
          ))}
        </div>
      </section>
      {/* Footer */}
      <div className="landing-footer-bottom">
        © 2026 VERA · Developed by{" "}
        <a href="https://huguryildiz.com/" target="_blank" rel="noopener" style={{ color: "inherit", textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.2)", paddingBottom: "1px", transition: "border-color .2s" }}>
          Huseyin Ugur Yildiz
        </a>
      </div>
    </div>
  );
}
