// Deterministic avatar gradient + initials helper for member chip avatars.
// Used by Projects mobile card (src/admin/pages/ProjectsPage.jsx) and
// extractable for other surfaces later.

const PALETTE = [
  "linear-gradient(135deg,#3b82f6,#2563eb)", // blue
  "linear-gradient(135deg,#8b5cf6,#7c3aed)", // purple
  "linear-gradient(135deg,#10b981,#059669)", // green
  "linear-gradient(135deg,#f59e0b,#d97706)", // amber
  "linear-gradient(135deg,#ec4899,#db2777)", // pink
];

export function avatarGradient(name) {
  const key = String(name ?? "");
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export function initials(name) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const up = (s) => s.toLocaleUpperCase("tr-TR");
  if (parts.length === 1) return up(parts[0].slice(0, 2));
  return up(parts[0][0] + parts[parts.length - 1][0]);
}
