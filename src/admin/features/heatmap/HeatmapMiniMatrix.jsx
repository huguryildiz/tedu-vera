// src/admin/features/heatmap/HeatmapMiniMatrix.jsx
import { useTheme } from "@/shared/theme/ThemeProvider";
import { scoreCellClass, scoreCellStyle } from "@/admin/utils/scoreHelpers";
import { jurorInitials, jurorAvatarBg, jurorAvatarFg } from "@/admin/utils/jurorIdentity";
import "./HeatmapMiniMatrix.css";

function ScoreCell({ cell, tabMax }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  if (!cell) {
    return <span className="hm-mm-cell-empty">—</span>;
  }

  const colorClass = scoreCellClass(cell.score, tabMax);
  const inlineStyle = scoreCellStyle(cell.score, tabMax, isDark) || {};
  const partialClass = cell.partial ? " hm-mm-cell-partial" : "";

  return (
    <span
      className={`hm-mm-cell ${colorClass}${partialClass}`}
      style={inlineStyle}
    >
      {Math.round(cell.score)}
    </span>
  );
}

function AvgCell({ avg, tabMax }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  if (avg == null) {
    return <span className="hm-mm-cell-empty">—</span>;
  }

  const colorClass = scoreCellClass(avg, tabMax);
  const inlineStyle = scoreCellStyle(avg, tabMax, isDark) || {};

  return (
    <span className={`hm-mm-cell ${colorClass}`} style={inlineStyle}>
      {avg.toFixed(1)}
    </span>
  );
}

export default function HeatmapMiniMatrix({
  sortedJurors,
  groups,
  lookup,
  activeTab,
  activeCriteria,
  tabMax,
  jurorRowAvgMap,
  visibleAverages,
  overallAvg,
  getCellDisplay,
}) {
  return (
    <div className="hm-mini-matrix-wrap">
      <table className="hm-mini-matrix">
        <thead>
          <tr>
            <th className="hm-mm-juror-col" />
            {groups.map((g) => (
              <th
                key={g.id}
                className="hm-mm-th-proj"
                title={g.title}
              >
                P{g.group_no}
              </th>
            ))}
            <th className="hm-mm-avg-col">Avg</th>
          </tr>
        </thead>
        <tbody>
          {sortedJurors.map((juror) => {
            const rowLookup = lookup[juror.key] || {};
            const rowAvg = jurorRowAvgMap.get(juror.key);
            return (
              <tr key={juror.key}>
                <td className="hm-mm-juror-col">
                  <span
                    className="hm-mm-juror-avatar"
                    style={{
                      background: jurorAvatarBg(juror.name),
                      color: jurorAvatarFg(juror.name),
                    }}
                  >
                    {jurorInitials(juror.name)}
                  </span>
                  <span className="hm-mm-juror-info">
                    <span className="hm-mm-juror-name">{juror.name}</span>
                    {juror.dept && (
                      <span className="hm-mm-juror-affil">{juror.dept}</span>
                    )}
                  </span>
                </td>
                {groups.map((g) => {
                  const entry = rowLookup[g.id] || null;
                  const cell = getCellDisplay(entry, activeTab, activeCriteria);
                  return (
                    <td key={g.id} className="hm-mm-proj-cell">
                      <ScoreCell cell={cell} tabMax={tabMax} />
                    </td>
                  );
                })}
                <td className="hm-mm-avg-col">
                  <AvgCell avg={rowAvg} tabMax={tabMax} />
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td className="hm-mm-juror-col">Avg</td>
            {groups.map((g, i) => (
              <td key={g.id} className="hm-mm-proj-cell">
                <AvgCell avg={visibleAverages[i]} tabMax={tabMax} />
              </td>
            ))}
            <td className="hm-mm-avg-col">
              <AvgCell avg={overallAvg} tabMax={tabMax} />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
