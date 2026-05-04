import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sun, Moon, KeyRound, ArrowRight } from "lucide-react";
import { useTheme } from "@/shared/theme/ThemeProvider";

function formatStamp(date) {
  const iso = date.toISOString().slice(0, 16).replace("T", " · ");
  return `${iso} UTC`;
}

export default function Masthead() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [stamp, setStamp] = useState(() => formatStamp(new Date()));

  useEffect(() => {
    const id = setInterval(() => setStamp(formatStamp(new Date())), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="ed-masthead">
      <div className="ed-masthead-inner">
        <div className="ed-brand">
          <span className="ed-brand-mark">V</span>ERA
          <span className="ed-brand-sub">Visual Evaluation</span>
        </div>

        <div className="ed-mast-meta">
          <span className="ed-mast-live">
            <span className="ed-mast-dot" />Live · vera-demo
          </span>
          <span className="ed-mast-stamp">{stamp}</span>
        </div>

        <div className="ed-mast-actions">
          <button
            type="button"
            className="ed-theme-toggle"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={15} strokeWidth={1.8} /> : <Moon size={15} strokeWidth={1.8} />}
          </button>
          <button
            type="button"
            className="ed-mast-btn ed-mast-btn--code"
            onClick={() => navigate("/eval")}
          >
            <KeyRound size={13} strokeWidth={1.8} />
            Enter code
          </button>
          <button
            type="button"
            className="ed-mast-btn ed-mast-btn--signin"
            data-testid="admin-landing-signin"
            onClick={() => navigate("/login")}
          >
            Sign in
            <ArrowRight size={12} strokeWidth={2} />
          </button>
        </div>
      </div>
    </header>
  );
}
