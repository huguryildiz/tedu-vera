import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import CustomSelect from "@/shared/ui/CustomSelect";
import { sortMobileJurors, MOBILE_SORT_KEYS } from "./mobileSort.js";
import HeatmapMiniMatrix from "./HeatmapMiniMatrix.jsx";

export default function HeatmapMobileList({
  visibleJurors,
  groups,
  lookup,
  activeTab,
  activeCriteria,
  tabMax,
  jurorRowAvgs,
  visibleAverages,
  overallAvg,
  jurorWorkflowMap,
  getCellDisplay,
}) {
  const [sortKey, setSortKey] = useState("avg_desc");

  const jurorRowAvgMap = useMemo(() => {
    const m = new Map();
    visibleJurors.forEach((j, i) => m.set(j.key, jurorRowAvgs[i]));
    return m;
  }, [visibleJurors, jurorRowAvgs]);

  const sortedJurors = useMemo(
    () => sortMobileJurors(visibleJurors, sortKey, {
      rowAvgs: jurorRowAvgMap,
      workflow: jurorWorkflowMap,
    }),
    [visibleJurors, sortKey, jurorRowAvgMap, jurorWorkflowMap]
  );

  return (
    <section className="heatmap-mobile" aria-label="Juror scoring heatmap (mobile)">
      <div className="hm-mobile-actions">
        <CustomSelect
          value={sortKey}
          onChange={setSortKey}
          options={MOBILE_SORT_KEYS}
          ariaLabel="Sort jurors"
        />
      </div>

      {sortedJurors.length === 0 ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="vera-es-page-prompt">
            <div className="vera-es-icon">
              <Users size={22} strokeWidth={1.8} />
            </div>
            <p className="vera-es-page-prompt-title">No Jurors to Display</p>
            <p className="vera-es-page-prompt-desc">Juror score data will appear here once jurors are assigned and evaluations begin.</p>
          </div>
        </div>
      ) : (
        <HeatmapMiniMatrix
          sortedJurors={sortedJurors}
          groups={groups}
          lookup={lookup}
          activeTab={activeTab}
          activeCriteria={activeCriteria}
          tabMax={tabMax}
          jurorRowAvgMap={jurorRowAvgMap}
          visibleAverages={visibleAverages}
          overallAvg={overallAvg}
          getCellDisplay={getCellDisplay}
          sortKey={sortKey}
          onSortChange={setSortKey}
        />
      )}
    </section>
  );
}
