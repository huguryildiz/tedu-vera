# Platform Control — Merge Unlock Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge `UnlockRequestsPage` into `OrganizationsPage` as a second top-level tab, rename the page to "Platform Control", and remove the now-redundant route + sidebar item.

**Architecture:** Add a `mainTab` state to `OrganizationsPage` controlling an "Organizations" / "Unlock Requests" tab strip. All unlock state, logic, and JSX moves inline. The `unlock-requests` route becomes a redirect. One sidebar item replaces two.

**Tech Stack:** React 18, React Router v6, Lucide icons, existing VERA CSS classes (`scores-kpi-strip`, `organizations-table`, `sem-status-*`, `card`, `btn`, `badge`).

---

## File Map

| File | Change |
|---|---|
| `src/admin/pages/OrganizationsPage.jsx` | Add imports; add `UNLOCK_TABS`, `StatusPill`; add all unlock state + logic; add tab strip; wrap org content; add unlock tab JSX + resolve modal; rename page title/id |
| `src/admin/pages/UnlockRequestsPage.jsx` | **Delete** |
| `src/router.jsx` | Remove lazy import + route; add redirect |
| `src/admin/layout/AdminSidebar.jsx` | Remove Unlock Requests nav button; rename Organizations label |
| `src/admin/hooks/useAdminNav.js` | Rename `organizations` label to `"Platform Control"` |

---

## Task 1: Add missing imports to OrganizationsPage

**Files:**
- Modify: `src/admin/pages/OrganizationsPage.jsx:18,26-43`

- [ ] **Step 1: Add `XCircle` to the lucide import block**

Current line 26–43:
```jsx
import {
  Archive,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Filter,
  Lock,
  Mail,
  MoreVertical,
  Pencil,
  Settings,
  Trash2,
  TriangleAlert,
  UserPlus,
  X,
  Icon,
} from "lucide-react";
```

Replace with:
```jsx
import {
  Archive,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Filter,
  Lock,
  Mail,
  MoreVertical,
  Pencil,
  Settings,
  Trash2,
  TriangleAlert,
  UserPlus,
  X,
  XCircle,
  Icon,
} from "lucide-react";
```

- [ ] **Step 2: Add `listUnlockRequests`, `resolveUnlockRequest`, `formatDateTime` imports**

Current line 18:
```js
import { listPeriods, setCurrentPeriod, updateOrganization } from "@/shared/api";
```

Replace with:
```js
import { listPeriods, setCurrentPeriod, updateOrganization, listUnlockRequests, resolveUnlockRequest } from "@/shared/api";
import { formatDateTime } from "@/shared/lib/dateUtils";
```

- [ ] **Step 3: Verify the file compiles — run `npm run build 2>&1 | head -20`**

Expected: no errors about missing imports.

---

## Task 2: Add UNLOCK_TABS constant and StatusPill helper

**Files:**
- Modify: `src/admin/pages/OrganizationsPage.jsx` — insert after the last file-level helper, before `export default function OrganizationsPage()`

- [ ] **Step 1: Find the line just before `export default function OrganizationsPage()`**

The line reads approximately (around line 135):
```js
// ── Main Component ────────────────────────────────────────────
```

- [ ] **Step 2: Insert `UNLOCK_TABS` and `StatusPill` immediately before that comment**

```jsx
const UNLOCK_TABS = [
  { key: "pending",  label: "Pending",  icon: Clock },
  { key: "approved", label: "Approved", icon: CheckCircle2 },
  { key: "rejected", label: "Rejected", icon: XCircle },
];

function StatusPill({ status }) {
  if (status === "approved") {
    return (
      <span className="sem-status sem-status-active" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <CheckCircle2 size={12} />
        Approved
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="sem-status sem-status-locked" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <XCircle size={12} />
        Rejected
      </span>
    );
  }
  return (
    <span className="sem-status sem-status-draft" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <Clock size={12} />
      Pending
    </span>
  );
}

```

---

## Task 3: Add mainTab + unlock state variables + business logic inside the component

**Files:**
- Modify: `src/admin/pages/OrganizationsPage.jsx` — inside `OrganizationsPage`, after the governance drawer states block (around line 219)

- [ ] **Step 1: Locate the governance drawer states block — it ends with:**

