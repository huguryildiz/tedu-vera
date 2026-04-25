import { describe, expect, it } from "vitest";
import { qaTest } from "../../../test/qaTest.js";
import {
  AUDIT_PAGE_SIZE,
  CATEGORY_META,
  SEVERITY_META,
  ACTION_LABELS,
  parseSearchDateParts,
  parseAuditDateString,
  getAuditDateRangeError,
  buildAuditParams,
  getInitials,
  getActorInfo,
  formatActionLabel,
  formatActionDetail,
  normalizeTeamMemberNames,
  groupByDay,
  formatSentence,
  formatDiffChips,
  groupBulkEvents,
  formatEventMeta,
  addDaySeparators,
  detectAnomalies,
} from "../auditUtils.js";

describe("auditUtils — constants", () => {
  qaTest("audit.utils.01", () => {
    expect(AUDIT_PAGE_SIZE).toBe(50);
    expect(CATEGORY_META).toHaveProperty("auth");
    expect(CATEGORY_META.auth).toHaveProperty("label", "Auth");
    expect(SEVERITY_META).toHaveProperty("critical");
    expect(SEVERITY_META.critical).toHaveProperty("label", "Critical");
    expect(typeof ACTION_LABELS).toBe("object");
    // Action labels is built from EVENT_META — should have known actions
    expect(ACTION_LABELS["admin.login"]).toBe("Admin login");
    expect(ACTION_LABELS["evaluation.complete"]).toBe("Evaluation completed");
  });
});

describe("auditUtils — parseSearchDateParts", () => {
  qaTest("audit.utils.02", () => {
    // Month-only: "jan 2025"
    const r1 = parseSearchDateParts("jan 2025");
    expect(r1).not.toBeNull();
    expect(r1.month).toBe(1);
    expect(r1.year).toBe(2025);
    expect(r1.day).toBeNull();

    // Day + month + year: "15 mar 2025"
    const r2 = parseSearchDateParts("15 mar 2025");
    expect(r2.day).toBe(15);
    expect(r2.month).toBe(3);
    expect(r2.year).toBe(2025);
  });

  qaTest("audit.utils.03", () => {
    // DD.MM.YYYY format
    const r3 = parseSearchDateParts("15.06.2025");
    expect(r3.day).toBe(15);
    expect(r3.month).toBe(6);
    expect(r3.year).toBe(2025);

    // ISO format: yyyy-mm-dd
    const r4 = parseSearchDateParts("2025-06-15");
    expect(r4.year).toBe(2025);
    expect(r4.month).toBe(6);
    expect(r4.day).toBe(15);

    // Non-date string
    expect(parseSearchDateParts("hello")).toBeNull();
    expect(parseSearchDateParts("")).toBeNull();
  });
});

describe("auditUtils — parseAuditDateString", () => {
  qaTest("audit.utils.04", () => {
    // Valid ISO datetime
    const r1 = parseAuditDateString("2025-06-15T14:30");
    expect(r1).not.toBeNull();
    expect(r1.isDateOnly).toBe(false);
    expect(r1.ms).toBeGreaterThan(0);

    // Valid date-only
    const r2 = parseAuditDateString("2025-06-15");
    expect(r2).not.toBeNull();
    expect(r2.isDateOnly).toBe(true);
    expect(r2.ms).toBeGreaterThan(0);
  });

  qaTest("audit.utils.05", () => {
    // Invalid format
    expect(parseAuditDateString("15/06/2025")).toBeNull();
    expect(parseAuditDateString("")).toBeNull();
    expect(parseAuditDateString(null)).toBeNull();

    // Out-of-range year
    expect(parseAuditDateString("1999-06-15")).toBeNull();
    expect(parseAuditDateString("2105-01-01")).toBeNull();

    // Invalid date parts (Feb 30)
    expect(parseAuditDateString("2025-02-30")).toBeNull();
  });
});

