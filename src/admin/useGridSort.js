// src/admin/useGridSort.js
// ── Sort & filter state for ScoreGrid ────────────────────────
// Encapsulates: sortGroupId, sortGroupDir, sortJurorDir, sortMode, jurorFilter
// Reads/writes from localStorage via persist.js
// Returns: computed visibleJurors + toggle/set actions

import { useEffect, useMemo, useReducer } from "react";
import { readSection, writeSection } from "./persist";
import { getCellState } from "./scoreHelpers";
import { cmp } from "./utils";

const SECTION = "grid";
const LEGACY  = "matrix"; // old key name, kept for backwards compat

function readGridState() {
  const cur = readSection(SECTION);
  return Object.keys(cur).length ? cur : readSection(LEGACY);
}

function initState() {
  const s = readGridState();
  return {
    sortGroupId:  (s.sortGroupId === null || typeof s.sortGroupId === "number") ? (s.sortGroupId ?? null) : null,
    sortGroupDir: s.sortGroupDir === "asc" || s.sortGroupDir === "desc" ? s.sortGroupDir : "desc",
    sortJurorDir: s.sortJurorDir === "asc" || s.sortJurorDir === "desc" ? s.sortJurorDir : "asc",
    sortMode:     s.sortMode === "group" ? "group" : "juror",
    jurorFilter:  typeof s.jurorFilter === "string" ? s.jurorFilter : "",
  };
}

// Click cycle: new column → desc; same column desc → asc; same column asc → reset (null)
function reducer(state, action) {
  switch (action.type) {
    case "TOGGLE_GROUP_SORT": {
      const { id } = action;
      if (state.sortGroupId !== id)      return { ...state, sortGroupId: id, sortGroupDir: "desc", sortMode: "group" };
      if (state.sortGroupDir === "desc") return { ...state, sortGroupDir: "asc", sortMode: "group" };
      return                                    { ...state, sortGroupId: null,  sortGroupDir: "desc", sortMode: "juror" };
    }
    case "TOGGLE_JUROR_SORT":
      if (state.sortMode !== "juror") return { ...state, sortMode: "juror" };
      return { ...state, sortJurorDir: state.sortJurorDir === "asc" ? "desc" : "asc" };
    case "SET_JUROR_FILTER":
      return { ...state, jurorFilter: action.value };
    default:
      return state;
  }
}

export function useGridSort(jurors, lookup) {
  const [state, dispatch] = useReducer(reducer, null, initState);
  const { sortGroupId, sortGroupDir, sortJurorDir, sortMode, jurorFilter } = state;

  // Persist on every state change (single write, covers all fields)
  useEffect(() => {
    writeSection(SECTION, state);
  }, [state]);

  const visibleJurors = useMemo(() => {
    let list = jurors.slice();

    if (jurorFilter) {
      const q = jurorFilter.toLowerCase().trim();
      list = list.filter((j) => {
        const name = String(j.name || "").toLowerCase();
        const dept = String(j.dept || "").toLowerCase();
        return name.includes(q) || dept.includes(q);
      });
    }

    if (sortMode === "group" && sortGroupId !== null) {
      // Sort by active group column; partial/empty cells always sink to bottom
      list.sort((a, b) => {
        const ea = lookup[a.key]?.[sortGroupId];
        const eb = lookup[b.key]?.[sortGroupId];
        const va = getCellState(ea) === "scored" ? Number(ea.total) : null;
        const vb = getCellState(eb) === "scored" ? Number(eb.total) : null;

        if (va === null && vb === null) return cmp(a.name, b.name);
        if (va === null) return 1;
        if (vb === null) return -1;

        const diff = sortGroupDir === "desc" ? vb - va : va - vb;
        return diff !== 0 ? diff : cmp(a.name, b.name); // stable tie-breaker
      });
    } else {
      // Juror name sort (or no sort → default alphabetical)
      const dir = sortMode === "juror" && sortJurorDir === "desc" ? -1 : 1;
      list.sort((a, b) => dir * cmp(a.name, b.name));
    }

    return list;
  }, [jurors, jurorFilter, sortGroupId, sortGroupDir, sortMode, sortJurorDir, lookup]);

  const toggleGroupSort = (id) => dispatch({ type: "TOGGLE_GROUP_SORT", id });
  const toggleJurorSort = ()    => dispatch({ type: "TOGGLE_JUROR_SORT" });
  const setJurorFilter  = (v)   => dispatch({ type: "SET_JUROR_FILTER", value: v });

  return {
    sortGroupId, sortGroupDir, sortJurorDir, sortMode, jurorFilter,
    visibleJurors, toggleGroupSort, toggleJurorSort, setJurorFilter,
  };
}
