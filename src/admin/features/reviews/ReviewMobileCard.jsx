import { useState } from "react";
import { MessageSquare, Clock, ChevronDown } from "lucide-react";
import { jurorInitials, jurorAvatarBg, jurorAvatarFg } from "@/admin/utils/jurorIdentity";
import { TeamMembersInline } from "@/shared/ui/EntityMeta";
import { formatTs } from "@/admin/utils/adminUtils";
import ScoreStatusPill from "@/admin/shared/ScoreStatusPill";
import JurorStatusPill from "@/admin/shared/JurorStatusPill";
import JurorBadge from "@/admin/shared/JurorBadge";

function scoreBandColor(total, totalMax) {
  if (total == null || !Number.isFinite(Number(total))) return "var(--text-tertiary)";
  const pct = (Number(total) / (totalMax || 100)) * 100;
  if (pct >= 85) return "var(--success)";
  if (pct >= 70) return "var(--warning)";
  return "var(--danger)";
}

function RingDonut({ total, totalMax }) {
  const hasValue = total != null;
  const color = scoreBandColor(total, totalMax);
  const deg = hasValue ? Math.min(360, (Number(total) / (totalMax || 100)) * 360) : 0;

  return (
    <div className="rmc-ring-wrap">
      <span
        className="rmc-ring-fill"
        style={{ "--pct": `${deg}deg`, "--ring": color }}
      >
        <span className="rmc-ring-inner">
          <span className="rmc-ring-score" style={{ color }}>
            {hasValue ? (Number.isFinite(Number(total)) ? Number(total).toFixed(1) : total) : "—"}
          </span>
          <span className="rmc-ring-denom">/{totalMax}</span>
        </span>
      </span>
    </div>
  );
}

function CritBar({ criterion, value }) {
  const missing = value === null || value === undefined;
  const pct = missing ? 0 : Math.max(0, Math.min(100, (value / criterion.max) * 100));
  const color = criterion.color || "var(--accent)";
  const label = criterion.label || criterion.shortLabel;

  return (
    <div className="rmc-crit-bar-row">
      <div className="rmc-crit-bar-label">{label}</div>
      <div className="rmc-bar-track">
        {!missing && (
          <div
            className="rmc-bar-fill"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        )}
      </div>
      <div className="rmc-crit-bar-score">
        {!missing ? (
          <>
            <span className="rmc-crit-score-val" style={{ color }}>{Number.isFinite(Number(value)) ? Number(value).toFixed(1) : value}</span>
            <span className="rmc-crit-score-max">/{criterion.max}</span>
          </>
        ) : (
          <span className="rmc-crit-score-empty">—</span>
        )}
      </div>
    </div>
  );
}

function MemberChips({ students }) {
  if (!students || (Array.isArray(students) && students.length === 0)) return null;
  return (
    <div className="rmc-meta-section">
      <span className="meta-chips-eyebrow">TEAM MEMBERS</span>
      <div className="meta-chips-row">
        <TeamMembersInline names={students} />
      </div>
    </div>
  );
}

function AdvisedByRow({ advisor }) {
  if (!advisor) return null;
  const advisors = advisor.split(",").map((s) => s.trim()).filter(Boolean);
  if (!advisors.length) return null;
  return (
    <div className="rmc-meta-section">
      <span className="meta-chips-eyebrow">ADVISED BY</span>
      <div className="meta-chips-row">
        {advisors.map((name, i) => (
          <JurorBadge key={`${name}-${i}`} name={name} size="sm" nameOnly variant="advisor" />
        ))}
      </div>
    </div>
  );
}

