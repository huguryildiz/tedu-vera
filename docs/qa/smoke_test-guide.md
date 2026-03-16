# Smoke Test Plan — TEDU Capstone Jury Evaluation Portal

> **Objective:** Confirm all critical flows are healthy before jury evaluation day.
> Run time target: **under 10 minutes** (manual) or **under 2 minutes** (automated).

---

## 1. Purpose

This smoke test verifies that:

- The application loads without errors.
- The jury evaluation flow (login → score → submit) completes end-to-end.
- The admin panel renders all tabs and key operations work.
- Backend connectivity (Supabase RPCs) is functional.
- Security gates (admin password, RPC secret, PIN lockout) are in place.

It is **not** a comprehensive regression suite. It answers one question: _"Is the system ready for jury day?"_

---

## 2. Scope

| Area | In Scope |
|------|----------|
| Home page | ✅ Renders, navigation buttons work |
| Jury flow | ✅ Identity → Semester → PIN → Eval → Submit → Done |
| Admin login | ✅ Password gate, setup flow, auth error handling |
| Admin — Overview | ✅ Dashboard loads, metrics rendered |
| Admin — Rankings | ✅ Table loads, sort works |
| Admin — Analytics | ✅ Charts render, ChartDataTable fallback |
| Admin — Grid | ✅ Matrix loads, sort/filter |
| Admin — Details | ✅ Score details expand |
| Admin — Settings | ✅ Semesters, Projects, Jurors, Permissions, Audit, DB Backup |
| Security | ✅ RPC secret, admin auth, PIN lockout |
| Realtime | ✅ Admin panel receives live updates |

**Out of scope:** Performance benchmarks, browser matrix, accessibility audit, MÜDEK calculation correctness (covered by unit tests).

---

## 3. Environment

| Environment | When to Use |
|-------------|-------------|
| **Local dev** (`npm run dev`) | Day-before verification; primary smoke test target |
| **Staging / Preview** (Vercel/Netlify preview deploy) | Post-deploy verification before going live |
| **Production** | Final check on jury morning; limit writes to test data |

### Prerequisites

- `.env.local` contains valid `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_RPC_SECRET`.
- At least one active semester with ≥ 1 project exists in the database.
- At least one test juror has been created (or will be created during the test).
- Admin password has been set (or the setup flow is testable).

---

## 4. Smoke Test Scenarios

### 4.1 Home Page

| # | Step | Expected Outcome | ⏱ |
|---|------|-------------------|---|
| H-01 | Open root URL `/` | Home page renders: TEDU logo, title, "Start Evaluation" + "Admin Panel" buttons visible. | 5s |
| H-02 | Check browser console | No errors (warnings acceptable). | 5s |

---

### 4.2 Jury Login

| # | Step | Expected Outcome | ⏱ |
|---|------|-------------------|---|
| J-01 | Click "Start Evaluation" | Identity step loads: Name + Institution fields visible, active semester info shown. | 5s |
| J-02 | Enter valid name + institution, click continue | Semester auto-advances (if 1 active) or semester list shown. | 5s |
| J-03 | **First-time juror:** get PIN reveal step | PIN displayed with copy-to-clipboard button. Note the PIN. | 5s |
| J-04 | **Returning juror:** enter correct 4-digit PIN | PIN verified, projects load, eval step shown. | 5s |
| J-05 | Enter incorrect PIN 3 times | Error with "attempts remaining" count, then lockout screen on 3rd failure. | 15s |
| J-06 | On lockout screen | "Too many login attempts" message, locked-until time shown, "Return Home" button works. | 5s |

---

### 4.3 Evaluation Flow

| # | Step | Expected Outcome | ⏱ |
|---|------|-------------------|---|
| E-01 | On eval step, verify group header | Group number, project title, and student names displayed. | 5s |
| E-02 | Enter scores for all 4 criteria (Technical, Written, Oral, Teamwork) | Score inputs accept values within range (0–30 / 0–10), rubric info available. | 15s |
| E-03 | Move focus away from score input (blur) | Autosave triggers: save status indicator shows "Saving…" → "Saved". | 5s |
| E-04 | Navigate to next group (arrow or group list) | Previous group's scores auto-saved, next group loads with its data. | 5s |
| E-05 | Enter scores for all groups | Progress bar reaches 100%. Submit confirmation dialog appears. | 30s |
| E-06 | Confirm submission | "Submitting scores…" loader → Done step with summary table, all scores visible. | 10s |
| E-07 | On Done step, click "Return Home" | Returns to home page. | 5s |

---

### 4.4 Admin Panel — Login

