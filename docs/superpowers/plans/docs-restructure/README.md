# Docs Restructure & Rewrite Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan session-by-session. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `docs/` into a premium-SaaS documentation tree — accurate top-level index, working test guide, clean architecture/operations/decisions layout, and a single source of truth for mockups. Move Claude-only scratch space out of `docs/`.

**Architecture:** Four sequential sessions, each self-contained and independently committable. Session 1 is low-risk reorganization (file moves + broken-index fix). Session 2 rewrites the stale test guide against the actual test realities (qa-catalog, qaTest, S33 coverage). Session 3 extracts the "Architectural Decisions" block from `CLAUDE.md` into per-decision ADR files. Session 4 adds operations/runbooks for jury-day incident response.

**Tech Stack:** Markdown (CommonMark), internal relative links, no build tooling. Validation via `npx markdown-link-check` and manual review.

**Scope note:** This plan only touches `docs/` and moves `docs/superpowers/` to `.claude/internal/`. It does **not** change `CLAUDE.md` content (only extracts it into ADRs), does **not** rewrite any code, and does **not** affect the `sql/` or `src/` trees.

---

## Current State (2026-04-23 audit)

### What works

| Folder | State |
|---|---|
| `architecture/` | 7 files, 150-300 lines each, content current |
| `audit/` | 4 files, focused audit-system reference |
| `deployment/` | 3 files (env, supabase, vercel), current |

### What's broken

1. **`docs/README.md` index is stale.** References non-existent files: `database-schema.md`, `git-commit-push.md`, `MUDEK_Rubric.md`, `reports/`, `refactor/`, `prompts/`, `misc/`.
2. **`qa/` guides are stale.** 4 guides (`vitest-guide.md`, `e2e-guide.md`, `smoke_test-guide.md`, `qa_workbook_tests.md`) pre-date S33 coverage build-out (40.47% lines), the `qaTest()` + `qa-catalog.json` pattern, integration test additions, and CI threshold ratchet.
3. **Mockups scattered across three folders.** `docs/mockups/` (22 HTML), `docs/concepts/` (18 HTML + 1 PDF), `docs/superpowers/mockups/` (empty on audit but referenced). No distinction between "active reference" and "historical explorations".
4. **`framework-outcomes.md` (25KB) sits at root** instead of under `architecture/`.
5. **`docs/superpowers/` is in the wrong place.** Plans + specs + implementation reports are Claude-agent workflow scratch space, not user-facing documentation. Largest file is 110KB (`restructure-and-test-rewrite/README.md`).
6. **No ADRs, no runbooks, no CHANGELOG.** CLAUDE.md "Architectural Decisions (Do Not Change)" section is raw ADR material with no dedicated home.

### Inventory for file moves

**To merge into `design/`:**

- `docs/mockups/*.html` (21 files)
- `docs/concepts/*.html` + 1 PDF (19 files)
- `docs/superpowers/mockups/` (empty per audit, but verify before delete)

**To relocate outside `docs/`:**

- `docs/superpowers/plans/` → `.claude/internal/plans/`
- `docs/superpowers/specs/` → `.claude/internal/specs/`
- `docs/superpowers/mockups/` → deleted if empty, else merged into `docs/design/archive/`

**To relocate within `docs/`:**

- `docs/framework-outcomes.md` → `docs/architecture/framework-outcomes.md`

---

## Target Structure

```
docs/
├── README.md                          # accurate index + entry point
├── getting-started.md                 # [Session 1 new] 30-min dev setup
├── contributing.md                    # [Session 1 new] branch/commit/PR
├── architecture/
│   ├── README.md                      # section index
│   ├── system-overview.md
│   ├── url-routing.md
│   ├── storage-policy.md
│   ├── period-lifecycle.md
│   ├── email-notifications.md
│   ├── database-webhooks.md
│   ├── multi-tenancy.md               # [Session 3 new] JWT + legacy v1
│   ├── framework-outcomes.md          # ← moved from docs/
│   └── overview-needs-attention.md    # kept as-is
├── testing/                           # [Session 2] replaces docs/qa/
│   ├── README.md                      # test pyramid + current coverage
│   ├── unit-tests.md                  # vitest + qaTest + qa-catalog
│   ├── integration-tests.md           # S33 additions
│   ├── e2e-tests.md                   # playwright
│   └── smoke-checklist.md             # pre-jury-day
├── deployment/
│   ├── README.md                      # section index
│   ├── environment-variables.md
│   ├── supabase-setup.md
│   ├── vercel-deployment.md
│   └── migrations.md                  # [Session 4 new] sql/migrations/ policy
├── operations/                        # [Session 4 new]
│   ├── README.md
│   ├── audit-system.md                # ← merged from docs/audit/
│   └── runbooks/
│       ├── jury-day-incident.md
│       ├── demo-seed-broken.md
│       └── auth-outage.md
├── decisions/                         # [Session 3 new] ADRs
│   ├── README.md                      # ADR format + index
│   ├── 0001-pathname-based-routing.md
│   ├── 0002-no-client-caching.md
│   ├── 0003-jwt-admin-auth.md
│   ├── 0004-jury-entry-token.md
│   └── 0005-snapshot-migrations.md
└── design/                            # [Session 1] replaces mockups/ + concepts/
    ├── README.md                      # active vs archive + spec links
    ├── reference/                     # canonical UI reference files
    │   ├── vera-premium-prototype.html
    │   ├── admin-all-pages.html
    │   └── premium-light-all-screens.html
    └── archive/                       # historical explorations by date
        ├── 2026-04/
        ├── 2026-03/
        └── jury-flow-explorations/    # v1-v5 series

.claude/internal/                      # [Session 1] gitignored
├── plans/                             # ← moved from docs/superpowers/plans/
└── specs/                             # ← moved from docs/superpowers/specs/
```

