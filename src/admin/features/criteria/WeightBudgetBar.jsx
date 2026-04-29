import { useState, useRef, useEffect } from "react";
import { Equal, Sparkles } from "lucide-react";
import { CRITERION_COLORS } from "./criteriaFormHelpers";

const DARK_COLOR_MAP = { "#22c55e": "#4ade80", "#16a34a": "#4ade80" };

function useDarkMode() {
  const [dark, setDark] = useState(() => document.body.classList.contains("dark-mode"));
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.body.classList.contains("dark-mode")));
    obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

const BUBBLE_COLORS = ['#60a5fa','#f472b6','#34d399','#fbbf24','#a78bfa','#fb923c','#38bdf8','#e879f9','#4ade80','#f87171'];

function spawnBubbles(iconRef, wrapRef, setParticles) {
  let originX = 20, originY = 16;
  if (iconRef.current && wrapRef.current) {
    const ic = iconRef.current.getBoundingClientRect();
    const wr = wrapRef.current.getBoundingClientRect();
    originX = (ic.left + ic.width / 2) - wr.left;
    originY = (ic.top  + ic.height / 2) - wr.top;
  }
  const count = 8;
  setParticles(
    Array.from({ length: count }, (_, i) => {
      const size  = 4 + Math.random() * 5;
      const angle = -155 + (130 / (count - 1)) * i + (Math.random() - 0.5) * 14;
      const dist  = 22 + Math.random() * 18;
      const rad   = (angle * Math.PI) / 180;
      return {
        id:    Date.now() + i,
        left:  originX - size / 2,
        top:   originY - size / 2,
        size,
        color: BUBBLE_COLORS[i % BUBBLE_COLORS.length],
        delay: Math.random() * 60,
        bx:    Math.cos(rad) * dist,
        by:    Math.sin(rad) * dist,
      };
    })
  );
  setTimeout(() => setParticles([]), 900);
}

