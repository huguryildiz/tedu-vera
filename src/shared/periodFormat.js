// src/shared/periodFormat.js
// ============================================================
// Evaluation period display-name helpers (pure functions).
// ============================================================

/**
 * @deprecated Period names are now stored clean (no code prefix).
 * Kept as a no-op safety net during the transition period.
 *
 * Strips the organization code prefix from a period display name.
 * E.g. "boun-cs Spring 2026" with slug "boun-cs" → "Spring 2026"
 * Returns the period_name unchanged if slug doesn't match or would leave empty.
 *
 * @param {string} name  Raw period_name from DB.
 * @param {string} [slug] Organization code to strip.
 * @returns {string}
 */
export function stripSlugPrefix(name, slug) {
  if (!name) return name || "";
  if (!slug) return name;
  if (name.startsWith(slug)) {
    const rest = name.slice(slug.length).replace(/^\s+/, "");
    return rest || name;
  }
  return name;
}
