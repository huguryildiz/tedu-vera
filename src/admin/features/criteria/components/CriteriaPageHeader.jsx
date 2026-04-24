import { Search, Download, Lock, Plus } from "lucide-react";
import { FilterButton } from "@/shared/ui/FilterButton";

export default function CriteriaPageHeader({
  visible,
  searchText,
  onSearchChange,
  filterOpen,
  activeFilterCount,
  onToggleFilter,
  onToggleExport,
  isLocked,
  onAddCriterion,
}) {
  if (!visible) return null;
  return (
    <div className="crt-header-actions mobile-toolbar-stack">
      <div className="admin-search-wrap mobile-toolbar-search">
        <Search size={14} strokeWidth={2} style={{ opacity: 0.45 }} />
        <input
          className="search-input"
          type="text"
          placeholder="Search criteria…"
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <FilterButton
        className="mobile-toolbar-filter"
        activeCount={activeFilterCount}
        isOpen={filterOpen}
        onClick={onToggleFilter}
      />
      <button
        className="btn btn-outline btn-sm mobile-toolbar-export"
        onClick={onToggleExport}
      >
        <Download size={14} strokeWidth={2} style={{ verticalAlign: "-1px" }} />
        {" "}Export
      </button>
      {isLocked ? (
        <div className="crt-lock-badge mobile-toolbar-primary">
          <Lock size={11} strokeWidth={2.2} />
          Evaluation Active
        </div>
      ) : (
        <button
          data-testid="criteria-add-btn"
          className="btn btn-primary btn-sm mobile-toolbar-primary"
          onClick={onAddCriterion}
        >
          <Plus size={13} strokeWidth={2.2} />
          Add Criterion
        </button>
      )}
    </div>
  );
}
