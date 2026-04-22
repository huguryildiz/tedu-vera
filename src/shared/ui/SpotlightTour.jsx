// src/shared/ui/SpotlightTour.jsx
// Reusable guided tour overlay — renders a spotlight hole + tooltip per step.
// storageType="session" (default) stores in sessionStorage; "local" persists across sessions.
import { useState, useEffect, useLayoutEffect, useRef } from "react";

const PAD = 8;
const MOBILE_BP = 600;

/**
 * @param {{ steps: Array<{selector:string, title:string, body:string, placement:"above"|"below"}>, sessionKey?: string, delay?: number, storageType?: "session"|"local" }} props
 */
export default function SpotlightTour({ steps, sessionKey = "dj_tour_done", delay = 700, storageType = "session", onDone, onStart }) {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [hole, setHole] = useState(null);
  const [tipPos, setTipPos] = useState({ top: -9999, left: -9999, width: 248 });
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.innerWidth <= MOBILE_BP
  );
  const doneRef = useRef(false);

  const store = storageType === "local" ? localStorage : sessionStorage;

  useEffect(() => {
    if (!steps || steps.length === 0) return;
    try {
      if (store.getItem(sessionKey)) return;
    } catch {}
    const timer = setTimeout(() => {
      onStart?.();
      setActive(true);
      setStep(0);
    }, delay);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= MOBILE_BP);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  useLayoutEffect(() => {
    if (!active) return;
    const s = steps[step];
    if (!s) { skip(); return; }

    const target = document.querySelector(s.selector);
    if (!target) {
      if (step < steps.length - 1) { setStep((v) => v + 1); } else { skip(); }
      return;
    }

    const rect = target.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const targetVisible =
      rect.width > 0 &&
      rect.height > 0 &&
      rect.right > 0 &&
      rect.bottom > 0 &&
      rect.left < vw &&
      rect.top < vh;

    if (isMobile) {
      // Mobile: bottom-sheet style, full width with gutter, no spotlight hole
      // if target is offscreen (sidebar items when collapsed).
      const gutter = 16;
      const tipW = Math.min(420, vw - gutter * 2);
      const tipLeft = Math.max(gutter, Math.round((vw - tipW) / 2));
      // Reserve ~220px for tooltip content on mobile
      const tipTop = Math.max(gutter, vh - 240);

      if (targetVisible) {
        setHole({
          left: Math.max(0, rect.left - PAD),
          top: Math.max(0, rect.top - PAD),
          width: Math.min(vw, rect.width + PAD * 2),
          height: Math.min(vh, rect.height + PAD * 2),
        });
      } else {
        setHole({ offscreen: true });
      }
      setTipPos({ top: tipTop, left: tipLeft, width: tipW });
      return;
    }

    // Desktop / tablet
    const TIP_W = 248;
    const TIP_H = 170;
    const gap = 12;
    const tipLeft = Math.max(gap, Math.min(rect.left, vw - TIP_W - gap));
    let tipTop;
    if (s.placement === "below") {
      tipTop = rect.bottom + PAD + gap;
    } else {
      tipTop = rect.top - TIP_H - PAD - gap;
    }
    tipTop = Math.max(gap, Math.min(tipTop, vh - TIP_H - gap));

    setHole({
      left: rect.left - PAD,
      top: rect.top - PAD,
      width: rect.width + PAD * 2,
      height: rect.height + PAD * 2,
    });
    setTipPos({ top: tipTop, left: tipLeft, width: TIP_W });
  }, [active, step, isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  function next() {
    if (step >= steps.length - 1) { skip(); return; }
    setStep((s) => s + 1);
  }

  function skip() {
    if (doneRef.current) return;
    doneRef.current = true;
    setActive(false);
    try { store.setItem(sessionKey, "1"); } catch {}
    onDone?.();
  }

  if (!active || !hole) return null;

  const isLast = step === steps.length - 1;
  const s = steps[step];
  const hideHole = isMobile && hole.offscreen;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 500, pointerEvents: "auto" }}
      onClick={(e) => { e.stopPropagation(); skip(); }}
    >
      {hideHole ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            pointerEvents: "none",
          }}
        />
      ) : (
        <div
          className="dj-spotlight-mask-hole"
          style={{
            position: "absolute",
            left: hole.left,
            top: hole.top,
            width: hole.width,
            height: hole.height,
            borderRadius: 10,
            pointerEvents: "none",
            transition: "all .35s cubic-bezier(0.22,1,0.36,1)",
          }}
        />
      )}
      <div
        className="dj-spotlight-tooltip-box"
        style={{
          position: "absolute",
          top: tipPos.top,
          left: tipPos.left,
          width: tipPos.width,
          transition: "all .35s cubic-bezier(0.22,1,0.36,1)",
          zIndex: 1,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dj-spotlight-progress">
          Step {step + 1} of {steps.length}
        </div>
        <h4 className="dj-spotlight-title">{s.title}</h4>
        <p className="dj-spotlight-body">{s.body}</p>
        <div className="dj-spotlight-actions">
          <button className="dj-spotlight-skip-btn" onClick={skip}>
            Skip tour
          </button>
          <button className="dj-spotlight-next-btn" onClick={next}>
            {isLast ? "Got it ✓" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}
