# Design Reference

> _Last updated: 2026-05-02_

UI mockups and design concepts for VERA. The folder is split into a small
canonical reference set and a date-grouped archive of historical exploration.

## Structure

- **`reference/`** — canonical UI prototypes. When CLAUDE.md or a code comment
  says "match the prototype", it points here. Keep this folder small (3-5 files).
- **`archive/`** — historical design explorations, grouped by date (`YYYY-MM/`)
  or series (`jury-flow-explorations/`). Never deleted; design decisions are
  traceable through these files.

## Active reference files

| File | Purpose |
| --- | --- |
| [reference/vera-premium-prototype.html](reference/vera-premium-prototype.html) | Master UI prototype — 1:1 reference for all admin and jury pages. |
| [reference/admin-all-pages.html](reference/admin-all-pages.html) | Admin panel screens in a single HTML for layout comparison. |
| [reference/premium-light-all-screens.html](reference/premium-light-all-screens.html) | Light-mode variant reference. |

Source code that targets a prototype links it by relative path
(`docs/design/reference/vera-premium-prototype.html`), so renaming any of these
files breaks code comments — search before renaming.

## Archive layout

| Folder | Contents |
| --- | --- |
| `archive/2026-04/` | All April 2026 feature mockups (admin pages, drawers, jury arrival, audit log, criteria, outcomes, etc.). 31 files. |
| `archive/jury-flow-explorations/` | The `jury-flow-v1..v5` series — alternative jury-flow visual directions. 6 files. |
| `archive/VERA Feedback System — Design Spec.pdf` | Original feedback-system spec PDF. |

When adding a new dated archive group (`2026-05/`, etc.), update this table.

## Adding a new mockup

1. **One-off feature exploration** → `archive/YYYY-MM/<date>-<slug>.html`.
2. **Replaces or updates a canonical reference** → discuss before editing
   `reference/`. The prototype is the source of truth for many components.
3. **Never edit a file in `archive/`.** Create a new dated version instead so
   the design history stays intact.

---
