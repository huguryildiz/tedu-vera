# P2-13 — Visual regression

## Goal

Add Playwright `toHaveScreenshot()` assertions for VERA's high-churn admin pages. Catch CSS/layout regressions across light + dark themes.

## Target routes (top 5)

The audit names these as high-churn:
1. `/admin/rankings` (RankingsPage)
2. `/admin/periods` (PeriodsPage)
3. `/admin/projects` (ProjectsPage) — also a ≥1000-line file
4. `/admin/jurors` (JurorsPage)
5. Mobile-portrait variant of any of the above (use a 390×844 viewport)

## Where

New file: `e2e/visual/admin-routes.spec.ts`

Pattern:

```ts
import { test, expect } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";

const ROUTES = [
  { path: "/admin/rankings", name: "rankings" },
  { path: "/admin/periods", name: "periods" },
  { path: "/admin/projects", name: "projects" },
  { path: "/admin/jurors", name: "jurors" },
];

const VIEWPORTS = [
  { width: 1440, height: 900, label: "desktop" },
  { width: 390, height: 844, label: "mobile-portrait" },
];

const THEMES = ["light", "dark"];

for (const route of ROUTES) {
  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`visual: ${route.name} ${viewport.label} ${theme}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        // Log in once before suite via storageState if possible to avoid 20× login
        await new LoginPom(page).loginAsAdmin();
        await page.goto(route.path);
        if (theme === "dark") {
          await page.evaluate(() => document.body.classList.add("dark-mode"));
        }
        await expect(page).toHaveScreenshot(
          `${route.name}-${viewport.label}-${theme}.png`,
          { maxDiffPixelRatio: 0.02, fullPage: true }
        );
      });
    }
  }
}
```

## Tolerance

- `maxDiffPixelRatio: 0.02` (2%) — allows minor antialiasing diffs on text, blocks real layout breaks.
- `fullPage: true` — capture entire scrollable region.

## First run

Generate baselines: `npx playwright test e2e/visual --update-snapshots`. Review the resulting `.png` files (committed to repo) — they should be readable, not blank/half-rendered. If a baseline is bad, fix the wait strategy in the spec, not the threshold.

## Storage

Baselines live in `e2e/visual/admin-routes.spec.ts-snapshots/` next to the spec.
**Do commit the baseline `.png` files** — Playwright diffs against them.

## Workflow integration

DO NOT add to default e2e.yml — visual tests are slow and flaky on font-rendering differences across runners. Add a `if: github.event_name == 'workflow_dispatch'` gated job to e2e.yml, or a separate `visual.yml`.

## Acceptance

- 4 routes × 2 viewports × 2 themes = 16 screenshot tests
- Baselines generated + committed
- Workflow_dispatch-only

## Out of scope

- Per-component visual tests (these stay in component tests if added later)
- Cross-browser (chromium only for now)

Do NOT commit. Report back: baselines generated, any flakes, file count.