---

## Rules (apply to every session)

1. **No git commits unless the user explicitly asks.** Stage and report; never run `git commit` or `git push` autonomously. (Per user memory: `feedback_no_auto_commit`, `feedback_no_push`.)
2. **Update tests/docs in same step as the move.** When relocating a file, update every referencing link in the same edit pass — never leave broken links for a follow-up. (Per user memory: `feedback_update_tests_with_impl`.)
3. **No placeholder IDs.** Any Supabase project ref, Vercel org, or infra ID written into a doc must be a literal `<project-ref>` / `<org>` placeholder. (Per user memory: `feedback_no_deployment_ids`.)
4. **Markdown conventions.** Real headings (not `**bold**` as heading), blank lines around headings/lists, language on fenced code blocks, `**bold**` not `__bold__`. (Per `CLAUDE.md` markdown rules.)
5. **Per-session report.** End each session with a file in `implementation_reports/S<N>-<slug>.md` summarizing: files moved/created/deleted, broken links fixed, open items for the next session.
6. **Link verification gate.** Before closing a session, run `find docs -name "*.md" -print0 | xargs -0 grep -l "](.*\.md"` and spot-check any changed file for broken relative links. Fail the session if a link resolves to a non-existent file.
7. **`.claude/internal/` must be in `.gitignore`** before any superpowers content is moved there. Verify with `git check-ignore .claude/internal/plans` returning a non-empty result.

---

## Sessions

| Session | Scope | Risk | Deliverable |
|---|---|---|---|
| S1 | File reorganization + README rewrite + mockup consolidation + superpowers relocation | Low | Accurate index, no broken links, `design/` folder, `.claude/internal/` |
| S2 | `qa/` → `testing/` rewrite against current test reality (S33 coverage, qa-catalog, qaTest, CI ratchet) | Medium | 5 current test guides replacing 4 stale ones |
| S3 | Extract "Architectural Decisions" from `CLAUDE.md` into 5 ADR files + add `multi-tenancy.md` | Medium | `decisions/` ADR folder with index |
| S4 | `operations/runbooks/` + merge `audit/` into `operations/audit-system.md` + new `migrations.md` | Low | 3 runbooks + consolidated operations section |

---

## Session 1: Reorganization & Mockup Consolidation

**Goal:** Fix the broken index, merge mockup folders into a single `design/` tree with reference/archive split, relocate superpowers scratch space, and move `framework-outcomes.md` under `architecture/`.

**Files touched:**

- Move: `docs/framework-outcomes.md` → `docs/architecture/framework-outcomes.md`
- Move: all `docs/mockups/*.html` → `docs/design/archive/<group>/`
- Move: all `docs/concepts/*.html` + 1 PDF → `docs/design/{reference,archive/<group>}/`
- Move: `docs/superpowers/plans/` → `.claude/internal/plans/`
- Move: `docs/superpowers/specs/` → `.claude/internal/specs/`
- Delete: `docs/superpowers/` (after confirming empty)
- Delete: `docs/mockups/` (after confirming empty)
- Delete: `docs/concepts/` (after confirming empty)
- Rewrite: `docs/README.md`
- Create: `docs/design/README.md`
- Create: `docs/architecture/README.md`
- Create: `docs/deployment/README.md`
- Create: `docs/getting-started.md`
- Create: `docs/contributing.md`
- Modify: `.gitignore` (add `.claude/internal/`)

### Step 1: Pre-flight verification

- [ ] **S1.1 — Confirm `.claude/internal/` is gitignored**

```bash
grep -E "^\.claude/internal/?$|^\.claude/$" .gitignore || echo ".claude/internal/" >> .gitignore
git check-ignore .claude/internal/plans/test && echo "OK"
```

Expected: `OK` printed after an ignored path is echoed.

