import { test, expect } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { ReviewsPom } from "../poms/ReviewsPom";
import {
  adminClient,
  seedJurorSession,
  setJurorEditMode,
  readJurorAuth,
  resetJurorAuth,
} from "../helpers/supabaseAdmin";
import { EVAL_PERIOD_ID, EVAL_JURORS } from "../fixtures/seed-ids";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

// ── Shared sign-in helper ─────────────────────────────────────────────────────

async function signInAndGoto(
  page: Parameters<Parameters<typeof test>[1]>[0]["page"],
): Promise<ReviewsPom> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("vera.admin_tour_done", "1");
      localStorage.setItem("admin.remember_me", "true");
    } catch {}
  });
  const login = new LoginPom(page);
  const shell = new AdminShellPom(page);
  await login.goto();
  await login.signIn(EMAIL, PASSWORD);
  await shell.expectOnDashboard();
  await page.goto("/admin/reviews");
  const reviews = new ReviewsPom(page);
  await reviews.waitForReady();
  return reviews;
}

// ── UI smoke ──────────────────────────────────────────────────────────────────

test.describe("reviews page — smoke", () => {
  test.describe.configure({ mode: "serial" });

  // e2e.admin.reviews.smoke
  test("page renders — reviews table visible", async ({ page }) => {
    const reviews = await signInAndGoto(page);
    await expect(reviews.table()).toBeVisible();
    const rowCount = await reviews.rows().count();
    expect(rowCount).toBeGreaterThan(0);
  });
});

// ── UI filter tests ───────────────────────────────────────────────────────────

test.describe("reviews page — filters", () => {
  test.describe.configure({ mode: "serial" });

  // e2e.admin.reviews.filter.juror
  test("filter by juror — only matching rows remain visible", async ({ page }) => {
    const reviews = await signInAndGoto(page);

    // Require at least one row so there is something to filter
    await expect(reviews.rows().first()).toBeVisible({ timeout: 10_000 });

    // Dynamically pick the first juror name (from .jb-name, not affiliation)
    const jurorName = ((await reviews.jurorNameCells().first().textContent()) ?? "").trim();
    expect(jurorName.length).toBeGreaterThan(0);

    await reviews.openFilterPanel();
    await reviews.selectJurorFilter(jurorName);

    // All visible juror name cells must match the selected juror exactly
    const cells = reviews.jurorNameCells();
    await expect(cells).not.toHaveCount(0);
    const n = await cells.count();
    for (let i = 0; i < n; i++) {
      await expect(cells.nth(i)).toHaveText(jurorName);
    }
  });

  // e2e.admin.reviews.filter.project
  test("filter by project — only matching rows remain visible", async ({ page }) => {
    const reviews = await signInAndGoto(page);

    await expect(reviews.rows().first()).toBeVisible({ timeout: 10_000 });

    const projectTitle = (
      (await reviews.projectTitleCells().first().textContent()) ?? ""
    ).trim();
    expect(projectTitle.length).toBeGreaterThan(0);

    await reviews.openFilterPanel();
    await reviews.selectProjectFilter(projectTitle);

    const cells = reviews.projectTitleCells();
    await expect(cells).not.toHaveCount(0);
    const n = await cells.count();
    for (let i = 0; i < n; i++) {
      await expect(cells.nth(i)).toHaveText(projectTitle);
    }
  });
});

// ── DB-layer behavioral tests ─────────────────────────────────────────────────

test.describe("reviews — jury_feedback submit (E2)", () => {
  const jurorId = EVAL_JURORS[0].id;
  const periodId = EVAL_PERIOD_ID;

  test.beforeEach(async () => {
    // Remove any pre-existing row to avoid UNIQUE(period_id, juror_id) conflict
    await adminClient
      .from("jury_feedback")
      .delete()
      .eq("period_id", periodId)
      .eq("juror_id", jurorId);
  });

  test.afterEach(async () => {
    await adminClient
      .from("jury_feedback")
      .delete()
      .eq("period_id", periodId)
      .eq("juror_id", jurorId);
  });

  // e2e.admin.reviews.feedback.submit
  test("rpc_submit_jury_feedback writes correct period_id + juror_id to jury_feedback", async () => {
    const token = await seedJurorSession(jurorId, periodId);

    const { data, error } = await adminClient.rpc("rpc_submit_jury_feedback", {
      p_period_id: periodId,
      p_session_token: token,
      p_rating: 4,
      p_comment: "E2E feedback submit test",
    });
    expect(error).toBeNull();
    expect(data?.ok).toBe(true);

    const { data: row, error: readErr } = await adminClient
      .from("jury_feedback")
      .select("period_id, juror_id, rating, comment")
      .eq("period_id", periodId)
      .eq("juror_id", jurorId)
      .single();
    expect(readErr).toBeNull();
    expect(row!.period_id).toBe(periodId);
    expect(row!.juror_id).toBe(jurorId);
    expect(row!.rating).toBe(4);
    expect(row!.comment).toBe("E2E feedback submit test");
  });
});

