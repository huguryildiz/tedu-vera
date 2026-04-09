// src/admin/AuditLogPage.jsx — Phase 10
// Audit Log page: track admin actions, score changes, and access events.
// Hook connections: useAuditLogFilters, usePageRealtime

import { useMemo, useState } from "react";
import { useAdminContext } from "../hooks/useAdminContext";
import { ChevronLeft, ChevronRight, Filter, RefreshCw } from "lucide-react";
import { useToast } from "@/shared/hooks/useToast";
import FbAlert from "@/shared/ui/FbAlert";
import { FilterButton } from "@/shared/ui/FilterButton";
import { useAuditLogFilters } from "../hooks/useAuditLogFilters";
import { usePageRealtime } from "../hooks/usePageRealtime";
import ExportPanel from "../components/ExportPanel";
import CustomSelect from "@/shared/ui/CustomSelect";
import { getActorInfo, formatActionLabel, formatActionDetail } from "../utils/auditUtils";

// ── Chip helpers ──────────────────────────────────────────────
const CHIP_MAP = {
  entry_tokens:       { type: "token",    label: "Token" },
  score_sheets:       { type: "eval",     label: "Evaluation" },
  jurors:             { type: "juror",    label: "Juror" },
  periods:            { type: "period",   label: "Period" },
  projects:           { type: "project",  label: "Project" },
  organizations:      { type: "security", label: "Security" },
  memberships:        { type: "security", label: "Security" },
  juror_period_auth:  { type: "juror",    label: "Juror" },
  profiles:           { type: "security", label: "Auth" },
  audit_logs:         { type: "security", label: "Audit" },
  period_criteria:    { type: "period",   label: "Criteria" },
  framework_outcomes: { type: "period",   label: "Outcome" },
  org_applications:   { type: "security", label: "Application" },
};

// Unique chip labels for Type filter dropdown
const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  ...Object.values(
    Object.entries(CHIP_MAP).reduce((acc, [, chip]) => {
      if (!acc[chip.label]) acc[chip.label] = chip.label;
      return acc;
    }, {})
  ).map((label) => ({ value: label, label })),
];

const ACTOR_TYPES = [
  { value: "", label: "All" },
  { value: "admin", label: "Admin" },
  { value: "juror", label: "Juror" },
  { value: "system", label: "System" },
];

function getChip(resourceType) {
  return CHIP_MAP[resourceType] || { type: "eval", label: "System" };
}

