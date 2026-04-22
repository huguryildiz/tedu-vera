# Rankings Mobile Portrait Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current 3-column grid card on Rankings mobile portrait with a hybrid design: B-style layout (gradient rank bubble + score progress bar), AvgDonut for the average, avatar team-member chips, and per-criterion mini-bars.

**Architecture:** All changes are split between `RankingsPage.jsx` (JSX structure) and `rankings.css` (responsive styles). Three new `<td>` elements are added that are hidden on desktop via a global rule and only activated in the portrait media query. The `AvgDonut` component is reused as-is; `.team-member-*` classes from `components.css` are reused as-is.

**Tech Stack:** React 18, CSS Grid, `AvgDonut` (conic-gradient), `StudentNames` / `EntityMeta`, `lucide-react`

---

## File Map

| File | What changes |
|------|-------------|
| `src/admin/pages/RankingsPage.jsx` | Import `AvgDonut`; add `ranking-top-{n}` classes; swap `col-avg` content; add 3 mobile-only `<td>` cells |
| `src/styles/pages/rankings.css` | Desktop defaults (hide new cells + donut); full rewrite of portrait media query |

---

### Task 1: Import AvgDonut into RankingsPage

**Files:**
- Modify: `src/admin/pages/RankingsPage.jsx:1-18`

- [ ] **Step 1: Add the import**

Open `src/admin/pages/RankingsPage.jsx`. After line 17 (`import useCardSelection from "@/shared/hooks/useCardSelection";`), add:

```jsx
import AvgDonut from "./AvgDonut";
```

- [ ] **Step 2: Verify the file still builds**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors about `AvgDonut`.

---

### Task 2: Add `ranking-top-N` class to each row

**Files:**
- Modify: `src/admin/pages/RankingsPage.jsx:871`

The portrait CSS needs per-rank selectors for border color and rank bubble gradient. Add `ranking-top-{rank}` for ranks 1–3.

- [ ] **Step 1: Find the row**

In `RankingsPage.jsx`, locate this line (around line 871):

```jsx
<tr key={proj.id} data-card-selectable="" className={`mcard${rank <= 3 ? " ranking-highlight" : ""}`}>
```

- [ ] **Step 2: Add rank class**

Replace with:

```jsx
<tr
  key={proj.id}
  data-card-selectable=""
  className={[
    "mcard",
    rank <= 3 ? "ranking-highlight" : "",
    rank <= 3 ? `ranking-top-${rank}` : "",
  ].filter(Boolean).join(" ")}
>
```

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | tail -10
```

Expected: clean build.

---

### Task 3: Swap `col-avg` content — plain number + AvgDonut

**Files:**
- Modify: `src/admin/pages/RankingsPage.jsx:891-897`

On desktop the plain number stays visible; on portrait the donut replaces it (CSS controls visibility).

- [ ] **Step 1: Find the cell**

Locate this block (around lines 891–897):

```jsx
<td
  className="col-avg"
  data-label="Average"
  style={rank === 1 ? { color: "var(--accent)" } : undefined}
>
  {proj.totalAvg.toFixed(1)}
</td>
```

- [ ] **Step 2: Replace with dual-mode content**

```jsx
<td className="col-avg" data-label="Average">
  <span
    className="rk-avg-num"
    style={rank === 1 ? { color: "var(--accent)" } : undefined}
  >
    {proj.totalAvg.toFixed(1)}
  </span>
  <AvgDonut value={proj.totalAvg} max={100} />
</td>
```

Note: the `style` prop moves onto the `<span>` so the donut is never tinted by rank-1 accent.

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | tail -10
```

Expected: clean build.

---

### Task 4: Add three mobile-only `<td>` cells after `col-jurors`

**Files:**
- Modify: `src/admin/pages/RankingsPage.jsx:901-903`

These cells are `display: none` on desktop (added in Task 5) and gain `display: block` / grid-area in portrait CSS (Task 6).

- [ ] **Step 1: Find the closing of `col-jurors`**

Locate this line (around line 901):

```jsx
<td className="col-jurors" data-label="Jurors">{proj.count ?? "—"}</td>
```

- [ ] **Step 2: Insert three new cells immediately after it (before `</tr>`)**