| # | Step | Expected Outcome | ⏱ |
|---|------|-------------------|---|
| A-01 | Click "Admin Panel" from home | Admin login screen shown (or setup screen if first time). | 5s |
| A-02 | Enter correct admin password | Admin panel loads with Overview tab visible, loading overlay dismisses. | 5s |
| A-03 | Enter wrong password | "Invalid password" error, not admitted. | 5s |

---

### 4.5 Admin — Overview Tab

| # | Step | Expected Outcome | ⏱ |
|---|------|-------------------|---|
| O-01 | Overview tab active | Dashboard cards visible: Total Projects, Total Jurors, Evaluations, Completion. | 5s |
| O-02 | Semester dropdown | All semesters listed, selecting one reloads data. | 5s |
| O-03 | Refresh button | Data reloads, "Last refreshed" timestamp updates. | 5s |

---

### 4.6 Admin — Scores: Rankings

| # | Step | Expected Outcome | ⏱ |
|---|------|-------------------|---|
| R-01 | Switch to Scores → Rankings | Rankings table renders with projects sorted by average total. | 5s |
| R-02 | Verify columns | Group #, Project Name, Juror Count, Avg per criterion, Total Avg, Min, Max visible. | 5s |

---

### 4.7 Admin — Scores: Analytics

| # | Step | Expected Outcome | ⏱ |
|---|------|-------------------|---|
| AN-01 | Switch to Scores → Analytics | Charts render (or appropriate "no data" message). | 10s |
| AN-02 | If no Recharts JS loaded | ChartDataTable fallback renders text-based summary table. | 5s |
| AN-03 | Trend chart semester selector | Selecting semesters loads multi-semester trend data. | 5s |

---

### 4.8 Admin — Scores: Grid

| # | Step | Expected Outcome | ⏱ |
|---|------|-------------------|---|
| G-01 | Switch to Scores → Grid | Matrix table renders — jurors as rows, groups as columns. | 5s |
| G-02 | Sorting | Click column header → rows re-sort. | 5s |
| G-03 | Cell states | Cells show colored state: scored (green), partial (amber), empty (gray). | 5s |

---

### 4.9 Admin — Scores: Details

| # | Step | Expected Outcome | ⏱ |
|---|------|-------------------|---|
| D-01 | Switch to Scores → Details | Juror activity list renders. | 5s |
| D-02 | Expand a juror row | Per-group scores displayed for this juror. | 5s |

---

### 4.10 Admin — Settings: Semester Management

| # | Step | Expected Outcome | ⏱ |
|---|------|-------------------|---|
| S-01 | Open Settings → Semesters section | Semester list visible with active badge. | 5s |
| S-02 | Create a new semester | Form accepts name + poster date, semester appears in list. | 15s |
| S-03 | Set active semester | Active badge moves, toast confirmation shown. | 5s |

---

### 4.11 Admin — Settings: Project Management

| # | Step | Expected Outcome | ⏱ |
|---|------|-------------------|---|
| P-01 | Open Projects section | Project list for selected semester shown. | 5s |
| P-02 | Add a project (manual) | Group No + Title + Students accepted, project appears. | 10s |
| P-03 | CSV import | Upload CSV file, projects imported (or upserted). | 15s |

---

### 4.12 Admin — Settings: Juror Management

| # | Step | Expected Outcome | ⏱ |
|---|------|-------------------|---|
| JM-01 | Open Jurors section | Juror list for selected semester shown with status indicators. | 5s |
| JM-02 | Create a juror | Name + Institution accepted, juror appears. | 10s |
| JM-03 | Reset juror PIN | New PIN generated and displayed in dialog. Admin can copy PIN. | 10s |
| JM-04 | Toggle edit mode for a juror | Edit toggle switches, status updates (e.g., "Editing"). | 5s |

---

### 4.13 Admin — Settings: Permissions & Security

| # | Step | Expected Outcome | ⏱ |
|---|------|-------------------|---|
| PS-01 | Open Permissions section | Evaluation lock toggle visible for selected semester. | 5s |
| PS-02 | Toggle evaluation lock | Confirmation dialog shown. After confirm, lock state updates. | 10s |
| PS-03 | Open Security section | Admin password change, backup password, delete password sections visible. | 5s |

---

### 4.14 Admin — Settings: Audit Log

| # | Step | Expected Outcome | ⏱ |
|---|------|-------------------|---|
| AL-01 | Open Audit section | Recent audit log entries load. | 5s |
| AL-02 | Date filter | Setting from/to dates filters entries. | 5s |
| AL-03 | Search | Typing a search term filters log entries. | 5s |

---

### 4.15 Admin — Settings: DB Backup

| # | Step | Expected Outcome | ⏱ |
|---|------|-------------------|---|
| BK-01 | Open DB Backup section | Export and Import options visible. | 5s |
| BK-02 | Export (if backup password set) | Enter backup password → JSON file downloads. | 10s |

---

### 4.16 Security Checks

