# P1 Test Hardening Sprint

**Date:** 2026-04-25 (Pazar sabah → devam)
**Branch:** `qa/p1-test-hardening`
**Predecessor:** P0 sprint complete on `main` (merge commit `9bffdc27`)
**Reference audit:** [`docs/qa/vera-test-audit-report.md`](../../../qa/vera-test-audit-report.md) §9 P1

---

## Why P1 now

P0 closed the regression-detection gap (CI gates, edge auth shapes, RPC contracts, migration CI, hook hardening) and built the demo-seed E2E fixture infrastructure. With unit + edge + workflow-level migration green on every PR, we now have a stable surface to extend test depth without risking silent CI bypass.

P1 picks up the audit's "within one sprint" items — six discrete pieces, ranging from mechanical (constraint pgTAP, RPC contract extension) to substantive (E2E gap fills, concurrent perf).

## Sprint scope (6 items, ordered easiest → hardest)

| # | Audit item | What it adds | Why it matters | Effort |
|---|---|---|---|---|
| **9** | Extend RPC pgTAP coverage | 6 more critical RPCs pinned (return shape, RAISE conditions, RLS gating) | 36 of 45 RPCs are unpinned; covers final-submit, snapshot freeze, audit chain verify, juror unlock, outcome maps, org delete | S |
| **7** | Constraint + trigger pgTAP | NOT NULL / UNIQUE / CHECK violation tests + `trigger_assign_project_no` correctness + `trigger_audit_log` diff accuracy | Schema relaxation today is silent; CHECK constraints can be dropped without any test failing | S |
| **8** | Post-seed smoke validation | New job after `demo-db-reset.yml` applies seed: 5-assertion check (jury token authenticates, locked period serves projects, super-admin lists orgs, fixture rows exist, audit chain valid) | Demo silently breaks today if the seed has a regression; nothing alarms | XS |
| **10** | Eliminate `waitForTimeout` | Replace remaining 2 occurrences (`evaluate.spec.ts`, `google-oauth.spec.ts`) with event-based waits | Flake reducer; the pattern is a known anti-pattern | XS |
| **6** | E2E gap sprint | Six new E2E specs: invite-accept, password-reset, setup-wizard period creation, score-edit approval, unlock-request, jury final-submit + lock | Largest absolute coverage gain; closes flows that have zero E2E today | L |
| **11** | Concurrent-jury performance test | Playwright fan-out: N parallel juror contexts scoring simultaneously against demo | Event-day usage is the platform's bottleneck; nothing tests it today | M |

## Execution strategy

Same as P0: stay on Opus for orchestration, dispatch Sonnet subagents for parallel mechanical work (item 9 RPC pgTAP files, item 7 constraint files, item 6 E2E specs). Keep code-reviewer subagents in reserve for risky pieces (item 11 perf test).

## Per-item prompts

Detailed subagent briefs live in [`prompts/`](./prompts/):

- [`9-rpc-pgtap-extension.md`](./prompts/9-rpc-pgtap-extension.md) — 6 more contract files
- [`7-constraint-trigger-pgtap.md`](./prompts/7-constraint-trigger-pgtap.md) — schema-level invariants
- [`8-post-seed-smoke.md`](./prompts/8-post-seed-smoke.md) — workflow add-on
- [`10-waitfortimeout-cleanup.md`](./prompts/10-waitfortimeout-cleanup.md) — 2 specs
- [`6-e2e-gap-fill.md`](./prompts/6-e2e-gap-fill.md) — 6 new specs
- [`11-concurrent-jury-perf.md`](./prompts/11-concurrent-jury-perf.md) — perf harness

## Acceptance

- All P0 checks remain green (no regressions)
- Each P1 item ships its own commit (mergeable independently)
- Final SESSION-REPORT documents what landed + remaining gaps for the next sprint