```jsx
  const [systemHealthOpen, setSystemHealthOpen] = useState(false);
```

- [ ] **Step 2: Insert the main tab state + all unlock state immediately after that line:**

```jsx
  // ── Main tab ─────────────────────────────────────────────────
  const [mainTab, setMainTab] = useState("organizations");

  // ── Unlock Requests state ────────────────────────────────────
  const [unlockTab, setUnlockTab] = useState("pending");
  const [unlockRows, setUnlockRows] = useState([]);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [resolveTarget, setResolveTarget] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [resolveSubmitting, setResolveSubmitting] = useState(false);
  const [unlockError, setUnlockError] = useState("");

  const [unlockSortKey, setUnlockSortKey] = useState("created_at");
  const [unlockSortDir, setUnlockSortDir] = useState("desc");
  const [unlockPage, setUnlockPage] = useState(1);
  const [unlockPageSize, setUnlockPageSize] = useState(10);
```

- [ ] **Step 3: Add the unlock business logic after the existing `pagedOrgs` memo (around line 353)**

Find the line:
```jsx
  // ── Effects ──────────────────────────────────────────────────
```

Insert **before** that line:

```jsx
  // ── Unlock Requests logic ────────────────────────────────────

  const loadUnlockRequests = useCallback(async (status) => {
    setUnlockLoading(true);
    setUnlockError("");
    try {
      const data = await listUnlockRequests(status);
      setUnlockRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setUnlockError(e?.message || "Could not load unlock requests.");
      setUnlockRows([]);
    } finally {
      setUnlockLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mainTab !== "unlock-requests") return;
    loadUnlockRequests(unlockTab);
    setUnlockPage(1);
  }, [mainTab, unlockTab, loadUnlockRequests]);

  const sortedUnlockRows = useMemo(() => {
    const dir = unlockSortDir === "asc" ? 1 : -1;
    return [...unlockRows].sort((a, b) => {
      let cmp = 0;
      if (unlockSortKey === "organization_name") {
        cmp = String(a.organization_name || "").localeCompare(String(b.organization_name || ""), "tr", { sensitivity: "base", numeric: true });
      } else if (unlockSortKey === "period_name") {
        cmp = String(a.period_name || "").localeCompare(String(b.period_name || ""), "tr", { sensitivity: "base", numeric: true });
      } else if (unlockSortKey === "requester_name") {
        cmp = String(a.requester_name || "").localeCompare(String(b.requester_name || ""), "tr", { sensitivity: "base", numeric: true });
      } else if (unlockSortKey === "created_at") {
        cmp = Date.parse(a.created_at || "") - Date.parse(b.created_at || "");
      } else if (unlockSortKey === "status") {
        cmp = String(a.status || "").localeCompare(String(b.status || ""));
      } else if (unlockSortKey === "reviewed_at") {
        cmp = Date.parse(a.reviewed_at || "") - Date.parse(b.reviewed_at || "");
      }
      return cmp * dir;
    });
  }, [unlockRows, unlockSortKey, unlockSortDir]);

  const unlockTotalPages = Math.max(1, Math.ceil(sortedUnlockRows.length / unlockPageSize));
  const unlockSafePage = Math.min(unlockPage, unlockTotalPages);
  const pagedUnlockRows = useMemo(() => {
    const start = (unlockSafePage - 1) * unlockPageSize;
    return sortedUnlockRows.slice(start, start + unlockPageSize);
  }, [sortedUnlockRows, unlockSafePage, unlockPageSize]);

  function handleUnlockSort(key) {
    if (unlockSortKey === key) {
      setUnlockSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setUnlockSortKey(key);
      setUnlockSortDir("asc");
    }
    setUnlockPage(1);
  }

  const openResolve = (row, decision) => {
    setResolveTarget({ row, decision });
    setNoteDraft("");
  };

  const closeResolve = () => {
    if (resolveSubmitting) return;
    setResolveTarget(null);
    setNoteDraft("");
  };

  const submitResolve = async () => {
    if (!resolveTarget) return;
    setResolveSubmitting(true);
    try {
      const result = await resolveUnlockRequest(
        resolveTarget.row.id,
        resolveTarget.decision,
        noteDraft.trim() || null,
      );
      if (result?.ok) {
        _toast.success(
          resolveTarget.decision === "approved"
            ? `Unlocked ${resolveTarget.row.period_name || "period"}.`
            : `Rejected unlock request for ${resolveTarget.row.period_name || "period"}.`
        );
        setResolveTarget(null);
        setNoteDraft("");
        loadUnlockRequests(unlockTab);
      } else {
        _toast.error(
          result?.error_code === "request_not_pending"
            ? "This request was already resolved."
            : "Could not resolve the request."
        );
      }
    } catch (e) {
      _toast.error(e?.message || "Could not resolve the request.");
    } finally {
      setResolveSubmitting(false);
    }
  };

```

