import { useTheme } from "@/shared/theme/ThemeProvider";

import tapDark from "@/assets/landing/showcase/jury-evaluate-mobile-dark.png";
import tapLight from "@/assets/landing/showcase/jury-evaluate-mobile-light.png";
import auditDark from "@/assets/landing/showcase/auditlog-dark.png";
import auditLight from "@/assets/landing/showcase/auditlog-light.png";
import rankDark from "@/assets/landing/showcase/rankings-dark.png";
import rankLight from "@/assets/landing/showcase/rankings-light.png";
import attainDark from "@/assets/landing/showcase/analytics-dark.png";
import attainLight from "@/assets/landing/showcase/analytics-light.png";
import reportDark from "@/assets/landing/showcase/overview-dark.png";
import reportLight from "@/assets/landing/showcase/overview-light.png";

const STATIONS = [
  {
    n: "01",
    stage: "Tap",
    label: "A juror taps",
    em: "“8”",
    caption: "Score input · on the phone",
    img: { dark: tapDark, light: tapLight },
    variant: "phone",
    alt: "Jury scoring screen — mobile portrait capture",
  },
  {
    n: "02",
    stage: "Persist",
    label: "Saved &",
    em: "chained",
    caption: "audit log · upsert · < 80 ms",
    img: { dark: auditDark, light: auditLight },
    alt: "Audit log entry capture",
  },
  {
    n: "03",
    stage: "Rank",
    label: "Rankings",
    em: "recompute",
    caption: "live · per project · per period",
    img: { dark: rankDark, light: rankLight },
    alt: "Live rankings page capture",
  },
  {
    n: "04",
    stage: "Attain",
    label: "Outcomes",
    em: "recalculate",
    caption: "criterion → outcome map · weighted",
    img: { dark: attainDark, light: attainLight },
    alt: "Outcome attainment chart capture",
  },
  {
    n: "05",
    stage: "Report",
    label: "Report",
    em: "ready",
    caption: "audit-chained · export-ready",
    img: { dark: reportDark, light: reportLight },
    alt: "Admin overview / export-ready capture",
  },
];

export default function FiveSteps() {
  const { theme } = useTheme();
  return (
    <section className="ed-five" id="five-steps">
      <div className="ed-wrap">
        <header className="ed-five-head">
          <span className="num">02</span>
          <h2>
            Five steps. <em>Five seconds.</em>
          </h2>
          <p className="sub">
            From the moment a juror taps a score on a phone to the moment a programme-outcome
            attainment report is signed off, every step is live, audited, and accreditation-ready.
          </p>
        </header>

        <ol className="ed-five-stage">
          {STATIONS.map((s) => (
            <li key={s.n} className="ed-five-station">
              <div className="stamp">
                <span className="step-n">{s.n}</span>
                <span>{s.stage}</span>
              </div>
              <div className={`shot${s.variant === "phone" ? " shot--phone" : ""}`}>
                <span className="corner-tl" />
                <span className="corner-tr" />
                <span className="corner-bl" />
                <span className="corner-br" />
                <img
                  src={theme === "dark" ? s.img.dark : s.img.light}
                  alt={s.alt}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="label">
                {s.label} <em className="editorial-italic">{s.em}</em>
              </div>
              <div className="caption">{s.caption}</div>
            </li>
          ))}
        </ol>

        <div className="ed-five-foot">
          <span>Architecture &middot; React + Supabase + Postgres triggers</span>
          <span>Latency &middot; &lt; 200 ms end-to-end</span>
        </div>
      </div>
    </section>
  );
}
