// src/shared/passwordPolicy.js
// Canonical password policy used across auth/admin flows.

export const PASSWORD_MIN_LENGTH = 10;

export const PASSWORD_REQUIREMENTS = [
  { key: "length", label: "Minimum 10 characters" },
  { key: "lower", label: "At least one lowercase letter" },
  { key: "upper", label: "At least one uppercase letter" },
  { key: "number", label: "At least one number" },
  { key: "special", label: "At least one special character" },
];

export const PASSWORD_POLICY_ERROR_TEXT =
  "Password must be at least 10 characters and include lowercase, uppercase, number, and special character.";

export const PASSWORD_POLICY_PLACEHOLDER =
  "Min 10 chars, upper, lower, number, symbol";

export function evaluatePassword(password) {
  const value = String(password || "");
  const checks = {
    length: value.length >= PASSWORD_MIN_LENGTH,
    lower: /[a-z]/.test(value),
    upper: /[A-Z]/.test(value),
    number: /[0-9]/.test(value),
    special: /[^A-Za-z0-9]/.test(value),
  };
  const score = Object.values(checks).filter(Boolean).length;
  return { checks, score };
}

export function isStrongPassword(password) {
  return evaluatePassword(password).score === PASSWORD_REQUIREMENTS.length;
}

export function getStrengthMeta(score) {
  const labels = ["", "Very Weak", "Weak", "Fair", "Strong", "Very Strong"];
  const colors = ["", "#ef4444", "#f97316", "#eab308", "#22c55e", "#16a34a"];
  return {
    label: labels[score] || "",
    color: colors[score] || "",
    pct: score * 20,
  };
}
