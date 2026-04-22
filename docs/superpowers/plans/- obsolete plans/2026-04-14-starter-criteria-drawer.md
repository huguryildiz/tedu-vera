# Starter Criteria Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `LayoutTemplate` trigger button to the Criteria page chip row that opens a 3-section drawer (Active Criteria summary, Copy from Existing Period, Starter Templates) letting the user populate a blank period with either a cloned set or a hardcoded 4-criterion template.

**Architecture:** Three-file change — new `StarterCriteriaDrawer.jsx` component with a module-level `STARTER_CRITERIA` constant; `criteria.css` gets `.crt-template-btn` and `scd-*` drawer-section classes; `CriteriaPage.jsx` gets the missing count/weight chips from Stream 1, a new state variable, the trigger button, and the drawer instance. No API changes. No DB migrations.

**Tech Stack:** React 18, lucide-react icons, `@testing-library/react` + vitest for tests, CSS custom properties from `variables.css`.

---

## File Map

| File | Change |
|------|--------|
| `src/test/qa-catalog.json` | **Modify** — append 7 new `criteria.starter.*` test IDs |
| `src/admin/__tests__/starterCriteria.test.jsx` | **Create** — data-integrity + component tests |
| `src/admin/drawers/StarterCriteriaDrawer.jsx` | **Create** — drawer component + `STARTER_CRITERIA` constant |
| `src/styles/pages/criteria.css` | **Modify** — append `.crt-template-btn` + `scd-*` classes after line 260 |
| `src/admin/pages/CriteriaPage.jsx` | **Modify** — add missing count/weight chips, `LayoutTemplate` import, `starterDrawerOpen` state, trigger button, drawer instance |

---

## Task 1: Register test IDs in `qa-catalog.json`

**Files:**
- Modify: `src/test/qa-catalog.json`

Tests using `qaTest()` must have their ID pre-registered in the catalog or the helper throws. This task only touches the catalog — no code yet.

- [ ] **Step 1: Append 7 new entries to the end of `src/test/qa-catalog.json`**

Find the last `}` before the closing `]` of the array. Insert the following 7 objects after the last existing entry (before `]`):

```json
  ,
  {
    "id": "criteria.starter.01",
    "module": "Criteria / Starter Drawer",
    "area": "Starter Criteria — Data Integrity",
    "story": "STARTER_CRITERIA constant",
    "scenario": "has exactly 4 entries",
    "whyItMatters": "Template must always load a full 4-criterion set.",
    "risk": "Wrong count would produce a broken or oversized draft.",
    "coverageStrength": "Strong",
    "severity": "normal"
  },
  {
    "id": "criteria.starter.02",
    "module": "Criteria / Starter Drawer",
    "area": "Starter Criteria — Data Integrity",
    "story": "STARTER_CRITERIA constant",
    "scenario": "max values sum to exactly 100",
    "whyItMatters": "The template is advertised as '100 pts total'; incorrect totals break the weight bar.",
    "risk": "Draft weight would not equal 100, triggering a validation warning.",
    "coverageStrength": "Strong",
    "severity": "normal"
  },
  {
    "id": "criteria.starter.03",
    "module": "Criteria / Starter Drawer",
    "area": "Starter Criteria — Data Integrity",
    "story": "STARTER_CRITERIA constant",
    "scenario": "every criterion has all required keys",
    "whyItMatters": "Missing keys cause silent rendering failures in the criterion editor.",
    "risk": "Editor drawer would crash or show empty fields.",
    "coverageStrength": "Strong",
    "severity": "normal"
  },
  {
    "id": "criteria.starter.04",
    "module": "Criteria / Starter Drawer",
    "area": "Starter Criteria — Data Integrity",
    "story": "STARTER_CRITERIA constant",
    "scenario": "every criterion rubric has exactly 4 bands with correct level names",
    "whyItMatters": "The rubric band editor assumes exactly 4 named levels.",
    "risk": "Missing or mis-named levels would silently produce a broken rubric.",
    "coverageStrength": "Strong",
    "severity": "normal"
  },
  {
    "id": "criteria.starter.05",
    "module": "Criteria / Starter Drawer",
    "area": "Starter Criteria — Component",
    "story": "Use Template button",
    "scenario": "calls onApplyTemplate with STARTER_CRITERIA when clicked",
    "whyItMatters": "The callback is how CriteriaPage receives and applies the template.",
    "risk": "Wrong or empty argument means no criteria would be loaded.",
    "coverageStrength": "Strong",
    "severity": "normal"
  },
  {
    "id": "criteria.starter.06",
    "module": "Criteria / Starter Drawer",
    "area": "Starter Criteria — Component",
    "story": "Copy & Use button",
    "scenario": "calls onCopyFromPeriod with the selected period id when clicked",
    "whyItMatters": "This is the only way the page knows which period to clone from.",
    "risk": "Wrong id or no call means the clone action never fires.",
    "coverageStrength": "Strong",
    "severity": "normal"
  },
  {
    "id": "criteria.starter.07",
    "module": "Criteria / Starter Drawer",
    "area": "Starter Criteria — Component",
    "story": "Overwrite warning",
    "scenario": "shows FbAlert warning when draftCriteria is non-empty",
    "whyItMatters": "Users with existing criteria must see the replace warning before committing.",
    "risk": "Silent overwrite would destroy carefully configured criteria.",
    "coverageStrength": "Strong",
    "severity": "normal"
  }
```

