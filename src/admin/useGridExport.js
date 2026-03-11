// src/admin/useGridExport.js
// ── Export workflow for ScoreGrid ────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { exportGridXLSX } from "./utils";

export function useGridExport({ buildExportRows, groups, semesterName, jurors, visibleJurors }) {
  const [showExportPrompt, setShowExportPrompt] = useState(false);

  // Auto-dismiss export prompt when filter is cleared
  useEffect(() => {
    if ((visibleJurors?.length || 0) >= (jurors?.length || 0)) {
      setShowExportPrompt(false);
    }
  }, [visibleJurors?.length, jurors?.length]);

  const doExport = useCallback((jurorList) => {
    const exportRows = buildExportRows(jurorList);
    void exportGridXLSX(exportRows, groups, { semesterName });
  }, [buildExportRows, groups, semesterName]);

  const requestExport = useCallback(() => {
    if ((visibleJurors?.length || 0) < (jurors?.length || 0)) {
      setShowExportPrompt(true);
      return;
    }
    doExport(visibleJurors);
  }, [visibleJurors, jurors, doExport]);

  const exportFiltered = useCallback(() => {
    doExport(visibleJurors);
    setShowExportPrompt(false);
  }, [visibleJurors, doExport]);

  const exportAll = useCallback(() => {
    doExport(jurors);
    setShowExportPrompt(false);
  }, [jurors, doExport]);

  const dismissExportPrompt = useCallback(() => {
    setShowExportPrompt(false);
  }, []);

  return {
    showExportPrompt,
    requestExport,
    exportFiltered,
    exportAll,
    dismissExportPrompt,
  };
}
