import { useNavigate } from "react-router-dom";
import { LayoutGrid, ArrowRight } from "lucide-react";

export default function Hero() {
  const navigate = useNavigate();
  const demoToken = import.meta.env.VITE_DEMO_ENTRY_TOKEN;

  const onJuryClick = () => {
    navigate(demoToken ? `/demo/eval?t=${demoToken}` : "/eval");
  };

  return (
    <section className="ed-hero">
      <div className="ed-wrap">
        <div className="ed-hero-eyebrow">
          <span className="num">01</span>
          <span>Visual Evaluation · Reporting · Analytics</span>
          <span className="bar" />
          <span className="meta">
            <span>Issue</span>
            <b>Vol. 1</b>
            <span>·</span>
            <b>2026</b>
          </span>
        </div>

        <h1 className="ed-hero-h1">
          Evaluate <em>anything.</em>
          <br />
          Prove <em>everything.</em>
          <span className="light">Live, on any device, in real time.</span>
        </h1>

        <p className="ed-hero-lede editorial-body">
          Structured jury scoring for capstones, exhibitions, hackathons, and accreditation review panels.
          Configurable criteria, real-time data capture, and{" "}
          <b>programme-outcome reports</b> that compile the moment the last juror clicks submit.
        </p>

        <div className="ed-hero-cta">
          <button
            type="button"
            className="ed-cta-primary"
            id="btn-try-demo"
            onClick={onJuryClick}
          >
            Be a juror
            <span className="badge">Demo</span>
            <ArrowRight size={16} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            className="ed-cta-secondary"
            onClick={() => navigate("/demo")}
          >
            <LayoutGrid size={14} strokeWidth={1.8} />
            Tour the admin panel
          </button>
        </div>

        <div className="ed-hero-foot">
          <span>No sign-up · Real evaluation data · Sandbox isolated</span>
          <span>↓ Scroll</span>
        </div>
      </div>
    </section>
  );
}