---

## Task 4: Update page header — title, description, page id, badges

**Files:**
- Modify: `src/admin/pages/OrganizationsPage.jsx` — around lines 1053–1063

- [ ] **Step 1: Replace the page header block**

Find:
```jsx
      <div className="page" id="page-organizations">
        <div className="page-title">Organizations</div>
        <div className="page-desc" style={{ marginBottom: 12 }}>
          Platform-wide organization management, admin memberships, and governance controls.
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 16 }}>
          <span className="badge badge-neutral">Super Admin</span>
          <span className="badge" style={{ background: "var(--success-soft)", color: "var(--success)", border: "1px solid rgba(22,163,74,0.18)" }}>
            Platform Scope
          </span>
        </div>
```

Replace with:
```jsx
      <div className="page" id="page-platform-control">
        <div className="page-title">Platform Control</div>
        <div className="page-desc" style={{ marginBottom: 12 }}>
          Super-admin hub for organization management, unlock request approvals, and platform governance.
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 0 }}>
          <span className="badge badge-neutral">Super Admin</span>
        </div>
```

---

## Task 5: Add top-level tab strip JSX

**Files:**
- Modify: `src/admin/pages/OrganizationsPage.jsx` — after the badges div from Task 4

- [ ] **Step 1: Insert the tab strip immediately after the closing `</div>` of the badges block (and before the KPI strip)**

```jsx
        {/* ── Top-level tab strip ─────────────────────────────── */}
        <div
          role="tablist"
          style={{ display: "flex", gap: 6, margin: "16px 0 0", borderBottom: "1px solid var(--border)" }}
        >
          {[
            { key: "organizations", label: "Organizations" },
            { key: "unlock-requests", label: "Unlock Requests" },
          ].map((t) => {
            const active = mainTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMainTab(t.key)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 14px",
                  background: "transparent",
                  border: "none",
                  borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                  color: active ? "var(--text-primary)" : "var(--text-secondary)",
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  cursor: "pointer",
                  marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
```

---

## Task 6: Wrap existing Organizations content in tab condition

**Files:**
- Modify: `src/admin/pages/OrganizationsPage.jsx`

The KPI strip starts directly after the tab strip. Everything from the KPI strip to the closing `</div>` of the page div (the very last `</div>` before the closing `</>`) must be wrapped.

- [ ] **Step 1: Wrap the Organizations tab body**

Immediately after the tab strip closing `</div>`, insert:
```jsx
        {mainTab === "organizations" && (
        <>
```

