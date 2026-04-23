import { Filter, XCircle } from "lucide-react";
import CustomSelect from "@/shared/ui/CustomSelect";

export default function PeriodsFilterPanel({
  onClose,
  frameworks,
  statusFilter,
  setStatusFilter,
  dateRangeFilter,
  setDateRangeFilter,
  progressFilter,
  setProgressFilter,
  criteriaFilter,
  setCriteriaFilter,
  outcomeFilter,
  setOutcomeFilter,
  setupFilter,
  setSetupFilter,
  onClearAll,
}) {
  return (
    <div className="filter-panel show">
      <div className="filter-panel-header">
        <div>
          <h4>
            <Filter size={14} strokeWidth={2} style={{ verticalAlign: "-1px", marginRight: "4px", opacity: 0.5, display: "inline" }} />
            Filter Periods
          </h4>
          <div className="filter-panel-sub">Narrow evaluation periods by status, date, criteria set, outcome set, and setup state.</div>
        </div>
        <button className="filter-panel-close" onClick={onClose}>&#215;</button>
      </div>
      <div className="filter-row">
        <div className="filter-group">
          <label>Status</label>
          <CustomSelect
            compact
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: "All" },
              { value: "draft", label: "Draft" },
              { value: "published", label: "Published" },
              { value: "live", label: "Live" },
              { value: "closed", label: "Closed" },
            ]}
            ariaLabel="Status"
          />
        </div>
        <div className="filter-group">
          <label>Date Range</label>
          <CustomSelect
            compact
            value={dateRangeFilter}
            onChange={setDateRangeFilter}
            options={[
              { value: "all", label: "All" },
              { value: "this_year", label: "This year" },
              { value: "past", label: "Past" },
              { value: "future", label: "Future" },
            ]}
            ariaLabel="Date Range"
          />
        </div>
        <div className="filter-group">
          <label>Progress</label>
          <CustomSelect
            compact
            value={progressFilter}
            onChange={setProgressFilter}
            options={[
              { value: "all", label: "All" },
              { value: "not_started", label: "Not started" },
              { value: "in_progress", label: "In progress" },
              { value: "complete", label: "Complete" },
            ]}
            ariaLabel="Progress"
          />
        </div>
        <div className="filter-group">
          <label>Criteria Set</label>
          <CustomSelect
            compact
            value={criteriaFilter}
            onChange={setCriteriaFilter}
            options={[
              { value: "all", label: "All" },
              { value: "has", label: "Has criteria" },
              { value: "none", label: "Not set" },
            ]}
            ariaLabel="Criteria Set"
          />
        </div>
        <div className="filter-group">
          <label>Outcome Set</label>
          <CustomSelect
            compact
            value={outcomeFilter}
            onChange={setOutcomeFilter}
            options={[
              { value: "all", label: "All" },
              { value: "not_set", label: "Not set" },
              ...(frameworks || []).map((fw) => ({ value: fw.id, label: fw.name })),
            ]}
            ariaLabel="Outcome Set"
          />
        </div>
        <div className="filter-group">
          <label>Setup</label>
          <div className="filter-toggle-group">
            {[["all", "All"], ["no_projects", "No Projects"], ["no_jurors", "No Jurors"]].map(([val, lbl]) => (
              <button
                key={val}
                className={`filter-toggle-btn${setupFilter === val ? " filter-toggle-btn--active" : ""}`}
                onClick={() => setSetupFilter(val)}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
        <button className="btn btn-outline btn-sm filter-clear-btn" onClick={onClearAll}>
          <XCircle size={12} strokeWidth={2} style={{ opacity: 0.5, verticalAlign: "-1px" }} />
          {" "}Clear all
        </button>
      </div>
    </div>
  );
}
