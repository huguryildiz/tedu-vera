const collator = new Intl.Collator(undefined, { sensitivity: "base" });

const STATUS_RANK = {
  completed: 0,
  in_progress: 1,
  pending: 1,
  invited: 2,
  not_started: 3,
};

function statusRank(s) {
  return STATUS_RANK[s] ?? 99;
}

export const MOBILE_SORT_KEYS = [
  { value: "avg_desc",  label: "Avg \u2193" },
  { value: "avg_asc",   label: "Avg \u2191" },
  { value: "name_asc",  label: "Name A\u2013Z" },
  { value: "name_desc", label: "Name Z\u2013A" },
  { value: "status",    label: "Status" },
];

const VALID = new Set(MOBILE_SORT_KEYS.map(o => o.value));

export function sortMobileJurors(jurors, key, { rowAvgs, workflow } = {}) {
  const safeKey = VALID.has(key) ? key : "name_asc";
  const list = jurors.slice();
  const nameCmp = (a, b) => collator.compare(a.name || "", b.name || "");

  list.sort((a, b) => {
    if (safeKey === "name_asc")  return nameCmp(a, b);
    if (safeKey === "name_desc") return nameCmp(b, a);

    if (safeKey === "status") {
      const ra = statusRank(workflow?.get(a.key));
      const rb = statusRank(workflow?.get(b.key));
      return ra !== rb ? ra - rb : nameCmp(a, b);
    }

    // avg_desc / avg_asc
    const va = rowAvgs?.get(a.key);
    const vb = rowAvgs?.get(b.key);
    const aNull = va == null;
    const bNull = vb == null;
    if (aNull && bNull) return nameCmp(a, b);
    if (aNull) return 1;
    if (bNull) return -1;
    const diff = safeKey === "avg_desc" ? vb - va : va - vb;
    return diff !== 0 ? diff : nameCmp(a, b);
  });

  return list;
}
