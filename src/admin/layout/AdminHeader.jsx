// src/admin/layout/AdminHeader.jsx — Phase 1
// Prototype source: lines 11722–11754
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/auth";
import { useFloating } from "@/shared/hooks/useFloating";
import { sortPeriodsForPopover } from "@/shared/periodSort";

import { Search, Check, Calendar, Menu, ChevronDown, RefreshCw, FileEdit, Play, Archive } from "lucide-react";

const PAGE_LABELS = {
  overview: "Overview",
  rankings: "Rankings",
  analytics: "Analytics",
  heatmap: "Heatmap",
  reviews: "Reviews",
  jurors: "Jurors",
  projects: "Projects",
  periods: "Evaluation Periods",
  criteria: "Evaluation Criteria",
  outcomes: "Outcomes & Mapping",
  "entry-control": "Entry Control",
  "pin-blocking": "PIN Blocking",
  "audit-log": "Audit Log",
  settings: "Settings",
  export: "Export",
};

// ── Period status helpers ─────────────────────────────────────
const STATUS_ICON = {
  "status-draft":   <FileEdit size={11} strokeWidth={2.2} />,
  "status-live":    <Play size={11} strokeWidth={2.2} />,
  "status-closed":  <Archive size={11} strokeWidth={2.2} />,
};

function getPeriodStatus(p) {
  if (!p) return null;
  if (p.closed_at || p.visibility === "hidden") return { label: "Closed", cls: "status-closed" };
  if (p.is_locked || p.eval_locked) return { label: "Live", cls: "status-live" };
  return { label: "Draft", cls: "status-draft" };
}

function formatPeriodMeta(p) {
  if (!p) return "";
  const parts = [];
  if (p.semester_name && p.semester_name !== p.name) parts.push(p.semester_name);
  if (p.end_date) {
    try {
      const d = new Date(p.end_date);
      if (!isNaN(d)) parts.push(d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }));
    } catch {}
  }
  return parts.join(" · ");
}