describe("auditUtils — getAuditDateRangeError", () => {
  qaTest("audit.utils.06", () => {
    // No dates — valid
    expect(getAuditDateRangeError({})).toBe("");

    // Valid range
    expect(
      getAuditDateRangeError({ startDate: "2025-01-01", endDate: "2025-12-31" })
    ).toBe("");

    // Invalid format
    const invalidFmt = getAuditDateRangeError({ startDate: "bad-date" });
    expect(invalidFmt).toMatch(/Invalid date format/i);

    // Reversed range
    const reversed = getAuditDateRangeError({
      startDate: "2025-12-31",
      endDate: "2025-01-01",
    });
    expect(reversed).toMatch(/cannot be later/i);
  });
});

describe("auditUtils — buildAuditParams", () => {
  qaTest("audit.utils.07", () => {
    const filters = {
      startDate: "2025-01-01",
      endDate: "2025-06-30",
      actorTypes: ["admin"],
      actions: [],
      categories: [],
      severities: ["high"],
    };
    const params = buildAuditParams(filters, 25, null, "");
    expect(params.startAt).not.toBeNull();
    expect(params.endAt).not.toBeNull();
    expect(params.actorTypes).toEqual(["admin"]);
    expect(params.actions).toBeNull(); // empty array → null
    expect(params.severities).toEqual(["high"]);
    expect(params.limit).toBe(25);
  });

  qaTest("audit.utils.08", () => {
    // Date-only endDate gets extended to end of day
    const filters = { startDate: "", endDate: "2025-06-30" };
    const params = buildAuditParams(filters, 50, null, "");
    // endAt should be a valid ISO string for June 30 23:59:59.999
    expect(params.endAt).toContain("2025-06-30");

    // cursor passed through
    const cursor = { beforeAt: "2025-03-01T00:00:00Z", beforeId: "some-uuid" };
    const p2 = buildAuditParams({}, 10, cursor, "");
    expect(p2.beforeAt).toBe(cursor.beforeAt);
    expect(p2.beforeId).toBe(cursor.beforeId);
  });

  qaTest("audit.utils.09", () => {
    // searchText is a date pattern — populates searchDay/Month/Year
    const params = buildAuditParams({}, 50, null, "15 jan 2025");
    expect(params.searchDay).toBe(15);
    expect(params.searchMonth).toBe(1);
    expect(params.searchYear).toBe(2025);
    expect(params.search).toBe("15 jan 2025");

    // non-date searchText — search populated, day/month/year null
    const p2 = buildAuditParams({}, 50, null, "Alice");
    expect(p2.search).toBe("Alice");
    expect(p2.searchDay).toBeNull();
  });
});

describe("auditUtils — getInitials", () => {
  qaTest("audit.utils.10", () => {
    expect(getInitials("Alice Smith")).toBe("AS");
    expect(getInitials("John")).toBe("J");
    expect(getInitials("")).toBe("?");
    expect(getInitials(null)).toBe("?");
    expect(getInitials("Prof. Dr. Ahmet Kaya")).toBe("PD"); // takes first 2 words
    expect(getInitials("Alice Smith Jones")).toBe("AS"); // capped at 2
  });
});

describe("auditUtils — getActorInfo", () => {
  qaTest("audit.utils.11", () => {
    // actor_type = juror
    const jurorLog = { actor_type: "juror", actor_name: "Dr. Smith" };
    const juror = getActorInfo(jurorLog);
    expect(juror.type).toBe("juror");
    expect(juror.name).toBe("Dr. Smith");
    expect(juror.role).toBe("Juror");
    expect(juror.initials).toBeTruthy();

    // actor_type = system
    const sysLog = { actor_type: "system" };
    const sys = getActorInfo(sysLog);
    expect(sys.type).toBe("system");
    expect(sys.initials).toBeNull();

    // actor_type = admin
    const adminLog = { actor_type: "admin", actor_name: "Jane Admin" };
    const admin = getActorInfo(adminLog);
    expect(admin.type).toBe("admin");
    expect(admin.name).toBe("Jane Admin");
    expect(admin.role).toBe("Organization Admin");
  });

  qaTest("audit.utils.12", () => {
    // Legacy row: user_id present → admin
    const legacyAdmin = {
      user_id: "some-uuid",
      profiles: { display_name: "Bob Admin" },
    };
    const r = getActorInfo(legacyAdmin);
    expect(r.type).toBe("admin");
    expect(r.name).toBe("Bob Admin");

    // Legacy row: juror action with details.actor_name
    const legacyJuror = {
      action: "evaluation.complete",
      details: { actor_name: "Juror Alice" },
    };
    const j = getActorInfo(legacyJuror);
    expect(j.type).toBe("juror");
    expect(j.name).toBe("Juror Alice");

    // No actor info → system
    const noActor = { action: "some.other.action" };
    const s = getActorInfo(noActor);
    expect(s.type).toBe("system");
  });
});

