import { useEffect, useRef, useState } from "react";
import { getDemoClient } from "@/shared/lib/supabaseClient";

const FALLBACK_QUOTES = [
  {
    rating: 5,
    comment:
      "We evaluated 41 capstone projects with 19 jurors in under two hours. Scores were live, rankings were instant, and the attainment report was on the dean's desk before we left the building.",
    juror_name: "Prof. Dr. Ahmet Yılmaz",
    affiliation: "EE Department · Capstone Coordinator · TED University",
  },
  {
    rating: 5,
    comment:
      "Yüzlerce takımı hızlıca değerlendirdik. Sistem çok stabil — jüri günü tek bir crash yaşamadık.",
    juror_name: "Prof. Kemal Özdemir",
    affiliation: "İTÜ · Havacılık ve Uzay",
  },
];

const demoClient = getDemoClient();

function useFeedback() {
  const [quotes, setQuotes] = useState(FALLBACK_QUOTES);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    demoClient
      .rpc("rpc_get_public_feedback")
      .then(({ data }) => {
        const live = data?.testimonials;
        if (Array.isArray(live) && live.length > 0) {
          // Editorial restraint: at most three pull quotes.
          setQuotes(live.slice(0, 3));
        }
      })
      .catch(() => {});
  }, []);

  return quotes;
}

const Stars = ({ n = 5 }) => (
  <span className="ed-fn-stars" aria-label={`${n} out of 5 stars`}>
    {"★".repeat(Math.max(0, Math.min(5, n)))}
  </span>
);

export default function FieldNotes() {
  const quotes = useFeedback();
  return (
    <section className="ed-fieldnotes" id="field-notes">
      <div className="ed-wrap">
        <header className="ed-fn-head">
          <span className="num">06</span>
          <h2>
            What chairs say <em>after the jury day.</em>
          </h2>
          <p className="sub">
            Production at universities, competitions, and accreditation review boards. The pattern
            is consistent: scoring takes minutes, reports take seconds, the binder takes care of itself.
          </p>
          <span className="meta">{quotes.length} · ENTRIES</span>
        </header>

        <div className="ed-fn-list">
          {quotes.map((q, i) => (
            <figure key={`${q.juror_name}-${i}`} className="ed-fn-quote">
              <blockquote>
                <span className="mark" aria-hidden="true">&ldquo;</span>
                {q.comment}
              </blockquote>
              <figcaption>
                <span className="who">{q.juror_name}</span>
                <span className="role">{q.affiliation}</span>
                <Stars n={q.rating || 5} />
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
