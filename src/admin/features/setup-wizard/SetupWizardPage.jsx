// src/admin/features/setup-wizard/SetupWizardPage.jsx — Setup wizard orchestrator
// 5-step wizard guiding first-time organization admins through initial evaluation setup.
// Steps: Welcome → Period → Criteria (+Framework) → Projects → Jurors (+Launch)

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useAdminContext } from "@/admin/shared/useAdminContext";
import { useAuth } from "@/auth";
import { useSetupWizard } from "./useSetupWizard";
import { markSetupComplete } from "@/shared/api";
import { KEYS } from "@/shared/storage/keys";

import WizardStepper from "./steps/WizardStepper";
import WelcomeStep from "./steps/WelcomeStep";
import PeriodStep from "./steps/PeriodStep";
import CriteriaStep from "./steps/CriteriaStep";
import JurorsStep from "./steps/JurorsStep";
import ProjectsStep from "./steps/ProjectsStep";
import CompletionStep from "./steps/CompletionStep";

import "./styles/index.css";

export default function SetupWizardPage() {
  const {
    activeOrganization,
    sortedPeriods,
    criteriaConfig,
    frameworks,
    allJurors,
    summaryData,
    navigateTo,
    fetchData,
    reloadCriteriaAndOutcomes,
    selectedPeriodId,
    setSelectedPeriodId,
    isDemoMode,
  } = useAdminContext();
  const { refreshMemberships } = useAuth();

  const {
    currentStep,
    completedSteps,
    goToStep,
    nextStep,
    prevStep,
    wizardData,
    setWizardData,
  } = useSetupWizard({
    orgId: activeOrganization?.id,
    periods: sortedPeriods || [],
    criteriaConfig: criteriaConfig || [],
    frameworks: frameworks || [],
    jurors: allJurors || [],
    projects: summaryData || [],
    hasEntryToken: false,
  });

  const [loading] = useState(false);
  // Restore completion screen on remount so that navigating away and back still
  // shows "Your evaluation is ready!" instead of dumping the user back onto
  // step 7 (which reactive derivation would do once all data is in place).
  // Source of truth is the DB-backed organizations.setup_completed_at flag.
  const [showCompletion, setShowCompletion] = useState(
    () => !!activeOrganization?.setupCompletedAt
  );

  useEffect(() => {
    if (activeOrganization?.setupCompletedAt) setShowCompletion(true);
  }, [activeOrganization?.setupCompletedAt]);

  const periodId = wizardData.periodId;

  // Refresh shared context data on mount so that any external changes
  // (e.g. a period deleted from the Periods page, or criteria/outcomes
  // edited on the Criteria page) are reflected before the wizard validates
  // its state.
  useEffect(() => {
    fetchData();
    reloadCriteriaAndOutcomes?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reconcile wizard ↔ admin on the currently-active period.
  //
  // First render only: prefer the admin's selectedPeriodId over wizard's
  // persisted periodId — sessionStorage may hold a stale period from an old
  // wizard session.
  //
  // After first render: keep admin's selectedPeriodId synced to the wizard's
  // period so allJurors/summaryData reflect the wizard period.
  const mountReconcileDone = useRef(false);
  useEffect(() => {
    if (!Array.isArray(sortedPeriods) || sortedPeriods.length === 0) return;

    if (!mountReconcileDone.current) {
      mountReconcileDone.current = true;
      if (selectedPeriodId && selectedPeriodId !== periodId) {
        const adminValid = sortedPeriods.some((p) => p.id === selectedPeriodId);
        if (adminValid) {
          setWizardData({ periodId: selectedPeriodId });
          // useSetupWizard's reactive effect only advances (Math.max) — without
          // this reset the wizard would stay on a step appropriate to the OLD period.
          goToStep(1);
          return;
        }
      }
    }

    if (periodId && periodId !== selectedPeriodId) {
      setSelectedPeriodId(periodId);
    }
  }, [sortedPeriods, periodId, selectedPeriodId, setSelectedPeriodId, setWizardData, goToStep]);

  const periodIdSet = useMemo(
    () => new Set((sortedPeriods || []).map((p) => p.id)),
    [sortedPeriods]
  );

  // If the wizard holds a periodId that no longer exists, or all periods were
  // deleted, reset to step 1 so the user is prompted to create a new period.
  // Only reset when periodId was previously assigned — skip when null/undefined
  // so a fresh wizard on an empty org isn't kicked back while creating a period.
  useEffect(() => {
    if (!Array.isArray(sortedPeriods)) return;
    if (sortedPeriods.length === 0) {
      if (periodId != null) {
        setWizardData({ periodId: null });
        goToStep(1);
      }
      return;
    }
    if (!periodId) return;
    if (!periodIdSet.has(periodId)) {
      setWizardData({ periodId: null });
      goToStep(1);
    }
  }, [periodId, periodIdSet, sortedPeriods, setWizardData, goToStep]);

  const handleStep2Continue = useCallback(
    async (newPeriodId) => {
      setWizardData({ periodId: newPeriodId });
      await fetchData();
      // Don't call nextStep() here — the reactive effect in useSetupWizard advances
      // step 2→3 once fetchData() updates sortedPeriods with the new period.
    },
    [setWizardData, fetchData]
  );

  const handleStep3Continue = useCallback(
    (frameworkId) => {
      if (frameworkId) setWizardData({ frameworkId });
      nextStep();
    },
    [nextStep, setWizardData]
  );

  const handleStep4Continue = useCallback(() => {
    nextStep();
  }, [nextStep]);

  const clearWizardStorage = useCallback(() => {
    if (!activeOrganization?.id) return;
    try {
      sessionStorage.removeItem(`sw_step_${activeOrganization.id}`);
      sessionStorage.removeItem(`sw_data_${activeOrganization.id}`);
    } catch { /* ignore */ }
  }, [activeOrganization?.id]);

  // Surfaces the CompletionScreen when the user clicks "Complete Setup".
  // The DB flag is stamped later, inside CompletionStep's handleGenerate.
  const handleCompletion = useCallback(() => {
    clearWizardStorage();
    setShowCompletion(true);
  }, [clearWizardStorage]);

  // Token generated → DB flag stamped → refresh AuthProvider so the sidebar
  // Setup link disappears and direct /admin/setup access starts bouncing.
  const handleMarkSetupComplete = useCallback(async (organizationId) => {
    await markSetupComplete(organizationId);
    // refreshMemberships is deferred to onDashboard so the redirect effect in
    // AdminRouteLayout doesn't fire while the completion screen is still visible.
  }, []);

  const handleSkip = useCallback(() => {
    clearWizardStorage();
    if (activeOrganization?.id) {
      try { sessionStorage.setItem(KEYS.SETUP_SKIP_PREFIX + activeOrganization.id, "1"); } catch { /* ignore */ }
    }
    navigateTo("overview");
  }, [navigateTo, clearWizardStorage, activeOrganization?.id]);

  if (showCompletion) {
    return (
      <CompletionStep
        periodId={periodId}
        organizationId={activeOrganization?.id}
        isDemoMode={isDemoMode}
        onDashboard={async () => {
          if (activeOrganization?.id && !activeOrganization?.setupCompletedAt) {
            try { await markSetupComplete(activeOrganization.id); } catch { /* ignore */ }
          }
          await refreshMemberships?.();
          navigateTo("overview");
        }}
        onPublished={() => fetchData()}
        onMarkSetupComplete={handleMarkSetupComplete}
        onNavigateStep={(step) => {
          setShowCompletion(false);
          goToStep(step);
        }}
      />
    );
  }

  return (
    <>
      <WizardStepper
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={goToStep}
      />

      {currentStep === 1 && (
        <WelcomeStep
          onContinue={() => nextStep()}
          onSkip={handleSkip}
        />
      )}

      {currentStep === 2 && (
        <PeriodStep
          onContinue={handleStep2Continue}
          onBack={prevStep}
          onCreateNew={() => setWizardData({ periodId: null })}
          existingPeriods={sortedPeriods || []}
          wizardPeriodId={periodId}
        />
      )}

      {currentStep === 3 && (
        <CriteriaStep
          periodId={periodId}
          frameworks={frameworks || []}
          onContinue={handleStep3Continue}
          onBack={prevStep}
        />
      )}

      {currentStep === 4 && (
        <ProjectsStep
          periodId={periodId}
          onContinue={handleStep4Continue}
          onBack={prevStep}
          loading={loading}
        />
      )}

      {currentStep === 5 && (
        <JurorsStep
          periodId={periodId}
          onContinue={() => fetchData()}
          onBack={prevStep}
          onLaunch={handleCompletion}
          loading={loading}
        />
      )}
    </>
  );
}
