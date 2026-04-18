import { MessageSquare } from "lucide-react";
import { jurorInitials, jurorAvatarBg, jurorAvatarFg } from "../utils/jurorIdentity";
import ScoreStatusPill from "./ScoreStatusPill";
import JurorStatusPill from "./JurorStatusPill";

const CELL_COLORS = [
  "var(--accent)",
  "var(--success)",
  "var(--warning)",
  "var(--purple, #a78bfa)",
];

const MEMBER_PALETTE = ["#6c63ff", "#22c55e", "#f59e0b", "#3b82f6", "#ec4899"];

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function memberAvatarColor(name) {
  const surname = (name || "").trim().split(/\s+/).pop() || name;
  return MEMBER_PALETTE[hashStr(surname) % MEMBER_PALETTE.length];
}

function parseMemberLabel(raw) {
  const parts = (raw || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { initial: "?", display: raw };
  const initial = parts[0].charAt(0).toUpperCase();
  const surname = parts[parts.length - 1];
  const display = parts.length === 1 ? surname : `${initial}. ${surname}`;
  return { initial, display };
}

function parseStudents(students) {
  if (!students) return [];
  return String(students).split(",").map((s) => s.trim()).filter(Boolean);
}

const RING_R = 16;
const RING_CIRC = 2 * Math.PI * RING_R;

function ringStrokeColor(total, totalMax) {
  if (total === null || total === undefined) return "var(--text-tertiary)";
  const pct = total / totalMax;
  if (pct >= 0.7) return "var(--accent)";
  if (pct >= 0.4) return "var(--warning)";
  return "var(--danger)";
}

function RingDonut({ total, totalMax }) {
  const hasValue = total !== null && total !== undefined;
  const pct = hasValue ? Math.max(0, Math.min(1, total / totalMax)) : 0;
  const dashFill = pct * RING_CIRC;
  const color = ringStrokeColor(total, totalMax);

  return (
    <div className="rmc-ring-wrap">
      <svg width={44} height={44} viewBox="0 0 44 44" aria-hidden="true">
        <circle cx={22} cy={22} r={RING_R} fill="none" stroke="var(--border)" strokeWidth={4.5} />
        {hasValue && (
          <circle
            cx={22} cy={22} r={RING_R}
            fill="none"
            stroke={color}
            strokeWidth={4.5}
            strokeDasharray={`${dashFill} ${RING_CIRC}`}
            strokeLinecap="round"
            transform="rotate(-90 22 22)"
          />
        )}
      </svg>
      <div className="rmc-ring-label">
        <span className="rmc-ring-score" style={{ color }}>
          {hasValue ? total : "—"}
        </span>
        <span className="rmc-ring-denom">/{totalMax}</span>
      </div>
    </div>
  );
}

function ScoreCell({ criterion, value, colorIndex, isLastOdd }) {
  const missing = value === null || value === undefined;
  const pct = missing ? 0 : Math.max(0, Math.min(1, value / criterion.max));
  const barColor = CELL_COLORS[colorIndex % CELL_COLORS.length];
  const displayLabel =
    criterion.shortLabel && criterion.shortLabel.length <= 9
      ? criterion.shortLabel
      : criterion.label;

  return (
    <div
      className={[
        "rmc-score-cell",
        missing ? "rmc-score-cell--empty" : "",
        isLastOdd ? "rmc-score-cell--span" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="rmc-cell-label">{displayLabel.toUpperCase()}</div>
      {!missing && (
        <div className="rmc-cell-score-row">
          <span className="rmc-cell-value">{value}</span>
          <span className="rmc-cell-max">/{criterion.max}</span>
        </div>
      )}
      <div className="rmc-cell-bar-track">
        {!missing && (
          <div
            className="rmc-cell-bar-fill"
            style={{ width: `${pct * 100}%`, background: barColor }}
          />
        )}
      </div>
    </div>
  );
}

const MAX_CHIPS = 4;

function MemberChips({ students }) {
  const members = parseStudents(students);
  if (members.length === 0) return null;

  const visible = members.slice(0, MAX_CHIPS);
  const overflow = members.length - MAX_CHIPS;

  return (
    <div className="rmc-team-row">
      <span className="rmc-team-label">TEAM</span>
      <div className="rmc-team-chips">
        {visible.map((name, i) => {
          const { initial, display } = parseMemberLabel(name);
          const bg = memberAvatarColor(name);
          return (
            <span key={i} className="rmc-member-chip">
              <span className="rmc-member-av" style={{ background: bg }}>
                {initial}
              </span>
              <span className="rmc-member-name">{display}</span>
            </span>
          );
        })}
        {overflow > 0 && (
          <span className="rmc-member-chip rmc-member-chip--overflow">+{overflow}</span>
        )}
      </div>
    </div>
  );
}

export default function ReviewMobileCard({ row, criteria }) {
  const totalMax = criteria.reduce((s, c) => s + (Number(c.max) || 0), 0);
  const isPartial = row.effectiveStatus === "partial";
  const isOdd = criteria.length % 2 !== 0;

  return (
    <div className={`rmc-card${isPartial ? " rmc-card--partial" : ""}`}>
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
        <MemberChips students={row.students} />
      </div>

      {criteria.length > 0 && (
        <div className="rmc-score-grid">
          {criteria.map((criterion, idx) => {
            const value = row[criterion.id] ?? row[criterion.key] ?? null;
            const isLastOdd = isOdd && idx === criteria.length - 1;
            return (
              <ScoreCell
                key={criterion.id || criterion.key || idx}
                criterion={criterion}
                value={value !== undefined ? value : null}
                colorIndex={idx}
                isLastOdd={isLastOdd}
              />
            );
          })}
        </div>
      )}

      <div className="rmc-footer">
        <div className="rmc-footer-left">
          {row.comments && (
            <MessageSquare
              size={11}
              style={{ color: "var(--text-tertiary)", marginRight: 4, flexShrink: 0 }}
            />
          )}
          <ScoreStatusPill status={row.effectiveStatus} />
        </div>
        <JurorStatusPill status={row.jurorStatus} />
      </div>
    </div>
  );
}
