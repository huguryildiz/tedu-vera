import { useTheme } from "@/shared/theme/ThemeProvider";
import periodsDark from "@/assets/landing/showcase/periods-dark.png";
import periodsLight from "@/assets/landing/showcase/periods-light.png";

const STAGES = [
  { label: "Draft", note: "Configurable" },
  { label: "Published", note: "Visible to jurors" },
  { label: "Live", note: "Scoring active" },
  { label: "Closed", note: "Snapshot frozen" },
];

const BULLETS = [
  "Four-stage lifecycle",
  "Snapshot-frozen on close",
  "Per-period criteria & outcomes",
];

export default function Lifecycle() {
  const { theme } = useTheme();
  return (
    <section className="ed-lifecycle" id="lifecycle">
      <div className="ed-wrap">
        <header className="ed-life-head">
          <span className="num">03</span>
          <h2>
            Period lifecycle <em>control</em>.
          </h2>
          <p className="sub">
            Each transition is an explicit admin action; closed periods are immutable, locked
            snapshots for accreditation review.
          </p>
        </header>

        <ol className="ed-life-stages" aria-label="Period lifecycle stages">
          {STAGES.map((s, i) => (
            <li key={s.label} className={`ed-life-stage${i === STAGES.length - 1 ? " is-terminal" : ""}`}>
              <span className="ed-life-step-n">{String(i + 1).padStart(2, "0")}</span>
              <span className="ed-life-stage-label">{s.label}</span>
              <span className="ed-life-stage-note">{s.note}</span>
              {i < STAGES.length - 1 && <span className="ed-life-arrow" aria-hidden="true">→</span>}
            </li>
          ))}
        </ol>

        <figure className="ed-life-figure">
          <div className="ed-life-shot">
            <span className="corner-tl" />
            <span className="corner-tr" />
            <span className="corner-bl" />
            <span className="corner-br" />
            <img
              src={theme === "dark" ? periodsDark : periodsLight}
              alt="Period lifecycle administration view — Draft, Published, Live, Closed states"
              loading="lazy"
              decoding="async"
            />
            <div className="ed-life-shot-overlay">
              <span className="dot" />
              <span>Live · vera-demo</span>
            </div>
          </div>
        </figure>

        <ul className="ed-life-bullets">
          {BULLETS.map((b) => (
            <li key={b}>
              <span className="diamond" aria-hidden="true">◆</span>
              {b}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
