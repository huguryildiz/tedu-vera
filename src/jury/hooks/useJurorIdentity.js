// src/jury/hooks/useJurorIdentity.js
// ============================================================
// Owns juror identity form state: name, affiliation, and the
// auth/identity-step error message.
//
// This hook has no effects and no async behavior. Handlers
// that need to act on these values (handleIdentitySubmit) live
// in the useJuryState orchestrator because they cross multiple
// concern boundaries.
// ============================================================

import { useState } from "react";

import { DEMO_MODE } from "@/shared/lib/demoMode";

export function useJurorIdentity() {
  const [juryName, setJuryName] = useState(DEMO_MODE ? "Demo Juror" : "");
  const [affiliation, setAffiliation] = useState(DEMO_MODE ? "TEDU, EE" : "");
  const [authError, setAuthError] = useState("");

  return {
    juryName, setJuryName,
    affiliation, setAffiliation,
    authError, setAuthError,
  };
}
