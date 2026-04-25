import { useState, useId } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import JurorBadge from "./JurorBadge.jsx";
import AvgDonut from "@/admin/shared/AvgDonut.jsx";
import { useTheme } from "@/shared/theme/ThemeProvider";
import { scoreCellClass, scoreCellStyle } from "@/admin/utils/scoreHelpers";

function SparkDot({ row, isDark }) {
  if (row.empty) {
    return <span className="hm-sparkdot hm-sparkdot-empty" aria-hidden="true" />;
  }
  if (row.partial) {
    return (
      <span
        className="hm-sparkdot"
        aria-hidden="true"
        style={{ background: "var(--score-partial-bg)", boxShadow: "inset 0 0 0 1.5px var(--score-partial-text)" }}
      />
    );
  }
  const colorClass = scoreCellClass(row.score, row.max);
  const cs = isDark ? scoreCellStyle(row.score, row.max, true) : undefined;
  return (
    <span
      className={`hm-sparkdot${colorClass ? ` ${colorClass}` : ""}`}
      aria-hidden="true"
      style={cs ? { background: cs.background, boxShadow: cs.boxShadow } : undefined}
    />
  );
}

function RowItem({ row, tabLabel }) {
  if (row.empty) {
    return (
      <li className="hm-row" aria-label={`${row.title}: not scored`}>
        <span className="hm-row-code">{row.label}</span>
        <span className="hm-row-title">{row.title}</span>
        <span className="hm-score-value hm-score-empty">{"—"}</span>
      </li>
    );
  }
  const color = row.partial ? "var(--score-partial-text)" : "var(--accent)";
  const aria = row.partial
    ? `${row.title}: partial ${row.score}`
    : `${row.title}: ${row.score}`;
  return (
    <li className="hm-row" aria-label={aria}>
      <span className="hm-row-code">{row.label}</span>
      <span className="hm-row-title">{row.title}</span>
      <span className={`hm-score-value proj-score-value${row.partial ? " partial" : ""}`} style={row.partial ? { color } : undefined}>
        {row.score}
        {row.partial && <span className="m-flag" aria-hidden="true">!</span>}
        <span className="m-cell-tip">
          {row.partial ? "Partial" : tabLabel} · {row.score} / {row.max}
        </span>
      </span>
    </li>
  );
}

export default function JurorHeatmapCard({
  juror,
  avg,
  tabMax,
  tabLabel = "Total",
  rows,
}) {
  const [expanded, setExpanded] = useState(false);
  const rowsId = useId();
  const projectCount = rows.length;
  const label = expanded ? "Collapse juror card" : "Expand juror card";
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <article
      data-card-selectable=""
      className={`hm-card${expanded ? " is-expanded" : ""}`}
    >
      <button
        type="button"
        className="hm-card-toggle"
        aria-expanded={expanded}
        aria-controls={rowsId}
        aria-label={label}
        onClick={() => setExpanded(v => !v)}
      >
        <div className="hm-card-head">
          <div className="hm-card-head-left">
            <JurorBadge
              name={juror.name || juror.juror_name}
              affiliation={juror.dept || juror.affiliation}
              size="sm"
            />
          </div>
          <AvgDonut value={avg} max={tabMax} />
        </div>
        <div className="hm-card-summary">
          <span className="hm-card-summary-text">
            {projectCount} {projectCount === 0 ? "projects scored" : "projects"} ·
          </span>
          <span className="hm-card-spark">
            {rows.map((row, i) => (
              <SparkDot key={row.groupId ?? i} row={row} isDark={isDark} />
            ))}
          </span>
          <span className="hm-card-chev">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </div>
      </button>
      {expanded && (
        <>
          <ul className="hm-card-rows" id={rowsId}>
            {rows.map((row, i) => (
              <RowItem key={row.groupId ?? i} row={row} tabLabel={tabLabel} />
            ))}
          </ul>
          <button
            type="button"
            className="hm-card-close"
            onClick={() => setExpanded(false)}
            aria-label="Collapse juror card"
          >
            <ChevronUp size={14} />
            <span>Close</span>
          </button>
        </>
      )}
    </article>
  );
}
