function toStartDateMs(value) {
  if (!value) return -1;
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : -1;
}

export function sortPeriodsByStartDateDesc(list = []) {
  return [...(list || [])].sort((a, b) => {
    const diff = toStartDateMs(b?.start_date) - toStartDateMs(a?.start_date);
    if (diff !== 0) return diff;
    return String(a?.name || "").localeCompare(String(b?.name || ""), "tr");
  });
}

// ── Popover sort: end_date ?? updated_at DESC, status-based secondary ──

function toSortDateMs(period) {
  const raw = period?.end_date || period?.updated_at;
  if (!raw) return -1;
  const ms = Date.parse(String(raw));
  return Number.isFinite(ms) ? ms : -1;
}

/** Status priority: lower = higher priority */
function statusPriority(p) {
  if (!p) return 9;
  // active/current (not locked, not closed, not archived)
  const isClosed = !!p.closed_at;
  const isLocked = !!(p.is_locked || p.eval_locked);
  const isArchived = p.visibility === "hidden";
  if (!isClosed && !isLocked && !isArchived) return 0; // active/current
  if (isLocked && !isClosed) return 1; // locked
  if (isClosed && !isArchived) return 2; // closed
  if (isArchived) return 3; // archived
  return 4;
}

function popoverCompare(a, b) {
  const diff = toSortDateMs(b) - toSortDateMs(a);
  if (diff !== 0) return diff;
  const sp = statusPriority(a) - statusPriority(b);
  if (sp !== 0) return sp;
  return String(a?.name || "").localeCompare(String(b?.name || ""), "tr");
}

/**
 * sortPeriodsForPopover — returns structured data for the period popover.
 *
 * @param {object[]} periods  — raw period list
 * @param {string}   selectedId — currently selected period ID
 * @param {number}   [recentCount=5] — how many recent periods to show
 * @returns {{ pinned: object|null, recent: object[], all: object[] }}
 */
export function sortPeriodsForPopover(periods = [], selectedId, recentCount = 5) {
  const sorted = [...(periods || [])].sort(popoverCompare);
  const pinned = sorted.find((p) => p.id === selectedId) || null;
  const rest = sorted.filter((p) => p.id !== selectedId);
  return {
    pinned,
    recent: rest.slice(0, recentCount),
    all: sorted,
  };
}