Then find the final two closing tags of the page div (the `</div>` that closes `<div className="page"...>` and the one before it that closes the Platform Governance card's container). The pattern at the very end of the page content is:

```jsx
            </div>
          </div>
        </div>
      </div>
```

The last `</div>` closes `<div className="page">`. Insert **before** that last `</div>`:
```jsx
        </>
        )}
```

So the final structure of the page div's closing area becomes:
```jsx
            </div>
          </div>
        </div>
        </>
        )}
      </div>
```

---

## Task 7: Add Unlock Requests tab JSX + resolve modal

**Files:**
- Modify: `src/admin/pages/OrganizationsPage.jsx`

- [ ] **Step 1: Add Unlock Requests tab content after the `)}` closing of the Organizations condition**

(This goes inside the `<div className="page">` but after the `{mainTab === "organizations" && ...}` block)

```jsx
        {mainTab === "unlock-requests" && (
          <div style={{ paddingTop: 8 }}>
            {unlockError && (
              <FbAlert variant="danger" title="Error">{unlockError}</FbAlert>
            )}

            {/* Sub-tab strip: Pending / Approved / Rejected */}
            <div
              role="tablist"
              aria-label="Request status filter"
              style={{ display: "flex", gap: 6, margin: "16px 0", borderBottom: "1px solid var(--border)" }}
            >
              {UNLOCK_TABS.map((t) => {
                const TabIcon = t.icon;
                const active = unlockTab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setUnlockTab(t.key)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "10px 14px",
                      background: "transparent",
                      border: "none",
                      borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                      color: active ? "var(--text-primary)" : "var(--text-secondary)",
                      fontSize: 13,
                      fontWeight: active ? 600 : 500,
                      cursor: "pointer",
                    }}
                  >
                    <TabIcon size={14} />
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="table-wrap table-wrap--split" style={{ overflow: "auto" }}>
                <table className="organizations-table">
                  <thead>
                    <tr>
                      <th className={`sortable${unlockSortKey === "organization_name" ? " sorted" : ""}`} onClick={() => handleUnlockSort("organization_name")}>Organization <SortIcon colKey="organization_name" sortKey={unlockSortKey} sortDir={unlockSortDir} /></th>
                      <th className={`sortable${unlockSortKey === "period_name" ? " sorted" : ""}`} onClick={() => handleUnlockSort("period_name")}>Period <SortIcon colKey="period_name" sortKey={unlockSortKey} sortDir={unlockSortDir} /></th>
                      <th className={`sortable${unlockSortKey === "requester_name" ? " sorted" : ""}`} onClick={() => handleUnlockSort("requester_name")}>Requester <SortIcon colKey="requester_name" sortKey={unlockSortKey} sortDir={unlockSortDir} /></th>
                      <th>Reason</th>
                      <th className={`sortable${unlockSortKey === "created_at" ? " sorted" : ""}`} onClick={() => handleUnlockSort("created_at")}>Requested <SortIcon colKey="created_at" sortKey={unlockSortKey} sortDir={unlockSortDir} /></th>
                      <th className={`sortable${unlockSortKey === "status" ? " sorted" : ""}`} onClick={() => handleUnlockSort("status")}>Status <SortIcon colKey="status" sortKey={unlockSortKey} sortDir={unlockSortDir} /></th>
                      {unlockTab !== "pending" && <th className={`sortable${unlockSortKey === "reviewed_at" ? " sorted" : ""}`} onClick={() => handleUnlockSort("reviewed_at")}>Reviewed <SortIcon colKey="reviewed_at" sortKey={unlockSortKey} sortDir={unlockSortDir} /></th>}
                      {unlockTab === "pending" && <th style={{ textAlign: "right" }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {unlockLoading && (
                      <tr>
                        <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)" }}>
                          Loading…
                        </td>
                      </tr>
                    )}
                    {!unlockLoading && pagedUnlockRows.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)" }}>
                          No {unlockTab} requests.
                        </td>
                      </tr>
                    )}
                    {!unlockLoading && pagedUnlockRows.map((r) => (
                      <tr key={r.id}>
                        <td>{r.organization_name || "—"}</td>
                        <td><strong>{r.period_name || "—"}</strong></td>
                        <td>{r.requester_name || "—"}</td>
                        <td style={{ maxWidth: 400, whiteSpace: "normal", textAlign: "justify", textJustify: "inter-word" }}>
                          {r.reason}
                        </td>
                        <td className="vera-datetime-text">{formatDateTime(r.created_at)}</td>
                        <td><StatusPill status={r.status} /></td>
                        {unlockTab !== "pending" && (
                          <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                            <div>{r.reviewer_name || "—"}</div>
                            <div className="vera-datetime-text">{r.reviewed_at ? formatDateTime(r.reviewed_at) : ""}</div>
                            {r.review_note && (
                              <div style={{ marginTop: 4, fontStyle: "italic" }}>"{r.review_note}"</div>
                            )}
                          </td>
                        )}
                        {unlockTab === "pending" && (
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline"
                              style={{ marginRight: 6 }}
                              onClick={() => openResolve(r, "rejected")}
                            >
                              <XCircle size={13} style={{ marginRight: 4 }} />
                              Reject
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() => openResolve(r, "approved")}
                            >
                              <CheckCircle2 size={13} style={{ marginRight: 4 }} />
                              Approve
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Pagination
              currentPage={unlockSafePage}
              totalPages={unlockTotalPages}
              pageSize={unlockPageSize}
              totalItems={sortedUnlockRows.length}
              onPageChange={setUnlockPage}
              onPageSizeChange={(size) => { setUnlockPageSize(size); setUnlockPage(1); }}
              itemLabel="requests"
            />
          </div>
        )}
```

- [ ] **Step 2: Add the resolve modal to the fragment — inside `<>` alongside the governance drawers, before `<div className="page">`**

Find the comment:
```jsx
      {/* ── Page Content ────────────────────────────────────────── */}
```

Insert **before** that comment:

```jsx
      {/* Unlock Requests resolve modal */}
      <Modal
        open={!!resolveTarget}
        onClose={closeResolve}
        size="sm"
        centered
      >
        <div className="fs-modal-header">
          <div className={`fs-modal-icon ${resolveTarget?.decision === "approved" ? "success" : "danger"}`}>
            {resolveTarget?.decision === "approved"
              ? <CheckCircle2 size={22} strokeWidth={2} />
              : <XCircle size={22} strokeWidth={2} />}
          </div>
          <div className="fs-title" style={{ textAlign: "center" }}>
            {resolveTarget?.decision === "approved" ? "Approve Unlock?" : "Reject Unlock?"}
          </div>
          <div className="fs-subtitle" style={{ textAlign: "center", marginTop: 4 }}>
            {resolveTarget?.decision === "approved"
              ? <>Unlock <strong style={{ color: "var(--text-primary)" }}>{resolveTarget?.row?.period_name}</strong>. Admin can edit the rubric again — existing scores remain but may become inconsistent.</>
              : <>Keep <strong style={{ color: "var(--text-primary)" }}>{resolveTarget?.row?.period_name}</strong> locked. The requester will be notified.</>
            }
          </div>
        </div>

        <div className="fs-modal-body" style={{ paddingTop: 2 }}>
          {resolveTarget?.decision === "approved" && (
            <FbAlert variant="warning" title="High-impact action">
              This unlock bypasses the fairness guard. It is audit-logged with severity=high and the requester receives an email with your optional note below.
            </FbAlert>
          )}
          <div style={{ marginTop: 10 }}>
            <label
              htmlFor="resolve-note"
              style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}
            >
              Note to requester <span style={{ color: "var(--text-tertiary)" }}>(optional)</span>
            </label>
            <textarea
              id="resolve-note"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={3}
              disabled={resolveSubmitting}
              placeholder={resolveTarget?.decision === "approved"
                ? "e.g. Approved — please make the fix and re-generate the QR code after."
                : "e.g. Rejected — the change you described affects rubric weights and would invalidate existing scores."}
              style={{
                width: "100%",
                padding: "10px 12px",
                fontFamily: "inherit",
                fontSize: 13,
                lineHeight: 1.5,
                color: "var(--text-primary)",
                background: "var(--input-bg, var(--bg-2))",
                border: "1px solid var(--border)",
                borderRadius: 8,
                resize: "vertical",
                minHeight: 72,
                outline: "none",
              }}
            />
          </div>
        </div>

        <div
          className="fs-modal-footer"
          style={{ justifyContent: "center", background: "transparent", borderTop: "none", paddingTop: 0 }}
        >
          <button
            type="button"
            className="fs-btn fs-btn-secondary"
            onClick={closeResolve}
            disabled={resolveSubmitting}
            style={{ flex: 1 }}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`fs-btn ${resolveTarget?.decision === "approved" ? "fs-btn-primary" : "fs-btn-danger"}`}
            onClick={submitResolve}
            disabled={resolveSubmitting}
            style={{ flex: 1 }}
          >
            <AsyncButtonContent
              loading={resolveSubmitting}
              loadingText={resolveTarget?.decision === "approved" ? "Approving…" : "Rejecting…"}
            >
              {resolveTarget?.decision === "approved" ? "Approve & Unlock" : "Reject Request"}
            </AsyncButtonContent>
          </button>
        </div>
      </Modal>
```

- [ ] **Step 3: Verify build — `npm run build 2>&1 | head -30`**

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/admin/pages/OrganizationsPage.jsx
git commit -m "feat: absorb UnlockRequestsPage into Platform Control tab"
```

---

## Task 8: Update router.jsx

**Files:**
- Modify: `src/router.jsx:50,96`

- [ ] **Step 1: Remove the UnlockRequestsPage lazy import (line 50)**

Find:
```js
const UnlockRequestsPage = lazy(() => import("@/admin/pages/UnlockRequestsPage"));
```

Delete that line entirely.

- [ ] **Step 2: Replace the unlock-requests route with a redirect**

Find:
```jsx
  { path: "unlock-requests",  element: <SuspenseWrap><UnlockRequestsPage /></SuspenseWrap> },
```

Replace with:
```jsx
  { path: "unlock-requests",  element: <Navigate to="../organizations" replace /> },
```

- [ ] **Step 3: Verify build — `npm run build 2>&1 | head -20`**

Expected: no errors.

---

## Task 9: Update AdminSidebar.jsx

**Files:**
- Modify: `src/admin/layout/AdminSidebar.jsx`

- [ ] **Step 1: Remove the Unlock Requests nav button**

Find and delete the entire button block:
```jsx
            <button
              className={itemClass("unlock-requests")}
              onClick={() => navTo("unlock-requests")}
            >
              <ShieldAlert size={18} strokeWidth={1.8} />
              Unlock Requests
            </button>
```

- [ ] **Step 2: Rename the Organizations nav label to "Platform Control"**

Find:
```jsx
            <button
              className={itemClass("organizations")}
              onClick={() => navTo("organizations")}
            >
              <Building size={18} strokeWidth={1.8} />
              Organizations
            </button>
```

Replace with:
```jsx
            <button
              className={itemClass("organizations")}
              onClick={() => navTo("organizations")}
            >
              <Building size={18} strokeWidth={1.8} />
              Platform Control
            </button>
```

- [ ] **Step 3: Check whether `ShieldAlert` is still imported after removing the button. If it's no longer used, remove it from the import.**

Run: `grep -n "ShieldAlert" src/admin/layout/AdminSidebar.jsx`

If only used in the deleted button, remove `ShieldAlert` from the lucide import.

---

## Task 10: Update useAdminNav.js

**Files:**
- Modify: `src/admin/hooks/useAdminNav.js:90`

- [ ] **Step 1: Rename the label**

Find:
```js
  organizations: "Organizations",
```

Replace with:
```js
  organizations: "Platform Control",
```

- [ ] **Step 2: Remove `unlock-requests` from PAGE_LABELS if present**

Check: the current file does NOT have `"unlock-requests"` in PAGE_LABELS (it was never added). No action needed — confirm with:

```bash
grep "unlock-requests" src/admin/hooks/useAdminNav.js
```

Expected: no output.

---

## Task 11: Delete UnlockRequestsPage.jsx

- [ ] **Step 1: Delete the file**

```bash
rm src/admin/pages/UnlockRequestsPage.jsx
```

- [ ] **Step 2: Verify build one final time**

```bash
npm run build 2>&1 | head -30
```

Expected: clean build with no errors.

- [ ] **Step 3: Final commit**

```bash
git add -u src/admin/pages/UnlockRequestsPage.jsx
git add src/router.jsx src/admin/layout/AdminSidebar.jsx src/admin/hooks/useAdminNav.js
git commit -m "feat: rename Organizations to Platform Control, remove Unlock Requests route"
```

---

## Task 12: Manual verification

- [ ] Run `npm run dev` and open `http://localhost:5173/admin/organizations`
- [ ] Confirm page title shows "Platform Control", single "Super Admin" badge
- [ ] Confirm "Organizations" and "Unlock Requests" tab strip is visible
- [ ] Confirm Organizations tab shows KPI strip + table (same as before)
- [ ] Confirm Unlock Requests tab loads the pending table on first switch
- [ ] Confirm switching Pending/Approved/Rejected sub-tabs works
- [ ] Confirm Approve / Reject modal opens and submits without error
- [ ] Navigate to `/admin/unlock-requests` — confirm redirect to `/admin/organizations`
- [ ] Confirm sidebar shows only "Platform Control" under the Platform section (no "Unlock Requests" item)
- [ ] Log in as a non-super admin — confirm "Platform Control" is not visible in sidebar
