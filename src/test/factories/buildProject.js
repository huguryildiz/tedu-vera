let _seq = 1;

export function buildProject(overrides = {}) {
  const n = _seq++;
  return {
    id: `project-${String(n).padStart(3, "0")}`,
    organization_id: "org-001",
    period_id: "period-001",
    title: `Test Project ${n}`,
    group_no: `G${String(n).padStart(2, "0")}`,
    team_members: `Team Member A, Team Member B`,
    advisor_name: `Prof. Test ${n}`,
    created_at: "2025-09-15T10:00:00Z",
    ...overrides,
  };
}
