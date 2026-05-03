# FbAlert Migration Audit

> _Last updated: 2026-04-29_

All inline `fs-alert` raw div patterns have been replaced with the canonical `<FbAlert>` component from `src/shared/ui/FbAlert.jsx`.

## What Changed

Raw markup like:

```jsx
<div className="fs-alert warning">
  <div className="fs-alert-icon"><AlertTriangle size={15} /></div>
  <div className="fs-alert-body">
    <div className="fs-alert-title">Title</div>
    <div className="fs-alert-desc">Description</div>
  </div>
</div>
```

…was replaced with:

```jsx
<FbAlert variant="warning" title="Title">
  Description
</FbAlert>
```

For simple message-only alerts (no title):

```jsx
<FbAlert variant="danger" style={{ marginBottom: 12 }}>{errorMessage}</FbAlert>
```

## Icon Override

`FbAlert` gained an `icon` prop for alerts that previously used a non-default icon (e.g. `Lock` instead of `AlertTriangle`). Usage:

```jsx
<FbAlert variant="warning" title="Criterion locked" icon={Lock}>
  This criterion cannot be edited while the period is locked.
</FbAlert>
```

## Files Modified

| File | Alert(s) replaced | Icons removed |
|---|---|---|
| `src/admin/features/outcomes/OutcomeDetailDrawer.jsx` | warning (lock), danger (error), info (mapping hint) | `AlertCircle`, `Info` |
| `src/admin/features/outcomes/AddOutcomeDrawer.jsx` | danger (error), info (mapping hint) | `AlertCircle`, `Info` |
| `src/admin/features/outcomes/components/DeleteOutcomeModal.jsx` | danger (irreversible action) | `AlertCircle` |
| `src/admin/features/outcomes/components/UnassignFrameworkModal.jsx` | danger (irreversible action) | `AlertCircle` |
| `src/admin/features/entry-control/EntryTokenModal.jsx` | warning (token expiry) | `AlertTriangle` |
| `src/admin/features/entry-control/RevokeTokenModal.jsx` | warning (active jurors) | `AlertTriangle` |
| `src/admin/features/entry-control/components/SendQrModal.jsx` | warning (no-email jurors) | `AlertCircle` |
| `src/admin/features/pin-blocking/PinResetConfirmModal.jsx` | warning (PIN stops working) | `AlertTriangle` |
| `src/admin/features/pin-blocking/UnlockAllModal.jsx` | warning (audit log) | `AlertTriangle` |
| `src/admin/features/pin-blocking/UnlockPinModal.jsx` | warning (PIN shown once) | `AlertTriangle` |
| `src/admin/features/criteria/EditSingleCriterionDrawer.jsx` | warning (criterion locked, Lock icon override) | — |
| `src/admin/features/criteria/ProgrammeOutcomesManagerDrawer.jsx` | info (shared outcome template) | `Info` |
| `src/admin/features/criteria/components/CriteriaConfirmModals.jsx` | danger × 2 (irreversible action) | `AlertCircle` |
| `src/admin/features/organizations/CreateOrganizationDrawer.jsx` | danger (save error) | `AlertCircle` |
| `src/shared/ui/ConfirmModal.jsx` | danger (confirm error) | `AlertCircle` |
| `src/admin/shared/DeleteBackupModal.jsx` | danger (irreversible action) | `AlertCircle` |
| `src/admin/shared/ResetPinModal.jsx` | warning (PIN stops working) | `AlertTriangle` |
| `src/admin/shared/PinPolicyDrawer.jsx` | danger (save error) | `AlertCircle` |
| `src/admin/shared/PinResultModal.jsx` | info (no email on file) | `Info` |
| `src/admin/shared/ImportCsvModal.jsx` | danger (import error), info (what to do next) | `AlertCircle`, `Info` |
| `src/admin/shared/ImportJurorsModal.jsx` | danger (import error), info (what to do next) | `AlertCircle`, `Info` |

## Preserved Inline Uses

`AlertCircle` was intentionally preserved where used **outside** of `fs-alert` blocks:

- `src/admin/shared/PinResultModal.jsx:262` — inline send-error status indicator (not an alert card)
- `src/admin/features/criteria/EditSingleCriterionDrawer.jsx:567,572` — inline field validation indicators

## Result

Zero raw `fs-alert-icon / fs-alert-body / fs-alert-title / fs-alert-desc` elements remain in `src/`. All alert presentation is now driven by `FbAlert`, ensuring consistent styling, dark/light mode tokens, and accessibility (role, aria attributes) from a single source.
