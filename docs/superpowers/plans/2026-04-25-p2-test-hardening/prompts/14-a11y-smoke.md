# P2-14 — Accessibility smoke

## Goal

Run `axe-playwright` against VERA's top 5 routes; flag any WCAG A/AA violations. Smoke-level: catch obvious problems (missing labels, low-contrast text, focus traps) without trying to be a full a11y audit.

## Setup

Add devDep: `@axe-core/playwright`. Existing project already has Playwright.

```bash
npm install --save-dev @axe-core/playwright
```

## Target routes (mirror visual-regression list)

1. `/admin/rankings`
2. `/admin/periods`
3. `/admin/projects`
4. `/admin/jurors`
5. `/jury/eval` (juror landing — high-traffic public-facing)

## Where

New file: `e2e/a11y/smoke.spec.ts`

```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { LoginPom } from "../poms/LoginPom";

const ROUTES = [
  { path: "/admin/rankings", name: "rankings", needsAuth: true },
  { path: "/admin/periods", name: "periods", needsAuth: true },
  { path: "/admin/projects", name: "projects", needsAuth: true },
  { path: "/admin/jurors", name: "jurors", needsAuth: true },
  { path: "/jury/eval", name: "jury-eval", needsAuth: false },
];

for (const route of ROUTES) {
  test(`a11y smoke: ${route.name}`, async ({ page }) => {
    if (route.needsAuth) await new LoginPom(page).loginAsAdmin();
    await page.goto(route.path);
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules([
        // Document violations as comments here so future runs know why a rule
        // is muted. Common ignorables on a real-world app:
        //   "color-contrast" — if marketing brand colors are intentionally
        //                      below 4.5:1 (raise as a backlog item)
      ])
      .analyze();

    if (results.violations.length > 0) {
      console.log(`a11y violations on ${route.name}:`,
        results.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }))
      );
    }
    expect(results.violations).toEqual([]);
  });
}
```

## How to handle real violations

Run the suite once. If real violations turn up:
1. **Critical / serious** (missing alt text, missing labels, broken focus order) → fix in source. These are bugs.
2. **Moderate** (decorative SVG without aria-hidden, etc.) → fix or document with `disableRules` + comment.
3. **Color contrast on brand-mandated colors** → document via `disableRules` with a backlog note in `docs/qa/a11y-backlog-2026-04-25.md`.

## Workflow integration

Add a job to e2e.yml that runs ONLY on `workflow_dispatch` (slow + can flake on dynamic content). Do NOT gate PRs on this initially.

## Acceptance

- 5 routes × 1 smoke = 5 tests
- All pass OR all known-fail violations documented in `a11y-backlog-2026-04-25.md`
- workflow_dispatch-only

Do NOT commit. Report back: violations found per route + which were fixed in source vs muted.
