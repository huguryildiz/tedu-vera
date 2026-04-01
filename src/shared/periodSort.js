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