- [ ] **Step 2: Verify JSON is valid**

```bash
node -e "require('./src/test/qa-catalog.json'); console.log('OK')"
```

Expected output: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/test/qa-catalog.json
git commit -m "test(criteria): register criteria.starter.01-07 test IDs in qa-catalog"
```

---

## Task 2: Write failing tests + create minimal `StarterCriteriaDrawer.jsx`

**Files:**
- Create: `src/admin/__tests__/starterCriteria.test.jsx`
- Create: `src/admin/drawers/StarterCriteriaDrawer.jsx` (stub — just the constant + a minimal export)

### Step 1: Write the test file

- [ ] **Step 1a: Create `src/admin/__tests__/starterCriteria.test.jsx`**

```jsx
// src/admin/__tests__/starterCriteria.test.jsx
// ============================================================
// StarterCriteriaDrawer — data integrity + component tests
// ============================================================

import { describe, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { qaTest } from "../../test/qaTest.js";
import StarterCriteriaDrawer, {
  STARTER_CRITERIA,
} from "../drawers/StarterCriteriaDrawer.jsx";

// ── Mock Drawer so tests don't need the full UI shell ──────

vi.mock("@/shared/ui/Drawer", () => ({
  default: ({ open, children }) =>
    open ? <div data-testid="drawer">{children}</div> : null,
}));

vi.mock("@/shared/ui/FbAlert", () => ({
  default: ({ children, variant }) => (
    <div data-testid={`fbalert-${variant}`}>{children}</div>
  ),
}));

vi.mock("@/shared/ui/CustomSelect", () => ({
  default: ({ value, onChange, options, disabled, placeholder }) => (
    <select
      data-testid="custom-select"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {(options || []).map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

// ── REQUIRED_KEYS ─────────────────────────────────────────

const REQUIRED_KEYS = ["key", "label", "shortLabel", "color", "max", "blurb", "outcomes", "rubric"];
const RUBRIC_LEVELS = ["Excellent", "Good", "Developing", "Insufficient"];

// ── Data integrity ─────────────────────────────────────────

describe("STARTER_CRITERIA — data integrity", () => {
  qaTest("criteria.starter.01", () => {
    expect(STARTER_CRITERIA).toHaveLength(4);
  });

  qaTest("criteria.starter.02", () => {
    const total = STARTER_CRITERIA.reduce((sum, c) => sum + c.max, 0);
    expect(total).toBe(100);
  });

  qaTest("criteria.starter.03", () => {
    for (const criterion of STARTER_CRITERIA) {
      for (const key of REQUIRED_KEYS) {
        expect(criterion).toHaveProperty(key);
      }
    }
  });

  qaTest("criteria.starter.04", () => {
    for (const criterion of STARTER_CRITERIA) {
      expect(criterion.rubric).toHaveLength(4);
      const levels = criterion.rubric.map((b) => b.level);
      for (const expected of RUBRIC_LEVELS) {
        expect(levels).toContain(expected);
      }
    }
  });
});

// ── Component — Use Template ───────────────────────────────

describe("StarterCriteriaDrawer — Use Template", () => {
  qaTest("criteria.starter.05", () => {
    const onApplyTemplate = vi.fn();
    render(
      <StarterCriteriaDrawer
        open={true}
        onClose={vi.fn()}
        draftCriteria={[]}
        otherPeriods={[]}
        isLocked={false}
        onApplyTemplate={onApplyTemplate}
        onCopyFromPeriod={vi.fn()}
      />
    );

    const useBtn = screen.getByRole("button", { name: /use template/i });
    fireEvent.click(useBtn);

    expect(onApplyTemplate).toHaveBeenCalledOnce();
    expect(onApplyTemplate).toHaveBeenCalledWith(STARTER_CRITERIA);
  });
});

// ── Component — Copy & Use ─────────────────────────────────

describe("StarterCriteriaDrawer — Copy & Use", () => {
  qaTest("criteria.starter.06", () => {
    const onCopyFromPeriod = vi.fn();
    const periods = [{ id: "period-abc", name: "Spring 2026", criteria_count: 4 }];

    render(
      <StarterCriteriaDrawer
        open={true}
        onClose={vi.fn()}
        draftCriteria={[]}
        otherPeriods={periods}
        isLocked={false}
        onApplyTemplate={vi.fn()}
        onCopyFromPeriod={onCopyFromPeriod}
      />
    );

    // Select a period via the mocked CustomSelect
    const select = screen.getByTestId("custom-select");
    fireEvent.change(select, { target: { value: "period-abc" } });

    const copyBtn = screen.getByRole("button", { name: /copy & use/i });
    fireEvent.click(copyBtn);

    expect(onCopyFromPeriod).toHaveBeenCalledOnce();
    expect(onCopyFromPeriod).toHaveBeenCalledWith("period-abc");
  });
});

// ── Component — Overwrite warning ─────────────────────────

describe("StarterCriteriaDrawer — overwrite warning", () => {
  qaTest("criteria.starter.07", () => {
    const existingCriteria = [
      { key: "existing-01", label: "Test", shortLabel: "T", color: "#000", max: 100, blurb: "", outcomes: [], rubric: [] },
    ];

    render(
      <StarterCriteriaDrawer
        open={true}
        onClose={vi.fn()}
        draftCriteria={existingCriteria}
        otherPeriods={[]}
        isLocked={false}
        onApplyTemplate={vi.fn()}
        onCopyFromPeriod={vi.fn()}
      />
    );

    // Warning should appear (at least once — it renders in both Copy and Template sections)
    const warnings = screen.getAllByTestId("fbalert-warning");
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0]).toHaveTextContent(/replace your current criteria/i);
  });
});
```

- [ ] **Step 1b: Run tests — confirm they fail**

```bash
npm test -- --run src/admin/__tests__/starterCriteria.test.jsx
```

Expected: all 7 tests **fail** (module not found or export not found).

---

- [ ] **Step 2: Create minimal `src/admin/drawers/StarterCriteriaDrawer.jsx`** (constant only — enough for data tests to pass)

```jsx
// src/admin/drawers/StarterCriteriaDrawer.jsx

export const STARTER_CRITERIA = [
  {
    key:        "written-communication",
    label:      "Written Communication",
    shortLabel: "Written Comm",
    color:      "#3b82f6",
    max:        30,
    blurb: "Evaluates how effectively the team communicates their project in written and visual form — including layout, information hierarchy, figure quality, and clarity of technical content for a mixed audience.",
    outcomes:   [],
    rubric: [
      { level: "Excellent",    min: "27", max: "30", description: "Poster layout is intuitive with clear information flow. Visuals are fully labelled and high quality. Technical content is presented in a way accessible to both technical and non-technical readers." },
      { level: "Good",         min: "21", max: "26", description: "Layout is mostly logical. Visuals are readable with minor gaps. Technical content is largely clear with small areas for improvement." },
      { level: "Developing",   min: "13", max: "20", description: "Occasional gaps in information flow. Some visuals are missing labels or captions. Technical content is only partially communicated." },
      { level: "Insufficient", min: "0",  max: "12", description: "Confusing layout. Low-quality or unlabelled visuals. Technical content is unclear or missing." },
    ],
  },
  {
    key:        "oral-communication",
    label:      "Oral Communication",
    shortLabel: "Oral Comm",
    color:      "#8b5cf6",
    max:        30,
    blurb: "Evaluates the team's ability to present their work verbally and respond to questions from jurors with varying technical backgrounds. Audience adaptation — adjusting depth and vocabulary based on who is asking — is a key factor.",
    outcomes:   [],
    rubric: [
      { level: "Excellent",    min: "27", max: "30", description: "Presentation is consciously adapted for both technical and non-technical jury members. Q&A responses are accurate, clear, and audience-appropriate." },
      { level: "Good",         min: "21", max: "26", description: "Presentation is mostly clear and well-paced. Most questions answered correctly. Audience adaptation is generally evident." },
      { level: "Developing",   min: "13", max: "20", description: "Understandable but inconsistent. Limited audience adaptation. Time management or Q&A depth needs improvement." },
      { level: "Insufficient", min: "0",  max: "12", description: "Unclear or disorganised presentation. Most questions answered incorrectly or not at all." },
    ],
  },
  {
    key:        "technical-content",
    label:      "Technical Content",
    shortLabel: "Technical",
    color:      "#f59e0b",
    max:        30,
    blurb: "Evaluates the depth, correctness, and originality of the engineering work itself — independent of how well it is communicated. Assesses whether the team has applied appropriate knowledge, justified design decisions, and demonstrated real technical mastery.",
    outcomes:   [],
    rubric: [
      { level: "Excellent",    min: "27", max: "30", description: "Problem is clearly defined with strong motivation. Design decisions are well-justified with engineering depth. Originality and mastery of relevant tools or methods are evident." },
      { level: "Good",         min: "21", max: "26", description: "Design is mostly clear and technically justified. Engineering decisions are largely supported." },
      { level: "Developing",   min: "13", max: "20", description: "Problem is stated but motivation or technical justification is insufficient." },
      { level: "Insufficient", min: "0",  max: "12", description: "Vague problem definition and unjustified decisions. Superficial technical content." },
    ],
  },
  {
    key:        "teamwork",
    label:      "Teamwork",
    shortLabel: "Teamwork",
    color:      "#22c55e",
    max:        10,
    blurb: "Evaluates visible evidence of equal and effective team participation during the evaluation session, as well as the group's professional and ethical conduct in interacting with jurors.",
    outcomes:   [],
    rubric: [
      { level: "Excellent",    min: "9", max: "10", description: "All members participate actively and equally. Professional and ethical conduct observed throughout." },
      { level: "Good",         min: "7", max: "8",  description: "Most members contribute. Minor knowledge gaps. Professionalism mostly observed." },
      { level: "Developing",   min: "4", max: "6",  description: "Uneven participation. Some members are passive or unprepared." },
      { level: "Insufficient", min: "0", max: "3",  description: "Very low participation or dominated by one person. Lack of professionalism observed." },
    ],
  },
];

export default function StarterCriteriaDrawer() {
  return null;
}
```

- [ ] **Step 3: Run data-integrity tests — confirm they pass**

```bash
npm test -- --run src/admin/__tests__/starterCriteria.test.jsx
```

Expected: `criteria.starter.01` through `criteria.starter.04` **pass**; `criteria.starter.05`–`criteria.starter.07` still fail (drawer renders null).

- [ ] **Step 4: Commit the stub**

```bash
git add src/admin/__tests__/starterCriteria.test.jsx src/admin/drawers/StarterCriteriaDrawer.jsx
git commit -m "test(criteria): add starterCriteria tests + STARTER_CRITERIA constant stub"
```

---

## Task 3: Implement full `StarterCriteriaDrawer.jsx`

**Files:**
- Modify: `src/admin/drawers/StarterCriteriaDrawer.jsx`

The component replaces the stub default export. The `STARTER_CRITERIA` export stays unchanged.

- [ ] **Step 1: Replace the default export with the full component**

Replace the entire file content with:

```jsx
// src/admin/drawers/StarterCriteriaDrawer.jsx

import { useState } from "react";
import { LayoutTemplate } from "lucide-react";
import Drawer from "@/shared/ui/Drawer";
import FbAlert from "@/shared/ui/FbAlert";
import CustomSelect from "@/shared/ui/CustomSelect";

// ── Starter template data ─────────────────────────────────

export const STARTER_CRITERIA = [
  {
    key:        "written-communication",
    label:      "Written Communication",
    shortLabel: "Written Comm",
    color:      "#3b82f6",
    max:        30,
    blurb: "Evaluates how effectively the team communicates their project in written and visual form — including layout, information hierarchy, figure quality, and clarity of technical content for a mixed audience.",
    outcomes:   [],
    rubric: [
      { level: "Excellent",    min: "27", max: "30", description: "Poster layout is intuitive with clear information flow. Visuals are fully labelled and high quality. Technical content is presented in a way accessible to both technical and non-technical readers." },
      { level: "Good",         min: "21", max: "26", description: "Layout is mostly logical. Visuals are readable with minor gaps. Technical content is largely clear with small areas for improvement." },
      { level: "Developing",   min: "13", max: "20", description: "Occasional gaps in information flow. Some visuals are missing labels or captions. Technical content is only partially communicated." },
      { level: "Insufficient", min: "0",  max: "12", description: "Confusing layout. Low-quality or unlabelled visuals. Technical content is unclear or missing." },
    ],
  },
  {
    key:        "oral-communication",
    label:      "Oral Communication",
    shortLabel: "Oral Comm",
    color:      "#8b5cf6",
    max:        30,
    blurb: "Evaluates the team's ability to present their work verbally and respond to questions from jurors with varying technical backgrounds. Audience adaptation — adjusting depth and vocabulary based on who is asking — is a key factor.",
    outcomes:   [],
    rubric: [
      { level: "Excellent",    min: "27", max: "30", description: "Presentation is consciously adapted for both technical and non-technical jury members. Q&A responses are accurate, clear, and audience-appropriate." },
      { level: "Good",         min: "21", max: "26", description: "Presentation is mostly clear and well-paced. Most questions answered correctly. Audience adaptation is generally evident." },
      { level: "Developing",   min: "13", max: "20", description: "Understandable but inconsistent. Limited audience adaptation. Time management or Q&A depth needs improvement." },
      { level: "Insufficient", min: "0",  max: "12", description: "Unclear or disorganised presentation. Most questions answered incorrectly or not at all." },
    ],
  },
  {
    key:        "technical-content",
    label:      "Technical Content",
    shortLabel: "Technical",
    color:      "#f59e0b",
    max:        30,
    blurb: "Evaluates the depth, correctness, and originality of the engineering work itself — independent of how well it is communicated. Assesses whether the team has applied appropriate knowledge, justified design decisions, and demonstrated real technical mastery.",
    outcomes:   [],
    rubric: [
      { level: "Excellent",    min: "27", max: "30", description: "Problem is clearly defined with strong motivation. Design decisions are well-justified with engineering depth. Originality and mastery of relevant tools or methods are evident." },
      { level: "Good",         min: "21", max: "26", description: "Design is mostly clear and technically justified. Engineering decisions are largely supported." },
      { level: "Developing",   min: "13", max: "20", description: "Problem is stated but motivation or technical justification is insufficient." },
      { level: "Insufficient", min: "0",  max: "12", description: "Vague problem definition and unjustified decisions. Superficial technical content." },
    ],
  },
  {
    key:        "teamwork",
    label:      "Teamwork",
    shortLabel: "Teamwork",
    color:      "#22c55e",
    max:        10,
    blurb: "Evaluates visible evidence of equal and effective team participation during the evaluation session, as well as the group's professional and ethical conduct in interacting with jurors.",
    outcomes:   [],
    rubric: [
      { level: "Excellent",    min: "9", max: "10", description: "All members participate actively and equally. Professional and ethical conduct observed throughout." },
      { level: "Good",         min: "7", max: "8",  description: "Most members contribute. Minor knowledge gaps. Professionalism mostly observed." },
      { level: "Developing",   min: "4", max: "6",  description: "Uneven participation. Some members are passive or unprepared." },
      { level: "Insufficient", min: "0", max: "3",  description: "Very low participation or dominated by one person. Lack of professionalism observed." },
    ],
  },
];

// ── Component ─────────────────────────────────────────────

export default function StarterCriteriaDrawer({
  open,
  onClose,
  draftCriteria,
  otherPeriods,
  isLocked,
  onApplyTemplate,
  onCopyFromPeriod,
}) {
  const [selectedPeriodId, setSelectedPeriodId] = useState("");

  const hasExisting = draftCriteria.length > 0;
  const totalMax = draftCriteria.reduce((s, c) => s + (Number(c.max) || 0), 0);
  const isBalanced = hasExisting && totalMax === 100;

  const periodOptions = otherPeriods.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  function handleCopy() {
    onCopyFromPeriod(selectedPeriodId);
  }

  function handleUseTemplate() {
    onApplyTemplate(STARTER_CRITERIA);
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Load Template"
      icon={(stroke) => <LayoutTemplate size={17} stroke={stroke} strokeWidth={2} />}
    >
      {/* ── Section 1: Active Criteria ──────────────────── */}
      <div className="scd-section">
        <div className="scd-section-label">Active Criteria</div>
        {hasExisting ? (
          <div className="scd-chips-row">
            <span className="crt-chip neutral">{draftCriteria.length} {draftCriteria.length === 1 ? "criterion" : "criteria"}</span>
            <span className={`crt-chip ${isBalanced ? "success" : "warning"}`}>
              {totalMax} {isBalanced ? "pts · balanced" : "/ 100 pts"}
            </span>
          </div>
        ) : (
          <p className="scd-empty-hint">No criteria defined for this period.</p>
        )}
      </div>

      {/* ── Section 2: Copy from Existing Period ────────── */}
      <div className="scd-section">
        <div className="scd-section-label">Copy from Existing Period</div>
        <CustomSelect
          value={selectedPeriodId}
          onChange={setSelectedPeriodId}
          options={periodOptions}
          disabled={otherPeriods.length === 0 || isLocked}
          placeholder={otherPeriods.length === 0 ? "No other periods available" : "Select a period…"}
        />
        <div className="scd-action-row">
          {hasExisting && (
            <FbAlert variant="warning">This will replace your current criteria.</FbAlert>
          )}
          <button
            className="scd-use-btn"
            onClick={handleCopy}
            disabled={!selectedPeriodId || isLocked}
          >
            Copy &amp; Use
          </button>
        </div>
      </div>

      {/* ── Section 3: Starter Templates ────────────────── */}
      <div className="scd-section">
        <div className="scd-section-label">Starter Templates</div>
        <div className="scd-template-card">
          <div className="scd-template-info">
            <div className="scd-template-name">Standard Evaluation</div>
            <div className="scd-template-meta">4 criteria · 100 pts total</div>
          </div>
          <div className="scd-action-row">
            {hasExisting && (
              <FbAlert variant="warning">This will replace your current criteria.</FbAlert>
            )}
            <button
              className="scd-use-btn"
              onClick={handleUseTemplate}
              disabled={isLocked}
            >
              Use Template
            </button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
```

- [ ] **Step 2: Run all tests — confirm all 7 pass**

```bash
npm test -- --run src/admin/__tests__/starterCriteria.test.jsx
```

Expected: all 7 tests **pass**.

- [ ] **Step 3: Run the full test suite to confirm no regressions**

```bash
npm test -- --run
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/admin/drawers/StarterCriteriaDrawer.jsx
git commit -m "feat(criteria): implement StarterCriteriaDrawer with 3-section layout and STARTER_CRITERIA constant"
```

---

## Task 4: Add CSS to `criteria.css`

**Files:**
- Modify: `src/styles/pages/criteria.css`

All new rules append after line 260 (the `.dark-mode .crt-period-badge` block). The next block after line 260 is `.dark-mode .crt-table-card` — insert before it.

- [ ] **Step 1: Insert `.crt-template-btn` and `scd-*` classes**

After the closing `}` of `.dark-mode .crt-period-badge` (line 260) and before `.dark-mode .crt-table-card`, insert:

```css
/* ── Template trigger button ──────────────────────────────── */

.crt-template-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface-1);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  flex-shrink: 0;
}

.crt-template-btn:hover {
  background: var(--surface-2);
  border-color: var(--accent);
  color: var(--accent);
}

.crt-template-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

/* ── Starter Criteria Drawer ─────────────────────────────── */

.scd-section {
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
}

.scd-section:last-child {
  border-bottom: none;
}

.scd-section-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 14px;
}

.scd-chips-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.scd-empty-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.scd-template-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface-1);
}

