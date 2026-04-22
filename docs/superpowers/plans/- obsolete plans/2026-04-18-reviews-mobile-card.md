# Reviews Mobile Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `display: contents` mobile table hack in ReviewsPage with a proper `<ReviewMobileCard>` div-based component that shows a 2×N/2 criterion score grid and SVG donut ring for the total.

**Architecture:** Add a `useMobilePortrait()` hook in ReviewsPage that gates between the existing `<table>` (desktop) and a new `<div className="reviews-mobile-list">` (mobile portrait). `ReviewMobileCard` is a self-contained component in `src/admin/components/`. New CSS lives in the existing `reviews.css` under a new clearly-labeled section; the old `display: contents` mobile block is deleted.

**Tech Stack:** React 18 + Vite, Vitest + Testing Library, Lucide icons, CSS variables (`--bg-card`, `--surface-1`, `--border`, `--accent`, `--warning`, `--danger`, `--success`). No new dependencies.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/test/qa-catalog.json` | Add 7 `reviews.mobile_card.*` test IDs |
| Create | `src/admin/__tests__/ReviewMobileCard.test.jsx` | Unit tests for the card |
| Create | `src/admin/components/ReviewMobileCard.jsx` | New card component |
| Modify | `src/styles/pages/reviews.css` | Delete old mobile block; add `.rmc-*` styles |
| Modify | `src/admin/pages/ReviewsPage.jsx` | Add `useMobilePortrait` hook + conditional render |

---

## Task 1: Add QA catalog entries

**Files:**
- Modify: `src/test/qa-catalog.json`

- [ ] **Step 1: Append 7 entries to `src/test/qa-catalog.json`**

Open the file, find the closing `]` of the JSON array, and insert the following entries before it:

```json
,
  {
    "id": "reviews.mobile_card.01",
    "module": "Reviews / Mobile Card",
    "area": "Reviews Mobile Card — Rendering",
    "story": "Full Row Render",
    "scenario": "renders all criterion score cells with correct score values",
    "whyItMatters": "The 2×2 score grid is the primary information surface of the new card; every criterion must map correctly from the enriched row.",
    "risk": "Wrong key lookup would silently display zeros or dashes for all scores.",
    "coverageStrength": "Strong",
    "severity": "critical"
  },
  {
    "id": "reviews.mobile_card.02",
    "module": "Reviews / Mobile Card",
    "area": "Reviews Mobile Card — Rendering",
    "story": "Partial Row",
    "scenario": "applies amber left border class when effectiveStatus is partial",
    "whyItMatters": "Partial state is the most important visual signal — a juror has scored some but not all criteria.",
    "risk": "Missing visual indicator would make partial rows indistinguishable from complete ones.",
    "coverageStrength": "Strong",
    "severity": "normal"
  },
  {
    "id": "reviews.mobile_card.03",
    "module": "Reviews / Mobile Card",
    "area": "Reviews Mobile Card — Rendering",
    "story": "Empty Row",
    "scenario": "shows dash in ring center and fades all score cells when total is null",
    "whyItMatters": "An unscored row must clearly signal absence of data rather than displaying misleading zeros.",
    "risk": "Rendering 0 instead of dash would suggest a zero score was entered intentionally.",
    "coverageStrength": "Strong",
    "severity": "normal"
  },
  {
    "id": "reviews.mobile_card.04",
    "module": "Reviews / Mobile Card",
    "area": "Reviews Mobile Card — Rendering",
    "story": "No-Team Row",
    "scenario": "omits the team row entirely when students is empty string",
    "whyItMatters": "If no students are assigned, the TEAM label and chip row must not appear — no empty-state placeholder.",
    "risk": "Rendering an empty TEAM row would confuse admins into thinking student data failed to load.",
    "coverageStrength": "Strong",
    "severity": "normal"
  },
  {
    "id": "reviews.mobile_card.05",
    "module": "Reviews / Mobile Card",
    "area": "Reviews Mobile Card — Rendering",
    "story": "Team Overflow",
    "scenario": "shows first 4 member chips plus a +N overflow chip when team has 5 members",
    "whyItMatters": "Cards must not stretch arbitrarily wide from long member lists; overflow chips keep layout consistent.",
    "risk": "No cap would allow many-member teams to break card layout on narrow screens.",
    "coverageStrength": "Strong",
    "severity": "normal"
  },
  {
    "id": "reviews.mobile_card.06",
    "module": "Reviews / Mobile Card",
    "area": "Reviews Mobile Card — Rendering",
    "story": "Odd Criterion Count Grid",
    "scenario": "last score cell spans two columns when criterion count is odd",
    "whyItMatters": "A 3-criterion period is common; the orphan cell must span full width so the grid does not have an empty half-column.",
    "risk": "Without span, the last cell would only fill the left column, leaving a gap on the right.",
    "coverageStrength": "Strong",
    "severity": "normal"
  },
  {
    "id": "reviews.mobile_card.07",
    "module": "Reviews / Mobile Card",
    "area": "Reviews Mobile Card — Rendering",
    "story": "Comment Indicator",
    "scenario": "shows MessageSquare icon in footer when row.comments is non-empty",
    "whyItMatters": "Admins need a visual hint that a juror left a comment, since the full text is deferred to a future drawer.",
    "risk": "No indicator would hide comments entirely on mobile.",
    "coverageStrength": "Medium",
    "severity": "normal"
  }
