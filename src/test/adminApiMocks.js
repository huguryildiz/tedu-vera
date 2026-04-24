// src/test/adminApiMocks.js
// Shared mock factory for admin API unit tests.
// Returns Supabase-shaped responses: { data, error, count }.

export function mockSuccess(data, count) {
  return { data, error: null, count: count ?? data.length };
}

export function mockError(message, code = "PGRST116") {
  return { data: null, error: { message, code }, count: 0 };
}

export function mockEmpty() {
  return mockSuccess([]);
}

export function makeScore(overrides = {}) {
  return {
    id: "score-1",
    criterion_key: "c1",
    juror_id: "juror-1",
    project_id: "proj-1",
    score_value: 80,
    org_id: "org-a",
    period_id: "period-1",
    status: "submitted",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

export function makeCriteria(overrides = {}) {
  return {
    id: "crit-1",
    key: "c1",
    label: "Criterion 1",
    weight: 1,
    type: "numeric",
    max_score: 100,
    sort_order: 0,
    period_id: "period-1",
    ...overrides,
  };
}

export function makeProject(overrides = {}) {
  return {
    id: "proj-1",
    title: "Test Project",
    org_id: "org-a",
    project_no: 1,
    members: null,
    advisor_name: "Dr. Test",
    period_id: "period-1",
    ...overrides,
  };
}

export function makeJuror(overrides = {}) {
  return {
    id: "juror-1",
    juror_name: "Jane Doe",
    affiliation: "TEDU",
    email: "jane@example.com",
    org_id: "org-a",
    ...overrides,
  };
}

// Builds a score_sheets row as returned by the getScores select join.
export function makeSheetRow(overrides = {}) {
  return {
    id: "sheet-1",
    juror_id: "juror-1",
    project_id: "proj-1",
    period_id: "period-1",
    comment: "",
    status: "submitted",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    items: [],
    project: { id: "proj-1", title: "Test Project", members: null, project_no: 1 },
    juror: { id: "juror-1", juror_name: "Jane Doe", affiliation: "TEDU" },
    ...overrides,
  };
}

// Builds a score_sheet_items row with joined period_criteria key.
export function makeItem(key, value, overrides = {}) {
  return {
    id: `item-${key}`,
    score_value: value,
    period_criterion_id: `pc-${key}`,
    period_criteria: { key },
    ...overrides,
  };
}
