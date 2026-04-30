import { Eye, Filter, Icon, Lock, MoreVertical, Pencil, Search, Trash2, UserPlus, Users, XCircle } from "lucide-react";
import CustomSelect from "@/shared/ui/CustomSelect";
import FloatingMenu from "@/shared/ui/FloatingMenu";
import Pagination from "@/shared/ui/Pagination";
import { FilterButton } from "@/shared/ui/FilterButton";
import SortIcon from "./SortIcon";
import OrgStatusBadge from "./OrgStatusBadge";
import { formatShortDate, getOrgInitials, getOrgHue } from "./organizationHelpers";

export default function OrgTable({
  // Toolbar + search + filter
  search,
  setSearch,
  orgFilterOpen,
  setOrgFilterOpen,
  orgActiveFilterCount,
  orgStatusFilter,
  setOrgStatusFilter,
  orgStaffingFilter,
  setOrgStaffingFilter,
  onOpenCreate,
  // Table data + sort
  sortedFilteredOrgs,
  pagedOrgs,
  getOrgMeta,
  orgSortKey,
  orgSortDir,
  onOrgSort,
  orgsScopeRef,
  // Row actions menu
  openOrgActionMenuId,
  setOpenOrgActionMenuId,
  runOrgMenuAction,
  rowHandlers,
  // Pagination
  orgSafePage,
  orgTotalPages,
  orgPageSize,
  setOrgCurrentPage,
  setOrgPageSize,
}) {
  return (
    <div className="card" style={{ marginBottom: 14, padding: 14 }}>
      <div className="card-header">
        <div>
          <div className="card-title">Organization Management</div>
          <div className="text-sm text-muted" style={{ marginTop: 3 }}>
            Organization identity, health, admin capacity, and operational actions.
          </div>
        </div>
        <div className="organizations-toolbar" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "nowrap" }}>
          <div style={{ position: "relative", flex: "1 1 180px", minWidth: 160 }}>
            <Search size={13} strokeWidth={2} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)", pointerEvents: "none" }} />
            <input
              className="form-input organizations-toolbar-search"
              style={{ width: "100%", height: 30, fontSize: 12, paddingLeft: 28, boxSizing: "border-box" }}
              placeholder="Search organizations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <FilterButton
            activeCount={orgActiveFilterCount}
            isOpen={orgFilterOpen}
            onClick={() => setOrgFilterOpen((v) => !v)}
          />
          <button
            data-testid="orgs-create-btn"
            className="btn btn-primary btn-sm organizations-toolbar-create"
            style={{ width: "auto", padding: "6px 14px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0, whiteSpace: "nowrap" }}
            onClick={onOpenCreate}
          >
            <Icon
              iconNode={[]}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </Icon>
            Create Organization
          </button>
        </div>
      </div>

      {orgFilterOpen && (
        <div className="filter-panel show">
          <div className="filter-panel-header">
            <div>
              <h4>
                <Filter size={14} style={{ display: "inline", marginRight: 4, opacity: 0.5, verticalAlign: "-1px" }} />
                Filter Organizations
              </h4>
              <div className="filter-panel-sub">Narrow organizations by status and admin staffing.</div>
            </div>
            <button className="filter-panel-close" onClick={() => setOrgFilterOpen(false)}>&#215;</button>
          </div>
          <div className="filter-row">
            <div className="filter-group">
              <label>Status</label>
              <CustomSelect
                compact
                value={orgStatusFilter}
                onChange={(v) => setOrgStatusFilter(v)}
                options={[
                  { value: "all", label: "All statuses" },
                  { value: "active", label: "Active" },
                  { value: "archived", label: "Archived" },
                ]}
                ariaLabel="Status"
              />
            </div>
            <div className="filter-group">
              <label>Staffing</label>
              <CustomSelect
                compact
                value={orgStaffingFilter}
                onChange={(v) => setOrgStaffingFilter(v)}
                options={[
                  { value: "all", label: "All orgs" },
                  { value: "staffed", label: "Has admin" },
                  { value: "unstaffed", label: "Unstaffed" },
                ]}
                ariaLabel="Staffing"
              />
            </div>
            <button
              className="btn btn-outline btn-sm filter-clear-btn"
              onClick={() => { setOrgStatusFilter("all"); setOrgStaffingFilter("all"); }}
            >
              <XCircle size={12} strokeWidth={2} style={{ opacity: 0.5, verticalAlign: "-1px" }} />
              {" "}Clear all
            </button>
          </div>
        </div>
      )}

      <div className="table-wrap table-wrap--split">
        <table className="organizations-table table-standard table-pill-balance">
          <thead>
            <tr>
              <th className={`sortable${orgSortKey === "name" ? " sorted" : ""}`} onClick={() => onOrgSort("name")}>Organization <SortIcon colKey="name" sortKey={orgSortKey} sortDir={orgSortDir} /></th>
              <th className={`sortable${orgSortKey === "code" ? " sorted" : ""}`} onClick={() => onOrgSort("code")}>Code <SortIcon colKey="code" sortKey={orgSortKey} sortDir={orgSortDir} /></th>
              <th className={`sortable${orgSortKey === "status" ? " sorted" : ""}`} onClick={() => onOrgSort("status")}>Status <SortIcon colKey="status" sortKey={orgSortKey} sortDir={orgSortDir} /></th>
              <th className={`text-center sortable${orgSortKey === "admins" ? " sorted" : ""}`} onClick={() => onOrgSort("admins")}>Admins <SortIcon colKey="admins" sortKey={orgSortKey} sortDir={orgSortDir} /></th>
              <th className={`sortable${orgSortKey === "created_at" ? " sorted" : ""}`} onClick={() => onOrgSort("created_at")}>Created <SortIcon colKey="created_at" sortKey={orgSortKey} sortDir={orgSortDir} /></th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody ref={orgsScopeRef}>
            {sortedFilteredOrgs.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-sm text-muted" style={{ textAlign: "center", padding: "18px 0" }}>
                  No organizations found.
                </td>
              </tr>
            ) : (
              pagedOrgs.map((org) => {
                const code = String(org.code || "").toUpperCase();
                const initials = getOrgInitials(org.name);
                const hue = getOrgHue(org.name);
                const adminCount = org.tenantAdmins?.filter((a) => a.status === "active").length ?? 0;
                const adminLabel = adminCount === 1 ? "admin" : "admins";
                const isUnstaffed = adminCount === 0;
                return (
                  <tr
                    key={org.id}
                    data-card-selectable=""
                    data-initials={initials}
                    style={{ "--org-hue": hue }}
                  >
                    <td data-label="Organization" style={{ fontWeight: 600 }}>
                      {org.name || "—"}
                    </td>
                    <td data-label="Code" className="mono"><span className="org-code-pill">{code || "—"}</span></td>
                    <td data-label="Status"><OrgStatusBadge status={org.status} /></td>
                    <td data-label="Admins" className="text-center mono org-admin-count-cell">
                      <span className="org-admin-count-label">Admins:</span>{" "}
                      {org.tenantAdmins?.filter((a) => a.status === "active").length ?? 0}
                    </td>
                    <td data-label="Created"><span className="vera-datetime-text">{formatShortDate(org.created_at)}</span></td>
                    <td data-label="Actions" className="text-right">
                      <div style={{ display: "inline-flex" }}>
                        <FloatingMenu
                          trigger={<button className="row-action-btn" data-testid={`orgs-row-kebab-${org.id}`} title="Actions" onClick={(e) => { e.stopPropagation(); setOpenOrgActionMenuId((prev) => (prev === org.id ? null : org.id)); }}><MoreVertical size={18} strokeWidth={2} /></button>}
                          isOpen={openOrgActionMenuId === org.id}
                          onClose={() => setOpenOrgActionMenuId(null)}
                          placement="top-end"
                        >
                          <button
                            className="floating-menu-item"
                            onMouseDown={(e) => runOrgMenuAction(e, () => rowHandlers.onView(org))}
                          >
                            <Eye size={13} strokeWidth={2} />
                            View Organization
                          </button>
                          <button
                            className="floating-menu-item"
                            data-testid={`orgs-row-edit-${org.id}`}
                            onMouseDown={(e) => runOrgMenuAction(e, () => rowHandlers.onEdit(org))}
                          >
                            <Pencil size={13} strokeWidth={2} />
                            Edit Organization
                          </button>
                          <button
                            className="floating-menu-item"
                            onMouseDown={(e) => runOrgMenuAction(e, () => rowHandlers.onManageAdmins(org))}
                          >
                            <UserPlus size={13} strokeWidth={2} />
                            Manage Admins
                          </button>
                          <div className="floating-menu-divider" />
                          <button
                            className="floating-menu-item danger"
                            onMouseDown={(e) => runOrgMenuAction(e, () => rowHandlers.onToggleStatus(org))}
                          >
                            <Lock size={13} strokeWidth={2} />
                            Enable / Disable Organization
                          </button>
                          <div className="floating-menu-divider" />
                          <button
                            className="floating-menu-item danger"
                            data-testid={`orgs-row-delete-${org.id}`}
                            onMouseDown={(e) => runOrgMenuAction(e, () => rowHandlers.onDelete(org))}
                          >
                            <Trash2 size={13} strokeWidth={2} />
                            Delete Organization
                          </button>
                        </FloatingMenu>
                      </div>
                    </td>
                    <td className="org-card-meta-row" aria-hidden="true">
                      <span className="org-meta-chip">{code || "—"}</span>
                      <span className="org-meta-dot" />
                      <span className={`org-meta-admin${isUnstaffed ? " org-meta-admin--warn" : ""}`}>
                        <Users size={10} strokeWidth={2} />
                        {adminCount} {adminLabel}
                      </span>
                      <span className="org-meta-dot" />
                      <span className="org-meta-date vera-datetime-text">{formatShortDate(org.created_at)}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        currentPage={orgSafePage}
        totalPages={orgTotalPages}
        pageSize={orgPageSize}
        totalItems={sortedFilteredOrgs.length}
        onPageChange={setOrgCurrentPage}
        onPageSizeChange={(size) => { setOrgPageSize(size); setOrgCurrentPage(1); }}
        itemLabel="organizations"
      />
    </div>
  );
}