| # | Step | Expected Outcome | ⏱ |
|---|------|-------------------|---|
| SEC-01 | Verify `VITE_RPC_SECRET` is set | `import.meta.env.VITE_RPC_SECRET` is non-empty (check `.env.local`). | 5s |
| SEC-02 | Call admin RPC without password | Request fails with P0401 / "unauthorized" (verify in Supabase logs or Network tab). | 10s |
| SEC-03 | Admin password strength check (setup) | Weak password (< 10 chars, no special chars) is rejected with validation message. | 5s |
| SEC-04 | Verify admin logout | Click "← Return Home" from admin → re-entering admin requires password. | 5s |

---

## 5. Pass / Fail Criteria

| Criterion | Pass | Fail |
|-----------|------|------|
| **UI loads** | All pages render within 3 seconds | Blank screen or crash |
| **Console errors** | Zero `Error`-level console messages | Any unhandled errors |
| **Data appears** | Projects, jurors, scores populate as expected | Empty where data should exist |
| **Actions succeed** | Score save, PIN verify, submit, admin CRUD all return success | Network error or incorrect result |
| **Security gates** | Unauthorized access blocked at every entry point | Any bypass found |

> **Overall:** All scenarios must PASS for the system to be declared healthy.

---

## 6. Execution Time Target

| Method | Target |
|--------|--------|
| Manual walkthrough | **< 10 minutes** |
| Automated (Vitest unit + Playwright E2E) | **< 2 minutes** |

---

## 7. Recommended Automation

### 7.1 Vitest — Unit / Component Smoke Tests (already in place)

Existing tests cover component-level smoke rendering:

```text
src/jury/__tests__/smoke.test.jsx    — PinStep, SemesterStep, InfoStep, DoneStep, SheetsProgressDialog
src/admin/__tests__/smoke.test.jsx   — CompletionStrip, JurorActivity, AnalyticsTab
```

Run with:

```bash
npx vitest run --reporter=verbose
```

### 7.2 Playwright — E2E Smoke Suite (already in place)

The E2E suite covers the critical paths described above. Tests live in `e2e/`:

```text
e2e/jury-flow.spec.ts       — InfoStep UI smoke + full jury evaluation flow (jury.e2e.01)
e2e/jury-lock.spec.ts       — Locked semester: lock banner + disabled inputs (jury.e2e.02)
e2e/admin-login.spec.ts     — Admin password gate
e2e/admin-results.spec.ts   — Scores → Rankings tab loads (admin.e2e.02)
e2e/admin-export.spec.ts    — Rankings → Excel download (admin.e2e.03)
e2e/admin-import.spec.ts    — Settings → CSV import dialog (admin.e2e.01)
```

Run the full E2E suite:

```bash
npm run e2e
npm run e2e:report   # open HTML report
```

Credentials-gated tests are automatically skipped if `.env.local` does not contain the required variables. See [docs/qa/e2e-guide.md](e2e-guide.md) for setup details.

### 7.3 Simple Health Checks

Add a pre-jury-day script (`scripts/health-check.sh`):

```bash
#!/bin/bash
set -e

echo "=== TEDU Portal Health Check ==="

# 1. Check env vars
[ -z "$VITE_SUPABASE_URL" ] && echo "❌ VITE_SUPABASE_URL missing" && exit 1
[ -z "$VITE_SUPABASE_ANON_KEY" ] && echo "❌ VITE_SUPABASE_ANON_KEY missing" && exit 1
[ -z "$VITE_RPC_SECRET" ] && echo "❌ VITE_RPC_SECRET missing" && exit 1
echo "✅ Environment variables OK"

# 2. Check Supabase connectivity
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  "${VITE_SUPABASE_URL}/rest/v1/rpc/rpc_list_semesters" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}')
[ "$HTTP_CODE" -ne 200 ] && echo "❌ Supabase RPC unreachable (HTTP $HTTP_CODE)" && exit 1
echo "✅ Supabase connectivity OK"

# 3. Build check
npm run build 2>&1 | tail -1
echo "✅ Build successful"

echo ""
echo "=== All health checks passed ==="
```

---

## Quick Reference Checklist

Use this on jury morning as a fast manual run-through:

- [ ] **H-01** Home page loads
- [ ] **J-01** Jury identity step works
- [ ] **J-04** PIN login succeeds
- [ ] **E-02** Scores can be entered
- [ ] **E-03** Autosave works
- [ ] **E-06** Submission completes
- [ ] **A-02** Admin login works
- [ ] **O-01** Overview dashboard loads
- [ ] **R-01** Rankings table renders
- [ ] **G-01** Grid table renders
- [ ] **S-01** Semesters load in settings
- [ ] **SEC-01** RPC secret is configured

> ✅ If all 12 items pass → **System is ready for jury day.**
