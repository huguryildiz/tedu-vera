// src/shared/storage/juryStorage.js
// ============================================================
// Typed helpers for jury access grant and jury session keys.
// ============================================================

import { KEYS } from "./keys";

/** Read jury access grant (checks sessionStorage first, then localStorage). */
export function getJuryAccess() {
  try {
    return sessionStorage.getItem(KEYS.JURY_ACCESS) || localStorage.getItem(KEYS.JURY_ACCESS) || null;
  } catch { return null; }
}

/** Write jury access grant to both sessionStorage and localStorage. */
export function setJuryAccess(periodId) {
  try {
    sessionStorage.setItem(KEYS.JURY_ACCESS, periodId);
    localStorage.setItem(KEYS.JURY_ACCESS, periodId);
  } catch {}
}

/** Clear jury access grant from both storages. */
export function clearJuryAccess() {
  try {
    sessionStorage.removeItem(KEYS.JURY_ACCESS);
    localStorage.removeItem(KEYS.JURY_ACCESS);
  } catch {}
}

/** Get jury session keys object (for useJuryHandlers compatibility). */
export function getJurySessionKeys() {
  return {
    jurorId: KEYS.JURY_JUROR_ID,
    periodId: KEYS.JURY_PERIOD_ID,
    jurorName: KEYS.JURY_JUROR_NAME,
    affiliation: KEYS.JURY_AFFILIATION,
  };
}

/** Clear all jury session data from localStorage. */
export function clearJurySession() {
  try {
    localStorage.removeItem(KEYS.JURY_JUROR_ID);
    localStorage.removeItem(KEYS.JURY_PERIOD_ID);
    localStorage.removeItem(KEYS.JURY_JUROR_NAME);
    localStorage.removeItem(KEYS.JURY_AFFILIATION);
  } catch {}
}