```

- [ ] **Step 2: Validate JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('src/test/qa-catalog.json','utf8')); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/test/qa-catalog.json
git commit -m "test(reviews): add mobile card QA catalog entries"
```

---

## Task 2: Write failing tests

**Files:**
- Create: `src/admin/__tests__/ReviewMobileCard.test.jsx`

- [ ] **Step 1: Create the test file**

Create `src/admin/__tests__/ReviewMobileCard.test.jsx` with this content:

```jsx
import { describe, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ReviewMobileCard from "../components/ReviewMobileCard";
import { qaTest } from "../../test/qaTest.js";

// ReviewMobileCard uses jurorIdentity (pure functions) — no supabase needed.

const CRITERIA_4 = [
  { id: "technical", label: "Technical", shortLabel: "Tech", max: 30 },
  { id: "design",    label: "Design",    shortLabel: "Design", max: 30 },
  { id: "delivery",  label: "Delivery",  shortLabel: "Delivery", max: 30 },
  { id: "teamwork",  label: "Teamwork",  shortLabel: "Teamwork", max: 10 },
];

const CRITERIA_3 = [
  { id: "technical", label: "Technical", shortLabel: "Tech", max: 30 },
  { id: "design",    label: "Design",    shortLabel: "Design", max: 30 },
  { id: "delivery",  label: "Delivery",  shortLabel: "Delivery", max: 30 },
];

const FULL_ROW = {
  jurorId: "j1",
  juryName: "Dr. Aslıhan Koçak",
  affiliation: "TED University, EE",
  groupNo: 5,
  title: "Biomedical Signal Processing for Sleep Apnea Detection",
  students: "Emre Arslan, Beren Kaya, Mert Can",
  technical: 25,
  design: 28,
  delivery: 22,
  teamwork: 6,
  total: 81,
  effectiveStatus: "scored",
  jurorStatus: "completed",
  comments: "",
};

describe("ReviewMobileCard", () => {
  qaTest("reviews.mobile_card.01", () => {
    const { container } = render(<ReviewMobileCard row={FULL_ROW} criteria={CRITERIA_4} />);
    // Score values appear in cells
    expect(screen.getByText("25")).toBeTruthy();
    expect(screen.getByText("28")).toBeTruthy();
    expect(screen.getByText("22")).toBeTruthy();
    expect(screen.getByText("6")).toBeTruthy();
    // All 4 criterion labels present
    expect(screen.getByText("TECH")).toBeTruthy();
    expect(screen.getByText("DESIGN")).toBeTruthy();
    expect(screen.getByText("DELIVERY")).toBeTruthy();
    expect(screen.getByText("TEAMWORK")).toBeTruthy();
    // Total ring label
    expect(screen.getByText("81")).toBeTruthy();
  });

  qaTest("reviews.mobile_card.02", () => {
    const partialRow = { ...FULL_ROW, effectiveStatus: "partial", design: null, total: 53 };
    const { container } = render(<ReviewMobileCard row={partialRow} criteria={CRITERIA_4} />);
    expect(container.querySelector(".rmc-card--partial")).toBeTruthy();
  });

  qaTest("reviews.mobile_card.03", () => {
    const emptyRow = {
      ...FULL_ROW,
      technical: null, design: null, delivery: null, teamwork: null,
      total: null,
      effectiveStatus: "empty",
      jurorStatus: "not_started",
    };
    render(<ReviewMobileCard row={emptyRow} criteria={CRITERIA_4} />);
    // Ring center shows em-dash when total is null
    expect(screen.getByText("—")).toBeTruthy();
    // All score cells have the empty class (opacity: 0.4)
    const cells = document.querySelectorAll(".rmc-score-cell--empty");
    expect(cells.length).toBe(4);
  });

  qaTest("reviews.mobile_card.04", () => {
    const noTeamRow = { ...FULL_ROW, students: "" };
    const { container } = render(<ReviewMobileCard row={noTeamRow} criteria={CRITERIA_4} />);
    expect(container.querySelector(".rmc-team-row")).toBeNull();
  });

  qaTest("reviews.mobile_card.05", () => {
    const fiveMemberRow = {
      ...FULL_ROW,
      students: "Alice Smith, Bob Jones, Carol White, Dave Brown, Eve Davis",
    };
    render(<ReviewMobileCard row={fiveMemberRow} criteria={CRITERIA_4} />);
    // First 4 show surnames; overflow chip shows +1
    expect(screen.getByText(/Smith/)).toBeTruthy();
    expect(screen.getByText(/Jones/)).toBeTruthy();
    expect(screen.getByText(/White/)).toBeTruthy();
    expect(screen.getByText(/Brown/)).toBeTruthy();
    expect(screen.getByText("+1")).toBeTruthy();
    // Eve Davis must NOT appear as a chip
    expect(screen.queryByText(/Davis/)).toBeNull();
  });

  qaTest("reviews.mobile_card.06", () => {
    const threeRow = { ...FULL_ROW, delivery: 22, teamwork: undefined };
    const { container } = render(<ReviewMobileCard row={threeRow} criteria={CRITERIA_3} />);
    // Last cell (index 2, odd count) must span 2 columns
    const spanCell = container.querySelector(".rmc-score-cell--span");
    expect(spanCell).toBeTruthy();
    // Only one span cell
    const spanCells = container.querySelectorAll(".rmc-score-cell--span");
    expect(spanCells.length).toBe(1);
  });

  qaTest("reviews.mobile_card.07", () => {
    const withComment = { ...FULL_ROW, comments: "Excellent presentation." };
    const { container } = render(<ReviewMobileCard row={withComment} criteria={CRITERIA_4} />);
    // MessageSquare icon is rendered via lucide-react as an svg
    const footer = container.querySelector(".rmc-footer-left");
    expect(footer).toBeTruthy();
    // lucide-react renders SVGs — check one is present inside the footer-left
    expect(footer.querySelector("svg")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests — confirm they all fail with "Cannot find module"**

```bash
npm test -- --run src/admin/__tests__/ReviewMobileCard.test.jsx 2>&1 | head -30
```

Expected: `FAIL` — `Cannot find module '../components/ReviewMobileCard'`

- [ ] **Step 3: Commit**

```bash
git add src/admin/__tests__/ReviewMobileCard.test.jsx
git commit -m "test(reviews): add failing ReviewMobileCard unit tests"
```

---

## Task 3: Implement ReviewMobileCard.jsx

**Files:**
- Create: `src/admin/components/ReviewMobileCard.jsx`

- [ ] **Step 1: Create the component file**

Create `src/admin/components/ReviewMobileCard.jsx`:

```jsx
// src/admin/components/ReviewMobileCard.jsx
// Mobile portrait card for a single juror × project review row.
// Rendered by ReviewsPage when window matches (max-width: 768px) and (orientation: portrait).

