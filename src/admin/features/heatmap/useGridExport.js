// src/admin/useGridExport.js
// ── Export workflow for HeatmapPage ──────────────────────────

import { useCallback } from "react";
import { exportGridXLSX } from "@/admin/utils/exportXLSX";
import { downloadTable } from "@/admin/utils/downloadTable";
import { logExportInitiated } from "@/shared/api";
import { useAuth } from "@/auth";

export function useGridExport({ buildExportRows, groups, periodName, visibleJurors, lookup, activeCriteria = [] }) {
  const { activeOrganization } = useAuth();
  const tenantCode = activeOrganization?.code || "";
  const orgName = activeOrganization?.name || "";
  const deptName = "";
  const organizationId = activeOrganization?.id || null;

  // Build per-criterion rows (one tab per criterion showing that criterion's score)
  function buildCriterionTabs(jurorList) {
    return activeCriteria.map((c) => ({
      id: c.id,
      label: `${c.shortLabel || c.label || c.id} (${c.max})`,
      rows: (jurorList || []).map((juror) => {
        const scores = {};
        (groups || []).forEach((g) => {
          const entry = lookup?.[juror.key]?.[g.id];
          const val = entry?.[c.id];
          scores[g.id] = val !== null && val !== undefined ? val : null;
        });
        return { name: juror.name, dept: juror.dept ?? "", scores };
      }),
    }));
  }

  const requestExport = useCallback(async (format = "xlsx") => {
    // Both XLSX and PDF use the same comprehensive structure:
    // "All Criteria" totals + per-criterion breakdown.
    const exportRows    = buildExportRows(visibleJurors, "all");
    const criterionTabs = buildCriterionTabs(visibleJurors);

    await logExportInitiated({
      action: "export.heatmap",
      organizationId,
      resourceType: "score_sheets",
      details: {
        format,
        row_count: exportRows.length,
        period_name: periodName ?? null,
        project_count: groups.length,
        juror_count: exportRows.length,
        filters: { visible_jurors: visibleJurors.length, criteria_count: activeCriteria.length },
      },
    });

    if (format === "xlsx") {
      void exportGridXLSX(exportRows, groups, { periodName, tenantCode, criterionTabs });
      return;
    }

    // PDF: "All Criteria" page + one extra page per criterion
    const groupHeaders = (groups || []).map((g) =>
      g.group_no != null ? [`P${g.group_no}`, g.title || ""].filter(Boolean).join(" — ") : (g.title || String(g.id))
    );
    const allHeader = ["Juror", "Affiliation", "Juror Progress", ...groupHeaders];
    const makeDataRows = (tabRows, includeStatus) =>
      tabRows.map((r) => [
        r.name,
        r.dept ?? "",
        ...(includeStatus ? [r.statusLabel ?? ""] : []),
        ...(groups || []).map((g) => {
          const v = r.scores[g.id];
          return v !== null && v !== undefined ? v : "";
        }),
      ]);

    const extraSections = criterionTabs.map((tab) => ({
      title: tab.label,
      header: ["Juror", "Affiliation", ...groupHeaders],
      rows: makeDataRows(tab.rows, false),
    }));

    const pdfSubtitle = [
      periodName || "All Periods",
      `${exportRows.length} jurors`,
      `${groups.length} projects`,
      `${activeCriteria.length} criteria`,
    ].join(" · ");

    await downloadTable("pdf", {
      filenameType: "Heatmap",
      sheetName: "All Criteria",
      periodName,
      tenantCode,
      organization: orgName,
      department: deptName,
      pdfTitle: "VERA — Heatmap",
      pdfSubtitle,
      header: allHeader,
      rows: makeDataRows(exportRows, true),
      colWidths: [28, 20, 14, ...(groups || []).map(() => 10)],
      extraSections,
    });
  }, [buildExportRows, visibleJurors, groups, periodName, tenantCode, orgName, deptName, lookup, activeCriteria, organizationId]);

  return {
    requestExport,
  };
}