.scd-template-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.scd-template-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.scd-template-meta {
  font-size: 11px;
  color: var(--text-secondary);
}

.scd-action-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
}

.scd-use-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid rgba(59, 130, 246, 0.3);
  background: rgba(59, 130, 246, 0.06);
  color: var(--accent);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  align-self: flex-start;
}

.scd-use-btn:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.12);
  border-color: rgba(59, 130, 246, 0.5);
}

.scd-use-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles/pages/criteria.css
git commit -m "feat(criteria): add crt-template-btn and scd-* drawer section CSS classes"
```

---

## Task 5: Wire up `CriteriaPage.jsx`

**Files:**
- Modify: `src/admin/pages/CriteriaPage.jsx`

This task adds the missing count/weight chips from Stream 1, the new `LayoutTemplate` import, `StarterCriteriaDrawer` import, `starterDrawerOpen` state, the trigger button in the chip row, and the drawer instance.

**Current state of the file to be aware of:**
- Lines 4–20: lucide-react imports — `Calendar` is present but `ListChecks`, `CheckCircle2`, `AlertTriangle`, `LayoutTemplate` are missing
- Line 106: first state variable (`editingIndex`) — add `starterDrawerOpen` after it
- Lines 374–391: chip row — has `crt-period-badge` + `crt-add-btn` but missing count/weight chips and trigger button
- Lines 728–739: `EditSingleCriterionDrawer` — add `StarterCriteriaDrawer` after it (before closing `</div>` at line 740)

- [ ] **Step 1: Expand the lucide-react import block**

Find the current import block (lines 4–20):

```js
import {
  Lock,
  Plus,
  ClipboardList,
  Calendar,
  Pencil,
  Trash2,
  MoreVertical,
  ClipboardX,
  AlertCircle,
  Icon,
  Copy,
  MoveUp,
  MoveDown,
  Info,
} from "lucide-react";
```

Replace with:

```js
import {
  Lock,
  Plus,
  ClipboardList,
  ListChecks,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  LayoutTemplate,
  Pencil,
  Trash2,
  MoreVertical,
  ClipboardX,
  AlertCircle,
  Icon,
  Copy,
  MoveUp,
  MoveDown,
  Info,
} from "lucide-react";
```

- [ ] **Step 2: Add `StarterCriteriaDrawer` import**

After the existing `EditSingleCriterionDrawer` import line:

```js
import EditSingleCriterionDrawer from "@/admin/drawers/EditSingleCriterionDrawer";
```

Add:

```js
import StarterCriteriaDrawer from "@/admin/drawers/StarterCriteriaDrawer";
```

- [ ] **Step 3: Add `starterDrawerOpen` state**

Find the first state variable declaration inside `CriteriaPage()` — it will look like:

```js
  const [editingIndex, setEditingIndex] = useState(null);