- [ ] **S1.2 — Snapshot current docs tree for diff review**

```bash
find docs -type f \( -name "*.md" -o -name "*.html" -o -name "*.pdf" \) | sort > /tmp/docs-before.txt
wc -l /tmp/docs-before.txt
```

Expected: ~80-100 files. Save output for the session report.

- [ ] **S1.3 — Audit every markdown-to-markdown link before any move**

```bash
grep -rEn '\]\(\.{0,2}\/?[^)]+\.md\)' docs/ > /tmp/docs-links-before.txt
wc -l /tmp/docs-links-before.txt
```

Keep this file; it is the baseline for the link-check gate at the end.

### Step 2: Create new folder skeleton

- [ ] **S2.1 — Create target directories**

```bash
mkdir -p docs/design/reference
mkdir -p docs/design/archive/2026-04
mkdir -p docs/design/archive/2026-03
mkdir -p docs/design/archive/jury-flow-explorations
mkdir -p .claude/internal
```

- [ ] **S2.2 — Verify skeleton**

```bash
ls -d docs/design docs/design/reference docs/design/archive .claude/internal
```

Expected: all four paths print without error.

### Step 3: Move `framework-outcomes.md`

- [ ] **S3.1 — Move file**

```bash
git mv docs/framework-outcomes.md docs/architecture/framework-outcomes.md
```

- [ ] **S3.2 — Find and update incoming links**

```bash
grep -rln "framework-outcomes\.md" docs/ src/ CLAUDE.md 2>/dev/null
```

Expected: a list of files. For each one, update the path from `docs/framework-outcomes.md` (or `../framework-outcomes.md`) to the new location. Use the `Edit` tool — do not use `sed`.

### Step 4: Relocate superpowers workflow content

- [ ] **S4.1 — Move plans folder**

```bash
git mv docs/superpowers/plans .claude/internal/plans
```

Note: the plan you are reading will move along with it. That is expected.

- [ ] **S4.2 — Move specs folder**

```bash
git mv docs/superpowers/specs .claude/internal/specs
```

- [ ] **S4.3 — Handle `docs/superpowers/mockups/`**

```bash
ls -A docs/superpowers/mockups 2>/dev/null
```

If empty → `rmdir docs/superpowers/mockups`. If non-empty → move each file into `docs/design/archive/<date-group>/` (use the same grouping rules as Step 5).

- [ ] **S4.4 — Remove empty `docs/superpowers/`**

```bash
rmdir docs/superpowers
```

Expected: removed with no error. If error, list remaining files and decide case-by-case.

- [ ] **S4.5 — Search for broken links to moved superpowers content**

```bash
grep -rln "docs/superpowers/" docs/ src/ CLAUDE.md 2>/dev/null
```

For each hit: if it's in `CLAUDE.md` or a doc file, update the path to `.claude/internal/...`. If it's in source code, flag for user review (should not exist — source should not reference docs/superpowers).

### Step 5: Consolidate mockups into `docs/design/`

Use this grouping rule:

- **`reference/`** — files explicitly called "canonical UI reference" in `CLAUDE.md` memory or used as a live prototype: `vera-premium-prototype.html`, `admin-all-pages.html`, `premium-light-all-screens.html`.
- **`archive/jury-flow-explorations/`** — the `jury-flow-v1..v5` series (7 files).
- **`archive/2026-04/`** — any file with a name indicating April 2026 design work (cross-reference `.claude/internal/specs/2026-04-*.md`).
- **`archive/2026-03/`** — older explorations.
- **Root `archive/`** — anything that doesn't fit the dated groups (`eval-gate-mockup.html`, `landing-jury-access-section.html`, etc.).

- [ ] **S5.1 — Move reference files**

```bash
git mv docs/concepts/vera-premium-prototype.html docs/design/reference/
git mv docs/concepts/admin-all-pages.html docs/design/reference/
git mv docs/concepts/premium-light-all-screens.html docs/design/reference/
```

- [ ] **S5.2 — Move jury-flow series**

```bash
git mv docs/mockups/jury-flow-v1-glass-dark.html         docs/design/archive/jury-flow-explorations/
git mv docs/mockups/jury-flow-v2-clean-light.html        docs/design/archive/jury-flow-explorations/
git mv docs/mockups/jury-flow-v3-aurora.html             docs/design/archive/jury-flow-explorations/
git mv docs/mockups/jury-flow-v4-warm-neutral.html       docs/design/archive/jury-flow-explorations/
git mv docs/mockups/jury-flow-v5-ideal-vera.html         docs/design/archive/jury-flow-explorations/
git mv docs/mockups/jury-flow-v5-soft-depth.html         docs/design/archive/jury-flow-explorations/
```

- [ ] **S5.3 — Move remaining `docs/mockups/*.html` into `archive/2026-04/`**

