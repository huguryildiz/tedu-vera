const COLUMNS = [
  { key: "paper", label: "Paper + Excel" },
  { key: "forms", label: "Google Forms" },
  { key: "judgify", label: "Judgify" },
  { key: "vera", label: "VERA", highlight: true },
];

const ROWS = [
  { feature: "Real-time mobile scoring",     paper: "—", forms: "~", judgify: "✓", vera: "✓" },
  { feature: "Auto-save on every input",      paper: "—", forms: "—", judgify: "~", vera: "✓" },
  { feature: "Configurable rubric criteria",  paper: "~", forms: "~", judgify: "✓", vera: "✓" },
  { feature: "Programme outcome mapping",     paper: "—", forms: "—", judgify: "—", vera: "✓" },
  { feature: "Accreditation-ready reports",   paper: "—", forms: "—", judgify: "—", vera: "✓" },
  { feature: "Full audit trail",              paper: "—", forms: "—", judgify: "~", vera: "✓" },
  { feature: "Multi-organization isolation",  paper: "—", forms: "—", judgify: "✓", vera: "✓" },
  { feature: "No setup / training needed",    paper: "✓", forms: "✓", judgify: "~", vera: "✓" },
];

const CELL_CLASS = (v) => {
  if (v === "✓") return "ed-cmp-yes";
  if (v === "~") return "ed-cmp-partial";
  return "ed-cmp-no";
};

export default function Comparison() {
  return (
    <section className="ed-comparison" id="comparison">
      <div className="ed-wrap">
        <header className="ed-cmp-head">
          <span className="num">05</span>
          <h2>
            How VERA <em>compares</em>.
          </h2>
          <p className="sub">
            Every column is a tool teams reach for when a paper-based scoring day stops scaling.
            Only one of them was built ground-up for live, audited, programme-outcome evaluation.
          </p>
        </header>

        <div className="ed-cmp-frame">
          <table className="ed-cmp-table">
            <thead>
              <tr>
                <th scope="col">Capability</th>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className={c.highlight ? "is-highlight" : ""}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.feature}>
                  <th scope="row">{r.feature}</th>
                  {COLUMNS.map((c) => (
                    <td
                      key={c.key}
                      className={`${CELL_CLASS(r[c.key])}${c.highlight ? " is-highlight" : ""}`}
                    >
                      {r[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
