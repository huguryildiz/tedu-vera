import { useEffect, useRef } from "react";
import { Check } from "lucide-react";

export const STEP_LABELS = [
  "Welcome",
  "Period",
  "Criteria",
  "Projects",
  "Jurors",
];

export default function WizardStepper({ currentStep, completedSteps, onStepClick }) {
  const stepperRef = useRef(null);
  const activeRef = useRef(null);

  useEffect(() => {
    if (activeRef.current && stepperRef.current) {
      const container = stepperRef.current;
      const activeEl = activeRef.current;
      const offsetLeft = activeEl.offsetLeft - container.clientWidth / 2 + activeEl.clientWidth / 2;
      container.scrollTo({ left: offsetLeft, behavior: "smooth" });
    }
  }, [currentStep]);

  return (
    <div className="sw-stepper" ref={stepperRef}>
      {STEP_LABELS.map((label, idx) => {
        const step = idx + 1;
        const isActive = step === currentStep;
        const isCompleted = completedSteps.has(step);
        const stepClass = isCompleted ? "completed" : isActive ? "active" : "";
        const isClickable = isCompleted || step <= currentStep;

        return (
          <div key={step} ref={isActive ? activeRef : null}>
            <div
              className={`sw-step ${stepClass}${isClickable ? " clickable" : ""}`}
              onClick={isClickable ? () => onStepClick(step) : undefined}
            >
              <div className="sw-step-circle">
                {isCompleted ? <Check size={13} strokeWidth={2.5} /> : step}
              </div>
              <div className="sw-step-label">{label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
