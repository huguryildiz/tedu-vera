# QA Catalog Reconciliation Report — 2026-04-25

## Summary

The QA catalog (`src/test/qa-catalog.json`) contained **1,199 entries** before reconciliation (with 10 duplicates). A comprehensive audit of the codebase found **935 actual tests** using `qaTest()` calls across unit tests, E2E tests, and SQL tests.

**Reconciliation results:**
- **Catalog entries before:** 1,199 (reduced to 1,189 after deduplication)
- **Duplicate IDs removed:** 10 (coverage component tests)
- **Tests found in code:** 935
- **Tests now marked `status: "backlog"`:** 254 (tests planned but not yet implemented)
- **Orphaned tests (in code, not in catalog):** 0 (all tests are already catalogued)
- **Catalog integrity:** ✓ Valid JSON, no orphans, no new entries needed

## Key Findings

### Duplicate IDs (10 Found & Removed)

Ten catalog entries appeared twice, all from the coverage test module. Kept first occurrence, removed duplicates:
- coverage.draggable-theme-toggle.renders
- coverage.juror-heatmap-card.renders
- coverage.maintenance-gate.renders-children
- coverage.maintenance-page.renders
- coverage.outcome-pill-selector.renders-pills
- coverage.project-drawer.renders
- coverage.segmented-bar.renders-segments
- coverage.setup-progress-banner.renders
- coverage.tenant-search-dropdown.renders
- coverage.theme-toggle-icon.renders

### Backlog Tests (254 IDs)

Tests listed in the catalog but not yet implemented. Top patterns:
- **Coverage.*** (140+ IDs) — chart and component rendering tests not yet written
- **Admin.projects.page.\*** — project table edge cases
- **Period.sort.\***, **stats.\***, **ui.InlineError.smoke** — utility and UI helpers

Backlog entries preserve their full metadata (story, whyItMatters, risk, severity) so future work can immediately understand scope and priority without re-discovering context.

### No Orphaned Tests

All 935 tests in the codebase have corresponding catalog entries. This is a good sign — the test ID discipline is working, and no untracked or misdocumented tests exist in the repo.

## Catalog Integrity

The JSON file remains valid and properly structured:
- All 1,199 entries are parseable
- Entries without a `status` field are implicitly active (tests exist and run)
- Backlog entries carry full metadata for future implementation

## Next Steps

1. **Prioritize backlog by severity** — coverage tests (charts, components) are lower priority than utility and admin edge cases
2. **Implement backlog tests incrementally** — each qaTest call will remove the `status: "backlog"` field automatically once code exists
3. **Monitor orphan count in future audits** — should remain at zero as development continues
