// src/admin/useScoreGridData.js
// ── Data preparation for ScoreGrid ───────────────────────────
// Thin React wrapper around pure selectors in ./selectors/gridSelectors.
// All computation logic lives in the selectors; this hook only wires
// useMemo / useCallback and provides the stable return shape.

import { useMemo, useCallback } from "react";
import { CRITERIA } from "../config";
import { getJurorWorkflowState } from "./scoreHelpers";
import {
  buildLookup,
  buildJurorFinalMap,
  filterCompletedJurors,
  computeGroupAverages,
  buildExportRowsData,
} from "./selectors/gridSelectors";

export function useScoreGridData({ data, jurors, groups, criteriaConfig }) {
  const activeCriteria = criteriaConfig || CRITERIA;

  const lookup = useMemo(
    () => buildLookup(data, activeCriteria),
    [data, activeCriteria] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const jurorFinalMap = useMemo(
    () => buildJurorFinalMap(jurors),
    [jurors]
  );

  const jurorWorkflowMap = useMemo(() => {
    const map = new Map();
    (jurors || []).forEach((j) => {
      map.set(j.key, getJurorWorkflowState(j, groups || [], lookup, jurorFinalMap));
    });
    return map;
  }, [jurors, groups, lookup, jurorFinalMap]);

  const completedJurors = useMemo(
    () => filterCompletedJurors(jurors),
    [jurors]
  );

  const groupAverages = useMemo(
    () => computeGroupAverages(completedJurors, groups, lookup),
    [completedJurors, groups, lookup]
  );

  const buildExportRows = useCallback(
    (jurorList) => buildExportRowsData(jurorList, groups, lookup, jurorFinalMap, jurorWorkflowMap),
    [groups, lookup, jurorFinalMap, jurorWorkflowMap]
  );

  return {
    lookup,
    jurorFinalMap,
    jurorWorkflowMap,
    groupAverages,
    buildExportRows,
  };
}
