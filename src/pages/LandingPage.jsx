import { useTheme } from "@/shared/theme/ThemeProvider";
import AdminShowcaseCarousel from "@/components/home/AdminShowcaseCarousel";
import veraLogoDark from "@/assets/vera_logo_dark.png";
import veraLogoWhite from "@/assets/vera_logo_white.png";
import { Sun, Moon } from "lucide-react";

export function LandingPage({ onStartJury, onAdmin, onSignIn, isDemoMode }) {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <div className="min-h-dvh bg-[#020817] text-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 border-b border-white/10 bg-[#020817]/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={veraLogoDark}
                alt="VERA"
                className="h-8 w-auto"
                loading="eager"
              />
              <span className="text-lg font-semibold tracking-tight">VERA</span>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={toggleTheme}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-slate-300 transition-colors hover:bg-white/10"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={onSignIn}
                className="inline-flex h-9 items-center rounded-lg border border-white/15 bg-white/5 px-4 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10"
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-white/10 px-4 py-20 sm:py-32 lg:py-40">
        {/* Background gradient accent */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          {/* Logo mark */}
          <div className="mb-8 flex justify-center">
            <img
              src={veraLogoDark}
              alt=""
              className="h-20 w-auto"
              loading="eager"
            />
          </div>

          {/* Pill subtitles */}
          <div className="mb-6 flex flex-wrap justify-center gap-2">
            <span className="inline-block rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-medium text-slate-400">
              Visual Evaluation
            </span>
            <span className="inline-block rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-medium text-slate-400">
              Reporting
            </span>
            <span className="inline-block rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-medium text-slate-400">
              Analytics
            </span>
          </div>

          {/* Headline */}
          <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Evaluate anything.{" "}
            <span className="italic text-blue-300">Prove everything.</span>
          </h1>

          {/* Description */}
          <p className="mb-10 text-lg leading-relaxed text-slate-400 sm:text-xl">
            Structured jury scoring for exhibitions, competitions, and review
            panels. Configurable criteria, real-time data capture, and outcome
            reports your accreditation body trusts.
          </p>

          {/* CTA Buttons */}
          <div className="mb-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              onClick={isDemoMode ? onStartJury : onStartJury}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 font-medium text-white shadow-lg transition-colors hover:bg-blue-500"
            >
              {isDemoMode ? "Experience Demo" : "Start Evaluation"}
            </button>
            <button
              onClick={onAdmin}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-6 font-medium text-slate-200 transition-colors hover:bg-white/10"
            >
              Explore Admin Panel
            </button>
          </div>

          {/* Hint text for demo mode */}
          {isDemoMode && (
            <p className="text-sm text-slate-500">
              Interactive demo with real evaluation data — no sign-up required.
            </p>
          )}

          {/* Admin Showcase Carousel */}
          <div className="mt-16">
            <AdminShowcaseCarousel />
          </div>
        </div>
      </section>

      {/* Trust Band */}
      <section className="border-b border-white/10 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <p className="mb-8 text-center text-sm font-semibold uppercase tracking-wider text-slate-500">
            Trusted by engineering departments across Turkey
          </p>

          <div className="mb-8 flex flex-wrap items-center justify-center gap-3 text-center text-sm text-slate-400 sm:gap-6">
            <span>TED University</span>
            <span className="h-1 w-1 rounded-full bg-white/20" />
            <span>Bogazici University</span>
            <span className="h-1 w-1 rounded-full bg-white/20" />
            <span>METU</span>
          </div>

          <div className="mb-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <div className="text-center">
              <div className="mb-2 text-2xl font-bold text-blue-300 sm:text-3xl">
                6
              </div>
              <p className="text-xs text-slate-500 sm:text-sm">Departments</p>
            </div>
            <div className="text-center">
              <div className="mb-2 text-2xl font-bold text-blue-300 sm:text-3xl">
                2,094
              </div>
              <p className="text-xs text-slate-500 sm:text-sm">Evaluations</p>
            </div>
            <div className="text-center">
              <div className="mb-2 text-2xl font-bold text-blue-300 sm:text-3xl">
                113
              </div>
              <p className="text-xs text-slate-500 sm:text-sm">Jurors</p>
            </div>
            <div className="text-center">
              <div className="mb-2 text-2xl font-bold text-blue-300 sm:text-3xl">
                177
              </div>
              <p className="text-xs text-slate-500 sm:text-sm">Projects Scored</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-white/10 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              How it works
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Three simple steps
            </h2>
          </div>

          <div className="space-y-6">
            {/* Step 1 */}
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:gap-6">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600 text-lg font-bold text-white">
                1
              </div>
              <div>
                <h3 className="mb-2 text-lg font-semibold">Set Up & Share</h3>
                <p className="text-slate-400">
                  Define criteria, add projects, invite jurors. Share a QR code
                  or link — evaluators join in seconds.
                </p>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center text-slate-600 sm:hidden">
              <span>↓</span>
            </div>
            <div className="hidden justify-center text-slate-600 sm:flex">
              <span>→</span>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:gap-6">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600 text-lg font-bold text-white">
                2
              </div>
              <div>
                <h3 className="mb-2 text-lg font-semibold">Score Live</h3>
                <p className="text-slate-400">
                  Jurors evaluate on any device. Scores auto-save on every
                  input — no paper forms, no data entry.
                </p>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center text-slate-600 sm:hidden">
              <span>↓</span>
            </div>
            <div className="hidden justify-center text-slate-600 sm:flex">
              <span>→</span>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:gap-6">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600 text-lg font-bold text-white">
                3
              </div>
              <div>
                <h3 className="mb-2 text-lg font-semibold">Report & Prove</h3>
                <p className="text-slate-400">
                  Rankings, outcome attainment, analytics, and exports —
                  accreditation-ready the moment scoring ends.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-b border-white/10 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Why teams choose VERA
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              The core features
            </h2>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {/* Feature 1 */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="mb-4 h-12 w-12 rounded-lg bg-blue-600/20 flex items-center justify-center">
                <svg
                  className="h-6 w-6 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                  />
                </svg>
              </div>
              <h3 className="mb-3 text-lg font-semibold">Flexible Criteria</h3>
              <p className="text-slate-400">
                Define rubrics per evaluation period — technical, design,
                delivery, or any domain-specific criteria. Map each to programme
                outcomes.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="mb-4 h-12 w-12 rounded-lg bg-blue-600/20 flex items-center justify-center">
                <svg
                  className="h-6 w-6 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h3 className="mb-3 text-lg font-semibold">Real-Time Scoring</h3>
              <p className="text-slate-400">
                Jurors score on any device during the event. Auto-save on every
                input, live sync, PIN-secured sessions. Zero friction.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="mb-4 h-12 w-12 rounded-lg bg-blue-600/20 flex items-center justify-center">
                <svg
                  className="h-6 w-6 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <h3 className="mb-3 text-lg font-semibold">
                Outcome-Level Reporting
              </h3>
              <p className="text-slate-400">
                Every score maps to programme outcomes. Generate
                accreditation-ready attainment reports — not just rankings.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Before / After */}
      <section className="border-b border-white/10 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              The difference
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Without VERA */}
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
              <h3 className="mb-6 text-lg font-semibold text-red-300">
                Without VERA
              </h3>
              <ul className="space-y-3">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 text-red-400">✗</span>
                  <span className="text-slate-400">
                    Paper forms collected manually at the event
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 text-red-400">✗</span>
                  <span className="text-slate-400">
                    Scores entered into spreadsheets after the fact
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 text-red-400">✗</span>
                  <span className="text-slate-400">
                    Outcome mapping done by hand for accreditation
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 text-red-400">✗</span>
                  <span className="text-slate-400">
                    No audit trail — impossible to verify or defend
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 text-red-400">✗</span>
                  <span className="text-slate-400">
                    Results take days to compile and distribute
                  </span>
                </li>
              </ul>
            </div>

            {/* With VERA */}
            <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6">
              <h3 className="mb-6 text-lg font-semibold text-green-300">
                With VERA
              </h3>
              <ul className="space-y-3">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 text-green-400">✓</span>
                  <span className="text-slate-400">
                    Jurors score on their phones in real time
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 text-green-400">✓</span>
                  <span className="text-slate-400">
                    Every input auto-saved — zero data entry
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 text-green-400">✓</span>
                  <span className="text-slate-400">
                    Scores auto-map to programme outcomes
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 text-green-400">✓</span>
                  <span className="text-slate-400">
                    Full audit trail with action-level history
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 text-green-400">✓</span>
                  <span className="text-slate-400">
                    Rankings and reports ready the moment scoring ends
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-4 text-sm text-slate-500">
            © 2026 VERA · Developed by{" "}
            <a
              href="https://huguryildiz.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-slate-300"
            >
              Huseyin Ugur Yildiz
            </a>
            · v1.0
          </p>
          {isDemoMode && (
            <a
              href="https://vera-eval.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-400"
            >
              <svg
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
              Visit Production
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}
