const ROWS = [
  {
    n: "C.01",
    name: "Works on any device",
    desc: "Mobile, tablet, desktop. Zero installation, zero training — jurors scan a QR code and start.",
  },
  {
    n: "C.02",
    name: "PIN-secured sessions",
    desc: "Single-use, per-juror PIN. No accounts, no passwords, no shared credentials.",
  },
  {
    n: "C.03",
    name: "Real-time analytics",
    desc: "Live dashboards update the moment a juror submits. No polling, no admin intervention.",
  },
  {
    n: "C.04",
    name: "XLSX & PDF export",
    desc: "One-click reports formatted for committees, deans, and accreditors. Numerics, Turkish characters, audit-ready.",
  },
  {
    n: "C.05",
    name: "MÜDEK & ABET ready",
    desc: "Built-in programme outcome mapping. Attainment rollups compile the moment scoring ends.",
  },
  {
    n: "C.06",
    name: "Every evaluation context",
    desc: "University capstones, hackathons, TEKNOFEST & CanSat, design exhibitions, accreditation reviews.",
  },
];

export default function Capabilities() {
  return (
    <section className="ed-capabilities" id="capabilities">
      <div className="ed-wrap">
        <header className="ed-cap-head">
          <span className="num">04</span>
          <h2>
            One platform — built for <em>every</em> evaluation.
          </h2>
          <p className="sub">
            Six capabilities, one coherent system. The same scoring runtime that powers a 41-team
            capstone day powers a national hackathon, an accreditation review board, and a design
            exhibition.
          </p>
          <span className="meta">{ROWS.length} / {ROWS.length}</span>
        </header>

        <ol className="ed-cap-list">
          {ROWS.map((r) => (
            <li key={r.n} className="ed-cap-row">
              <span className="kicker">{r.n}</span>
              <span className="name">{r.name}</span>
              <span className="desc">{r.desc}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