```jsx
<td className="col-jurors" data-label="Jurors">{proj.count ?? "—"}</td>

{/* ── Mobile portrait only ── */}
<td className="rk-mobile-only rk-score-bar-cell" aria-hidden="true">
  <div className="rk-score-bar">
    <div
      className="rk-score-fill"
      style={{ width: `${Math.min(100, proj.totalAvg ?? 0)}%` }}
    />
  </div>
</td>

<td className="rk-mobile-only rk-criteria-cell" aria-hidden="true">
  <div className="rk-criteria">
    {criteriaConfig.map((c) => {
      const val = proj.avg?.[c.id];
      return (
        <div key={c.id} className="rk-criterion">
          <span className="rk-crit-name">{c.shortLabel || c.label}</span>
          <div className="rk-crit-bar">
            <div
              className="rk-crit-fill"
              style={{
                width: val != null && c.max > 0
                  ? `${Math.min(100, (val / c.max) * 100)}%`
                  : "0%",
                background: c.color || "var(--accent)",
              }}
            />
          </div>
          <span className="rk-crit-val">
            {val != null ? val.toFixed(0) : "—"}
          </span>
        </div>
      );
    })}
  </div>
</td>

<td className="rk-mobile-only rk-footer-cell" aria-hidden="true">
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
    <div className="rk-meta">
      {consensus && (
        <span className="rk-sigma">
          σ {consensus.sigma} · {consensus.min}–{consensus.max}
        </span>
      )}
      <span className="rk-jurors">{proj.count ?? "—"} jurors</span>
    </div>
  </div>
</td>
```

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | tail -10
```

Expected: clean build. Desktop should look identical (new cells are invisible — added next task).

---

### Task 5: Desktop CSS defaults

**Files:**
- Modify: `src/styles/pages/rankings.css`

Add rules outside any media query so the new cells and donut are hidden on desktop/landscape.

- [ ] **Step 1: Open `src/styles/pages/rankings.css`**

After the existing non-media-query block (after line 27, before the first `@media`), insert:

```css
/* ── Mobile-only cells: hidden everywhere except portrait ─────── */
.ranking-table .rk-mobile-only { display: none; }