describe("auditUtils — formatActionLabel", () => {
  qaTest("audit.utils.13", () => {
    expect(formatActionLabel("admin.login")).toBe("Admin login");
    expect(formatActionLabel("evaluation.complete")).toBe("Evaluation completed");
    expect(formatActionLabel(null)).toBe("—");
    expect(formatActionLabel("")).toBe("—");

    // Unknown action → fallback
    const fallback = formatActionLabel("projects.insert");
    expect(typeof fallback).toBe("string");
    expect(fallback.length).toBeGreaterThan(0);
  });
});

describe("auditUtils — normalizeTeamMemberNames", () => {
  qaTest("audit.utils.14", () => {
    expect(normalizeTeamMemberNames("Alice, Bob, Charlie")).toBe("Alice; Bob; Charlie");
    expect(normalizeTeamMemberNames("Alice\nBob\nCharlie")).toBe("Alice; Bob; Charlie");
    expect(normalizeTeamMemberNames("Alice/Bob")).toBe("Alice; Bob");
    // Deduplication
    expect(normalizeTeamMemberNames("Alice, Alice, Bob")).toBe("Alice; Bob");
    // Empty
    expect(normalizeTeamMemberNames("")).toBe("");
    expect(normalizeTeamMemberNames(null)).toBe("");
  });
});

describe("auditUtils — groupByDay", () => {
  qaTest("audit.utils.15", () => {
    const logs = [
      { id: "1", created_at: "2025-06-15T14:00:00Z", action: "admin.login" },
      { id: "2", created_at: "2025-06-15T10:00:00Z", action: "admin.logout" },
      { id: "3", created_at: "2025-06-14T09:00:00Z", action: "pin.reset" },
    ];
    const groups = groupByDay(logs);
    expect(groups).toHaveLength(2);
    expect(groups[0].logs).toHaveLength(2);
    expect(groups[1].logs).toHaveLength(1);
    expect(groups[0].key).not.toBe(groups[1].key);
  });
});

describe("auditUtils — formatSentence", () => {
  it("returns verb+resource for known actions", () => {
    const log = { action: "pin.reset", details: { juror_name: "Alice" } };
    const r = formatSentence(log);
    expect(r.verb).toContain("reset");
    expect(r.resource).toBe("Alice");
  });

  it("handles export.* prefix", () => {
    const log = { action: "export.scores", details: { periodName: "Fall 2025" } };
    const r = formatSentence(log);
    expect(r.verb).toContain("export");
    expect(r.resource).toBe("Fall 2025");
  });
});

describe("auditUtils — formatDiffChips", () => {
  qaTest("audit.utils.16", () => {
    // criteria.save with changes object → up to 4 entries
    const criteriaLog = {
      action: "criteria.save",
      details: {
        changes: {
          design:     { from: 25, to: 30 },
          delivery:   { from: 40, to: 35 },
          innovation: { from: 35, to: 35 },
        },
      },
    };
    const chips = formatDiffChips(criteriaLog);
    expect(chips).toHaveLength(3);
    expect(chips[0].key).toBe("design");
    expect(chips[0].from).toBe("25");
    expect(chips[0].to).toBe("30");

    // periods.update with changedFields array
    const periodLog = {
      action: "period.update",
      details: {
        changedFields: ["name", "endDate"],
        oldValues: { name: "Fall 2024", endDate: "2024-12-15" },
        newValues: { name: "Fall 2025", endDate: "2025-01-10" },
      },
    };
    const pChips = formatDiffChips(periodLog);
    expect(pChips).toHaveLength(2);
    expect(pChips[0].key).toBe("name");
    expect(pChips[0].from).toBe("Fall 2024");
    expect(pChips[0].to).toBe("Fall 2025");

    // Trigger-based diff (before/after object)
    const triggerLog = {
      action: "data.update",
      diff: {
        before: { title: "Old Title", updated_at: "2025-01-01" },
        after:  { title: "New Title", updated_at: "2025-06-01" },
      },
    };
    const tChips = formatDiffChips(triggerLog);
    // updated_at is skipped; only "title" changed
    expect(tChips).toHaveLength(1);
    expect(tChips[0].key).toBe("title");
    expect(tChips[0].from).toBe("Old Title");
    expect(tChips[0].to).toBe("New Title");

    // No diffs → empty array
    expect(formatDiffChips({ action: "admin.login", details: {} })).toEqual([]);
  });
});