For each file in `docs/mockups/`, check if there is a matching `.claude/internal/specs/2026-04-*.md` (by feature name). If yes, group into `archive/2026-04/`. If no date signal, leave in root `archive/`. Execute one `git mv` per file using the `Bash` tool.

Verify after:

```bash
ls docs/mockups/
```

Expected: empty. Then `rmdir docs/mockups`.

- [ ] **S5.4 — Move remaining `docs/concepts/*.html` + PDF into archive**

Use the same grouping. The PDF (`VERA Feedback System — Design Spec.pdf`) goes to `archive/` root.

Verify:

```bash
ls docs/concepts/
```

Expected: empty. Then `rmdir docs/concepts`.

- [ ] **S5.5 — Search for incoming links to old mockup/concept paths**

```bash
grep -rln -E "docs/(mockups|concepts)/" docs/ src/ CLAUDE.md .claude/ 2>/dev/null
```

For every hit, update the path to the new `docs/design/` location.

### Step 6: Write `docs/design/README.md`

- [ ] **S6.1 — Create `docs/design/README.md` with this content**

```markdown
# Design Reference

This folder holds UI mockups and design concepts for VERA.

## Structure

- **`reference/`** — canonical UI prototypes. When a CLAUDE.md instruction or code comment says "match the prototype", it refers to a file here. Keep this folder small — 3-5 files.
- **`archive/`** — historical design explorations, grouped by date (`YYYY-MM/`) or series (`jury-flow-explorations/`). Never deleted; design decisions are traceable through these files.

## Active reference files

| File | Purpose |
| --- | --- |
| `reference/vera-premium-prototype.html` | Master UI prototype — 1:1 reference for all pages. |
| `reference/admin-all-pages.html` | Admin panel screens in a single HTML, for layout comparison. |
| `reference/premium-light-all-screens.html` | Light-mode variant reference. |

## Linking from specs

Specs in `.claude/internal/specs/` reference archive files by relative path. Example:

``\`markdown
![mockup](../../docs/design/archive/2026-04/2026-04-21-verify-email-screen-mockup.html)
``\`

## Adding a new mockup

1. If it is a one-off exploration for a feature → `archive/YYYY-MM/<date>-<slug>.html`.
2. If it replaces or updates a canonical reference → discuss before editing `reference/`.
3. Never edit a file in `archive/` — create a new dated version instead.
```

(Replace `\`` backticks with real backticks when writing the file.)

### Step 7: Rewrite `docs/README.md`

- [ ] **S7.1 — Replace `docs/README.md` with an accurate index**

Content must enumerate every top-level folder under `docs/` (architecture, testing, deployment, operations, decisions, design, plus the two root files `getting-started.md`, `contributing.md`). Every table row must link to a file that exists. Do not list folders that haven't been created yet (`testing/`, `operations/`, `decisions/` will land in later sessions — mark them "Planned" in a separate table).

Structure:

```markdown
# VERA — Documentation

Multi-tenant academic jury evaluation platform. This directory is the single source of truth for architecture, deployment, operations, and design decisions.

---

## Start here

- [Getting started](getting-started.md) — dev environment in 30 minutes.
- [Contributing](contributing.md) — branch strategy, commit conventions, PR flow.

---

## Current sections

| Section | Contents |
| --- | --- |
| [architecture/](architecture/README.md) | System design, routing, storage policy, period lifecycle, framework outcomes. |
| [deployment/](deployment/README.md) | Environment variables, Supabase setup, Vercel deployment. |
| [audit/](audit/README.md) | Audit system coverage, event messages, roadmap. |
| [design/](design/README.md) | UI reference prototypes and archived mockups. |

---

## Planned (in progress)

| Section | Target session | Status |
| --- | --- | --- |
| `testing/` | Session 2 | Replaces stale `qa/`. |
| `decisions/` | Session 3 | ADRs extracted from CLAUDE.md. |
| `operations/` | Session 4 | Runbooks, audit merged in. |

---

## Claude-agent workflow content

Plans, specs, and implementation reports live in `.claude/internal/` (gitignored). Not part of the user-facing documentation set.
```

### Step 8: Stub the section READMEs and onboarding files

- [ ] **S8.1 — Write `docs/architecture/README.md`** (index linking to every `.md` under `architecture/`)

- [ ] **S8.2 — Write `docs/deployment/README.md`** (index linking to env-vars, supabase-setup, vercel-deployment)

- [ ] **S8.3 — Write `docs/getting-started.md`**

Must cover, in order: required accounts (Supabase, Vercel), clone + install, `.env.local` setup, `npm run dev`, run unit tests, run E2E tests, log into demo admin. Target: a new developer goes from zero to a running dev server in 30 minutes.

- [ ] **S8.4 — Write `docs/contributing.md`**