```

Add the new state variable on the next line:

```js
  const [starterDrawerOpen, setStarterDrawerOpen] = useState(false);
```

- [ ] **Step 4: Replace the chip row JSX with the complete version**

Find this block (lines 374–391 in the current file):

```jsx
          <div className="crt-table-card-header">
            <div className="crt-table-card-title">Active Criteria</div>
            <div className="crt-chips-row">
              {periods.viewPeriodLabel && (
                <div className="crt-period-badge">
                  <Calendar size={11} strokeWidth={1.75} />
                  {periods.viewPeriodLabel}
                </div>
              )}
              <button
                className="crt-add-btn"
                onClick={() => setEditingIndex(-1)}
                disabled={isLocked}
              >
                <Plus size={13} strokeWidth={2.2} />
                Add Criterion
              </button>
            </div>
          </div>
```

Replace with:

```jsx
          <div className="crt-table-card-header">
            <div className="crt-table-card-title">Active Criteria</div>
            <div className="crt-chips-row">
              {draftCriteria.length > 0 && (
                <div className="crt-chip neutral">
                  <ListChecks size={11} strokeWidth={2} />
                  {draftCriteria.length} {draftCriteria.length === 1 ? "criterion" : "criteria"}
                </div>
              )}
              {draftCriteria.length > 0 && (
                periods.draftTotal === 100 ? (
                  <div className="crt-chip success">
                    <CheckCircle2 size={11} strokeWidth={2} />
                    {periods.draftTotal} pts · balanced
                  </div>
                ) : (
                  <div className="crt-chip warning">
                    <AlertTriangle size={11} strokeWidth={2} />
                    {periods.draftTotal} / 100 pts
                  </div>
                )
              )}
              {periods.viewPeriodLabel && (
                <div className="crt-period-badge">
                  <Calendar size={11} strokeWidth={1.75} />
                  {periods.viewPeriodLabel}
                </div>
              )}
              <button
                className="crt-template-btn"
                onClick={() => setStarterDrawerOpen(true)}
                disabled={isLocked}
              >
                <LayoutTemplate size={13} strokeWidth={1.9} />
              </button>
              <button
                className="crt-add-btn"
                onClick={() => setEditingIndex(-1)}
                disabled={isLocked}
              >
                <Plus size={13} strokeWidth={2.2} />
                Add Criterion
              </button>
            </div>
          </div>