export default function WeightBudgetBar({ criteria, onDistribute, onAutoFill, locked }) {
  const isDark = useDarkMode();
  const resolveColor = (hex) => (isDark && hex ? (DARK_COLOR_MAP[hex.toLowerCase()] ?? hex) : hex);
  const [autoFillOpen, setAutoFillOpen] = useState(false);
  const popoverRef = useRef(null);

  const [distParticles,   setDistParticles]   = useState([]);
  const [fillParticles,   setFillParticles]   = useState([]);
  const [distBoosting,    setDistBoosting]    = useState(false);
  const [fillBoosting,    setFillBoosting]    = useState(false);
  const distIconRef  = useRef(null);
  const distWrapRef  = useRef(null);
  const fillIconRef  = useRef(null);
  const fillWrapRef  = useRef(null);

  const total = criteria.reduce((s, c) => s + (c.max || 0), 0);
  const remaining = 100 - total;
  const isValid = total === 100;
  const isOver = total > 100;
  const isUnder = total < 100;

  useEffect(() => {
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setAutoFillOpen(false);
      }
    }
    if (autoFillOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [autoFillOpen]);

  const handleAutoFill = (criterion) => {
    if (onAutoFill) onAutoFill(criterion);
    setAutoFillOpen(false);
  };

  const handleDistribute = () => {
    if (distBoosting || locked) return;
    if (onDistribute) onDistribute();
    setDistBoosting(true);
    spawnBubbles(distIconRef, distWrapRef, setDistParticles);
    setTimeout(() => setDistBoosting(false), 600);
  };

  const handleFillToggle = () => {
    if (locked) return;
    setAutoFillOpen(o => !o);
    if (!fillBoosting) {
      setFillBoosting(true);
      spawnBubbles(fillIconRef, fillWrapRef, setFillParticles);
      setTimeout(() => setFillBoosting(false), 600);
    }
  };

  return (
    <div className={`crt-budget-card${isOver ? " crt-budget-over" : isValid ? " crt-budget-valid" : ""}${locked ? " crt-budget-card--locked" : ""}`}>
      <div className="crt-budget-header">
        <div className="crt-budget-left">
          <div className="crt-budget-label">WEIGHT BUDGET</div>
          <div className={`crt-budget-value ${isOver ? "crt-budget-value-over" : isValid ? "crt-budget-value-valid" : "crt-budget-value-under"}`}>
            {total} / 100
          </div>
          <div className={`crt-budget-status ${isOver ? "crt-budget-status-over" : isUnder ? "crt-budget-status-under" : "crt-budget-status-valid"}`}>
            {isValid && "✓ Valid"}
            {isUnder && `${remaining} pts remaining`}
            {isOver && `Over by ${Math.abs(remaining)} pts`}
          </div>
        </div>
        <div className="crt-budget-actions">
          <div className="crt-budget-pill-wrap" ref={distWrapRef}>
            <button
              className={`crt-budget-pill${distBoosting ? " crt-budget-pill--boosting" : ""}`}
              onClick={handleDistribute}
              type="button"
              disabled={locked}
            >
              <span ref={distIconRef} className="crt-pill-icon-anchor">
                <Equal size={13} strokeWidth={2.5} />
              </span>
              Distribute equally
            </button>
            {distParticles.map(p => (
              <span
                key={p.id}
                className="crt-band-auto-bubble"
                style={{
                  left: p.left, top: p.top,
                  width: p.size, height: p.size,
                  background: p.color,
                  boxShadow: `0 0 6px ${p.color}, 0 0 12px ${p.color}88`,
                  animationDelay: `${p.delay}ms`,
                  "--bx": `${p.bx}px`, "--by": `${p.by}px`,
                }}
              />
            ))}
          </div>
          <div className="crt-budget-auto-container crt-budget-pill-wrap" ref={popoverRef}>
            <div className="crt-budget-pill-wrap" ref={fillWrapRef}>
              <button
                className={`crt-budget-pill${fillBoosting ? " crt-budget-pill--boosting" : ""}`}
                onClick={handleFillToggle}
                type="button"
                disabled={locked}
              >
                <span ref={fillIconRef} className="crt-pill-icon-anchor">
                  <Sparkles size={13} strokeWidth={2} />
                </span>
                Auto-fill remaining
              </button>
              {fillParticles.map(p => (
                <span
                  key={p.id}
                  className="crt-band-auto-bubble"
                  style={{
                    left: p.left, top: p.top,
                    width: p.size, height: p.size,
                    background: p.color,
                    boxShadow: `0 0 6px ${p.color}, 0 0 12px ${p.color}88`,
                    animationDelay: `${p.delay}ms`,
                    "--bx": `${p.bx}px`, "--by": `${p.by}px`,
                  }}
                />
              ))}
            </div>
            {autoFillOpen && isUnder && !locked && (
              <div className="crt-budget-dropdown">
                {criteria.map((crit) => {
                  const current = crit.max || 0;
                  const newVal = current + remaining;
                  return (
                    <button
                      key={crit.id || crit.key}
                      className="crt-budget-dropdown-item"
                      onClick={() => handleAutoFill(crit)}
                      type="button"
                    >
                      <span className="crt-budget-dropdown-label">{crit.label || crit.shortLabel}</span>
                      <span className="crt-budget-dropdown-values">
                        {current} → {newVal}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="crt-budget-bar-container">
        <div className={`crt-budget-bar${locked ? " crt-budget-bar--locked" : ""}`}>
          {criteria.map((crit, idx) => {
            const color = resolveColor(crit.color || CRITERION_COLORS[idx % CRITERION_COLORS.length]);
            return (
              <div
                key={crit.id || crit.key || idx}
                className="crt-budget-segment"
                style={{
                  flex: crit.max,
                  backgroundColor: color,
                }}
              />
            );
          })}
          {isUnder && (
            <div
              className="crt-budget-segment crt-budget-segment-remaining"
              style={{ flex: remaining }}
            />
          )}
        </div>
      </div>

      <div className="crt-budget-legend">
        {criteria.map((crit, idx) => {
          const color = resolveColor(crit.color || CRITERION_COLORS[idx % CRITERION_COLORS.length]);
          return (
            <div key={crit.id || crit.key || idx} className="crt-budget-legend-item">
              <div className="crt-budget-legend-dot" style={{ backgroundColor: color }} />
              <span className="crt-budget-legend-label">{crit.shortLabel || crit.label}</span>
              <span className="crt-budget-legend-weight">{crit.max || 0} pts</span>
            </div>
          );
        })}
        {isUnder && (
          <div className="crt-budget-legend-item">
            <div className="crt-budget-legend-dot crt-budget-legend-dot-remaining" />
            <span className="crt-budget-legend-label">Remaining</span>
            <span className="crt-budget-legend-weight">{remaining} pts</span>
          </div>
        )}
      </div>
    </div>
  );
}