Must cover: branch naming, commit conventions (reference existing commit history pattern), PR template, review requirements, CI gates. Pull commit format from recent `git log` — do not invent a format.

### Step 9: Link verification gate

- [ ] **S9.1 — Regenerate link list and diff**

```bash
grep -rEn '\]\(\.{0,2}\/?[^)]+\.md\)' docs/ > /tmp/docs-links-after.txt
diff /tmp/docs-links-before.txt /tmp/docs-links-after.txt > /tmp/docs-links-diff.txt
cat /tmp/docs-links-diff.txt
```

Expected: diff shows only removed links (from deleted/moved files) and added links (from the new READMEs). No "link to non-existent file" symptoms.

- [ ] **S9.2 — Validate every link in every changed markdown file**

For each `.md` file created or modified in this session, extract every relative link and verify the target exists:

```bash
for f in docs/README.md docs/design/README.md docs/architecture/README.md docs/deployment/README.md docs/getting-started.md docs/contributing.md; do
  echo "=== $f ==="
  grep -oE '\]\(([^)]+)\)' "$f" | sed 's/](//;s/)$//' | while read link; do
    # Skip URLs
    [[ "$link" =~ ^https?:// ]] && continue
    # Resolve relative to file's dir
    dir=$(dirname "$f")
    target="$dir/$link"
    [[ -e "$target" ]] || echo "BROKEN: $link (in $f)"
  done
done
```

Expected: no `BROKEN:` output.

### Step 10: Session 1 report

- [ ] **S10.1 — Write `.claude/internal/plans/docs-restructure/implementation_reports/S1-reorganization.md`**

(Note: this plan itself will have moved to `.claude/internal/plans/docs-restructure/` after S4.1. The report lives next to it.)

Report contents:

- Files moved (source → destination table).
- Files created (new READMEs + onboarding docs).
- Incoming links updated (count + list of files touched).
- Any files that could not be auto-categorized during S5.3/S5.4 (user decision required).
- Open items for S2.

- [ ] **S10.2 — Report to user and stop**

Do not commit. Print: "S1 complete. Files moved, index rewritten, link check passed. See implementation_reports/S1-reorganization.md. Ready to commit? (y/n)". Wait for user.

---

## Session 2: Testing Guide Rewrite (`qa/` → `testing/`)

**Goal:** Replace the 4 stale `qa/` guides with 5 current guides that reflect actual test infrastructure: `qaTest()`, `qa-catalog.json`, S33 coverage at 40.47%, integration tests added in S31-S33, vitest CI ratchet, Playwright conventions, and pre-jury-day smoke procedure.

**Files touched:**

- Create: `docs/testing/README.md`
- Create: `docs/testing/unit-tests.md`
- Create: `docs/testing/integration-tests.md`
- Create: `docs/testing/e2e-tests.md`
- Create: `docs/testing/smoke-checklist.md`
- Delete: `docs/qa/vitest-guide.md`
- Delete: `docs/qa/e2e-guide.md`
- Delete: `docs/qa/smoke_test-guide.md`
- Delete: `docs/qa/qa_workbook_tests.md`
- Delete: `docs/qa/` (empty)
- Modify: `docs/README.md` (move "Planned" → "Current" for testing)

### Step 1: Capture current test state

- [ ] **S2.1.1 — Run coverage to get current numbers**

```bash
npm test -- --run --coverage 2>&1 | tee /tmp/coverage-report.txt | tail -80
```

Record line/branch/function/statement coverage, test-file count, test count. These numbers land in `testing/README.md`.

- [ ] **S2.1.2 — List all test files by location**

```bash
find src -name "*.test.js" -o -name "*.test.jsx" -o -name "*.test.ts" -o -name "*.test.tsx" | sort > /tmp/test-files.txt
wc -l /tmp/test-files.txt
```

- [ ] **S2.1.3 — Read `src/test/qa-catalog.json` and `vite.config.js` coverage block**

Capture the exact catalog structure and threshold values for the guide.

- [ ] **S2.1.4 — Read `playwright.config.ts` (or equivalent)**

Capture browser list, base URL strategy, retry config.

### Step 2: Write `docs/testing/README.md`

- [ ] **S2.2.1 — Create the section index**

Must include: test pyramid diagram (unit > integration > E2E > smoke), current coverage numbers from S2.1.1, CI ratchet policy, links to the 4 sub-guides, commands cheat sheet (`npm test -- --run`, `npm run e2e`, `npm run check:no-native-select`).

### Step 3: Write `docs/testing/unit-tests.md`

- [ ] **S2.3.1 — Write the unit-test guide**

Must cover:

- The `qaTest()` wrapper and why it replaces bare `it()` — reference `src/test/qaTest.js`.
- `qa-catalog.json` registration flow: add id → write test → run.
- Mocking `supabaseClient`: `vi.mock("../../lib/supabaseClient", () => ({ supabase: {} }))` — exact import path and why.
- Test file locations: `src/admin/__tests__/`, `src/jury/__tests__/`, `src/shared/__tests__/`, feature-adjacent `__tests__/`.
- Commands: `npm test`, `npm test -- --run`, `npm test -- --run --coverage`, `npm test -- path/to/file.test.js`.
- Coverage thresholds in `vite.config.js` and the ratchet rule (never lower).
- Common patterns with examples drawn from real test files (find 2-3 representative examples by reading actual tests).

### Step 4: Write `docs/testing/integration-tests.md`

- [ ] **S2.4.1 — Write the integration-test guide**

Must cover the integration test set added in S31-S33. Read the actual test files first — find them by searching for `integration` in test paths or `describe` blocks. Document the distinction between unit (mocked supabase) and integration (real or MSW-mocked HTTP) patterns used in this project. If the project has no separate integration tier, say so explicitly and describe how "integration-like" coverage is handled within the unit tier.

### Step 5: Write `docs/testing/e2e-tests.md`

- [ ] **S2.5.1 — Write the E2E guide**

Must cover:

- Playwright command (`npm run e2e`) and browser matrix.
- Env vars required (`VITE_DEMO_*`, test admin credentials).
- Skip logic — how tests opt out of CI vs local.
- Report output location (HTML + Excel, per existing `e2e-guide.md`).
- `data-testid` ownership: Session B of the test coverage plan owns testids — document the convention for when unit tests need a new testid.

### Step 6: Write `docs/testing/smoke-checklist.md`

- [ ] **S2.6.1 — Write the smoke checklist**

Rewrite from the existing `docs/qa/smoke_test-guide.md` structure but against current reality:

- Pre-jury-day checklist (24h before).
- Environment toggle: demo vs prod.
- Entry token minting + rotation.
- Health check: `platform-metrics` edge function.
- Post-event audit: log review.

### Step 7: Delete stale `qa/` and update index

- [ ] **S2.7.1 — Delete old guides**

```bash
git rm docs/qa/vitest-guide.md docs/qa/e2e-guide.md docs/qa/smoke_test-guide.md docs/qa/qa_workbook_tests.md
rmdir docs/qa
```

- [ ] **S2.7.2 — Update `docs/README.md`**

Move `testing/` row from "Planned" into "Current sections". Remove any residual reference to `qa/`.

- [ ] **S2.7.3 — Search for incoming links to `docs/qa/`**

```bash
grep -rln "docs/qa/" docs/ src/ CLAUDE.md .claude/ 2>/dev/null
```

Update each hit to point to the corresponding `docs/testing/` file.

### Step 8: Link verification gate

- [ ] **S2.8.1 — Run the same link-check loop as S9.2** over the new `testing/` files plus `docs/README.md`.

Expected: no `BROKEN:` output.

### Step 9: Session 2 report

- [ ] **S2.9.1 — Write `implementation_reports/S2-testing-rewrite.md`**

Include: current coverage numbers captured, 4 files deleted, 5 files created, link audit diff.

- [ ] **S2.9.2 — Report to user and stop for commit approval.**

---

## Session 3: Architectural Decision Records

**Goal:** Extract the "Architectural Decisions (Do Not Change)" block from `CLAUDE.md` into 5 ADR files in `docs/decisions/`. Add `architecture/multi-tenancy.md` for the JWT + legacy v1 coexistence story, which is currently only visible by reading source code.

**Files touched:**

- Create: `docs/decisions/README.md`
- Create: `docs/decisions/0001-pathname-based-routing.md`
- Create: `docs/decisions/0002-no-client-caching.md`
- Create: `docs/decisions/0003-jwt-admin-auth.md`
- Create: `docs/decisions/0004-jury-entry-token.md`
- Create: `docs/decisions/0005-snapshot-migrations.md`
- Create: `docs/architecture/multi-tenancy.md`
- Modify: `docs/README.md` (promote `decisions/` from Planned to Current)
- Modify: `CLAUDE.md` ("Architectural Decisions" block replaced with a 2-line link to `docs/decisions/`)

### Step 1: ADR template and index

- [ ] **S3.1.1 — Write `docs/decisions/README.md`**

Must include: ADR format template (Context / Decision / Consequences / Status / Date), numbering convention, index table of the 5 ADRs.

### Step 2: Write each ADR

For each ADR, follow the same pattern. The source material is already in `CLAUDE.md` — extract it, expand each bullet into a full Context/Decision/Consequences block. Do not invent new context. If the "why" isn't captured in CLAUDE.md, flag it for user input in the session report rather than guessing.

- [ ] **S3.2.1 — Write `0001-pathname-based-routing.md`**

