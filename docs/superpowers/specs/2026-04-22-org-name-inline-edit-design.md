# Org Name Inline Edit — Design Spec

**Date:** 2026-04-22
**Status:** Approved

---

## Summary

Allow organization admins to edit their organization's display name directly from the Settings page. Only the name is editable by org admins; code (short label) and membership status remain Super Admin–only.

---

## Scope

- **In scope:** Inline name edit in the "Organization Access" card on `SettingsPage.jsx`
- **Out of scope:** Code (short label), membership status, contact email — these stay locked

---

## Backend

No changes required. `rpc_admin_update_organization` (defined in `009_audit.sql`) already:
- Accepts `{ name }` in the `p_updates` JSONB argument
- Calls `_assert_org_admin(p_org_id)`, which passes for both org admins and super-admins
- Writes an audit log entry on change

The existing `updateOrganization({ organizationId, name })` wrapper in `src/shared/api/admin/organizations.js` is sufficient.

---

## UI — SettingsPage.jsx

### Card header changes

- Remove the `"Read Only"` badge (no longer accurate)
- Change `"Managed by Super Admin"` → `"Code & status managed by Super Admin"`

### Organization row — view mode

```
| Organization   | TEST UNI               [✏ pencil icon] |
```

- Pencil icon: `<Pencil size={13} />` from lucide-react, muted color, accent on hover
- Clicking the icon enters edit mode
- Row is otherwise non-interactive (no tap-to-edit on the text itself)

### Organization row — edit mode

```
| Organization   | [___TEST UNI___________] [✓] [✗] |
```

- Input replaces the text value in-place, `font-weight: 600`, `width: 100%`
- `<Check size={13} />` confirm button and `<X size={13} />` cancel button appear to the right
- **Enter** → save; **Escape** → cancel; **blur** → cancel (explicit confirmation required)
- Empty/whitespace-only name is rejected client-side before calling the API

### Save flow

1. Call `updateOrganization({ organizationId: activeOrganization.id, name: trimmedValue })`
2. On success: update `activeOrganization.name` in local state; exit edit mode
3. On error: show `<FbAlert variant="danger">` inline below the row; stay in edit mode

### Short label and Membership status rows

Unchanged — no lock icon or extra muted styling added; visual difference is sufficient.

### Footer text update

```
Organization name can be edited by org admins.
Code, ownership, and status are managed by Super Admin.
```

---

## State

Local component state in `SettingsPage.jsx`:

```js
const [editingOrgName, setEditingOrgName] = useState(false);
const [orgNameDraft, setOrgNameDraft] = useState("");
const [orgNameError, setOrgNameError] = useState(null);
const [orgNameSaving, setOrgNameSaving] = useState(false);
```

No new hooks, no new files.

---

## Files to change

| File | Change |
|---|---|
| `src/admin/pages/SettingsPage.jsx` | Inline edit UI + save logic |

No migration, no API changes, no new files.