```

- [ ] **Step 5: Add `StarterCriteriaDrawer` instance after `EditSingleCriterionDrawer`**

Find this block (the EditSingleCriterionDrawer instance):

```jsx
      {/* Single-criterion editor drawer */}
      <EditSingleCriterionDrawer
        open={editingIndex !== null}
        onClose={closeEditor}
        period={{ id: periods.viewPeriodId, name: periods.viewPeriodLabel }}
        criterion={editingIndex >= 0 ? draftCriteria[editingIndex] : null}
        editIndex={editingIndex}
        criteriaConfig={draftCriteria}
        outcomeConfig={outcomeConfig}
        onSave={handleSave}
        disabled={loadingCount > 0}
        isLocked={isLocked}
      />
    </div>
```

Replace with:

```jsx
      {/* Single-criterion editor drawer */}
      <EditSingleCriterionDrawer
        open={editingIndex !== null}
        onClose={closeEditor}
        period={{ id: periods.viewPeriodId, name: periods.viewPeriodLabel }}
        criterion={editingIndex >= 0 ? draftCriteria[editingIndex] : null}
        editIndex={editingIndex}
        criteriaConfig={draftCriteria}
        outcomeConfig={outcomeConfig}
        onSave={handleSave}
        disabled={loadingCount > 0}
        isLocked={isLocked}
      />
      <StarterCriteriaDrawer
        open={starterDrawerOpen}
        onClose={() => setStarterDrawerOpen(false)}
        draftCriteria={draftCriteria}
        otherPeriods={otherPeriods}
        isLocked={isLocked}
        onApplyTemplate={(criteria) => {
          periods.updateDraft(criteria);
          setStarterDrawerOpen(false);
        }}
        onCopyFromPeriod={(periodId) => {
          setStarterDrawerOpen(false);
          handleClone(periodId);
        }}
      />
    </div>
