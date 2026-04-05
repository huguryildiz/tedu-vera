# Avatar Menu — Tenant Admin List & Edit

**Date:** 2026-04-05
**Status:** Approved
**Scope:** `src/admin/components/UserAvatarMenu.jsx` + supporting CSS

---

## Goal

Super-admins see all tenant admins listed in the avatar dropdown menu, grouped by organization. Clicking an admin opens an editable detail view inline within the same dropdown.

---

## Constraints

- Super-admin only: entire Team section hidden when `isSuper === false`
- No new components or patterns — extends existing `UserAvatarMenu`
- Delete is out of scope (stays in Settings > Organizations panel)
- Email edit is out of scope (requires Supabase Auth changes)

---

## Architecture

### State

`UserAvatarMenu` gains two new state fields:

```js
const [menuView, setMenuView] = useState("main"); // "main" | "team" | "detail"
const [selectedAdmin, setSelectedAdmin] = useState(null); // { userId, name, email, organizationId, organizationName, role }
```

Admin data is fetched once on menu open via `listOrganizations()`, stored as `orgList`. Loading and error states are handled inline within the dropdown.

### View Navigation

```text
main ──click admin──→ detail
main ──"View all"──→ team ──click admin──→ detail
detail ──"← Back"──→ (previous: main or team)
team   ──"← Back"──→ main
```

Previous view is tracked with `prevView` state to drive the back button correctly.

### CSS Transitions

Each view is rendered in a `div.ph-avatar-menu-views` wrapper. Active view slides into position via `transform: translateX`. Entering from right: `translateX(100%) → 0`. Going back (right): `0 → translateX(100%)`. CSS `transition: transform 220ms ease`.

---

## Views

### Main View (extended)

Existing content unchanged. New "Team" section added before the Sign Out divider:

- Section label: `TEAM` (uppercase, muted, small)
- Shows up to 3 admins inline (first across all orgs, alphabetical by org name then admin name)
- Each row: colored initials avatar + display name + small org badge
- If more admins exist: `View all →` link → team list view
- Clicking any admin row → detail view (with `prevView = "main"`)

### Team List View

Header: `← Team` back button → main view.

Content: orgs sorted alphabetically. Each org section:

- Org section header (uppercase label, muted color)
- Admin rows beneath: colored initials avatar (32px) + name + email + role badge
- Clicking a row → detail view (with `prevView = "team"`)

If `listOrganizations()` returns no admins: empty state "No admins found."

### Admin Detail View

Header: `← Back` → navigates to `prevView`.

Body (mirrors `ProfileView` pattern from the same file):

- Large avatar circle (56px, colored by initials)
- Display name + email (read-only header)
- Read-only info block: Organization + Role
- Editable field: Full Name (`displayName`)
- Email field: read-only input (visually disabled)
- Actions: Cancel (reset dirty state) + Save (calls `updateMemberAdmin`, disabled when not dirty or saving)
- Demo mode: Save permanently disabled

---

## Data Loading

`listOrganizations()` is called once when the dropdown opens (`menuOpen` transitions to `true`). Result cached in `orgList` state for the lifetime of the open session. No re-fetch on view switches.

Error: inline error message within the Team section header area.

Loading: skeleton shimmer rows (2 placeholder rows) while fetching.

---

## API

Uses existing `updateMemberAdmin({ organizationId, userId, displayName })` from `src/shared/api/admin/organizations.js`. No new RPCs needed.

---

## CSS

New classes in existing stylesheet (alongside `.ph-avatar-menu-*` classes):

- `.ph-avatar-menu-views` — clip container, `overflow: hidden`
- `.ph-avatar-menu-view` — full-width panel, transition
- `.ph-avatar-menu-view--active` — visible (translateX: 0)
- `.ph-avatar-menu-team-section` — org group wrapper
- `.ph-avatar-menu-team-header` — org label (uppercase, muted)
- `.ph-avatar-menu-admin-row` — clickable admin row
- `.ph-avatar-menu-admin-avatar` — 32px colored circle
- `.ph-avatar-view-back` — back button (← label)
- `.ph-avatar-view-title` — view header title

---

## Files Changed

| File | Change |
|---|---|
| `src/admin/components/UserAvatarMenu.jsx` | Add `menuView`, `prevView`, `selectedAdmin`, `orgList` state; add `TeamListView`, `AdminDetailView` sub-components; extend `handleMenuAction` |
| CSS (location TBD) | Add `.ph-avatar-menu-views`, team/admin-row classes, transition rules — existing `.ph-avatar-*` and `profile-modal-*` classes are not found in any tracked `.css` file; implementer must locate or create the correct stylesheet |

---

## Out of Scope

- Email editing (Supabase Auth required)
- Admin deletion from this menu
- Search/filter (admin count too low to warrant it)
- Pending application management (stays in Settings panel)
