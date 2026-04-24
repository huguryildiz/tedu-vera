import { Search, XCircle, Filter, Trophy, Info } from "lucide-react";
import Pagination from "@/shared/ui/Pagination";
import PremiumTooltip from "@/shared/ui/PremiumTooltip";
import { TeamMemberNames } from "@/shared/ui/EntityMeta";
import JurorBadge from "@/admin/shared/JurorBadge";
import AvgDonut from "@/admin/shared/AvgDonut";
import SortIcon from "./SortIcon";
import { HeatCell, ConsensusBadge, MedalCell } from "./RankingCells";

export default function RankingsTable({
  pagedRows,
  filteredRows,
  totalProjects,
  criteriaConfig,
  ranksMap,
  consensusMap,
  sortField,
  sortDir,
  loading,
  isPortraitMobile,
  columns,
  rowsScopeRef,
  onSort,
  searchText,
  activeFilterCount,
  onClearSearch,
  onClearFilters,
  pageSize,
  safePage,
  totalPages,
  onPageChange,
  onPageSizeChange,
}) {
  const consensusTooltipContent = (
    <span className="kpi-tip-wrap">
      <span className="kpi-tip-title">Juror Consensus</span>
      <span className="kpi-tip-body">Measures how much jurors agree on a project&apos;s score. Based on the standard deviation (σ) of total scores across all jurors.</span>
      <span className="kpi-tip-divider" />
      <span className="kpi-tip-row"><span className="consensus-badge consensus-high">High</span> σ &lt; 3.0 — Jurors closely agree</span>
      <span className="kpi-tip-row"><span className="consensus-badge consensus-moderate">Moderate</span> σ 3.0–5.0 — Some variation</span>
      <span className="kpi-tip-row"><span className="consensus-badge consensus-disputed">Disputed</span> σ &gt; 5.0 — Significant disagreement</span>
    </span>
  );

  return (
    <div id="sub-rankings">
      <div className="table-wrap table-wrap--split">
        <table className="ranking-table table-standard table-pill-balance">
          <colgroup>
            <col style={{ width: "1px" }} />
            <col style={{ width: "24%" }} />
            <col style={{ width: "14%" }} />
            {criteriaConfig.map((c) => (
              <col key={c.id} style={{ width: "8%" }} />
            ))}
            <col style={{ width: "8%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "5%" }} />
          </colgroup>
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={[
                    col.sortKey ? `sortable${sortField === col.sortKey ? ' sorted' : ''}` : '',
                    col.thClass || '',
                  ].filter(Boolean).join(' ') || undefined}
                  style={col.style}
                  onClick={col.sortKey ? () => onSort(col.sortKey) : undefined}
                >
                  {col.key === 'consensus' ? (
                    <div className="col-info">
                      {col.label}
                      <PremiumTooltip position="bottom" text={consensusTooltipContent}>
                        <Info size={11} strokeWidth={2.5} className="kpi-label-info-icon" style={{ cursor: "default", flexShrink: 0 }} />
                      </PremiumTooltip>
                      <SortIcon field={col.sortKey} sortField={sortField} sortDir={sortDir} />
                    </div>
                  ) : (
                    <>
                      {col.label}
                      {col.sortKey && <SortIcon field={col.sortKey} sortField={sortField} sortDir={sortDir} />}
                    </>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody ref={rowsScopeRef}>
            {loading && (
              <tr>
                <td
                  colSpan={3 + criteriaConfig.length + 3}
                  style={{ textAlign: "center", padding: 32, color: "var(--text-tertiary)" }}
                >
                  Loading…
                </td>
              </tr>
            )}
            {!loading && pagedRows.map((proj) => {
              const rank = ranksMap[proj.id];
              const consensus = consensusMap[proj.id];
              const title = proj.title || proj.name || "";
              const members = proj.members || proj.students || "";

              return (
                <tr
                  key={proj.id}
                  data-card-selectable=""
                  className={[
                    "mcard",
                    rank <= 3 ? "ranking-highlight" : "",
                    rank <= 3 ? `ranking-top-${rank}` : "",
                  ].filter(Boolean).join(" ")}
                >
                  <td className="col-rank" data-label="Rank">
                    <MedalCell rank={rank} />
                  </td>
                  <td className="col-project" data-label="Project Title">
                    <div className="proj-title-row">
                      {proj.group_no != null && (
                        <span className="ranking-proj-no">P{proj.group_no}</span>
                      )}
                      <span className="proj-title-text">{title}</span>
                    </div>
                    {proj.advisor && (() => {
                      const advisors = proj.advisor.split(",").map((s) => s.trim()).filter(Boolean);
                      if (!advisors.length) return null;
                      return (
                        <div className="meta-chips-row overview-top-advisors">
                          <span className="meta-chips-eyebrow">Advised by</span>
                          {advisors.map((name, idx) => (
                            <JurorBadge key={`${name}-${idx}`} name={name} size="sm" nameOnly variant="advisor" />
                          ))}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="col-students" data-label="Team Members">
                    <span className="meta-chips-eyebrow">TEAM MEMBERS</span>
                    <div className="meta-chips-row">
                      <TeamMemberNames names={members} />
                    </div>
                    {proj.advisor && (() => {
                      const advisors = proj.advisor.split(",").map((s) => s.trim()).filter(Boolean);
                      if (!advisors.length) return null;
                      return (
                        <div className="rk-advisor-section">
                          <span className="meta-chips-eyebrow">ADVISED BY</span>
                          <div className="meta-chips-row">
                            {advisors.map((name, idx) => (
                              <JurorBadge key={`${name}-${idx}`} name={name} size="sm" nameOnly variant="advisor" />
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                  {criteriaConfig.map((c) => (
                    <HeatCell
                      key={c.id}
                      value={proj.avg?.[c.id]}
                      max={c.max}
                      color={c.color}
                      label={c.shortLabel || c.label}
                    />
                  ))}
                  <td className="col-avg" data-label="Average">
                    <span className="rk-avg-num vera-score-num">
                      {proj.totalAvg.toFixed(1)}
                    </span>
                    <AvgDonut value={proj.totalAvg} max={100} />
                  </td>
                  <td className="text-center consensus-cell" data-label="Consensus">
                    <ConsensusBadge consensus={consensus} />
                  </td>
                  <td className="col-jurors" data-label="Jurors">{proj.count ?? "—"}</td>

                  {isPortraitMobile && (<>
                  <td className="rk-mobile-only rk-criteria-cell" aria-hidden="true">
                    <span className="rk-crit-label">Criteria Scores</span>
                    <div className="rk-criteria">
                      {criteriaConfig.map((c) => {
                        const val = proj.avg?.[c.id];
                        return (
                          <div key={c.id} className="rk-criterion">
                            <div className="rk-crit-name">{c.shortLabel || c.label}</div>
                            <div className="rk-crit-bar">
                              {val != null && (
                                <div
                                  className="rk-crit-fill"
                                  style={{
                                    width: c.max > 0 ? `${Math.min(100, (val / c.max) * 100)}%` : "0%",
                                    backgroundColor: c.color || "var(--accent)",
                                  }}
                                />
                              )}
                            </div>
                            <div className="rk-crit-val">
                              {val != null ? (
                                <>
                                  <span className="rk-crit-val-num" style={{ color: c.color || "var(--accent)" }}>
                                    {val.toFixed(0)}
                                  </span>
                                  <span className="rk-crit-val-max">/{c.max}</span>
                                </>
                              ) : (
                                <span className="rk-crit-val-empty">—</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </td>

                  <td className="rk-mobile-only rk-footer-cell" aria-hidden="true">
                    <div className="rk-footer-cols">
                      <div className="rk-footer-left">
                        <span className="rk-foot-label">
                          Consensus
                          <PremiumTooltip position="top" text={consensusTooltipContent}>
                            <Info size={11} strokeWidth={2.5} className="kpi-label-info-icon" style={{ cursor: "default", flexShrink: 0, marginLeft: 4 }} />
                          </PremiumTooltip>
                        </span>
                        <div className="rk-footer">
                          {consensus ? (
                            <span className={`rk-consensus rk-cons-${consensus.level}`}>
                              {consensus.level === "high"
                                ? "High"
                                : consensus.level === "moderate"
                                ? "Moderate"
                                : "Disputed"}
                            </span>
                          ) : (
                            <span className="rk-consensus rk-cons-none">—</span>
                          )}
                          {consensus && (
                            <span className="rk-meta">σ {consensus.sigma} · {consensus.min}–{consensus.max}</span>
                          )}
                        </div>
                      </div>
                      <div className="rk-jurors-block">
                        <span className="rk-jurors-label">Jurors Evaluated</span>
                        <span className="rk-jurors">{proj.count ?? "—"} jurors</span>
                      </div>
                    </div>
                  </td>
                  </>)}
                </tr>
              );
            })}
            {!loading && filteredRows.length === 0 && (
              <tr className="es-row">
                <td colSpan={3 + criteriaConfig.length + 3} style={{ padding: 0 }}>
                  {totalProjects === 0 ? (
                    <div className="vera-es-no-data">
                      <div className="vera-es-ghost-rows" aria-hidden="true">
                        <div className="vera-es-ghost-row">
                          <div className="vera-es-ghost-num"/><div className="vera-es-ghost-bar" style={{width:"18%"}}/><div className="vera-es-ghost-spacer"/><div className="vera-es-ghost-bar" style={{width:"8%"}}/><div className="vera-es-ghost-bar" style={{width:"8%"}}/>
                        </div>
                        <div className="vera-es-ghost-row">
                          <div className="vera-es-ghost-num"/><div className="vera-es-ghost-bar" style={{width:"24%"}}/><div className="vera-es-ghost-spacer"/><div className="vera-es-ghost-bar" style={{width:"8%"}}/><div className="vera-es-ghost-bar" style={{width:"8%"}}/>
                        </div>
                        <div className="vera-es-ghost-row">
                          <div className="vera-es-ghost-num"/><div className="vera-es-ghost-bar" style={{width:"14%"}}/><div className="vera-es-ghost-spacer"/><div className="vera-es-ghost-bar" style={{width:"8%"}}/><div className="vera-es-ghost-bar" style={{width:"8%"}}/>
                        </div>
                      </div>
                      <div className="vera-es-icon">
                        <Trophy size={22} strokeWidth={1.8}/>
                      </div>
                      <p className="vera-es-no-data-title">No Scores Yet</p>
                      <p className="vera-es-no-data-desc">Scores will appear here once jurors begin evaluating projects for this period.</p>
                    </div>
                  ) : (
                    <div className="vera-es-no-data">
                      <div className="vera-es-icon">
                        <Search size={22} strokeWidth={1.8}/>
                      </div>
                      <p className="vera-es-no-data-title">No Matching Projects</p>
                      <p className="vera-es-no-data-desc">No projects match the active filters. Try adjusting the search, score range, or consensus filter.</p>
                      <div className="vera-es-no-data-actions">
                        {searchText && (
                          <button className="btn btn-sm btn-ghost" onClick={onClearSearch}>
                            <XCircle size={13} strokeWidth={2}/> Clear Search
                          </button>
                        )}
                        {activeFilterCount > 0 && (
                          <button className="btn btn-sm btn-ghost" onClick={onClearFilters}>
                            <Filter size={13} strokeWidth={2}/> Clear Filters
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        currentPage={safePage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={filteredRows.length}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        itemLabel="projects"
      />
    </div>
  );
}
