import { useState } from "react";

const QUESTIONS = [
  {
    n: "Q.01",
    q: "Is VERA free to use?",
    a: "VERA is free for academic departments and research groups. For large-scale commercial use or custom deployments, contact us for pricing.",
  },
  {
    n: "Q.02",
    q: "Can I define my own evaluation criteria?",
    a: "Yes. Each evaluation period has fully configurable criteria — labels, weights, max scores, rubric descriptions, and programme outcome mappings. You can use the built-in defaults or create domain-specific criteria from scratch.",
  },
  {
    n: "Q.03",
    q: "Which accreditation standards does VERA support?",
    a: "MÜDEK and ABET programme-outcome mapping out of the box. You can also define custom outcome frameworks for any accreditation body or internal quality standard.",
  },
  {
    n: "Q.04",
    q: "Do jurors need to install an app?",
    a: "No. VERA runs entirely in the browser. Jurors scan a QR code or click a link, enter their name, and start scoring. No downloads, no accounts, no training.",
  },
  {
    n: "Q.05",
    q: "What happens if a juror loses connection?",
    a: "Scores auto-save after every input. If disconnected, the juror can return using their session PIN and resume exactly where they left off. No data is lost.",
  },
  {
    n: "Q.06",
    q: "Where is evaluation data stored?",
    a: "All data is stored in a secure Supabase (PostgreSQL) database with row-level security, role-based access controls, and a full audit trail. Each organization's data is completely isolated.",
  },
];

export default function CommonQuestions() {
  const [openIdx, setOpenIdx] = useState(null);
  const toggle = (i) => setOpenIdx((cur) => (cur === i ? null : i));

  return (
    <section className="ed-questions" id="questions">
      <div className="ed-wrap">
        <header className="ed-q-head">
          <span className="num">07</span>
          <h2>
            Common <em>questions</em>.
          </h2>
          <span className="meta">{QUESTIONS.length}</span>
        </header>

        <ul className="ed-q-list">
          {QUESTIONS.map((item, i) => {
            const isOpen = openIdx === i;
            return (
              <li key={item.n} className={`ed-q-item${isOpen ? " is-open" : ""}`}>
                <button
                  type="button"
                  className="ed-q-trigger"
                  aria-expanded={isOpen}
                  aria-controls={`ed-q-${i}-body`}
                  onClick={() => toggle(i)}
                >
                  <span className="kicker">{item.n}</span>
                  <span className="q">{item.q}</span>
                  <span className="toggle" aria-hidden="true">{isOpen ? "−" : "+"}</span>
                </button>
                <div id={`ed-q-${i}-body`} className="ed-q-body" hidden={!isOpen}>
                  <p className="editorial-body">{item.a}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