```

- [ ] **Step 6: Run the native-select check**

```bash
npm run check:no-native-select
```

Expected: passes with no errors.

- [ ] **Step 7: Run the full test suite**

```bash
npm test -- --run
```

Expected: exits 0.

- [ ] **Step 8: Commit**

```bash
git add src/admin/pages/CriteriaPage.jsx
git commit -m "feat(criteria): wire StarterCriteriaDrawer — chip row chips, trigger button, drawer instance"
```

---

## Task 6: Build check

**Files:** None modified.

- [ ] **Step 1: Run production build**

```bash
npm run build
```

Expected: exits 0 with no TypeScript / Vite errors.

- [ ] **Step 2: Start dev server and verify visually**

```bash
npm run dev
```

Open `http://localhost:5173`, navigate to Admin → Criteria, and select a period.

**Verify each chip row state:**

| Scenario | Expected chip row |
|---|---|
| Period selected, criteria exist, total = 100 | `[N criteria]` `[100 pts · balanced]` (green) `[Period Name]` `[☰]` `[+ Add Criterion]` |
| Period selected, criteria exist, total ≠ 100 | `[N criteria]` `[N / 100 pts]` (amber) `[Period Name]` `[☰]` `[+ Add Criterion]` |
| Period selected, no criteria | `[Period Name]` `[☰]` `[+ Add Criterion]` (count/weight chips hidden) |