describe("auditUtils — groupBulkEvents", () => {
  qaTest("audit.utils.17", () => {
    const now = new Date("2025-06-15T12:00:00Z").getTime();

    // Single events (no user_id) → pass through as single
    const singles = [
      { action: "a", resource_type: "project" },
      { action: "b", resource_type: "project" },
    ];
    const r1 = groupBulkEvents(singles);
    expect(r1).toHaveLength(2);
    expect(r1[0].type).toBe("single");

    // Two events from same actor — below BULK_MIN_SIZE (3) → singles
    const pair = [
      { user_id: "u1", resource_type: "project", created_at: new Date(now).toISOString() },
      { user_id: "u1", resource_type: "project", created_at: new Date(now + 60_000).toISOString() },
    ];
    const r2 = groupBulkEvents(pair);
    expect(r2).toHaveLength(2);
    expect(r2.every((e) => e.type === "single")).toBe(true);

    // Three events from same actor within 5 min → bulk
    const burst = [
      { user_id: "u2", resource_type: "score", created_at: new Date(now).toISOString() },
      { user_id: "u2", resource_type: "score", created_at: new Date(now + 60_000).toISOString() },
      { user_id: "u2", resource_type: "score", created_at: new Date(now + 120_000).toISOString() },
    ];
    const r3 = groupBulkEvents(burst);
    expect(r3).toHaveLength(1);
    expect(r3[0].type).toBe("bulk");
    expect(r3[0].count).toBe(3);
    expect(r3[0].logs).toHaveLength(3);
    expect(r3[0].representative).toBe(burst[0]);

    // Same actor but different resource_type → does not collapse
    const mixed = [
      { user_id: "u3", resource_type: "project", created_at: new Date(now).toISOString() },
      { user_id: "u3", resource_type: "juror",   created_at: new Date(now + 30_000).toISOString() },
      { user_id: "u3", resource_type: "project", created_at: new Date(now + 60_000).toISOString() },
    ];
    const r4 = groupBulkEvents(mixed);
    // All three are singles because resource_type breaks the run each time
    expect(r4).toHaveLength(3);
    expect(r4.every((e) => e.type === "single")).toBe(true);

    // Empty input
    expect(groupBulkEvents([])).toEqual([]);
  });
});

describe("auditUtils — formatEventMeta", () => {
  qaTest("audit.utils.18", () => {
    // Bulk group: "action × N · within M min"
    const bulkMeta = formatEventMeta({ action: "score.upsert" }, { bulkCount: 5, bulkSpanMs: 180_000 });
    expect(bulkMeta).toMatch(/score\.upsert × 5/);
    expect(bulkMeta).toMatch(/within 3 min/);

    // Bulk without span
    const bulkNoSpan = formatEventMeta({ action: "score.upsert" }, { bulkCount: 4 });
    expect(bulkNoSpan).toBe("score.upsert × 4");

    // Export event: "action · FORMAT · N rows"
    const exportLog = { action: "export.scores", details: { format: "xlsx", row_count: 120 } };
    const exportMeta = formatEventMeta(exportLog);
    expect(exportMeta).toContain("XLSX");
    expect(exportMeta).toContain("120 rows");

    // IP fallback
    const ipLog = { action: "admin.login", details: { ip: "192.168.1.1" } };
    expect(formatEventMeta(ipLog)).toBe("admin.login · 192.168.1.1");

    // Diff-bearing event → appends first diff chip
    const diffLog = {
      action: "criteria.save",
      details: { changes: { design: { from: 25, to: 30 } } },
    };
    const diffMeta = formatEventMeta(diffLog);
    expect(diffMeta).toContain("criteria.save");
    expect(diffMeta).toContain("25→30");

    // No extras → returns bare action
    const plainLog = { action: "admin.logout", details: {} };
    expect(formatEventMeta(plainLog)).toBe("admin.logout");
  });
});

