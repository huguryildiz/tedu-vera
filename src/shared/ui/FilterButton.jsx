// src/shared/ui/FilterButton.jsx
import { Filter } from "lucide-react";

export function FilterButton({ activeCount = 0, isOpen = false, onClick }) {
  return (
    <button
      type="button"
      className={`btn btn-outline btn-sm${isOpen ? " active" : ""}`}
      onClick={onClick}
    >
      <Filter size={14} style={{ verticalAlign: "-1px" }} />
      {" "}Filter
      {activeCount > 0 && (
        <span className="filter-badge">{activeCount}</span>
      )}
    </button>
  );
}
