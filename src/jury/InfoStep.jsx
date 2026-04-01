// src/jury/InfoStep.jsx
// Step 1 — Juror identity form.

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { UserCheck, Info, AlertCircle, Landmark, GraduationCap, CalendarDays, FolderKanban, ArrowRight, ArrowLeft } from "lucide-react";

const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

export default function InfoStep({
  juryName, setJuryName,
  affiliation, setAffiliation,
  currentPeriod,
  activeProjectCount,
  onStart,
  onBack,
  error,
}) {
  const canStart = juryName.trim().length > 0 && affiliation.trim().length > 0;
  const formatLongDate = (value) => {
    if (!value) return "\u2014";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };
  const periodLabel = currentPeriod?.name || "-";
  const infoDate = currentPeriod?.start_date;
  const infoDateLabel = infoDate ? formatLongDate(infoDate) : "-";
  const projectCountLabel =
    typeof activeProjectCount === "number"
      ? `${activeProjectCount} Project Group${activeProjectCount === 1 ? "" : "s"}`
      : "-";

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="flex flex-col gap-5 p-6">
          {/* Header */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="jury-step-icon">
              <UserCheck />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Jury Information</h1>
            {(currentPeriod?.university || currentPeriod?.department) && (
              <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
                {currentPeriod?.university && (
                  <span className="inline-flex items-center gap-1.5">
                    <GraduationCap className="size-4" />
                    {currentPeriod.university}
                  </span>
                )}
                {currentPeriod?.department && (
                  <span className="inline-flex items-center gap-1.5">
                    <Landmark className="size-4" />
                    {currentPeriod.department}
                  </span>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted-foreground" aria-label="Jury schedule summary">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                {periodLabel}
              </span>
              <span className="text-muted-foreground/40">&middot;</span>
              <span>{infoDateLabel}</span>
              <span className="text-muted-foreground/40">&middot;</span>
              <span className="inline-flex items-center gap-1">
                <FolderKanban className="size-3.5" />
                {projectCountLabel}
              </span>
            </div>
          </div>

          {/* Info banner */}
          <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>Name and institution / department cannot be changed once evaluation starts.</span>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <div>
                <div className="font-medium">Could not continue</div>
                <div className="mt-0.5 text-destructive/80">{error}</div>
              </div>
            </div>
          )}

          {/* Form */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="jury-name">Full Name</Label>
              <Input
                id="jury-name"
                value={juryName}
                onChange={(e) => setJuryName(e.target.value)}
                placeholder="e.g. Jane Smith"
                autoComplete="name"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="jury-affiliation">Affiliation</Label>
              <Input
                id="jury-affiliation"
                value={affiliation}
                onChange={(e) => setAffiliation(e.target.value)}
                placeholder="e.g. TED University / EE"
                onKeyDown={(e) => { if (e.key === "Enter" && canStart) onStart(); }}
              />
            </div>
          </div>

          {isDemoMode && (
            <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
              <Info className="mt-0.5 size-4 shrink-0" />
              <span>In production, jurors enter their real name and institution / department.</span>
            </div>
          )}

          {/* Actions */}
          <Button className="w-full" size="lg" disabled={!canStart} onClick={onStart}>
            Start Evaluation
            <ArrowRight className="ml-1 size-4" />
          </Button>
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            onClick={onBack}
          >
            <ArrowLeft className="size-3.5" />
            Return Home
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
