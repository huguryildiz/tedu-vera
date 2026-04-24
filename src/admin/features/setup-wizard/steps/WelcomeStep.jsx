import {
  Diamond,
  CalendarRange,
  ClipboardCheck,
  Users,
  Layers,
  Zap,
  Clock,
  ArrowRight,
} from "lucide-react";

export default function WelcomeStep({ onContinue, onSkip }) {
  const previewIcons = [
    { icon: CalendarRange,  label: "Create Period",        color: "#3b82f6" },
    { icon: ClipboardCheck, label: "Criteria",             color: "#8b5cf6" },
    { icon: Layers,         label: "Add Projects",         color: "#f59e0b" },
    { icon: Users,          label: "Add Jurors",           color: "#10b981" },
    { icon: Zap,            label: "Launch",               color: "#f43f5e" },
  ];

  return (
    <div className="sw-card sw-fade-in">
      <div className="sw-card-icon">
        <Diamond size={24} />
      </div>
      <h2 className="sw-card-title">Set up your evaluation</h2>
      <p className="sw-card-desc">
        Configure your first evaluation period in a few straightforward steps.
        You can always adjust settings later.
      </p>

      <div className="sw-steps-preview">
        {previewIcons.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="sw-preview-item" style={{ "--pi-delay": `${idx * 80}ms`, "--pi-float-delay": `${idx * 370}ms` }}>
              <div
                className="sw-preview-icon sw-preview-icon--color"
                style={{
                  "--pi-color": item.color,
                  "--pi-bg": item.color + "18",
                  "--pi-border": item.color + "38",
                }}
              >
                <Icon size={18} />
              </div>
              <div className="sw-preview-label">{item.label}</div>
            </div>
          );
        })}
      </div>

      <div className="sw-time-estimate">
        <Clock size={14} />
        Estimated time: ~5 minutes
      </div>

      <div className="sw-actions">
        <button className="sw-btn sw-btn-primary" onClick={onContinue} data-testid="wizard-welcome-continue">
          Get Started <ArrowRight size={16} />
        </button>
      </div>

      <div className="sw-footer">
        <button className="sw-btn-link" onClick={onSkip} data-testid="wizard-welcome-skip">
          I'll set up later
        </button>
      </div>
    </div>
  );
}