test.describe("reviews — juror edit-mode enable (E2)", () => {
  const jurorId = EVAL_JURORS[1].id;
  const periodId = EVAL_PERIOD_ID;

  test.afterEach(async () => {
    await resetJurorAuth(jurorId, periodId);
  });

  // e2e.admin.reviews.score.edit.enable
  test("setJurorEditMode writes edit_enabled=true to juror_period_auth", async () => {
    const expiresAt = new Date(Date.now() + 3_600_000).toISOString();

    await setJurorEditMode(jurorId, periodId, {
      final_submitted_at: new Date().toISOString(),
      edit_enabled: true,
      edit_reason: "E2E re-open test",
      edit_expires_at: expiresAt,
    });

    const auth = await readJurorAuth(jurorId, periodId);
    expect(auth.edit_enabled).toBe(true);
    expect(auth.edit_reason).toBe("E2E re-open test");
    expect(auth.final_submitted_at).not.toBeNull();
  });
});

// ── Phase 2.4 — applyFilters engine correctness ──────────────────────────────
// These assertions invoke the production `applyFilters` function inside an
// authenticated admin page via `page.evaluate`, so the test is coupled to the
// real module — a regression in `filterPipeline.js` surfaces as a test failure.

test.describe("reviews — applyFilters engine (Phase 2.4)", () => {
  test.describe.configure({ mode: "serial" });

  /**
   * Synthetic enriched rows. Every row already has `jurorStatus` and
   * `effectiveStatus` populated as `enrichRows` would compute, plus a
   * dynamic criterion key `c_design` so score-range filters have a target.
   */
  const SYNTH_ROWS = [
    {
      jurorId: "j1", juryName: "Juror Alpha", affiliation: "Dept A",
      projectId: "p1", title: "Project P1", students: "Alice",
      groupNo: "1", c_design: 75, total: 75, comments: "Looks good",
      effectiveStatus: "scored", jurorStatus: "completed", updatedAt: "2026-04-01",
    },
    {
      jurorId: "j2", juryName: "Juror Beta", affiliation: "Dept B",
      projectId: "p1", title: "Project P1", students: "Alice",
      groupNo: "1", c_design: 50, total: 50, comments: "",
      effectiveStatus: "scored", jurorStatus: "completed", updatedAt: "2026-04-02",
    },
    {
      jurorId: "j1", juryName: "Juror Alpha", affiliation: "Dept A",
      projectId: "p2", title: "Project P2", students: "Bob",
      groupNo: "2", c_design: 90, total: 90, comments: "Outstanding",
      effectiveStatus: "scored", jurorStatus: "completed", updatedAt: "2026-04-03",
    },
    {
      jurorId: "j2", juryName: "Juror Beta", affiliation: "Dept B",
      projectId: "p2", title: "Project P2", students: "Bob",
      groupNo: "2", c_design: 60, total: 60, comments: "Average",
      effectiveStatus: "scored", jurorStatus: "completed", updatedAt: "2026-04-04",
    },
  ];

  const BASE_FILTERS = {
    scoreFilters: {},
    scoreKeys: ["c_design"],
    filterComment: "",
  };

  async function applyFiltersIn(
    page: Parameters<Parameters<typeof test>[1]>[0]["page"],
    rows: typeof SYNTH_ROWS,
    overrides: Record<string, unknown>,
  ): Promise<typeof SYNTH_ROWS> {
    return page.evaluate(
      async ({ rs, base, ov }) => {
        // @ts-expect-error Vite dev server resolves at runtime
        const mod = await import("/src/admin/selectors/filterPipeline.js");
        return mod.applyFilters(rs, { ...base, ...ov });
      },
      { rs: rows, base: BASE_FILTERS, ov: overrides },
    );
  }

  // e2e.admin.reviews.filter.comment_only_with_text
  test("filterComment narrows to rows whose comment contains the substring", async ({ page }) => {
    await signInAndGoto(page);
    const filtered = await applyFiltersIn(page, SYNTH_ROWS, {
      filterComment: "outstanding",
    });
    expect(filtered.length).toBe(1);
    expect(filtered[0].jurorId).toBe("j1");
    expect(filtered[0].projectId).toBe("p2");
  });

  // e2e.admin.reviews.filter.score_range
  test("scoreFilters with min=70 max=80 keeps only the c_design=75 row", async ({ page }) => {
    await signInAndGoto(page);
    const filtered = await applyFiltersIn(page, SYNTH_ROWS, {
      scoreFilters: { c_design: { min: 70, max: 80 } },
    });
    expect(filtered.length).toBe(1);
    expect(filtered[0].c_design).toBe(75);
  });

  // e2e.admin.reviews.filter.combined_juror_project_comment
  test("combined juror + project + comment filters intersect to the unique row", async ({ page }) => {
    await signInAndGoto(page);
    const filtered = await applyFiltersIn(page, SYNTH_ROWS, {
      filterJuror: "alpha",
      filterProjectTitle: "P2",
      filterComment: "outstanding",
    });
    expect(filtered.length).toBe(1);
    expect(filtered[0].jurorId).toBe("j1");
    expect(filtered[0].projectId).toBe("p2");
    expect(filtered[0].c_design).toBe(90);
  });

  // e2e.admin.reviews.filter.empty_comment_keeps_all_rows
  test("blank filterComment is a no-op (pipe through)", async ({ page }) => {
    await signInAndGoto(page);
    const filtered = await applyFiltersIn(page, SYNTH_ROWS, {
      filterComment: "",
    });
    expect(filtered.length).toBe(SYNTH_ROWS.length);
  });
});