function critAbbrLabel(label) {
  return (label || "").split(/\s+/).filter(w => /^[a-zA-Z]/.test(w)).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function parseStudents(students) {
  if (!students) return [];
  if (Array.isArray(students)) return students.filter(Boolean);
  return String(students).split(/[,;]/).map(s => s.trim()).filter(Boolean);
}

export default function ReviewMobileCard({ row, criteria }) {
  const totalMax = criteria.reduce((s, c) => s + (Number(c.max) || 0), 0);
  const isPartial = row.effectiveStatus === "partial";
  const [commentOpen, setCommentOpen] = useState(false);
  const [expandOpen, setExpandOpen] = useState(false);
  const submittedTs = formatTs(row.finalSubmittedAt || row.updatedAt);
  const hasSubmittedTs = submittedTs && submittedTs !== "—";

  const members = parseStudents(row.students);
  const visibleAvatars = members.slice(0, 3);
  const overflowCount = members.length - visibleAvatars.length;
  const hasExpandableContent = criteria.length > 0 || members.length > 0 || !!row.advisor;

  return (
    <div
      data-card-selectable=""
      className={`rmc-card${isPartial ? " rmc-card--partial" : ""}`}
    >
      <div className="rmc-header">
        <div className="rmc-juror">
          <div
            className="rmc-juror-av"
            style={{
              background: jurorAvatarBg(row.juryName),
              color: jurorAvatarFg(row.juryName),
            }}
          >
            {jurorInitials(row.juryName)}
          </div>
          <div className="rmc-juror-info">
            <div className="rmc-juror-name">{row.juryName}</div>
            {row.affiliation && (
              <div className="rmc-juror-affil">{row.affiliation}</div>
            )}
          </div>
        </div>
        <RingDonut total={row.total} totalMax={totalMax} />
      </div>

      <div className="rmc-project-block">
        <div className="rmc-project-row">
          {row.groupNo != null && (
            <span className="rmc-project-badge">P{row.groupNo}</span>
          )}
          <span className="rmc-project-title">
            {row.title || row.projectName || "—"}
          </span>
        </div>
      </div>

      {hasExpandableContent && (
        <button
          className={`rmc-toggle-strip row-inline-control${expandOpen ? " rmc-toggle-strip--open" : ""}`}
          onClick={(e) => { e.stopPropagation(); setExpandOpen(v => !v); }}
          aria-label={expandOpen ? "Collapse details" : "Expand details"}
        >
          <div className="rmc-toggle-summary">
            <div className="rmc-toggle-pills">
              {criteria.map((c, i) => {
                const value = row[c.id] ?? row[c.key] ?? null;
                const abbr = critAbbrLabel(c.label || c.shortLabel || "");
                const numVal = value != null && Number.isFinite(Number(value)) ? Math.round(Number(value)) : null;
                return (
                  <span
                    key={c.id || i}
                    className="rmc-xpill"
                    style={{ color: c.color || "var(--accent)" }}
                  >
                    {abbr}{numVal != null ? ` ${numVal}` : ""}
                  </span>
                );
              })}
            </div>
            {visibleAvatars.length > 0 && (
              <div className="rmc-mini-avatars">
                {visibleAvatars.map((name, i) => (
                  <div key={i} className="rmc-mini-av">
                    {(name || "?")[0].toUpperCase()}
                  </div>
                ))}
                {overflowCount > 0 && (
                  <div className="rmc-mini-av rmc-mini-av--overflow">+{overflowCount}</div>
                )}
              </div>
            )}
          </div>
          <div className="rmc-toggle-chevron">
            <ChevronDown size={11} strokeWidth={2.5} />
          </div>
        </button>
      )}

      <div className={`rmc-expand-body${expandOpen ? " rmc-expand-body--open" : ""}`}>
        <div className="rmc-expand-inner">
          <MemberChips students={row.students} />
          <AdvisedByRow advisor={row.advisor} />
          {criteria.length > 0 && (
            <div className="rmc-crit-bars">
              <span className="meta-chips-eyebrow rmc-crit-heading">CRITERIA SCORES</span>
              {criteria.map((criterion, idx) => {
                const value = row[criterion.id] ?? row[criterion.key] ?? null;
                return (
                  <CritBar
                    key={criterion.id || criterion.key || idx}
                    criterion={criterion}
                    value={value !== undefined ? value : null}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="rmc-footer">
        <div className="rmc-footer-col">
          <span className="rmc-footer-label">Score Status</span>
          <div className="rmc-footer-left">
            {row.comments && (
              <button
                className={`rmc-comment-btn row-inline-control${commentOpen ? " rmc-comment-btn--active" : ""}`}
                onClick={() => setCommentOpen((v) => !v)}
                aria-label="Toggle comment"
              >
                <MessageSquare size={11} />
              </button>
            )}
            <ScoreStatusPill status={row.effectiveStatus} />
          </div>
        </div>
        <div className="rmc-footer-col rmc-footer-col--right">
          <span className="rmc-footer-label">Juror Progress</span>
          <JurorStatusPill status={row.jurorStatus} />
        </div>
      </div>

      {commentOpen && row.comments && (
        <div className="rmc-comment-panel">
          <MessageSquare size={12} className="rmc-comment-panel-icon" />
          <p className="rmc-comment-panel-text">{row.comments}</p>
        </div>
      )}

      <div className="rmc-submitted">
        <span className="rmc-submitted-label">
          <Clock size={11} strokeWidth={2} />
          Submitted At
        </span>
        <span className="rmc-submitted-value vera-datetime-text">
          {hasSubmittedTs ? (
            <>
              <span>{submittedTs.split(" ")[0]}</span>
              <span className="rmc-submitted-time">{submittedTs.split(" ")[1]}</span>
            </>
          ) : "—"}
        </span>
      </div>
    </div>
  );
}