/* ── Desktop col-avg: show plain number, hide donut ──────────── */
.ranking-table td.col-avg .avg-donut { display: none; }
```

- [ ] **Step 2: Build + eyeball desktop layout**

```bash
npm run dev
```

Open Rankings in desktop browser. Confirm table looks exactly the same as before.

---

### Task 6: Portrait CSS — full rewrite of media query

**Files:**
- Modify: `src/styles/pages/rankings.css:31-92`

Replace the existing `@media (max-width: 768px) and (orientation: portrait)` block entirely.

- [ ] **Step 1: Delete the old portrait block (lines 31–92)**

Remove everything from `@media (max-width: 768px) and (orientation: portrait) {` through its closing `}`.

- [ ] **Step 2: Insert the new block in its place**

```css
@media (max-width: 768px) and (orientation: portrait) {
  /* ── Table → card shell ── */
  .rankings-page .table-wrap {
    overflow: hidden;
    border: none;
    background: none;
    box-shadow: none;
    border-radius: 0;
  }

  .ranking-table { display: contents; }
  .ranking-table thead { display: none !important; }
  .ranking-table tbody { display: block; width: 100%; }

  /* ── Card grid ── */
  .ranking-table tbody tr {
    display: grid;
    grid-template-columns: 40px 1fr 52px;
    grid-template-rows: auto auto auto auto auto;
    grid-template-areas:
      "rank  title  donut"
      "bar   bar    bar  "
      "mem   mem    mem  "
      "crit  crit   crit "
      "foot  foot   foot ";
    width: 100%;
    margin-bottom: 8px;
    padding: 0;
    gap: 0;
    overflow: hidden;
    border-radius: 10px;
  }

  /* ── Base cell reset ── */
  .ranking-table td {
    display: block;
    border-bottom: none;
    padding: 0;
    box-sizing: border-box;
  }

  /* hide data-label pseudo in portrait (donut/chips carry their own labels) */
  .ranking-table td[data-label]::before { display: none; }

  /* ── Top-3 left border ── */
  .ranking-table tbody tr.ranking-top-1 { border-left: 3px solid #f59e0b; }
  .ranking-table tbody tr.ranking-top-2 { border-left: 3px solid #94a3b8; }
  .ranking-table tbody tr.ranking-top-3 { border-left: 3px solid #cd7c5a; }

  /* ── RANK column ── */
  .ranking-table td.col-rank {
    grid-area: rank;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 12px 0 0 8px;
  }

  /* Override MedalCell / ranking-medal sizing */
  .ranking-table td.col-rank .ranking-medal { font-size: 22px; line-height: 1; }
  .ranking-table td.col-rank .ranking-medal-cell { display: flex; align-items: center; justify-content: center; }

  /* Numeric rank (4+): bubble style */
  .ranking-table td.col-rank .ranking-num {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--bg-elevated, #21262d);
    border: 1.5px solid var(--border, #30363d);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 800;
    color: var(--text-primary);
    line-height: 1;
  }

  /* Top-3 rank bubble gradient */
  .ranking-table tbody tr.ranking-top-1 td.col-rank .ranking-medal-cell,
  .ranking-table tbody tr.ranking-top-2 td.col-rank .ranking-medal-cell,
  .ranking-table tbody tr.ranking-top-3 td.col-rank .ranking-medal-cell {
    width: 34px;
    height: 34px;
    border-radius: 50%;
  }

  .ranking-table tbody tr.ranking-top-1 td.col-rank .ranking-medal { font-size: 20px; }
  .ranking-table tbody tr.ranking-top-2 td.col-rank .ranking-medal { font-size: 20px; }
  .ranking-table tbody tr.ranking-top-3 td.col-rank .ranking-medal { font-size: 20px; }

  /* ── TITLE column ── */
  .ranking-table td.col-project {
    grid-area: title;
    padding: 12px 0 6px 10px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .ranking-table td.col-project .ranking-proj-no {
    display: inline-block;
    font-size: 9px;
    font-weight: 700;
    color: var(--accent);
    background: rgba(99, 102, 241, 0.1);
    border: 1px solid rgba(99, 102, 241, 0.22);
    border-radius: 4px;
    padding: 1px 5px;
    letter-spacing: 0.3px;
    margin-right: 0;
    width: fit-content;
  }

  /* Title text itself (text node after the span) */
  .ranking-table td.col-project {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.35;
  }

  /* ── DONUT column (col-avg) ── */
  .ranking-table td.col-avg {
    grid-area: donut;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 10px 10px 0 0;
  }

  /* Hide plain number, show donut */
  .ranking-table td.col-avg .rk-avg-num { display: none; }
  .ranking-table td.col-avg .avg-donut  { display: block; }

  /* Override donut size to 52px */
  .ranking-table td.col-avg .avg-donut,
  .ranking-table td.col-avg .avg-donut-fill {
    width: 52px;
    height: 52px;
  }

  /* ── SCORE BAR ── */
  .ranking-table td.rk-score-bar-cell {
    grid-area: bar;
    display: block;
    padding: 4px 12px 8px;
  }

  .rk-score-bar {
    height: 3px;
    background: var(--border, #21262d);
    border-radius: 3px;
    overflow: hidden;
  }

  .rk-score-fill {
    height: 100%;
    border-radius: 3px;
    background: linear-gradient(90deg, var(--accent), #7c3aed);
  }

  .ranking-table tbody tr.ranking-top-1 .rk-score-fill {
    background: linear-gradient(90deg, #f59e0b, #ef4444);
  }
  .ranking-table tbody tr.ranking-top-2 .rk-score-fill {
    background: linear-gradient(90deg, #94a3b8, #60a5fa);
  }
  .ranking-table tbody tr.ranking-top-3 .rk-score-fill {
    background: linear-gradient(90deg, #cd7c5a, #f59e0b);
  }

  /* ── TEAM MEMBERS ── */
  .ranking-table td.col-students {
    grid-area: mem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    padding: 0 12px 9px;
    font-size: inherit;
    color: inherit;
  }

  /* Hide desktop members label */
  .ranking-table td.col-students[data-label]::before { display: none; }

  /* ── CRITERIA MINI-BARS ── */
  .ranking-table td.rk-criteria-cell {
    grid-area: crit;
    display: block;
    border-top: 1px solid var(--border, #21262d);
    padding: 7px 12px 9px;
  }

  .rk-criteria {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .rk-criterion {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .rk-crit-name {
    font-size: 8.5px;
    color: var(--text-tertiary);
    width: 54px;
    flex-shrink: 0;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .rk-crit-bar {
    flex: 1;
    height: 3px;
    background: var(--border, #21262d);
    border-radius: 3px;
    overflow: hidden;
  }

  .rk-crit-fill {
    height: 100%;
    border-radius: 3px;
    /* background set inline via c.color */
  }

  .rk-crit-val {
    font-size: 9px;
    color: var(--text-secondary);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    width: 22px;
    text-align: right;
    flex-shrink: 0;
  }

  /* ── FOOTER ── */
  .ranking-table td.rk-footer-cell {
    grid-area: foot;
    display: block;
    border-top: 1px solid var(--border, #21262d);
    background: var(--bg-subtle, #0d1117);
    padding: 6px 12px 8px;
  }

  .rk-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .rk-consensus {
    font-size: 9px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 20px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .rk-consensus::before {
    content: "";
    width: 5px;
    height: 5px;
    border-radius: 50%;
    display: inline-block;
    flex-shrink: 0;
  }

  .rk-cons-high     { background: rgba(74,222,128,0.12); color: #4ade80; }
  .rk-cons-high::before  { background: #4ade80; }
  .rk-cons-moderate { background: rgba(96,165,250,0.12); color: #60a5fa; }
  .rk-cons-moderate::before { background: #60a5fa; }
  .rk-cons-disputed { background: rgba(248,113,113,0.12); color: #f87171; }
  .rk-cons-disputed::before { background: #f87171; }
  .rk-cons-none     { color: var(--text-tertiary); }

  .rk-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .rk-sigma {
    font-size: 9px;
    color: var(--text-tertiary);
    font-variant-numeric: tabular-nums;
  }

  .rk-jurors {
    font-size: 9px;
    color: var(--text-secondary);
    background: var(--bg-elevated, #21262d);
    border: 1px solid var(--border, #30363d);
    border-radius: 20px;
    padding: 2px 7px;
  }

  /* ── Hide cells that moved into footer ── */
  .ranking-table td.consensus-cell { display: none; }
  .ranking-table td.col-jurors     { display: none; }

  /* ── Hide heat cells ── */
  .ranking-table td.heat-cell { display: none; }
}
```

- [ ] **Step 3: Save and eyeball on mobile**

```bash
npm run dev
```

Open DevTools → iPhone SE portrait. Confirm:
- Rank bubble (left), title+group chip (center), AvgDonut (right)
- Score bar below
- Avatar team member chips
- Criteria bars (one row per criterion from `criteriaConfig`)
- Footer with consensus dot-badge, σ, juror count
- Top-1/2/3 have gold/silver/bronze left border

---

### Task 7: Visual QA checklist

- [ ] **Desktop**: table unchanged, no horizontal scroll introduced, all columns visible
- [ ] **Portrait rank 1**: gold border-left, 🥇 emoji, green donut (≥85), gold score bar gradient
- [ ] **Portrait rank 2**: silver border-left, 🥈, green donut, silver score bar gradient
- [ ] **Portrait rank 3**: bronze border-left, 🥉, donut color per score, bronze score bar gradient
- [ ] **Portrait rank 4+**: no colored border, numeric bubble, blue-purple bar
- [ ] **No score data** (`proj.totalAvg == null`): donut shows `—`, bar at 0%, criteria show `—`
- [ ] **No consensus**: footer consensus shows `—`, σ hidden
- [ ] **Run**: `npm run check:no-native-select` — should pass (no changes to selects)
- [ ] **Run**: `npm test -- --run` — should pass

---

### Task 8: Commit

- [ ] **Stage and commit**

```bash
git add src/admin/pages/RankingsPage.jsx src/styles/pages/rankings.css
git commit -m "feat(rankings): premium mobile portrait card — donut avg, avatar members, criteria bars"
```