Source: CLAUDE.md "Pathname-based routing — React Router v6; `/demo/*` → demo env; no query params for env selection". Expand: why pathname over query params, what breaks if reversed, trade-off against the planned `?demo=1` shift mentioned in user memory `project_deployment`.

- [ ] **S3.2.2 — Write `0002-no-client-caching.md`**

Source: CLAUDE.md "No caching — data re-fetched on every tab switch (live evaluation days need fresh data)". Expand: jury-day concurrency context, performance trade-off, what the rule explicitly excludes (browser storage preferences are allowed, per storage-policy.md).

- [ ] **S3.2.3 — Write `0003-jwt-admin-auth.md`**

Source: CLAUDE.md "JWT-based admin auth — Supabase Auth sessions; legacy v1 password RPCs for backward compat only". Expand: migration story from v1 RPCs, when legacy RPCs may finally be removed, impact on rpc-proxy edge function.

- [ ] **S3.2.4 — Write `0004-jury-entry-token.md`**

Source: CLAUDE.md "Jury entry via token — QR / entry-token verification always the entry path in production". Expand: token TTL, revocation, why tokens over persistent jury accounts, relationship to tenant implicit resolution.

- [ ] **S3.2.5 — Write `0005-snapshot-migrations.md`**

Source: CLAUDE.md "Database Migration Policy" section. Expand: snapshot vs incremental, why 9 modules, archive folder retention, demo seed exemption.

### Step 3: Write `docs/architecture/multi-tenancy.md`

- [ ] **S3.3.1 — Document super-admin vs tenant-admin**

Read: `src/shared/auth/AuthProvider.jsx`, `sql/migrations/006a_rpcs_admin.sql`, `sql/migrations/006b_rpcs_admin.sql`. Document: membership table shape, `organization_id IS NULL` convention, `_assert_tenant_admin()` helper, OAuth flow, `PendingReviewGate`, `CompleteProfileForm`, tenant-implicit jury flow.

### Step 4: Update `CLAUDE.md`

- [ ] **S3.4.1 — Replace "Architectural Decisions" block**

Read current `CLAUDE.md`. Find the "## Architectural Decisions (Do Not Change)" section. Replace the bullet list with:

```markdown
## Architectural Decisions (Do Not Change)

Full context lives in [docs/decisions/](docs/decisions/README.md). Active ADRs:

- [0001 — Pathname-based routing](docs/decisions/0001-pathname-based-routing.md)
- [0002 — No client-side caching](docs/decisions/0002-no-client-caching.md)
- [0003 — JWT-based admin auth](docs/decisions/0003-jwt-admin-auth.md)
- [0004 — Jury entry via token](docs/decisions/0004-jury-entry-token.md)
- [0005 — Snapshot migrations](docs/decisions/0005-snapshot-migrations.md)

DB changes require migration — never alter RPC signatures or table schema without a migration in `sql/migrations/`. See [architecture/multi-tenancy.md](docs/architecture/multi-tenancy.md) for the auth model.
```

Keep the "Database Migration Policy" sub-section intact — it is operational detail, not a decision record.

### Step 5: Update docs index and verify links

- [ ] **S3.5.1 — Promote `decisions/` to "Current sections" in `docs/README.md`**
- [ ] **S3.5.2 — Run link-check loop over every created/modified file.**

### Step 6: Session 3 report

- [ ] **S3.6.1 — Write `implementation_reports/S3-decisions.md`**

Flag any ADR where the "why" had to be inferred from code rather than found in CLAUDE.md — these need user review.

- [ ] **S3.6.2 — Report to user and stop for commit approval.**

---

## Session 4: Operations & Runbooks

**Goal:** Create `docs/operations/` with consolidated audit docs, jury-day incident runbooks, and a migrations operational guide. Produces the operational knowledge layer a new on-call engineer needs.

**Files touched:**

- Create: `docs/operations/README.md`
- Create: `docs/operations/audit-system.md` (merged from `docs/audit/*.md`)
- Create: `docs/operations/runbooks/jury-day-incident.md`
- Create: `docs/operations/runbooks/demo-seed-broken.md`
- Create: `docs/operations/runbooks/auth-outage.md`
- Create: `docs/deployment/migrations.md`
- Delete: `docs/audit/README.md`, `docs/audit/audit-coverage.md`, `docs/audit/audit-event-messages.md`, `docs/audit/audit-roadmap.md`
- Delete: `docs/audit/` (empty)
- Modify: `docs/README.md` (promote `operations/` from Planned to Current; remove `audit/` row)
- Modify: `docs/deployment/README.md` (add `migrations.md` row)

### Step 1: Consolidate audit docs

- [ ] **S4.1.1 — Merge `docs/audit/*.md` into `docs/operations/audit-system.md`**