function SortIcon({ colKey, sortKey, sortDir }) {
  if (sortKey !== colKey) {
    return <span className="sort-icon sort-icon-inactive">▲</span>;
  }
  return (
    <span className="sort-icon sort-icon-active">
      {sortDir === "asc" ? "▲" : "▼"}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────
export default function AuditLogPage() {
  const { organizationId } = useAdminContext();
  const _toast = useToast();
  const setMessage = (msg) => { if (msg) _toast.success(msg); };

  const [filterOpen, setFilterOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [datePreset, setDatePreset] = useState("all");
  const [sortKey, setSortKey] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");

  // Client-side filters (applied after data loads)
  const [typeFilter, setTypeFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");

  // Pagination
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  const {
    auditLogs,
    auditLoading,
    auditError,
    auditFilters,
    setAuditFilters,
    auditSearch,
    setAuditSearch,
    auditHasMore,
    auditExporting,
    showAuditSkeleton,
    isAuditStaleRefresh,
    hasAuditFilters,
    auditRangeError,
    handleAuditRefresh,
    handleAuditReset,
    handleAuditLoadMore,
    handleAuditExport,
    scheduleAuditRefresh,
    formatAuditTimestamp,
  } = useAuditLogFilters({ organizationId, isMobile: false, setMessage });

  // Active filter count
  const auditActiveFilterCount =
    (auditSearch?.trim() ? 1 : 0) +
    (auditFilters?.startDate ? 1 : 0) +
    (auditFilters?.endDate ? 1 : 0) +
    (typeFilter ? 1 : 0) +
    (actorFilter ? 1 : 0);

  // Real-time: refresh on new audit log inserts
  usePageRealtime({
    organizationId,
    channelName: "audit-log-page-live",
    subscriptions: [
      { table: "audit_logs", event: "INSERT", onPayload: scheduleAuditRefresh },
    ],
  });

  // ── Date preset handler ───────────────────────────────────
  function applyDatePreset(preset) {
    setDatePreset(preset);
    setCurrentPage(1);
    const now = new Date();
    if (preset === "all") {
      setAuditFilters((f) => ({ ...f, startDate: "", endDate: "" }));
    } else if (preset === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      setAuditFilters((f) => ({ ...f, startDate: start.toISOString().slice(0, 16), endDate: "" }));
    } else if (preset === "7d") {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setAuditFilters((f) => ({ ...f, startDate: start.toISOString().slice(0, 16), endDate: "" }));
    } else if (preset === "30d") {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setAuditFilters((f) => ({ ...f, startDate: start.toISOString().slice(0, 16), endDate: "" }));
    }
  }

  // ── Client-side filtering ────────────────────────────────
  const filteredLogs = useMemo(() => {
    let rows = auditLogs;
    if (typeFilter) {
      rows = rows.filter((l) => getChip(l.resource_type).label === typeFilter);
    }
    if (actorFilter) {
      rows = rows.filter((l) => getActorInfo(l).type === actorFilter);
    }
    return rows;
  }, [auditLogs, typeFilter, actorFilter]);

  // ── KPI derived values (from filtered data per CLAUDE.md rule) ──
  const kpiBase = filteredLogs;
  const total = kpiBase.length;
  const today = kpiBase.filter((l) => {
    if (!l.created_at) return false;
    const d = new Date(l.created_at);
    const n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  }).length;
  const adminCount = kpiBase.filter((l) => getActorInfo(l).type === "admin").length;
  const jurorCount = kpiBase.filter((l) => getActorInfo(l).type === "juror").length;

  // ── Sorting ──────────────────────────────────────────────
  const sortedAuditLogs = useMemo(() => {
    const rows = [...filteredLogs];
    rows.sort((a, b) => {
      const direction = sortDir === "asc" ? 1 : -1;
      let cmp = 0;
      if (sortKey === "created_at") {
        const aTs = Date.parse(a.created_at || "");
        const bTs = Date.parse(b.created_at || "");
        const aValue = Number.isFinite(aTs) ? aTs : Number.NEGATIVE_INFINITY;
        const bValue = Number.isFinite(bTs) ? bTs : Number.NEGATIVE_INFINITY;
        cmp = aValue - bValue;
      } else if (sortKey === "resource_type") {
        cmp = getChip(a.resource_type).label.localeCompare(getChip(b.resource_type).label, "tr", { sensitivity: "base", numeric: true });
      } else if (sortKey === "actor") {
        cmp = getActorInfo(a).name.localeCompare(getActorInfo(b).name, "tr", { sensitivity: "base", numeric: true });
      } else if (sortKey === "action") {
        cmp = formatActionLabel(a.action).localeCompare(formatActionLabel(b.action), "tr", { sensitivity: "base", numeric: true });
      }
      if (cmp !== 0) return cmp * direction;
      const aTs = Date.parse(a.created_at || "");
      const bTs = Date.parse(b.created_at || "");
      return (Number.isFinite(bTs) ? bTs : -Infinity) - (Number.isFinite(aTs) ? aTs : -Infinity);
    });
    return rows;
  }, [filteredLogs, sortKey, sortDir]);

  // ── Pagination ───────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sortedAuditLogs.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, sortedAuditLogs.length);
  const pagedLogs = sortedAuditLogs.slice(pageStart, pageEnd);

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "created_at" ? "desc" : "asc");
  }

  function handleClearAllFilters() {
    handleAuditReset();
    setDatePreset("all");
    setTypeFilter("");
    setActorFilter("");
    setCurrentPage(1);
  }

  return (
    <div className="page">
      <div className="page-title">Audit Log</div>
      <div className="page-desc">
        Track admin actions, score changes, and access events for compliance and accountability.
      </div>

      {/* Insight banner */}
      <div className="insight-banner">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <div>Complete activity trail for compliance and operational monitoring.</div>
      </div>

      {/* KPI strip */}
      <div className="scores-kpi-strip">
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value">{auditLoading && total === 0 ? "—" : total}</div>
          <div className="scores-kpi-item-label">Total Events</div>
        </div>
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value"><span className="accent">{auditLoading && total === 0 ? "—" : today}</span></div>
          <div className="scores-kpi-item-label">Today</div>
        </div>
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value">{auditLoading && total === 0 ? "—" : adminCount}</div>
          <div className="scores-kpi-item-label">Admin Actions</div>
        </div>
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value">{auditLoading && total === 0 ? "—" : jurorCount}</div>
          <div className="scores-kpi-item-label">Juror Events</div>
        </div>
      </div>

      {/* Error */}
      {(auditError || auditRangeError) && (
        <FbAlert variant="danger" style={{ marginBottom: 12 }}>
          {auditRangeError || auditError}
        </FbAlert>
      )}

      {/* Toolbar */}
      <div className="audit-toolbar">
        <div className="audit-search-wrap">
          <svg className="audit-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            className="audit-search-input"
            type="text"
            placeholder="Search events, actors, actions…"
            value={auditSearch}
            onChange={(e) => { setAuditSearch(e.target.value); setCurrentPage(1); }}
          />
        </div>

        <FilterButton
          activeCount={auditActiveFilterCount}
          isOpen={filterOpen}
          onClick={() => { setFilterOpen((v) => !v); setExportOpen(false); }}
        />

        <div style={{ flex: 1 }} />

        <button
          className="btn btn-outline btn-sm"
          type="button"
          disabled={auditExporting}
          onClick={() => { setExportOpen((v) => !v); setFilterOpen(false); }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 13, height: 13, marginRight: 4 }}>
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export
        </button>
      </div>

      {/* Filter Panel */}
      {filterOpen && (
        <div className="filter-panel show" style={{ marginBottom: 12 }}>
          <div className="filter-panel-header">
            <div>
              <h4>
                <Filter size={14} style={{ verticalAlign: "-1px", marginRight: 4, opacity: 0.5 }} />
                Filter Audit Log
              </h4>
              <div className="filter-panel-sub">Narrow events by date range, type, and actor.</div>
            </div>
            <button className="filter-panel-close" type="button" onClick={() => setFilterOpen(false)}>×</button>
          </div>
          <div className="filter-row">
            <div className="filter-group">
              <label>Date Range</label>
              <CustomSelect
                compact
                value={datePreset}
                onChange={(v) => applyDatePreset(v)}
                options={[
                  { value: "all", label: "All time" },
                  { value: "today", label: "Today" },
                  { value: "7d", label: "Last 7 days" },
                  { value: "30d", label: "Last 30 days" },
                  { value: "custom", label: "Custom range…" },
                ]}
                ariaLabel="Date range"
              />
            </div>
            {datePreset === "custom" && (
              <div className="filter-group">
                <label>From</label>
                <input
                  type="datetime-local"
                  className="audit-date-input"
                  value={auditFilters.startDate}
                  onChange={(e) => { setAuditFilters((f) => ({ ...f, startDate: e.target.value })); setCurrentPage(1); }}
                />
              </div>
            )}
            {datePreset === "custom" && (
              <div className="filter-group">
                <label>To</label>
                <input
                  type="datetime-local"
                  className="audit-date-input"
                  value={auditFilters.endDate}
                  onChange={(e) => { setAuditFilters((f) => ({ ...f, endDate: e.target.value })); setCurrentPage(1); }}
                />
              </div>
            )}
            <div className="filter-group">
              <label>Type</label>
              <CustomSelect
                compact
                value={typeFilter}
                onChange={(v) => { setTypeFilter(v); setCurrentPage(1); }}
                options={TYPE_OPTIONS}
                ariaLabel="Event type"
              />
            </div>
            <div className="filter-group">
              <label>Actor</label>
              <CustomSelect
                compact
                value={actorFilter}
                onChange={(v) => { setActorFilter(v); setCurrentPage(1); }}
                options={ACTOR_TYPES}
                ariaLabel="Actor type"
              />
            </div>
          </div>
          <button
            className="btn btn-outline btn-sm filter-clear-btn"
            type="button"
            onClick={handleClearAllFilters}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
            Clear all
          </button>
        </div>
      )}

      {/* Export Panel */}
      {exportOpen && (
        <ExportPanel
          title="Export Audit Log"
          subtitle="Download the full activity trail with timestamps, actors, and event details."
          meta={`${total} events · ${hasAuditFilters || typeFilter || actorFilter ? "Filtered" : "All time"}`}
          loading={auditExporting}
          onClose={() => setExportOpen(false)}
          onExport={async (fmt) => {
            await handleAuditExport(fmt);
            setExportOpen(false);
          }}
          style={{ marginBottom: 12 }}
        />
      )}

      {/* Audit table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th
                  className={`sortable${sortKey === "created_at" ? " sorted" : ""}`}
                  style={{ width: 170 }}
                  onClick={() => handleSort("created_at")}
                >
                  Timestamp <SortIcon colKey="created_at" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th
                  className={`sortable${sortKey === "resource_type" ? " sorted" : ""}`}
                  style={{ width: 95 }}
                  onClick={() => handleSort("resource_type")}
                >
                  Type <SortIcon colKey="resource_type" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th
                  className={`sortable${sortKey === "actor" ? " sorted" : ""}`}
                  style={{ width: 200 }}
                  onClick={() => handleSort("actor")}
                >
                  Actor <SortIcon colKey="actor" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th className={`sortable${sortKey === "action" ? " sorted" : ""}`} onClick={() => handleSort("action")}>
                  Action <SortIcon colKey="action" sortKey={sortKey} sortDir={sortDir} />
                </th>
              </tr>
            </thead>
            <tbody>
              {showAuditSkeleton && (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={4}>
                      <div className="audit-skeleton-row" />
                    </td>
                  </tr>
                ))
              )}

              {!auditLoading && sortedAuditLogs.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-sm text-muted" style={{ textAlign: "center", padding: "22px 0" }}>
                    {hasAuditFilters || typeFilter || actorFilter ? "No results for the current filters." : "No audit events yet."}
                  </td>
                </tr>
              )}

              {pagedLogs.map((log) => {
                const chip = getChip(log.resource_type);
                const actor = getActorInfo(log);
                const ts = formatAuditTimestamp(log.created_at);
                const detail = formatActionDetail(log);
                return (
                  <tr key={log.id} className={actor.type === "system" ? "audit-row-system" : ""}>
                    <td className="audit-ts">
                      <div className="audit-ts-main">{ts}</div>
                    </td>
                    <td>
                      <span className={`audit-chip audit-chip-${chip.type}`}>{chip.label}</span>
                    </td>
                    <td className="audit-actor">
                      {actor.type === "system" ? (
                        <div className="audit-actor-avatar audit-actor-system">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 13, height: 13 }}>
                            <path d="M12 2a10 10 0 110 20 10 10 0 010-20z" /><path d="M12 6v6l4 2" />
                          </svg>
                        </div>
                      ) : (
                        <div className={`audit-actor-avatar${actor.type === "juror" ? " audit-actor-juror" : ""}`}>
                          {actor.initials}
                        </div>
                      )}
                      <div className="audit-actor-info">
                        <div className="audit-actor-name" style={actor.type === "system" ? { color: "var(--text-tertiary)" } : {}}>
                          {actor.name}
                        </div>
                        <div className="audit-actor-role">{actor.role}</div>
                      </div>
                    </td>
                    <td>
                      <div className={`audit-action-main${isAuditStaleRefresh ? " opacity-40" : ""}`}>
                        {formatActionLabel(log.action)}
                      </div>
                      {detail && (
                        <div className="audit-action-detail">{detail}</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="audit-footer">
          <div className="audit-footer-left">
            <span className="text-sm text-muted">
              {auditLoading
                ? "Loading…"
                : sortedAuditLogs.length === 0
                  ? "No events"
                  : `Showing ${pageStart + 1}–${pageEnd} of ${sortedAuditLogs.length}${auditHasMore ? "+" : ""}`
              }
            </span>
            <CustomSelect
              compact
              value={String(pageSize)}
              onChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}
              options={[
                { value: "25", label: "25 / page" },
                { value: "50", label: "50 / page" },
                { value: "100", label: "100 / page" },
              ]}
              ariaLabel="Page size"
            />
          </div>
          <div className="audit-pagination">
            <button
              className="audit-page-btn"
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="audit-page-current">{safePage}</span>
            <span className="audit-page-sep">/</span>
            <span className="audit-page-total">{totalPages}</span>
            <button
              className="audit-page-btn"
              type="button"
              disabled={safePage >= totalPages && !auditHasMore}
              onClick={() => {
                if (safePage < totalPages) {
                  setCurrentPage((p) => p + 1);
                } else if (auditHasMore) {
                  handleAuditLoadMore();
                  setCurrentPage((p) => p + 1);
                }
              }}
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
            <button
              className="btn btn-outline btn-sm audit-refresh-btn"
              type="button"
              disabled={auditLoading}
              onClick={() => { handleAuditRefresh(); setCurrentPage(1); }}
            >
              <RefreshCw size={11} />
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
