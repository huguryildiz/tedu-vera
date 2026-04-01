// src/admin/analytics/TrendPeriodSelect.jsx
// Period multi-select dropdown for trend chart.
// Extracted from AnalyticsTab.jsx — structural refactor only.

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon, SearchIcon } from "../../shared/Icons";

export default function TrendPeriodSelect({ periods, selectedIds, onChange, loading }) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const wrapRef = useRef(null);
  const allCheckboxRef = useRef(null);
  const periodList = useMemo(() => {
    if (Array.isArray(periods)) return periods;
    if (periods && typeof periods === "object") return Object.values(periods);
    return [];
  }, [periods]);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredSemesterList = useMemo(() => {
    if (!normalizedSearch) return periodList;
    return periodList.filter((s) =>
      String(s?.period_name || "").toLowerCase().includes(normalizedSearch)
    );
  }, [periodList, normalizedSearch]);

  useEffect(() => {
    if (!open) setSearchTerm("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selectedSet = useMemo(() => new Set(selectedIds || []), [selectedIds]);
  const allSelected = periodList.length > 0 && selectedSet.size === periodList.length;
  const partiallySelected = selectedSet.size > 0 && !allSelected;

  useEffect(() => {
    if (!allCheckboxRef.current) return;
    allCheckboxRef.current.indeterminate = partiallySelected;
  }, [partiallySelected, open]);

  const toggleAll = () => {
    if (loading) return;
    if (allSelected) {
      onChange([]);
      return;
    }
    onChange(periodList.map((s) => s.id));
  };

  const toggle = (id) => {
    if (selectedSet.has(id)) {
      onChange((selectedIds || []).filter((x) => x !== id));
      return;
    }
    onChange([...(selectedIds || []), id]);
  };

  return (
    <div className={`trend-select${open ? " open" : ""}`} ref={wrapRef}>
      <button
        type="button"
        className="trend-select-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Select periods for trend chart"
        aria-haspopup="dialog"
      >
        <span className="trend-select-label">
          <span>Periods</span>
          <span className="trend-select-count">{(selectedIds || []).length}</span>
        </span>
        <span className={`trend-select-chevron${open ? " open" : ""}`} aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>

      {open && (
        <div className="trend-select-panel" role="dialog" aria-label="Trend period selection">
          <div className="trend-select-list">
            <div className="trend-select-search-wrap">
              <span className="trend-select-search-icon" aria-hidden="true">
                <SearchIcon />
              </span>
              <input
                type="text"
                className="trend-select-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search periods"
                aria-label="Search periods"
              />
            </div>
            {periodList.length === 0 && (
              <div className="trend-select-empty">No periods available.</div>
            )}
            {periodList.length > 0 && (
              <>
                <label className="trend-select-option trend-select-option-all">
                  <input
                    ref={allCheckboxRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    disabled={loading}
                  />
                  <span>All Periods</span>
                </label>
                {filteredSemesterList.length === 0 ? (
                  <div className="trend-select-empty">No matching periods.</div>
                ) : (
                  filteredSemesterList.map((s) => (
                    <label key={s.id} className="trend-select-option">
                      <input
                        type="checkbox"
                        checked={selectedSet.has(s.id)}
                        onChange={() => toggle(s.id)}
                        disabled={loading}
                      />
                      <span>{s.period_name || "—"}</span>
                    </label>
                  ))
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
