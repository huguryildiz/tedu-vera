// src/jury/JuryFlow.jsx
// ============================================================
// Main jury flow router — orchestrates all jury evaluation steps
// with dark glassmorphism design matching vera-premium-prototype.html
// ============================================================

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import useJuryState from "./shared/useJuryState";
import ArrivalStep from "./features/arrival/ArrivalStep";
import IdentityStep from "./features/identity/IdentityStep";
import SemesterStep from "./features/period-select/SemesterStep";
import PinStep from "./features/pin/PinStep";
import PinRevealStep from "./features/pin-reveal/PinRevealStep";
import LockedStep from "./features/lock/LockedStep";
import ProgressStep from "./features/progress/ProgressStep";
import EvalStep from "./features/evaluation/EvalStep";
import DoneStep from "./features/complete/DoneStep";
import MinimalLoaderOverlay from "@/shared/ui/MinimalLoaderOverlay";
import StepperBar from "./shared/StepperBar";

// Step name → URL path segment
const STEP_TO_PATH = {
  arrival: "arrival",
  identity: "identity",
  period: "period",
  semester: "period",
  pin: "pin",
  pin_reveal: "pin-reveal",
  locked: "locked",
  progress_check: "progress",
  eval: "evaluate",
  done: "complete",
};

export default function JuryFlow() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = useJuryState();
  const [loaderActive, setLoaderActive] = useState(false);

  // Keep URL in sync with current step
  useEffect(() => {
    const seg = STEP_TO_PATH[state.step];
    const juryBase = location.pathname.startsWith("/demo/jury") ? "/demo/jury" : "/jury";
    if (seg && location.pathname !== `${juryBase}/${seg}`) {
      navigate(`${juryBase}/${seg}`, { replace: true });
    }
  }, [state.step]); // eslint-disable-line react-hooks/exhaustive-deps

  const onBack = () => navigate("/", { replace: true });

  // Map step names to components
  // "arrival" is the QR-scan-success welcome screen (initial step for both prod + demo)
  // "period" is the hook-internal name for semester selection
  const stepComponents = {
    arrival: ArrivalStep,
    identity: IdentityStep,
    period: SemesterStep,      // hook sets "period", not "semester"
    semester: SemesterStep,    // kept as alias
    pin: PinStep,
    pin_reveal: PinRevealStep,
    locked: LockedStep,
    progress_check: ProgressStep,
    eval: EvalStep,
    done: DoneStep,
  };

  const CurrentStep = stepComponents[state.step];

  // During session hydration (page refresh with active session), loadingState is non-null
  // while step is still "arrival" or "identity" — show loader to avoid a flash of the
  // arrival screen or identity form before the juror is routed to their resumed step.
  const isHydrating =
    state.loadingState && (state.step === "arrival" || state.step === "identity");

  // Hide the stepper on arrival — arrival is a pre-flow brand moment
  // and the "Identity → PIN → …" navigation labels would break its mood.
  const showStepper = state.step !== "arrival";

  return (
    <div className="dj-screen">
      {showStepper && <StepperBar step={state.step} />}
      <div className="dj-step active">
        {!isHydrating && CurrentStep ? (
          <CurrentStep
            state={state}
            onBack={onBack}
            setLoaderActive={setLoaderActive}
          />
        ) : !isHydrating ? (
          <div>Unknown step: {state.step}</div>
        ) : null}
      </div>

      <MinimalLoaderOverlay
        open={loaderActive || isHydrating}
        label={state.loadingState?.message || "Loading"}
      />
    </div>
  );
}
