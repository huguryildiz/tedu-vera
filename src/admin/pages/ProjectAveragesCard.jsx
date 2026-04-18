export default function ProjectAveragesCard({
  groups = [],
  averages = [],
  overall,
  tabMax = 100,
}) {
  return (
    <article className="hm-card hm-card-footer">
      <header className="hm-card-footer-head">Project Averages</header>
      <ul className="hm-card-rows">
        {groups.map((g, i) => {
          const avg = averages[i];
          const label = g.group_no != null ? `P${g.group_no}` : "";
          const title = g.title || g.id;
          return (
            <li className="hm-row" key={g.id}>
              <span className="hm-row-code">{label}</span>
              <span className="hm-row-title">{title}</span>
              <span className="hm-avg-value">
                {avg == null ? "\u2014" : avg.toFixed(1)}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="hm-card-footer-overall">
        <span>Overall</span>
        <span className="hm-overall-value hm-avg-value" style={{ fontSize: "14px" }}>
          {overall == null ? "\u2014" : overall.toFixed(1)}
          <span className="hm-overall-max"> / {tabMax}</span>
        </span>
      </div>
    </article>
  );
}