// ── Period item row ───────────────────────────────────────────
function PeriodRow({ period, isPinned, onSelect }) {
  const status = getPeriodStatus(period);
  const meta = formatPeriodMeta(period);

  return (
    <div
      data-testid={`period-popover-item-${period.id}`}
      className={`period-popover-item${isPinned ? " pinned" : ""}`}
      onMouseDown={(e) => {
        e.preventDefault();
        onSelect(period.id);
      }}
    >
      <div className="period-popover-item-info">
        <span className="period-popover-item-name">
          {period.name || period.semester_name}
        </span>
        {meta && <span className="period-popover-item-meta">{meta}</span>}
      </div>
      {status && (
        <span className={`period-status-pill ${status.cls}`}>
          {STATUS_ICON[status.cls]}
          {status.label}
        </span>
      )}
      <Check size={16} strokeWidth={2.5} className="period-popover-check" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function AdminHeader({
  currentPage,
  onMobileMenuOpen,
  sortedPeriods = [],
  selectedPeriodId,
  onPeriodChange,
  onRefresh,
  refreshing = false,
  navigateTo,
}) {
  const { activeOrganization } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [iconSpinning, setIconSpinning] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef(null);
  const triggerRef = useRef(null);

  const { floatingRef, floatingStyle } = useFloating({
    triggerRef,
    isOpen: dropdownOpen,
    onClose: () => setDropdownOpen(false),
    placement: 'bottom-end',
  });

  const orgLabel = activeOrganization?.name || activeOrganization?.code || "Organization";
  const pageLabel = PAGE_LABELS[currentPage] || "Overview";

  const selectedPeriod = sortedPeriods.find((p) => p.id === selectedPeriodId);
  const periodLabel = selectedPeriod?.name || selectedPeriod?.semester_name || "—";

  // Threshold to show search input
  const SEARCH_THRESHOLD = 8;
  const showSearch = sortedPeriods.length >= SEARCH_THRESHOLD;

  // Compute popover structure
  const popoverData = useMemo(
    () => sortPeriodsForPopover(sortedPeriods, selectedPeriodId),
    [sortedPeriods, selectedPeriodId]
  );

  // Filter by search query
  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return popoverData;

    const matches = (p) => {
      const searchable = [
        p.id,
        p.name,
        p.semester_name,
        p.season,
      ].filter(Boolean).join(" ").toLowerCase();
      return searchable.includes(q);
    };

    return {
      pinned: popoverData.pinned && matches(popoverData.pinned) ? popoverData.pinned : null,
      recent: popoverData.recent.filter(matches),
      all: popoverData.all.filter(matches),
    };
  }, [popoverData, search]);

  // How many items are NOT shown in pinned + recent (only relevant when not searching)
  const hiddenCount = useMemo(() => {
    const shownIds = new Set();
    if (filteredData.pinned) shownIds.add(filteredData.pinned.id);
    filteredData.recent.forEach((p) => shownIds.add(p.id));
    return filteredData.all.filter((p) => !shownIds.has(p.id)).length;
  }, [filteredData]);

  const hasResults = search
    ? (filteredData.pinned || filteredData.all.length > 0)
    : (filteredData.pinned || filteredData.recent.length > 0);

  // Auto-focus search when popover opens
  useEffect(() => {
    if (dropdownOpen && showSearch) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
    if (!dropdownOpen) setSearch("");
  }, [dropdownOpen, showSearch]);

  useEffect(() => {
    if (!refreshing && iconSpinning) setIconSpinning(false);
  }, [refreshing, iconSpinning]);

  const handleRefreshClick = async () => {
    if (!onRefresh || refreshing) return;
    setIconSpinning(true);
    try {
      await Promise.resolve(onRefresh());
    } finally {
      setIconSpinning(false);
    }
  };

  const handleSelect = (id) => {
    onPeriodChange?.(id);
    setDropdownOpen(false);
  };

  const handleViewAll = () => {
    setDropdownOpen(false);
    navigateTo?.("periods");
  };

  return (
    <header className="admin-header">
      <button
        className="mobile-menu-btn"
        type="button"
        aria-label="Open navigation"
        onClick={onMobileMenuOpen}
      >
        <Menu size={18} />
      </button>
      <div className="header-breadcrumb">
        <strong>{orgLabel}</strong>&nbsp;/&nbsp;<span>{pageLabel}</span>
      </div>
      <div className="header-spacer" />
      {onRefresh && currentPage !== "setup" && (
        <div className="header-refresh-stack">
          <button
            className="btn btn-outline btn-sm header-refresh-btn"
            title="Refresh data"
            onClick={handleRefreshClick}
            disabled={refreshing}
          >
            <RefreshCw size={14} className={`refresh-icon${iconSpinning ? " spinning" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      )}
      {sortedPeriods.length > 0 && currentPage !== "setup" && currentPage !== "audit-log" && (
        <div className={`dropdown${dropdownOpen ? " open" : ""}`}>
          <button
            ref={triggerRef}
            data-testid="period-selector-trigger"
            className={`dropdown-trigger${dropdownOpen ? " open" : ""}`}
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
          >
            <span className="dropdown-dot" />
            <span className="dropdown-trigger-labels">
              <span className="dropdown-trigger-period">{periodLabel}</span>
            </span>
            <ChevronDown size={12} />
          </button>
          {dropdownOpen && createPortal(
            <div
              ref={floatingRef}
              className="dropdown-menu show period-popover"
              style={floatingStyle}
            >
              {/* Header */}
              <div className="period-popover-header">Evaluation Period</div>

              {/* Search */}
              {showSearch && (
                <div className="period-popover-search" style={{ position: "relative" }}>
                  <span className="period-popover-search-icon">
                    <Search size={14} />
                  </span>
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder="Search periods…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.stopPropagation();
                        if (search) setSearch("");
                        else setDropdownOpen(false);
                      }
                    }}
                  />
                </div>
              )}

              {/* Scrollable list */}
              <div className="period-popover-list">
                {/* Pinned selected period */}
                {filteredData.pinned && (
                  <>
                    <PeriodRow
                      period={filteredData.pinned}
                      isPinned
                      onSelect={handleSelect}
                    />
                    {(search ? filteredData.all.length > 1 : filteredData.recent.length > 0) && (
                      <div className="period-popover-divider" />
                    )}
                  </>
                )}

                {/* No search: show recent 5 */}
                {!search && filteredData.recent.length > 0 && (
                  <>
                    <div className="period-popover-section">Recent</div>
                    {filteredData.recent.map((p) => (
                      <PeriodRow
                        key={p.id}
                        period={p}
                        isPinned={false}
                        onSelect={handleSelect}
                      />
                    ))}
                  </>
                )}

                {/* Search active: show ALL matching periods (excluding pinned) */}
                {search && (() => {
                  const pinnedId = filteredData.pinned?.id;
                  const results = filteredData.all.filter((p) => p.id !== pinnedId);
                  if (results.length === 0) return null;
                  const total = results.length + (filteredData.pinned ? 1 : 0);
                  return (
                    <>
                      <div className="period-popover-section">Results ({total})</div>
                      {results.map((p) => (
                        <PeriodRow
                          key={p.id}
                          period={p}
                          isPinned={false}
                          onSelect={handleSelect}
                        />
                      ))}
                    </>
                  );
                })()}

                {/* Empty search state */}
                {!hasResults && search && (
                  <div className="period-popover-empty">
                    No periods matching &ldquo;{search}&rdquo;
                  </div>
                )}
              </div>

              {/* Footer — View all periods */}
              <div className="period-popover-footer">
                <button
                  className="period-popover-footer-btn"
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleViewAll();
                  }}
                >
                  <Calendar size={14} />
                  {hiddenCount > 0
                    ? `View all periods (${sortedPeriods.length})`
                    : "Manage periods"}
                </button>
              </div>
            </div>,
            document.body
          )}
        </div>
      )}
    </header>
  );
}