describe("auditUtils — addDaySeparators", () => {
  qaTest("audit.utils.19", () => {
    // Empty input
    expect(addDaySeparators([], [])).toEqual([]);

    // Two events on the same day → one day separator at the top
    const ts1 = "2025-06-15T10:00:00Z";
    const ts2 = "2025-06-15T14:00:00Z";
    const items = [
      { type: "single", log: { created_at: ts1 } },
      { type: "single", log: { created_at: ts2 } },
    ];
    const allLogs = [{ created_at: ts1 }, { created_at: ts2 }];
    const r1 = addDaySeparators(items, allLogs);
    // Should have: 1 day sentinel + 2 single items = 3
    expect(r1).toHaveLength(3);
    expect(r1[0].type).toBe("day");
    expect(r1[0].count).toBe(2);
    expect(r1[1].type).toBe("single");

    // Two events on different days → two day sentinels
    const ts3 = "2025-06-14T09:00:00Z";
    const items2 = [
      { type: "single", log: { created_at: ts1 } },
      { type: "single", log: { created_at: ts3 } },
    ];
    const allLogs2 = [{ created_at: ts1 }, { created_at: ts3 }];
    const r2 = addDaySeparators(items2, allLogs2);
    // 2 day sentinels + 2 items = 4
    expect(r2).toHaveLength(4);
    expect(r2[0].type).toBe("day");
    expect(r2[2].type).toBe("day");

    // Bulk item: uses representative.created_at for day key
    const bulkItem = {
      type: "bulk",
      count: 3,
      representative: { created_at: ts1 },
      logs: [],
    };
    const r3 = addDaySeparators([bulkItem], [{ created_at: ts1 }]);
    expect(r3).toHaveLength(2);
    expect(r3[0].type).toBe("day");
    expect(r3[1].type).toBe("bulk");
  });
});

describe("auditUtils — detectAnomalies", () => {
  qaTest("audit.utils.20", () => {
    const recent = (action, extra = {}) => ({
      action,
      created_at: new Date(Date.now() - 60_000).toISOString(), // 1 min ago
      ...extra,
    });
    const old = (action) => ({
      action,
      created_at: new Date(Date.now() - 30 * 24 * 3600_000).toISOString(), // 30 days ago
    });

    // No anomalies → null
    expect(detectAnomalies([])).toBeNull();
    expect(detectAnomalies([old("admin.login.failure"), old("admin.login.failure"), old("admin.login.failure")])).toBeNull();

    // Rule 1: ≥3 recent login failures → auth.login_failure.burst
    const failures = [
      recent("admin.login.failure", { ip_address: "10.0.0.1" }),
      recent("admin.login.failure"),
      recent("admin.login.failure"),
    ];
    const r1 = detectAnomalies(failures);
    expect(r1).not.toBeNull();
    expect(r1.key).toBe("auth.login_failure.burst");
    expect(r1.title).toMatch(/Failed login/i);
    expect(r1.details.count).toBe(3);
    expect(r1.details.ip).toBe("10.0.0.1");

    // Rule 2: org suspension in 24h → org.status.suspended
    const suspension = [
      recent("organization.status_changed", {
        details: { newStatus: "suspended", organizationCode: "TEDU" },
      }),
    ];
    const r2 = detectAnomalies(suspension);
    expect(r2.key).toBe("org.status.suspended");
    expect(r2.desc).toContain("TEDU");

    // Rule 6: PIN lockout in 24h (lowest priority but no higher rule triggered)
    const lock = [
      recent("juror.pin_locked", { actor_name: "Juror Bob" }),
    ];
    const r6 = detectAnomalies(lock);
    expect(r6.key).toBe("juror.pin_locked");
    expect(r6.desc).toContain("Juror Bob");

    // Rule 1 takes priority over rule 6 when both present
    const both = [...failures, ...lock];
    const rPriority = detectAnomalies(both);
    expect(rPriority.key).toBe("auth.login_failure.burst");
  });
});

