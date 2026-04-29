import Pagination from "@/shared/ui/Pagination";
import { ClipboardList, MoreVertical, Pencil, Copy, Trash2, FolderOpen, Upload, Plus, Info, Search, XCircle, UserRound, GraduationCap, Users, Clock } from "lucide-react";
import { TeamMemberNames } from "@/shared/ui/EntityMeta";
import JurorBadge from "@/admin/shared/JurorBadge";
import PremiumTooltip from "@/shared/ui/PremiumTooltip";
import FloatingMenu from "@/shared/ui/FloatingMenu";
import { formatDateTime as formatFull } from "@/shared/lib/dateUtils";
import { COLUMNS, membersToArray, formatRelative, scoreBandToken } from "./projectHelpers";
import MemberChips from "./MemberChips";
import SortIcon from "./SortIcon";
import { jurorAvatarBg, jurorAvatarFg, jurorInitials } from "@/admin/utils/jurorIdentity";

export default function ProjectsTable({
  pagedList,
  filteredList,
  projectList,
  loadingCount,
  sortKey,
  sortDir,
  projectAvgMap,
  projectEvalCountMap,
  periodMaxScore,
  openMenuId,
  setOpenMenuId,
  rowsScopeRef,
  isLocked,
  viewPeriodId,
  hasPeriods,
  onSort,
  onEdit,
  onDuplicate,
  onViewScores,
  onDelete,
  onAddProject,
  onImport,
  onNavigate,
  search,
  filterActiveCount,
  onClearSearch,
  onClearFilters,
  pageSize,
  safePage,
  totalPages,
  onPageChange,
  onPageSizeChange,
}) {
  const lockedTooltip = isLocked ? "Evaluation period is locked. Unlock the period to make changes." : null;
  return (
    <>
      <div className="table-wrap table-wrap--split">
        <table id="projects-main-table" className="table-standard table-pill-balance">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className={`${c.key === "group_no" || c.key === "avg_score" ? "text-center " : ""}sortable${sortKey === c.key ? " sorted" : ""}${c.colClass ? ` ${c.colClass}` : ""}`}
                  style={c.colWidth ? { width: c.colWidth } : {}}
                  onClick={() => onSort(c.key)}
                >
                  {c.key === "avg_score" && periodMaxScore != null
                    ? `Avg Score (${periodMaxScore})`
                    : c.label} <SortIcon colKey={c.key} sortKey={sortKey} sortDir={sortDir} />
                </th>
              ))}
              <th style={{ width: "8%", textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody ref={rowsScopeRef}>
            {loadingCount > 0 && filteredList.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "32px" }}>
                  Loading projects…
                </td>
              </tr>
            ) : filteredList.length === 0 ? (
              <tr className="es-row">
                <td colSpan={7} style={{ padding: 0 }}>
                  {!viewPeriodId && !hasPeriods ? (
                    <div style={{ display: "flex", justifyContent: "center", padding: "40px 24px" }}>
                      <div className="vera-es-card">
                        <div className="vera-es-hero vera-es-hero--fw">
                          <div className="vera-es-icon">
                            <FolderOpen size={22} strokeWidth={1.65} />
                          </div>
                          <div>
                            <div className="vera-es-title">No evaluation periods yet</div>
                            <div className="vera-es-desc">
                              Projects are organized by evaluation period. Create a period first, then start adding your projects to it.
                            </div>
                          </div>
                        </div>
                        <div className="vera-es-actions">
                          <button
                            className="vera-es-action vera-es-action--primary-fw"
                            onClick={() => onNavigate?.("periods")}
                          >
                            <div className="vera-es-num vera-es-num--fw">1</div>
                            <div className="vera-es-action-text">
                              <div className="vera-es-action-label">Go to Evaluation Periods</div>
                              <div className="vera-es-action-sub">Create a period to unlock project management</div>
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : !viewPeriodId ? (
                    <div data-testid="projects-no-period" style={{ textAlign: "center", padding: "40px 24px", color: "var(--text-tertiary)", fontSize: 13 }}>
                      Select an evaluation period above to manage projects.
                    </div>
                  ) : projectList.length > 0 ? (
                    <div className="vera-es-no-data">
                      <div className="vera-es-icon">
                        <Search size={20} strokeWidth={1.8} />
                      </div>
                      <div className="vera-es-no-data-title">No projects match your filters</div>
                      <div className="vera-es-no-data-desc">
                        {filterActiveCount > 0 && search.trim()
                          ? "Try adjusting your search or clearing active filters to see more projects."
                          : filterActiveCount > 0
                            ? "Try adjusting or clearing the active filters to see more projects."
                            : "No projects match your current search. Try a different keyword."}
                      </div>
                      <div className="vera-es-no-data-actions">
                        {search.trim() && (
                          <button className="btn btn-outline btn-sm" onClick={onClearSearch}>
                            <XCircle size={13} strokeWidth={2} /> Clear search
                          </button>
                        )}
                        {filterActiveCount > 0 && (
                          <button className="btn btn-primary btn-sm" onClick={onClearFilters}>
                            <XCircle size={13} strokeWidth={2.2} /> Clear filters
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="vera-es-no-data">
                      <div className="vera-es-ghost-rows" aria-hidden="true">
                        <div className="vera-es-ghost-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px" }}>
                          <div className="vera-es-ghost-num" />
                          <div className="vera-es-ghost-bar" style={{ width: 140 }} />
                          <div className="vera-es-ghost-spacer" />
                          <div className="vera-es-ghost-bar" style={{ width: 72 }} />
                          <div className="vera-es-ghost-bar" style={{ width: 44 }} />
                        </div>
                        <div className="vera-es-ghost-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px" }}>
                          <div className="vera-es-ghost-num" />
                          <div className="vera-es-ghost-bar" style={{ width: 108 }} />
                          <div className="vera-es-ghost-spacer" />
                          <div className="vera-es-ghost-bar" style={{ width: 72 }} />
                          <div className="vera-es-ghost-bar" style={{ width: 44 }} />
                        </div>
                        <div className="vera-es-ghost-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px" }}>
                          <div className="vera-es-ghost-num" />
                          <div className="vera-es-ghost-bar" style={{ width: 126 }} />
                          <div className="vera-es-ghost-spacer" />
                          <div className="vera-es-ghost-bar" style={{ width: 72 }} />
                          <div className="vera-es-ghost-bar" style={{ width: 44 }} />
                        </div>
                      </div>
                      <div className="vera-es-icon">
                        <FolderOpen size={22} strokeWidth={1.65} />
                      </div>
                      <div className="vera-es-no-data-title">No projects added yet</div>
                      <div className="vera-es-no-data-desc">
                        Add projects individually or import them via CSV. Each project needs a title and group number — team members and advisor can be added later.
                      </div>
                      <div className="vera-es-no-data-actions">
                        <PremiumTooltip text={lockedTooltip} position="top">
                          <button className="btn btn-outline btn-sm" style={{ whiteSpace: "nowrap" }} onClick={onImport} disabled={isLocked}>
                            <Upload size={13} strokeWidth={2} /> Import CSV
                          </button>
                        </PremiumTooltip>
                        <PremiumTooltip text={lockedTooltip} position="top">
                          <button className="btn btn-primary btn-sm" onClick={onAddProject} disabled={isLocked}>
                            <Plus size={13} strokeWidth={2.2} /> Add Project
                          </button>
                        </PremiumTooltip>
                      </div>
                      <div className="vera-es-no-data-hint">
                        <Info size={12} strokeWidth={2} />
                        CSV columns: <strong>group_no</strong>, <strong>title</strong>, <strong>members</strong> (optional), <strong>advisor</strong> (optional)
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            ) : pagedList.map((project) => (
              <tr key={project.id} data-card-selectable="" data-testid="project-row" data-project-id={project.id} data-project-title={project.title} className="mcard">
                <td className="text-center col-no" data-label="No">
                  <span className="mobile-rank-ring" aria-hidden="true">
                    <span
                      className="mobile-rank-ring-fill"
                      style={(() => {
                        const avg = projectAvgMap.get(project.id);
                        const max = periodMaxScore || 100;
                        const pct = avg != null && Number.isFinite(Number(avg))
                          ? Math.min(360, (Number(avg) / max) * 360)
                          : 0;
                        return {
                          "--pct": `${pct}deg`,
                          "--ring": scoreBandToken(avg, max),
                        };
                      })()}
                    >
                      <span className="mobile-rank-ring-inner">
                        <span className="mobile-rank-ring-num">
                          {projectAvgMap.has(project.id)
                            ? Math.round(Number(projectAvgMap.get(project.id)))
                            : "—"}
                        </span>
                        <span className="mobile-rank-ring-lbl">AVG</span>
                      </span>
                    </span>
                  </span>
                  {project.group_no != null
                    ? <span className="project-no-badge">P{project.group_no}</span>
                    : <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>—</span>}
                </td>
                <td data-label="Project Title" className="col-title">
                  <div className="proj-title-text">
                    {project.group_no != null && (
                      <span className="mobile-eyebrow">P{project.group_no}{" "}</span>
                    )}
                    {project.title}
                  </div>
                  {project.advisor && (() => {
                    const advisors = project.advisor.split(",").map((s) => s.trim()).filter(Boolean);
                    if (!advisors.length) return null;
                    return (
                      <>
                        <div className="meta-chips-block proj-advisors">
                          <div className="meta-chips-eyebrow">Advised by</div>
                          <div className="meta-chips-row">
                            {advisors.map((name, i) => (
                              <JurorBadge key={`${name}-${i}`} name={name} size="sm" nameOnly variant="advisor" />
                            ))}
                          </div>
                        </div>
                        <div className="advisor-mobile-line">
                          <UserRound size={12} strokeWidth={2} style={{ color: "var(--text-quaternary)", flexShrink: 0 }} />
                          <span>{advisors.join(", ")}</span>
                        </div>
                      </>
                    );
                  })()}
                </td>
                <td className="col-members" data-label="Team Members">
                  <span className="members-text"><TeamMemberNames names={project.members} /></span>
                  <span className="members-chips-wrap">
                    <span className="members-chips-label">Team</span>
                    <MemberChips members={project.members} />
                  </span>
                  {/* Mobile portrait compact row: advisor chips · member chips · stats */}
                  <div className="proj-compact-row2">
                    {project.advisor && (() => {
                      const advisors = project.advisor.split(",").map((s) => s.trim()).filter(Boolean);
                      if (!advisors.length) return null;
                      return (
                        <>
                          <PremiumTooltip text="Advised By">
                            <span className="proj-row2-icon"><GraduationCap size={11} strokeWidth={2} /></span>
                          </PremiumTooltip>
                          <span className="proj-adv-chips">
                            {advisors.slice(0, 2).map((name, i) => (
                              <PremiumTooltip key={i} text={name}>
                                <span className="proj-adv-chip" style={{ background: jurorAvatarBg(name), color: jurorAvatarFg(name) }}>
                                  {jurorInitials(name)}
                                </span>
                              </PremiumTooltip>
                            ))}
                          </span>
                          <span className="proj-chips-sep" />
                        </>
                      );
                    })()}
                    <PremiumTooltip text="Team Members">
                      <span className="proj-row2-icon"><Users size={11} strokeWidth={2} /></span>
                    </PremiumTooltip>
                    <MemberChips members={project.members} />
                    <span className="proj-chips-spacer" />
                    <span className="proj-chips-sep" />
                    <span className="proj-compact-stats">
                      <ClipboardList size={9} strokeWidth={2} className="proj-stat-icon" />
                      <strong>{projectEvalCountMap.get(project.id) ?? 0}</strong>
                      {" eval"}
                      <span className="proj-chips-sep" />
                      <Clock size={9} strokeWidth={2} className="proj-stat-icon" />
                      <span className="vera-datetime-text">{formatRelative(project.updated_at)}</span>
                    </span>
                  </div>
                </td>
                <td className="text-center avg-score-cell" data-label="Avg Score">
                  {projectAvgMap.has(project.id)
                    ? <>
                        <span className="vera-score-num">{projectAvgMap.get(project.id)}</span>
                        <span className="vera-score-denom">/100</span>
                      </>
                    : <span className="avg-score-empty">—</span>}
                </td>
                <td className="col-updated" data-label="Last Updated">
                  <PremiumTooltip text={formatFull(project.updated_at)}>
                    <span className="vera-datetime-text">{formatRelative(project.updated_at)}</span>
                  </PremiumTooltip>
                </td>
                <td className="col-actions" style={{ textAlign: "right" }}>
                  <FloatingMenu
                    isOpen={openMenuId === project.id}
                    onClose={() => setOpenMenuId(null)}
                    placement="bottom-end"
                    trigger={
                      <button
                        className="row-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId((prev) => (prev === project.id ? null : project.id));
                        }}
                        title="Actions"
                        data-testid="project-row-kebab"
                      >
                        <MoreVertical size={18} strokeWidth={2} />
                      </button>
                    }
                  >
                    <PremiumTooltip text={lockedTooltip} position="left">
                      <button
                        className={`floating-menu-item${isLocked ? " disabled" : ""}`}
                        onMouseDown={() => { if (!isLocked) onEdit(project); }}
                        disabled={isLocked}
                        data-testid="project-menu-edit"
                      >
                        <Pencil size={13} />
                        Edit Project
                      </button>
                    </PremiumTooltip>
                    <PremiumTooltip text={lockedTooltip} position="left">
                      <button
                        className={`floating-menu-item${isLocked ? " disabled" : ""}`}
                        onMouseDown={() => { if (!isLocked) onDuplicate(project); }}
                        disabled={isLocked}
                      >
                        <Copy size={13} />
                        Duplicate Project
                      </button>
                    </PremiumTooltip>
                    <button
                      className={`floating-menu-item${isLocked ? " floating-menu-item--highlight" : ""}`}
                      onMouseDown={() => { setOpenMenuId(null); onViewScores(project); }}
                    >
                      <ClipboardList size={13} />
                      View Scores
                    </button>
                    <div className="floating-menu-divider" />
                    <PremiumTooltip text={lockedTooltip} position="left">
                      <button
                        className={`floating-menu-item danger${isLocked ? " disabled" : ""}`}
                        onMouseDown={() => { if (!isLocked) { setOpenMenuId(null); onDelete(project); } }}
                        disabled={isLocked}
                        data-testid="project-menu-delete"
                      >
                        <Trash2 size={13} />
                        Delete Project
                      </button>
                    </PremiumTooltip>
                  </FloatingMenu>
                </td>
                <td className="col-footer" aria-hidden="true">
                  <span><strong>{membersToArray(project.members).length}</strong> members</span>
                  <span><strong>{projectEvalCountMap.get(project.id) ?? 0}</strong> evaluations</span>
                  <PremiumTooltip text={formatFull(project.updated_at) || "—"}>
                    <span>{formatRelative(project.updated_at)}</span>
                  </PremiumTooltip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        currentPage={safePage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={filteredList.length}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        itemLabel="projects"
      />
    </>
  );
}