**Verify the drawer:**

1. Click `☰` — drawer opens with title "Load Template" and a `LayoutTemplate` icon.
2. Section 1 (Active Criteria): shows chips when criteria exist, muted hint when empty.
3. Section 2 (Copy from Existing Period): CustomSelect visible; "Copy & Use" disabled until a period is selected.
4. Section 3 (Starter Templates): "Standard Evaluation" card with "Use Template" button.
5. When criteria already exist, both sections show the "This will replace your current criteria." warning banner.
6. Click "Use Template" → drawer closes, criteria replaced with the 4 STARTER_CRITERIA items, WeightBudgetBar shows 100 pts.

---

## Spec Coverage Self-Review

| Spec Requirement | Covered in Task |
|---|---|
| `LayoutTemplate` trigger button in chip row | Task 5 Step 4 |
| `.crt-template-btn` CSS | Task 4 Step 1 |
| Trigger disabled when `isLocked` | Task 5 Step 4 |
| `starterDrawerOpen` state | Task 5 Step 3 |
| `StarterCriteriaDrawer` props: `open`, `onClose`, `draftCriteria`, `otherPeriods`, `isLocked`, `onApplyTemplate`, `onCopyFromPeriod` | Task 3 Step 1 |
| Section 1 — Active Criteria chips (count + weight) + empty hint | Task 3 Step 1 |
| Section 2 — CustomSelect (not native `<select>`) | Task 3 Step 1 |
| Section 2 — Copy & Use disabled when no period selected | Task 3 Step 1 |
| Section 2 — empty state when `otherPeriods.length === 0` | Task 3 Step 1 |
| Section 2 — overwrite warning when criteria exist | Task 3 Step 1 |
| Section 3 — "Standard Evaluation" card | Task 3 Step 1 |
| Section 3 — overwrite warning when criteria exist | Task 3 Step 1 |
| Section 3 — Use Template calls `onApplyTemplate(STARTER_CRITERIA)` | Task 3 Step 1 |
| `STARTER_CRITERIA` — 4 entries, max sum = 100 | Task 2 Step 2 |
| `STARTER_CRITERIA` — correct colors from `CRITERION_COLORS` | Task 2 Step 2 |
| `STARTER_CRITERIA` — no MÜDEK branding in labels/descriptions | Task 2 Step 2 |
| Chip row: count + weight + period badge chips (missing from Stream 1) | Task 5 Step 4 |
| `scd-*` CSS classes | Task 4 Step 1 |
| No API changes, no DB migrations | N/A — confirmed by plan scope |
| `handleClone` and empty-state card unchanged | Task 5 (only adds wiring, does not touch clone logic or empty-state) |
