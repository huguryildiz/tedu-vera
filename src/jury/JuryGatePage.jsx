// src/jury/JuryGatePage.jsx
// ============================================================
// Phase 3.5 — Jury access gate.
//
// Shown when the user lands on /jury-entry.
// If a ?t= token is present, it is verified against the DB.
// On success:
//   - semester-scoped grant stored in localStorage (persists across sessions)
//   - URL cleaned to /jury-entry (token removed from address bar)
//   - onGranted() called → App sets page to "jury"
// On failure or missing token:
//   - access-required screen shown; no jury form rendered
//
// Resume (same or new browser session) is handled entirely
// by the App.jsx page initializer — this component is only
// mounted for fresh token verification.
// ============================================================

import { useEffect, useState } from "react";
import { verifyEntryToken } from "../shared/api";
import { AlertCircleIcon } from "../shared/Icons";
import { setJuryAccess } from "../shared/storage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Info } from "lucide-react";

export default function JuryGatePage({ token, onGranted, onBack }) {
  // "loading" → verifying token; "denied" → bad/expired token; "missing" → no token
  const [status, setStatus] = useState(token ? "loading" : "missing");

  useEffect(() => {
    if (!token) return;
    let active = true;
    verifyEntryToken(token)
      .then((res) => {
        if (!active) return;
        if (res?.ok) {
          setJuryAccess(res.period_id);
          window.history.replaceState(null, "", "/jury-entry");
          onGranted();
        } else {
          setStatus("denied");
        }
      })
      .catch(() => {
        if (active) setStatus("denied");
      });
    return () => { active = false; };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 pt-8 pb-6 text-center">
            <div
              className="size-10 animate-spin rounded-full border-[3px] border-muted border-t-primary"
              aria-label="Verifying access…"
            />
            <h1 className="text-xl font-semibold">Verifying access…</h1>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="space-y-5 pt-6">
          {/* Header */}
          <div className="flex flex-col items-center gap-3">
            <div className="jury-step-icon jury-step-icon--error">
              <ShieldAlert />
            </div>
            <h1 className="text-xl font-semibold">Jury access required</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              This page can only be opened with a valid jury QR code or access link
              provided by the coordinators.
            </p>
            {status === "denied" && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                <Info className="mt-0.5 size-4 shrink-0" />
                <span>The link you used is invalid, expired, or has been revoked.</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <Button className="w-full" onClick={onBack}>
            &larr; Back to Home
          </Button>

          <p className="text-xs text-muted-foreground">
            If you are a walk-in juror, please contact the registration desk.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
