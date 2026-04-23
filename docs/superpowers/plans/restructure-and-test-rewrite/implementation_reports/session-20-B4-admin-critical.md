# Session 20 — B4 Part 1: Admin Critical Feature Tests

**Tarih:** 2026-04-23
**Kapsam:** Faz B4 Part 1 — jurors + periods + projects + organizations full test coverage
**Sonuç:** 17/17 test yeşil, 14 test dosyası, 1.47s

---

## Yazılan Test Dosyaları

### Jurors (`src/admin/features/jurors/__tests__/`)
| Dosya | Test | QA ID |
|-------|------|-------|
| `JurorsPage.test.jsx` | 1 | `admin.jurors.page.render` |
| `AddJurorDrawer.test.jsx` | 2 | `admin.jurors.add.happy`, `admin.jurors.add.validation` |
| `EditJurorDrawer.test.jsx` | 1 | `admin.jurors.edit.prefill` |
| `useManageJurors.test.js` | 1 | `admin.jurors.hook.load` |

### Periods (`src/admin/features/periods/__tests__/`)
| Dosya | Test | QA ID |
|-------|------|-------|
| `PeriodsPage.test.jsx` | 1 | `admin.periods.page.render` |
| `AddEditPeriodDrawer.test.jsx` | 2 | `admin.periods.add.happy`, `admin.periods.add.error` |
| `ClosePeriodModal.test.jsx` | 1 | `admin.periods.close.confirm` |
| `useManagePeriods.test.js` | 1 | `admin.periods.hook.load` |

### Projects (`src/admin/features/projects/__tests__/`)
| Dosya | Test | QA ID |
|-------|------|-------|
| `ProjectsPage.test.jsx` | 1 | `admin.projects.page.render` |
| `AddProjectDrawer.test.jsx` | 1 | `admin.projects.add.happy` |
| `DeleteProjectModal.test.jsx` | 1 | `admin.projects.delete.confirm` |
| `useManageProjects.test.js` | 1 | `admin.projects.hook.load` |

### Organizations (`src/admin/features/organizations/__tests__/`)
| Dosya | Test | QA ID |
|-------|------|-------|
| `OrganizationsPage.test.jsx` | 1 | `admin.orgs.page.render` |
| `useManageOrganizations.test.js` | 2 | `admin.orgs.hook.load`, `admin.orgs.create.happy` |

---

## Kritik Teknik Bulgular

### 1. OOM: Unstable `vi.fn()` References in useEffect Dependencies

**Problem:** `vi.mock("../hook", () => ({ useHook: () => ({ fn: vi.fn() }) }))` — the factory function `() => ({...})` runs on EVERY component render. Each call produces a new `vi.fn()` object. If this function reference appears in a React `useEffect` dependency array, the effect re-fires every render → calls `setLoadingCount()` → state change → re-render → new fn reference → effect fires again → infinite loop → OOM.

**Affected pages:** `JurorsPage.jsx` (lines 275-296) and `ProjectsPage.jsx` (line 260) both have:
```js
useEffect(() => {
  incLoading();
  periods.loadPeriods()...
}, [periods.loadPeriods]);  // ← unstable mock → infinite loop
```

**Fix:** Create `vi.fn()` instances in the outer factory body (runs ONCE at module load):
```js
vi.mock("@/admin/features/periods/useManagePeriods", () => {
  const loadPeriods = vi.fn().mockResolvedValue(undefined);  // ← created once
  return {
    useManagePeriods: () => ({ loadPeriods, ... }),  // ← same reference every render
  };
});
```

### 2. Mock Path Resolution: `"./"` vs `"../"`

From `__tests__/Foo.test.jsx`, `vi.mock("./Bar")` resolves to `__tests__/Bar` (non-existent) — the mock silently doesn't apply and the REAL module loads. `vi.mock("../Bar")` resolves to the actual component file. Original ProjectsPage tests used `"./"` prefix throughout, causing mocks to silently not apply.

### 3. `vi.hoisted()` for Top-Level Mock Variables

Vitest hoists `vi.mock()` calls before variable declarations. `const mockFn = vi.fn()` at the top of the file is NOT accessible inside a `vi.mock()` factory — `Cannot access 'mockFn' before initialization`. Fix: use `vi.hoisted()`:
```js
const { mockCreateOrg } = vi.hoisted(() => ({
  mockCreateOrg: vi.fn().mockResolvedValue({ data: { id: "org-new" }, error: null }),
}));
```

### 4. Duplicate-Name Validation is Edit-Mode Only

`AddEditPeriodDrawer.jsx` line 50: `if (!isEdit || ...) { setNameError(""); return; }` — the duplicate period name check ONLY runs when editing an existing period (`period` prop is non-null). The `admin.periods.add.error` test must pass `period={{ id: "p-001", name: "Fall 2025" }}` to enter edit mode.

### 5. Missing Exports in dateBounds Mock

`useManagePeriods.js` imports `APP_DATE_MIN_DATE`, `APP_DATE_MAX_DATE`, `isIsoDateWithinBounds` from `@/shared/dateBounds`. The original mock only provided `clampDate`, `formatForInput`, `buildDateBoundsFromSettings`. Added all six exports.

### 6. `useManageOrganizations` Requires `incLoading`/`decLoading`

The hook calls `incLoading()` directly on save operations (not optional-chained). `makeOpts` must include `incLoading: vi.fn()` and `decLoading: vi.fn()`.

---

## Test Sayısı

| Aşama | Yeni test | Toplam |
|-------|-----------|--------|
| Session 17 (B1 shared) | 68 | 139 |
| Session 18 (B2 auth) | 37 | 176 |
| Session 19 (B3 jury) | 49 | 225 |
| **Session 20 (B4 admin critical)** | **17** | **242** |

Full suite: **242/242 test, 80 dosya**