describe("auditUtils — buildAuditParams filter validation", () => {
  qaTest("audit-filter-actor-types", () => {
    // Valid actor types pass through
    const validTypes = ["admin", "system", "juror", "service"];
    const params1 = buildAuditParams({ actorTypes: validTypes }, 50, null, "");
    expect(params1.actorTypes).toEqual(validTypes);

    // Unknown actor type passes through unchecked (no enum validation)
    const params2 = buildAuditParams({ actorTypes: ["unknown_type"] }, 50, null, "");
    expect(params2.actorTypes).toEqual(["unknown_type"]);

    // Empty array → null
    const params3 = buildAuditParams({ actorTypes: [] }, 50, null, "");
    expect(params3.actorTypes).toBeNull();

    // Single-item array
    const params4 = buildAuditParams({ actorTypes: ["admin"] }, 50, null, "");
    expect(params4.actorTypes).toEqual(["admin"]);

    // Null/undefined actorTypes → null (not passed in object returns null)
    const params5 = buildAuditParams({}, 50, null, "");
    expect(params5.actorTypes).toBeNull();
  });

  qaTest("audit-filter-actions", () => {
    // Valid action strings pass through
    const validActions = ["data.score.submitted", "admin.login", "evaluation.complete"];
    const params1 = buildAuditParams({ actions: validActions }, 50, null, "");
    expect(params1.actions).toEqual(validActions);

    // Unknown action type passes through unchecked
    const params2 = buildAuditParams({ actions: ["unknown.action"] }, 50, null, "");
    expect(params2.actions).toEqual(["unknown.action"]);

    // Empty array → null
    const params3 = buildAuditParams({ actions: [] }, 50, null, "");
    expect(params3.actions).toBeNull();

    // Mixed valid and invalid actions (no validation, passes through)
    const params4 = buildAuditParams(
      { actions: ["admin.login", "totally.unknown"] },
      50,
      null,
      ""
    );
    expect(params4.actions).toEqual(["admin.login", "totally.unknown"]);

    // No actions key → returns null
    const params5 = buildAuditParams({}, 50, null, "");
    expect(params5.actions).toBeNull();
  });

  qaTest("audit-filter-categories", () => {
    // Valid categories from CATEGORY_META (auth, access, data, config, security)
    const validCats = ["auth", "access", "data", "config", "security"];
    const params1 = buildAuditParams({ categories: validCats }, 50, null, "");
    expect(params1.categories).toEqual(validCats);

    // Unknown category passes through unchecked
    const params2 = buildAuditParams({ categories: ["unknown"] }, 50, null, "");
    expect(params2.categories).toEqual(["unknown"]);

    // Empty array → null
    const params3 = buildAuditParams({ categories: [] }, 50, null, "");
    expect(params3.categories).toBeNull();

    // Subset of valid categories
    const params4 = buildAuditParams({ categories: ["auth", "data"] }, 50, null, "");
    expect(params4.categories).toEqual(["auth", "data"]);

    // No categories key → returns null
    const params5 = buildAuditParams({}, 50, null, "");
    expect(params5.categories).toBeNull();
  });

  qaTest("audit-filter-severities", () => {
    // Valid severities from SEVERITY_META (info, low, medium, high, critical)
    const validSevs = ["info", "low", "medium", "high", "critical"];
    const params1 = buildAuditParams({ severities: validSevs }, 50, null, "");
    expect(params1.severities).toEqual(validSevs);

    // Unknown severity passes through unchecked
    const params2 = buildAuditParams({ severities: ["unknown_sev"] }, 50, null, "");
    expect(params2.severities).toEqual(["unknown_sev"]);

    // Empty array → null
    const params3 = buildAuditParams({ severities: [] }, 50, null, "");
    expect(params3.severities).toBeNull();

    // Subset of valid severities
    const params4 = buildAuditParams({ severities: ["high", "critical"] }, 50, null, "");
    expect(params4.severities).toEqual(["high", "critical"]);

    // No severities key → returns null
    const params5 = buildAuditParams({}, 50, null, "");
    expect(params5.severities).toBeNull();
  });

  qaTest("audit-filter-date-range", () => {
    // Reversed date range (start > end) — buildAuditParams does NOT validate;
    // validation is handled by getAuditDateRangeError called separately in UI
    const reversed = buildAuditParams(
      { startDate: "2025-06-30", endDate: "2025-01-01" },
      50,
      null,
      ""
    );
    // Function returns params anyway; RPC or UI error handler catches it
    expect(reversed.startAt).not.toBeNull();
    expect(reversed.endAt).not.toBeNull();

    // Boundary dates (same day)
    const params1 = buildAuditParams(
      { startDate: "2025-06-15", endDate: "2025-06-15" },
      50,
      null,
      ""
    );
    expect(params1.startAt).not.toBeNull();
    expect(params1.endAt).not.toBeNull();

    // Year far in past (year boundary)
    const params2 = buildAuditParams({ startDate: "1900-01-01" }, 50, null, "");
    // parseAuditDateString validates year bounds; invalid year → null
    expect(params2.startAt).toBeNull(); // APP_DATE_MIN_YEAR is likely ~2000

    // Year far in future
    const params3 = buildAuditParams({ endDate: "2999-12-31" }, 50, null, "");
    // APP_DATE_MAX_YEAR validation may reject this
    expect(params3.endAt).toBeNull();

    // Malformed date string (not ISO)
    const params4 = buildAuditParams({ startDate: "not-a-date" }, 50, null, "");
    expect(params4.startAt).toBeNull();

    // Empty date string → parsed as falsy, startAt → null
    const params5 = buildAuditParams({ startDate: "" }, 50, null, "");
    expect(params5.startAt).toBeNull();

    // No dates
    const params6 = buildAuditParams({}, 50, null, "");
    expect(params6.startAt).toBeNull();
    expect(params6.endAt).toBeNull();
  });

  qaTest("audit-filter-search-text", () => {
    // Normal search text
    const params1 = buildAuditParams({}, 50, null, "Alice Smith");
    expect(params1.search).toBe("Alice Smith");

    // SQL-suspect characters: ; (semicolon) — passes through unchecked, no escaping
    const params2 = buildAuditParams({}, 50, null, "test; DROP TABLE logs");
    expect(params2.search).toBe("test; DROP TABLE logs");

    // SQL wildcard %, _ — passes through, no escaping
    const params3 = buildAuditParams({}, 50, null, "test%value_name");
    expect(params3.search).toBe("test%value_name");

    // Backslash — passes through, no escaping
    const params4 = buildAuditParams({}, 50, null, "path\\to\\file");
    expect(params4.search).toBe("path\\to\\file");

    // Unicode characters
    const params5 = buildAuditParams({}, 50, null, "Ahmet Çalışkan 北京");
    expect(params5.search).toBe("Ahmet Çalışkan 北京");

    // Very long string (>1000 chars) — passes through, no truncation
    const longStr = "x".repeat(2000);
    const params6 = buildAuditParams({}, 50, null, longStr);
    expect(params6.search).toBe(longStr);
    expect(params6.search.length).toBe(2000);

    // Empty string → search returns null (because `search ? search : null`)
    const params7 = buildAuditParams({}, 50, null, "");
    expect(params7.search).toBeNull();

    // Only whitespace → trim() results in empty string, then → null
    const params8 = buildAuditParams({}, 50, null, "   ");
    expect(params8.search).toBeNull();

    // Null/undefined searchText → "" after String().trim(), then → null
    const params9 = buildAuditParams({}, 50, null, null);
    expect(params9.search).toBeNull();

    // Date-like string → also sets searchDay/Month/Year
    const params10 = buildAuditParams({}, 50, null, "15 jan 2025");
    expect(params10.search).toBe("15 jan 2025");
    expect(params10.searchDay).toBe(15);
    expect(params10.searchMonth).toBe(1);
    expect(params10.searchYear).toBe(2025);
  });

  qaTest("audit-filter-limit-cursor", () => {
    // Normal positive limit
    const params1 = buildAuditParams({}, 50, null, "");
    expect(params1.limit).toBe(50);

    // Limit = 1 (minimum)
    const params2 = buildAuditParams({}, 1, null, "");
    expect(params2.limit).toBe(1);

    // Limit = 0 (falsy, defaults to AUDIT_PAGE_SIZE)
    const params3 = buildAuditParams({}, 0, null, "");
    expect(params3.limit).toBe(50); // AUDIT_PAGE_SIZE

    // Negative limit (truthy, passes through)
    const params4 = buildAuditParams({}, -10, null, "");
    expect(params4.limit).toBe(-10);

    // Very large limit (10000)
    const params5 = buildAuditParams({}, 10000, null, "");
    expect(params5.limit).toBe(10000);

    // Cursor object with valid fields
    const cursor1 = { beforeAt: "2025-03-01T12:00:00Z", beforeId: "uuid-1234" };
    const params6 = buildAuditParams({}, 50, cursor1, "");
    expect(params6.beforeAt).toBe(cursor1.beforeAt);
    expect(params6.beforeId).toBe(cursor1.beforeId);

    // Cursor with null beforeAt (passes through)
    const cursor2 = { beforeAt: null, beforeId: "uuid-5678" };
    const params7 = buildAuditParams({}, 50, cursor2, "");
    expect(params7.beforeAt).toBeNull();
    expect(params7.beforeId).toBe("uuid-5678");

    // Cursor with null beforeId
    const cursor3 = { beforeAt: "2025-03-01T12:00:00Z", beforeId: null };
    const params8 = buildAuditParams({}, 50, cursor3, "");
    expect(params8.beforeAt).toBe(cursor3.beforeAt);
    expect(params8.beforeId).toBeNull();

    // Invalid cursor format (not ISO datetime) — passes through unchecked
    const cursor4 = { beforeAt: "not-a-datetime", beforeId: "invalid-uuid" };
    const params9 = buildAuditParams({}, 50, cursor4, "");
    expect(params9.beforeAt).toBe("not-a-datetime");
    expect(params9.beforeId).toBe("invalid-uuid");

    // Null cursor → both beforeAt and beforeId return null
    const params10 = buildAuditParams({}, 50, null, "");
    expect(params10.beforeAt).toBeNull();
    expect(params10.beforeId).toBeNull();
  });

  qaTest("audit-filter-combined", () => {
    // All filters active at once
    const filters = {
      startDate: "2025-01-01",
      endDate: "2025-06-30",
      actorTypes: ["admin", "system"],
      actions: ["admin.login", "data.score.submitted"],
      categories: ["auth", "data"],
      severities: ["high", "critical"],
    };
    const cursor = { beforeAt: "2025-03-15T10:00:00Z", beforeId: "some-uuid" };
    const params = buildAuditParams(filters, 25, cursor, "test search");

    // All expected keys are present and not corrupted
    expect(params).toHaveProperty("startAt");
    expect(params).toHaveProperty("endAt");
    expect(params).toHaveProperty("actorTypes");
    expect(params).toHaveProperty("actions");
    expect(params).toHaveProperty("categories");
    expect(params).toHaveProperty("severities");
    expect(params).toHaveProperty("limit");
    expect(params).toHaveProperty("beforeAt");
    expect(params).toHaveProperty("beforeId");
    expect(params).toHaveProperty("search");
    expect(params).toHaveProperty("searchDay");
    expect(params).toHaveProperty("searchMonth");
    expect(params).toHaveProperty("searchYear");

    // Values are correct
    expect(params.startAt).not.toBeNull();
    expect(params.endAt).not.toBeNull();
    expect(params.actorTypes).toEqual(["admin", "system"]);
    expect(params.actions).toEqual(["admin.login", "data.score.submitted"]);
    expect(params.categories).toEqual(["auth", "data"]);
    expect(params.severities).toEqual(["high", "critical"]);
    expect(params.limit).toBe(25);
    expect(params.beforeAt).toBe(cursor.beforeAt);
    expect(params.beforeId).toBe(cursor.beforeId);
    expect(params.search).toBe("test search");
    expect(params.searchDay).toBeNull(); // "test search" is not a date pattern
  });
});
