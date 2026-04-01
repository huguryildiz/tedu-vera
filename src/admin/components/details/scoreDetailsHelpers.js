// src/admin/components/details/scoreDetailsHelpers.js
// ============================================================
// Pure helper functions for ScoreDetails derived state.
// ============================================================

import { formatTs } from "../../utils";
import { formatDateOnlyFromMs } from "./ScoreDetailsTable";
import { isInvalidNumberRange } from "../../hooks/useScoreDetailsFilters";

/**
 * Toggle a value in a multi-select array, preserving a custom sort order.
 */
export function toggleMulti(value, selected, setter, order = []) {
  const next = new Set(selected);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  let list = Array.from(next);
  if (order.length > 0) {
    const orderMap = new Map(order.map((v, i) => [v, i]));
    list.sort((a, b) => (orderMap.get(a) ?? 9999) - (orderMap.get(b) ?? 9999));
  }
  setter(list);
}

/**
 * Build a human-readable sort label from the current sort state.
 */
export function buildSortLabel(columns, sortKey, sortDir) {
  if (!sortKey) return null;
  const col = columns.find((c) => c.sortKey === sortKey);
  const colLabel = col?.label || "Column";
  const isDateSort = sortKey === "updatedMs" || sortKey === "finalSubmittedMs";
  const isTextSort = [
    "period",
    "title",
    "students",
    "juryName",
    "affiliation",
    "effectiveStatus",
    "jurorStatus",
  ].includes(sortKey);
  const dirLabel = isDateSort
    ? (sortDir === "asc" ? "oldest → newest" : "newest → oldest")
    : isTextSort
      ? (sortDir === "asc" ? "A → Z" : "Z → A")
      : (sortDir === "asc" ? "low → high" : "high → low");
  return `${colLabel} (${dirLabel})`;
}

/**
 * Build the active filter chips array from column definitions.
 */
export function buildActiveFilterChips(columns) {
  const chips = [];
  columns.forEach((col) => {
    const f = col.filter;
    if (!f || !f.isActive) return;
    let value = "";
    if (f.type === "text" || f.type === "select") value = f.value || "";
    if (f.type === "multi") {
      const allMode = f.allMode || "empty";
      if (allMode === "all" && f.value === null) return;
      const selected = Array.isArray(f.value) ? f.value : [];
      if (selected.length === 0) {
        if (allMode === "all") {
          value = "None";
        } else {
          return;
        }
      } else {
        const labelMap = new Map((f.options || []).map((o) => {
          if (typeof o === "string") return [o, o];
          return [o.value, o.label];
        }));
        value = selected.length <= 2
          ? selected.map((v) => labelMap.get(v) ?? v).join(", ")
          : `${selected.length} selected`;
      }
    }
    if (f.type === "dateRange") {
      const fromRaw = f.value?.from ?? "";
      const toRaw = f.value?.to ?? "";
      if (!fromRaw && !toRaw) return;
      const fromParsed = f.parsedFrom;
      const toParsed = f.parsedTo;
      const fromMs = fromParsed ? fromParsed.ms : null;
      const toMs = toParsed ? toParsed.ms : null;
      const invalidDateRange = (fromRaw && fromMs === null)
        || (toRaw && toMs === null)
        || (toRaw && !fromRaw)
        || (fromMs !== null && toMs !== null && fromMs > toMs);
      if (invalidDateRange) return;
      const from = fromRaw
        ? (fromParsed?.isDateOnly ? formatDateOnlyFromMs(fromParsed.ms) : formatTs(fromRaw))
        : "—";
      const to = toRaw
        ? (toParsed?.isDateOnly ? formatDateOnlyFromMs(toParsed.ms) : formatTs(toRaw))
        : "—";
      value = `${from} → ${to}`;
    }
    if (f.type === "numberRange") {
      const minRaw = f.value?.min ?? "";
      const maxRaw = f.value?.max ?? "";
      if (minRaw === "" && maxRaw === "") return;
      if (isInvalidNumberRange(minRaw, maxRaw)) return;
      if (minRaw !== "" && maxRaw !== "") value = `${minRaw}–${maxRaw}`;
      else if (minRaw !== "") value = `≥ ${minRaw}`;
      else value = `≤ ${maxRaw}`;
    }
    chips.push({ id: col.id, label: col.label, value, onClear: f.clear });
  });
  return chips;
}