Read all 4 files. Write a single unified audit-system guide with sections: Overview, Coverage (from audit-coverage.md), Event Messages (from audit-event-messages.md), Roadmap & Known Gaps (from audit-roadmap.md + user memory `project_audit_remaining_work`). Do not lose information — every unique fact in any of the 4 source files must survive into the merged file.

- [ ] **S4.1.2 — Delete source files after merge is verified**

```bash
git rm docs/audit/README.md docs/audit/audit-coverage.md docs/audit/audit-event-messages.md docs/audit/audit-roadmap.md
rmdir docs/audit
```

### Step 2: Write runbooks

Each runbook follows the structure: **Symptom → Detection → Impact → Triage → Fix → Postmortem template.**

- [ ] **S4.2.1 — Write `runbooks/jury-day-incident.md`**

Source material: user memory + CLAUDE.md "No caching" / "Live evaluation days need fresh data" + Edge Function gotchas section. Cover: entry-token failure, PIN blocking, score write failures, tenant membership gate misfires, `visibilitychange` save storm.

- [ ] **S4.2.2 — Write `runbooks/demo-seed-broken.md`**

Source material: `scripts/generate_demo_seed.js`, `sql/seeds/demo_seed.sql`, CLAUDE.md rule "Do not push demo_seed.sql to any DB". Cover: symptom (demo login fails / data missing), regenerating the seed, manual apply, dev vs live distinction.

- [ ] **S4.2.3 — Write `runbooks/auth-outage.md`**

Source: `src/shared/auth/AuthProvider.jsx`, `supabase/functions/rpc-proxy/index.ts`, CLAUDE.md Edge Function gotchas (Kong JWT gate, ES256, `auth.getUser(token)`). Cover: tenant-admin lockout, Google OAuth flow break, Kong 401, `execution_time_ms ≈ 0ms` signal.

### Step 3: Write `docs/deployment/migrations.md`

- [ ] **S4.3.1 — Operational migrations guide**

Source: CLAUDE.md "Database Migration Policy" section. Cover: the 9-module structure (000-009), the rule set (1-8), MCP-based apply flow (Supabase MCP tools), both-projects rule, archive folder, demo seed exemption. Cross-link to [0005 ADR](../decisions/0005-snapshot-migrations.md) for the "why".

### Step 4: Write `docs/operations/README.md`

- [ ] **S4.4.1 — Section index**

Link to audit-system.md + each runbook + monitoring notes (brief — note what tooling is or is not in place; if no monitoring tooling exists, say so explicitly).

### Step 5: Update index and verify

- [ ] **S4.5.1 — Final `docs/README.md` rewrite**

Every "Planned" row is now in "Current sections". Target final state:

| Section | Contents |
| --- | --- |
| architecture/ | System design |
| testing/ | Test strategy and guides |
| deployment/ | Env, Supabase, Vercel, migrations |
| operations/ | Audit system, runbooks |
| decisions/ | ADRs |
| design/ | UI reference and archive |

- [ ] **S4.5.2 — Update `docs/deployment/README.md`** to add `migrations.md` row.

- [ ] **S4.5.3 — Run link-check loop** over every created/modified file.

- [ ] **S4.5.4 — Final sweep:** grep for any residual reference to `docs/qa/`, `docs/mockups/`, `docs/concepts/`, `docs/audit/`, `docs/superpowers/`, `docs/framework-outcomes.md`. Any hit is a miss from earlier sessions — fix before closing.

```bash
grep -rEn "docs/(qa|mockups|concepts|audit|superpowers)/|docs/framework-outcomes\.md" docs/ src/ CLAUDE.md .claude/ 2>/dev/null
```

Expected: no output.

### Step 6: Session 4 report and final summary

- [ ] **S4.6.1 — Write `implementation_reports/S4-operations.md`**

- [ ] **S4.6.2 — Write `implementation_reports/FINAL-summary.md`**

Summary across all 4 sessions: total files moved, created, deleted; new sections live; open questions (if any); suggested follow-up.

- [ ] **S4.6.3 — Report to user and stop for commit approval.**

---

## Self-Review Checklist

Run after the plan is saved, before handing off to execution.

- [ ] Every file move has a matching "update incoming links" step.
- [ ] Every new file has a content outline (not just "write the file").
- [ ] Every session ends with a link-verification gate.
- [ ] No placeholder text remains in this plan (TBD, TODO, "fill in later").
- [ ] `.claude/internal/` is in `.gitignore` before any superpowers content moves.
- [ ] `CLAUDE.md` modifications are limited to Session 3 (Architectural Decisions block).
- [ ] No git commits happen autonomously — each session ends with "report and wait for user".
- [ ] Session 1 prerequisites are independent of Sessions 2-4 (can ship alone).
- [ ] Session 2 is independent of Sessions 3-4.
- [ ] Session 4 depends only on Session 1 (folder structure) — not on 2 or 3.
