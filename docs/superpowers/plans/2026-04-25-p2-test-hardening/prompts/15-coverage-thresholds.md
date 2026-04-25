# P2-15 — Coverage threshold raises

## Goal

Bump vitest coverage thresholds from current 47/32/56 to 60/50/65 (audit's first step). Locks in P0+P1 gains so future PRs can't regress below this floor.

## Where

`vite.config.js` — has the `coverage` block.

## Current

```js
coverage: {
  provider: "v8",
  thresholds: {
    lines: 47,
    functions: 32,
    branches: 56,
    statements: 47,
  },
}
```

## Target

```js
coverage: {
  provider: "v8",
  thresholds: {
    lines: 60,
    functions: 50,
    branches: 65,
    statements: 60,
  },
}
```

## Verify

Run `npx vitest run --coverage` (or `npm run test:cov` if there's a script). Confirm actual coverage is at or above the new thresholds. If not, the new threshold can't ship — drop incremental (e.g., 55/45/60) and document why in the commit message.

## Acceptance

- vite.config.js updated
- `npx vitest run --coverage` passes locally with new threshold
- If coverage isn't there, ratchet to whatever IS sustainable, with a `// TODO: bump to 60/50/65 once X` comment

Do NOT commit. Report back: actual coverage numbers + the threshold you ended up shipping.
