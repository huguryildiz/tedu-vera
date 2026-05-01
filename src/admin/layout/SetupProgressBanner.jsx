import { Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { Cog, ChevronRight, Check } from "lucide-react";

export default function SetupProgressBanner({ basePath, steps }) {
  const navigate = useNavigate();
  const completedCount = steps.filter((s) => s.done).length;
  const currentIndex = steps.findIndex((s) => !s.done);

  return (
    <div className="setup-progress-banner">
      <div className="spb-inner">
        <Cog size={13} strokeWidth={2} className="spb-icon" aria-hidden />
        <span className="spb-title">Setup</span>
        <span className="spb-count">
          {completedCount}<span className="spb-total">/{steps.length}</span>
        </span>
        <span className="spb-sep" aria-hidden />
        <div className="spb-steps">
          {steps.map((step, i) => (
            <Fragment key={step.id}>
              <span className={`spb-step${step.done ? " done" : i === currentIndex ? " current" : ""}`}>
                <span className="spb-step-num" aria-hidden>
                  {step.done ? <Check size={8} strokeWidth={3.5} /> : i + 1}
                </span>
                {step.label}
              </span>
              {i < steps.length - 1 && <span className="spb-connector" aria-hidden />}
            </Fragment>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="spb-btn"
        onClick={() => navigate(`${basePath}/setup`)}
      >
        Continue Setup
        <ChevronRight size={13} strokeWidth={2.5} />
      </button>
    </div>
  );
}