import { MessageSquare } from "lucide-react";
import { jurorInitials, jurorAvatarBg, jurorAvatarFg } from "../utils/jurorIdentity";
import ScoreStatusPill from "./ScoreStatusPill";
import JurorStatusPill from "./JurorStatusPill";

// Bar fill colors cycle by criterion index (accent→success→warning→purple)
const CELL_COLORS = [
  "var(--accent)",
  "var(--success)",
  "var(--warning)",
  "var(--purple, #a78bfa)",
];

// Member avatar palette — 5 hues hashed on surname
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

// ── SVG donut ring ────────────────────────────────────────────────
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
        {/* Track */}
        <circle cx={22} cy={22} r={RING_R} fill="none" stroke="var(--border)" strokeWidth={4.5} />
        {/* Fill arc */}
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

// ── Score grid cell ───────────────────────────────────────────────
function ScoreCell({ criterion, value, colorIndex, isLastOdd }) {
  const missing = value === null || value === undefined;
  const pct = missing ? 0 : Math.max(0, Math.min(1, value / criterion.max));
  const barColor = CELL_COLORS[colorIndex % CELL_COLORS.length];
  // Use shortLabel if ≤9 chars, otherwise full label
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
      <div className="rmc-cell-score-row">
        <span className="rmc-cell-value">{missing ? "—" : value}</span>
        <span className="rmc-cell-max">/{criterion.max}</span>
      </div>
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

// ── Team member chips ─────────────────────────────────────────────
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

// ── Card ──────────────────────────────────────────────────────────
export default function ReviewMobileCard({ row, criteria }) {
  const totalMax = criteria.reduce((s, c) => s + (Number(c.max) || 0), 0);
  const isPartial = row.effectiveStatus === "partial";
  const isOdd = criteria.length % 2 !== 0;

  return (
    <div className={`rmc-card${isPartial ? " rmc-card--partial" : ""}`}>
      {/* ── Header: juror identity + total ring ── */}
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

      {/* ── Project + team ── */}
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

      {/* ── Score grid ── */}
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

      {/* ── Footer: score status + juror status ── */}
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
```

- [ ] **Step 2: Run tests — expect them to pass**

```bash
npm test -- --run src/admin/__tests__/ReviewMobileCard.test.jsx
```

Expected: All 7 tests `PASS`. If any fail, check:
- `reviews.mobile_card.01`: are criterion IDs (`technical`, `design`, etc.) matching `row` keys?
- `reviews.mobile_card.03`: is `"—"` the exact character rendered in the ring?
- `reviews.mobile_card.05`: does `parseMemberLabel("Alice Smith")` return `{ display: "A. Smith" }`? The test checks `/Smith/` so this is fine.

- [ ] **Step 3: Run existing Reviews tests to confirm no regressions**

```bash
npm test -- --run src/admin/__tests__/ReviewsPage.test.jsx src/admin/__tests__/ReviewsPage.filter.test.jsx
```

Expected: All tests `PASS` (ReviewMobileCard is not yet imported by ReviewsPage).

- [ ] **Step 4: Commit**

```bash
git add src/admin/components/ReviewMobileCard.jsx
git commit -m "feat(reviews): add ReviewMobileCard component"
```

---

## Task 4: Add mobile card CSS and remove old mobile block

**Files:**
- Modify: `src/styles/pages/reviews.css` — delete lines 589–761 (the old `display: contents` block), add new `.rmc-*` block

- [ ] **Step 1: Delete the old mobile portrait block**

In `src/styles/pages/reviews.css`, find and delete the entire block from:
```css
/* ══════════════════════════════════════════════════════════════════
   Portrait / mobile card layout  (≤ 768px portrait)
```
down to and including the closing `}` of `@media (max-width: 768px) and (orientation: portrait)` (currently lines 589–761, ending before the landscape media query comment).

The landscape block starting at:
```css
/* ══════════════════════════════════════════════════════════════════
   Landscape compact  (≤ 768px landscape)
```
must be kept intact.

- [ ] **Step 2: Add new mobile card styles**

Append the following at the end of `src/styles/pages/reviews.css`, before the end of file:

```css
/* ── Mobile portrait header responsive fixes ────────────────────── */
@media (max-width: 768px) and (orientation: portrait) {
  .reviews-header { flex-direction: column; align-items: stretch; gap: 10px; }
  .reviews-actions { flex-wrap: wrap; gap: 6px; }
  .reviews-actions > div:first-child { width: 100%; min-width: 0; }
  .reviews-search { width: 100% !important; box-sizing: border-box; }

  .reviews-page {
    overflow: hidden;
    max-width: 100%;
  }
}

/* ── Mobile portrait cards (new) ───────────────────────────────── */
@media (max-width: 768px) and (orientation: portrait) {
  .reviews-mobile-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* ── Card shell ── */
  .rmc-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px 16px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .rmc-card--partial {
    border-left: 3px solid var(--warning);
  }

  /* ── Header: juror + ring ── */
  .rmc-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }

  .rmc-juror {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1;
  }

  .rmc-juror-av {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
    line-height: 1;
  }

  .rmc-juror-info {
    min-width: 0;
  }

  .rmc-juror-name {
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text-primary);
  }

  .rmc-juror-affil {
    font-size: 10px;
    color: var(--text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── SVG donut ring ── */
  .rmc-ring-wrap {
    position: relative;
    width: 44px;
    height: 44px;
    flex-shrink: 0;
  }

  .rmc-ring-label {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    line-height: 1;
    pointer-events: none;
  }

  .rmc-ring-score {
    font-size: 13px;
    font-weight: 800;
    line-height: 1;
  }

  .rmc-ring-denom {
    font-size: 8px;
    color: var(--text-tertiary);
    line-height: 1;
    margin-top: 1px;
  }

  /* ── Project + team block ── */
  .rmc-project-block {
    border-top: 1px solid var(--border);
    padding-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .rmc-project-row {
    display: flex;
    align-items: flex-start;
    gap: 7px;
  }

  .rmc-project-badge {
    font-size: 10px;
    font-weight: 600;
    color: var(--accent);
    background: var(--accent-soft);
    border-radius: 4px;
    padding: 2px 5px;
    flex-shrink: 0;
    font-family: var(--mono);
    line-height: 1.4;
    letter-spacing: 0.3px;
  }

  .rmc-project-title {
    font-size: 11px;
    font-weight: 600;
    line-height: 1.35;
    color: var(--text-primary);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* ── Team row ── */
  .rmc-team-row {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    flex-wrap: wrap;
  }

  .rmc-team-label {
    font-size: 9px;
    font-weight: 700;
    color: var(--text-tertiary);
    letter-spacing: 0.4px;
    text-transform: uppercase;
    padding-top: 3px;
    flex-shrink: 0;
  }

  .rmc-team-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .rmc-member-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 2px 7px 2px 3px;
  }

  .rmc-member-chip--overflow {
    padding: 2px 8px;
    font-size: 10px;
    color: var(--text-tertiary);
    justify-content: center;
  }

  .rmc-member-av {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 8px;
    font-weight: 700;
    color: #fff;
    flex-shrink: 0;
    line-height: 1;
  }

  .rmc-member-name {
    font-size: 10px;
    color: var(--text-secondary);
    white-space: nowrap;
  }

  /* ── Score grid ── */
  .rmc-score-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px;
  }

  .rmc-score-cell {
    background: var(--surface-1); /* nested-panel-ok */
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 7px 8px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .rmc-score-cell--empty {
    opacity: 0.4;
  }

  .rmc-score-cell--span {
    grid-column: 1 / -1;
  }

  .rmc-cell-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: var(--text-tertiary);
  }

  .rmc-cell-score-row {
    display: flex;
    align-items: baseline;
    gap: 1px;
  }

  .rmc-cell-value {
    font-size: 15px;
    font-weight: 800;
    color: var(--text-primary);
    font-family: var(--mono);
  }

  .rmc-cell-max {
    font-size: 9px;
    color: var(--text-tertiary);
  }

  .rmc-cell-bar-track {
    height: 3px;
    background: var(--border);
    border-radius: 99px;
    overflow: hidden;
    margin-top: 2px;
  }

  .rmc-cell-bar-fill {
    height: 100%;
    border-radius: 99px;
  }

  /* ── Footer ── */
  .rmc-footer {
    border-top: 1px solid var(--border);
    padding-top: 9px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .rmc-footer-left {
    display: flex;
    align-items: center;
    gap: 4px;
  }
}
```

- [ ] **Step 3: Run `check:no-nested-panels`**

```bash
npm run check:no-nested-panels
```

Expected: `OK` (the `.rmc-score-cell` background line carries `/* nested-panel-ok */`).

- [ ] **Step 4: Commit**

```bash
git add src/styles/pages/reviews.css
git commit -m "style(reviews): replace display:contents mobile hack with rmc card styles"
```

---

## Task 5: Update ReviewsPage.jsx

**Files:**
- Modify: `src/admin/pages/ReviewsPage.jsx`

- [ ] **Step 1: Add ReviewMobileCard import and useMobilePortrait hook**

At the top of `src/admin/pages/ReviewsPage.jsx`, add the import after the existing imports:

```js
import ReviewMobileCard from "../components/ReviewMobileCard";
```

Then add this hook definition before `ReviewsStatusGuide` (after the import block):

```js
// ── Mobile portrait detection ─────────────────────────────────
function useMobilePortrait() {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 768px) and (orientation: portrait)").matches
      : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px) and (orientation: portrait)");
    const handler = (e) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return matches;
}
```

- [ ] **Step 2: Use the hook inside ReviewsPage and add conditional render**

Inside the `ReviewsPage` component, add the hook call right after all the `useMemo` declarations (before the `return`):

```js
const isMobilePortrait = useMobilePortrait();
```

Then find the `{/* Table */}` section in the JSX, which currently opens with:

```jsx
{/* Table */}
<div className="table-wrap table-wrap--split">
  <table className="reviews-table table-standard table-pill-balance" ...>
```

Replace that entire `{/* Table */}` div block (the `<div className="table-wrap ...">...</div>`) with:

```jsx
{/* Table / Mobile card list */}
{isMobilePortrait ? (
  <div className="reviews-mobile-list">
    {pageRows.length === 0 ? (
      <div className="reviews-empty-row">No reviews match the current filters.</div>
    ) : (
      pageRows.map((row, i) => (
        <ReviewMobileCard
          key={`${row.jurorId ?? row.juryName}__${row.projectId ?? row.title}__${i}`}
          row={row}
          criteria={criteriaConfig}
        />
      ))
    )}
  </div>
) : (
  <div className="table-wrap table-wrap--split">
    <table className="reviews-table table-standard table-pill-balance" style={{ tableLayout: "fixed", width: "100%" }}>
      <colgroup>
        <col style={{ width: 148 }} />{/* Juror */}
        <col style={{ width: 44 }} />{/* No */}
        <col />{/* Project — flexible */}
        <col style={{ width: 110 }} />{/* Team Members */}
        {scoreCols.filter(c => c.key !== "total").map(c => (
          <col key={c.key} style={{ width: 60 }} />
        ))}{/* Each criterion score */}
        <col style={{ width: 64 }} />{/* Total */}
        <col style={{ width: 72 }} />{/* Status */}
        <col style={{ width: 60 }} />{/* Progress */}
        <col style={{ width: 72 }} />{/* Comment */}
        <col style={{ width: 76 }} />{/* Submitted At */}
      </colgroup>
      <thead>
        <tr>
          {columns.map(col => (
            <th
              key={col.key}
              className={[
                col.sortKey ? `sortable${sortKey === col.sortKey ? ' sorted' : ''}` : '',
                col.thClass || '',
              ].filter(Boolean).join(' ') || undefined}
              style={col.style}
              onClick={col.sortKey ? () => handleSort(col.sortKey) : undefined}
            >
              {col.label}
              {col.sortKey && <SortIcon colKey={col.sortKey} sortKey={sortKey} sortDir={sortDir} />}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {pageRows.length === 0 ? (
          <tr>
            <td colSpan={6 + (scoreCols.length)} className="reviews-empty-row">
              No reviews match the current filters.
            </td>
          </tr>
        ) : (
          pageRows.map((row, i) => {
            const isPartialRow = row.effectiveStatus === "partial";
            const submittedTs = formatTs(row.finalSubmittedAt);
            return (
              <tr key={`${row.jurorId ?? row.juryName}__${row.projectId ?? row.title}__${i}`} className={isPartialRow ? "partial-row" : ""}>
                <td className="col-juror">
                  <JurorBadge name={row.juryName} affiliation={row.affiliation} size="sm" />
                </td>
                <td className="col-no text-center" data-project={row.title || row.projectName || ""}>
                  {row.groupNo != null
                    ? <span className="project-no-badge">P{row.groupNo}</span>
                    : <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>—</span>}
                </td>
                <td className="col-project text-sm">{row.title || row.projectName || "—"}</td>
                <td className="col-members text-xs text-muted">
                  <StudentNames names={row.students} />
                  {!row.students ? "—" : null}
                </td>
                {scoreCols.filter((c) => c.key !== "total").map((col) => {
                  const val = row[col.key];
                  const missing = val === null || val === undefined;
                  return (
                    <td key={col.key} className={`col-score${missing ? " missing" : ""}`} data-label={col.label.split(" / ")[0]}>
                      {missing ? "—" : val}
                    </td>
                  );
                })}
                <td className="col-total">
                  {row.total != null ? (
                    <>
                      <span className="total-score-value">{row.total}</span>
                      {isPartialRow && (
                        <span style={{ marginLeft: 2, width: 12, height: 12, borderRadius: "50%", background: "rgba(217,119,6,0.12)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 7, color: "var(--warning)", fontWeight: 700 }}>!</span>
                      )}
                    </>
                  ) : "—"}
                </td>
                <td className="col-status text-center">
                  <ScoreStatusPill status={row.effectiveStatus} />
                </td>
                <td className="col-progress text-center">
                  <JurorPill status={row.jurorStatus} submittedTs={submittedTs} />
                </td>
                <td className="col-comment">
                  {row.comments ? (
                    <PremiumTooltip text={row.comments}>
                      <span className="col-comment-inner">
                        <MessageSquare size={10} style={{ verticalAlign: "-1px", marginRight: 3, opacity: 0.4 }} />
                        {row.comments}
                      </span>
                    </PremiumTooltip>
                  ) : "—"}
                </td>
                <td className="col-submitted text-right vera-datetime-text">
                  {submittedTs && submittedTs !== "—" ? submittedTs : "—"}
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  </div>
)}
```

- [ ] **Step 3: Run the full test suite**

```bash
npm test -- --run
```

Expected: All existing tests pass, including `ReviewsPage.test.jsx` and `ReviewsPage.filter.test.jsx`. The `ReviewMobileCard.test.jsx` suite already passed in Task 3.

- [ ] **Step 4: Run code quality checks**

```bash
npm run check:no-nested-panels && npm run check:no-native-select
```

Expected: Both checks exit with code 0.

- [ ] **Step 5: Build to catch any import/type errors**

```bash
npm run build 2>&1 | tail -20
```

Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/admin/pages/ReviewsPage.jsx
git commit -m "feat(reviews): add mobile portrait card list render path"
```

---

## Task 6: Visual QA

**Files:** none (read-only verification)

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open Chrome DevTools → toggle device toolbar**

Set to **iPhone SE** (375×667) — DevTools automatically sets orientation to portrait.

Navigate to the Reviews page (must be logged in as admin).

Verify:
- Mobile list renders (no table visible)
- Each card shows juror avatar + name + affiliation
- Donut ring appears in top-right with score and `/100` denominator
- Project badge (`P5`, etc.) + 2-line-clamped title
- Team member chips with colored avatar + `A. Surname` format
- 2×2 score grid with bars
- Footer with `Scored`/`Partial`/`Empty` pill on left, juror status pill on right

- [ ] **Step 3: Test each status state**

Use the filter panel to isolate:
1. **Scored + Completed** — ring blue, no left border
2. **Partial** — card left border 3px amber, null cells faded
3. **Empty** — ring shows `—` in grey, all score cells at opacity 0.4
4. **Editing** — juror pill shows `Editing` in purple

- [ ] **Step 4: Test Pixel 7 viewport** (412×915)

Switch device to Pixel 7. Verify layout holds; no truncation of ring or card edges.

- [ ] **Step 5: Switch to landscape**

Rotate device toolbar to landscape. Verify the desktop table renders (not the card list).

- [ ] **Step 6: Final commit (if any CSS tweaks were needed)**

```bash
git add src/styles/pages/reviews.css
git commit -m "style(reviews): visual QA tweaks for mobile card layout"
```

Only create this commit if tweaks were needed. Skip if Task 4 CSS was sufficient.

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task covering it |
|-----------------|-----------------|
| 32px juror avatar + initials + color hash | Task 3 (uses `jurorAvatarBg/Fg`, `jurorInitials`) |
| 44px SVG donut ring + color-coded stroke | Task 3 (`RingDonut`) |
| Ring: accent ≥70%, warning 40–69%, danger <40%, grey null | Task 3 (`ringStrokeColor`) |
| Project badge `P{groupNo}` + 2-line title clamp | Task 3 + Task 4 CSS |
| Team chips: max 4 + `+N` overflow | Task 3 (`MemberChips`, `MAX_CHIPS = 4`) |
| 2×N/2 score grid | Task 3 (`ScoreCell`) + Task 4 CSS |
| Odd last cell spans 2 cols | Task 3 (`isLastOdd`) |
| Bar color cycles accent→success→warning→purple | Task 3 (`CELL_COLORS`) |
| Empty cell: opacity 0.4, em-dash, no bar | Task 3 (`missing` branch) |
| Card footer: `ScoreStatusPill` + `JurorStatusPill` | Task 3 (reused components) |
| Comment indicator: `MessageSquare` icon | Task 3 (in footer-left) |
| Partial row: 3px amber left border | Task 3 (`rmc-card--partial`) + Task 4 CSS |
| No `onClick` on card | Task 3 (no handler defined) |
| `useMediaQuery`-style mobile detection | Task 5 (`useMobilePortrait`) |
| Desktop table unchanged | Task 5 (table in `else` branch) |
| Old `display: contents` block removed | Task 4 (deleted from reviews.css) |
| `/* nested-panel-ok */` on score cell bg | Task 4 (`.rmc-score-cell` background line) |
| QA catalog IDs | Task 1 |
| Unit tests: 7 scenarios | Task 2 |

All spec requirements are covered. No placeholders remain.
