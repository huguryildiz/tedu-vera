// src/layouts/AdminRouteLayout.jsx
// ============================================================
// Route-based admin layout. Replaces the old AdminLayout's
// conditional tab rendering with React Router <Outlet />.
//
// Responsibilities:
//   - Auth gate (login/register/forgot/reset screens)
//   - Profile completion gate
//   - Pending review gate
//   - Sidebar + Header chrome
//   - Data fetching (useAdminData)
//   - Renders child route via <Outlet />
// ============================================================

import { lazy, Suspense, useRef, useMemo, useState, useEffect, useCallback, Component } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth";
import { useMaintenanceStatus } from "@/components/MaintenanceGate";
import { AlertTriangle, Icon } from "lucide-react";
import { useAdminNav, getPageLabel } from "@/admin/hooks/useAdminNav";
import { KEYS } from "@/shared/storage/keys";
import { useAdminData } from "@/admin/hooks/useAdminData";
import { useGlobalTableSort } from "@/admin/hooks/useGlobalTableSort";
import AdminSidebar from "@/admin/layout/AdminSidebar";
import AdminHeader from "@/admin/layout/AdminHeader";
import SpotlightTour from "@/shared/ui/SpotlightTour";
import { ADMIN_TOUR_STEPS } from "@/admin/adminTourSteps";
import SetupProgressBanner from "@/admin/layout/SetupProgressBanner";
import EmailVerifyBanner from "@/auth/features/verify-email/EmailVerifyBanner";
import AsyncButtonContent from "@/shared/ui/AsyncButtonContent";
import DraggableThemeToggle from "@/jury/shared/DraggableThemeToggle";
const LazyLoginForm            = lazy(() => import("@/auth/features/login/LoginScreen"));
const LazyRegisterForm         = lazy(() => import("@/auth/features/register/RegisterScreen"));
const LazyForgotPasswordForm   = lazy(() => import("@/auth/features/forgot-password/ForgotPasswordScreen"));
const LazyResetPasswordForm    = lazy(() => import("@/auth/features/reset-password/ResetPasswordScreen"));
const LazyCompleteProfileForm  = lazy(() => import("@/auth/screens/CompleteProfileScreen"));
const LazyPendingReviewGate = lazy(() => import("@/auth/screens/PendingReviewScreen"));
const LazyGraceLockScreen   = lazy(() => import("@/auth/screens/GraceLockScreen"));

const DEMO_EMAIL    = import.meta.env.VITE_DEMO_ADMIN_EMAIL    || "";
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_ADMIN_PASSWORD || "";

// ── Fallback login form ───────────────────────────────────────
function FallbackLoginForm({ onLogin, initialEmail = "", initialPassword = "" }) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState(initialPassword);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onLogin(email.trim(), password, false, "");
    } catch (err) {
      setError(err?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh", background: "#f8fafc" }}>
      <form onSubmit={handleSubmit} style={{ width: "360px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "32px", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", margin: "0 0 24px" }}>Sign in to VERA</h1>
        {error && <p style={{ color: "#dc2626", fontSize: "14px", margin: "0 0 16px", padding: "10px 12px", background: "#fef2f2", borderRadius: "8px" }}>{error}</p>}
        <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>Email</label>
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
          style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", marginBottom: "16px", boxSizing: "border-box" }}
        />
        <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>Password</label>
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password"
          style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", marginBottom: "24px", boxSizing: "border-box" }}
        />
        <button type="submit" disabled={loading}
          style={{ width: "100%", padding: "11px", background: "#2F56D6", color: "#fff", border: "none", borderRadius: "8px", fontSize: "15px", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
          <span className="btn-loading-content">
            <AsyncButtonContent loading={loading} loadingText="Signing in…">Sign in</AsyncButtonContent>
          </span>
        </button>
      </form>
    </div>
  );
}

class AuthFormErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return this.props.fallback || null;
    return this.props.children;
  }
}

export default function AdminRouteLayout() {
  useGlobalTableSort();

  const location = useLocation();
  const navigate = useNavigate();
  const settingsDirtyRef = useRef(false);
  const { currentPage, basePath, isDemo, navigateTo } = useAdminNav({ settingsDirtyRef });
  const isDemoMode = isDemo;

  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState(null);
  const [tourKey, setTourKey] = useState(0);
  const [tourDone, setTourDone] = useState(() => {
    try { return !!localStorage.getItem(KEYS.ADMIN_TOUR_DONE); } catch { return false; }
  });

  const handleStartTour = useCallback(() => {
    try { localStorage.removeItem(KEYS.ADMIN_TOUR_DONE); } catch {}
    setTourDone(false);
    setTourKey((k) => k + 1);
    if (window.innerWidth <= 768) setMobileOpen(true);
  }, []);

  const {
    user,
    loading: authLoading,
    activeOrganization,
    profileIncomplete,
    isPending,
    hasJoinRequest,
    isSuper,
    isEmailVerified,
    graceEndsAt,
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    completeProfile,
  } = useAuth();

  const { isActiveNow: maintenanceActive } = useMaintenanceStatus();

  const [authPage, setAuthPage] = useState(() => {
    // Check if coming from reset-password route
    if (location.pathname === "/reset-password") return "reset";
    try {
      const hash   = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
      const params = new URLSearchParams(window.location.search);
      if (
        hash.get("type") === "recovery" ||
        params.get("type") === "recovery" ||
        params.get("page") === "reset-password"
      ) return "reset";
    } catch {}
    return "login";
  });
  const [authError, setAuthError] = useState("");

  // Determine scores view from pathname (for backward compatibility with existing data hooks)
  const scoresView = useMemo(() => {
    const pageToView = { rankings: "rankings", analytics: "analytics", heatmap: "grid", reviews: "details" };
    return pageToView[currentPage] || "rankings";
  }, [currentPage]);

  const {
    rawScores,
    summaryData,
    allJurors,
    sortedPeriods,
    loading,
    loadError,
    lastRefresh,
    fetchData,
    bgRefresh,
  } = useAdminData({
    organizationId: activeOrganization?.id,
    selectedPeriodId,
    onSelectedPeriodChange: setSelectedPeriodId,
    scoresView,
  });

  const selectedPeriod = sortedPeriods.find((p) => p.id === selectedPeriodId) || null;

  // Fetch criteria + outcomes from snapshot tables
  const [criteriaConfig, setCriteriaConfig] = useState([]);
  const [outcomeConfig, setOutcomeConfig] = useState([]);
  const [frameworks, setFrameworks] = useState([]);
  const [criteriaLoading, setCriteriaLoading] = useState(false);
  useEffect(() => {
    if (!selectedPeriodId || !activeOrganization?.id) {
      setCriteriaConfig([]);
      setOutcomeConfig([]);
      setFrameworks([]);
      return;
    }
    // Clear immediately so wizard step derivation doesn't see stale data from the
    // prior period during the async loading window (prevents phantom step jumps).
    setCriteriaConfig([]);
    setOutcomeConfig([]);
    setCriteriaLoading(true);
    let alive = true;
    (async () => {
      try {
        const { listPeriodCriteria, listPeriodOutcomes, listFrameworks } = await import("@/shared/api");
        const { getActiveCriteria } = await import("@/shared/criteria/criteriaHelpers");
        const [criteriaRows, outcomeRows, frameworkRows] = await Promise.all([
          listPeriodCriteria(selectedPeriodId),
          listPeriodOutcomes(selectedPeriodId),
          listFrameworks(activeOrganization.id),
        ]);
        if (!alive) return;
        const effectiveCriteria = criteriaRows.length > 0
          ? criteriaRows
          : (selectedPeriod?.criteria_config || []);
        setCriteriaConfig(getActiveCriteria(effectiveCriteria));
        setOutcomeConfig(outcomeRows.map((o) => ({
          id: o.id,
          code: o.code,
          desc_en: o.label || o.description || "",
          desc_tr: o.description || "",
        })));
        setFrameworks(frameworkRows);
      } catch {
        if (alive) { setCriteriaConfig([]); setOutcomeConfig([]); setFrameworks([]); }
      } finally {
        if (alive) setCriteriaLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [selectedPeriodId, activeOrganization?.id]);

  const reloadFrameworks = useCallback(async () => {
    if (!activeOrganization?.id) return;
    try {
      const { listFrameworks } = await import("@/shared/api");
      const rows = await listFrameworks(activeOrganization.id);
      setFrameworks(rows);
    } catch {}
  }, [activeOrganization?.id]);

  // Re-fetch criteria + outcomes for the currently selected period without waiting
  // for a period/org change. Used by the setup wizard after the user has edited
  // criteria on a sibling page (e.g. /admin/criteria) and returned to the wizard,
  // so step derivation sees up-to-date data.
  const reloadCriteriaAndOutcomes = useCallback(async () => {
    if (!selectedPeriodId || !activeOrganization?.id) return;
    try {
      const { listPeriodCriteria, listPeriodOutcomes } = await import("@/shared/api");
      const { getActiveCriteria } = await import("@/shared/criteria/criteriaHelpers");
      const [criteriaRows, outcomeRows] = await Promise.all([
        listPeriodCriteria(selectedPeriodId),
        listPeriodOutcomes(selectedPeriodId),
      ]);
      const effectiveCriteria = criteriaRows.length > 0
        ? criteriaRows
        : (selectedPeriod?.criteria_config || []);
      setCriteriaConfig(getActiveCriteria(effectiveCriteria));
      setOutcomeConfig(outcomeRows.map((o) => ({
        id: o.id,
        code: o.code,
        desc_en: o.label || o.description || "",
        desc_tr: o.description || "",
      })));
    } catch {}
  }, [selectedPeriodId, activeOrganization?.id, selectedPeriod]);

  const onDirtyChange = useCallback((dirty) => { settingsDirtyRef.current = dirty; }, []);
  const onCurrentSemesterChange = useCallback((periodId) => {
    setSelectedPeriodId(periodId);
    fetchData(periodId);
  }, [fetchData]);

  // One-time onboarding: drive the setup wizard purely off
  // organizations.setup_completed_at — never off period count. Period
  // deletion or empty-period transients no longer re-trigger the wizard,
  // and a completed wizard stays completed across tabs/devices.
  // Super admins never get pushed into the wizard — they inspect tenants,
  // they don't onboard them.
  const setupIncomplete =
    !!activeOrganization && activeOrganization.setupCompletedAt == null && !isSuper;

  // Whether the user clicked "I'll set up later" in this browser session.
  const skipped = (() => {
    try { return sessionStorage.getItem(KEYS.SETUP_SKIP_PREFIX + activeOrganization?.id) === "1"; }
    catch { return false; }
  })();

  // Only redirect to /admin/setup when the user has NOT skipped.
  // Skipped users get the full sidebar + progress banner instead.
  useEffect(() => {
    const isSkipped = (() => {
      try { return sessionStorage.getItem(KEYS.SETUP_SKIP_PREFIX + activeOrganization?.id) === "1"; }
      catch { return false; }
    })();
    const needsSetup =
      setupIncomplete && !isSkipped && !loading &&
      currentPage !== "setup" && currentPage !== "settings";
    if (needsSetup) {
      navigate(`${basePath}/setup`);
    }
  }, [setupIncomplete, loading, currentPage, basePath, navigate, activeOrganization?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Block direct access to /admin/setup once onboarding is complete: the
  // wizard is single-use, so re-entering its URL bounces back to overview.
  useEffect(() => {
    if (
      currentPage === "setup" &&
      activeOrganization?.setupCompletedAt
    ) {
      navigate(`${basePath}/overview`, { replace: true });
    }
  }, [currentPage, activeOrganization?.setupCompletedAt, basePath, navigate]);

  const frameworkThreshold = (
    frameworks.find((f) => f.id === selectedPeriod?.framework_id) ?? frameworks[0]
  )?.default_threshold ?? 70;

  // Setup wizard progress steps — used by SetupProgressBanner
  const setupSteps = useMemo(() => [
    { id: "period",   label: "Period",   done: sortedPeriods.length > 0 },
    { id: "criteria", label: "Criteria", done: criteriaConfig.length > 0 },
    { id: "projects", label: "Projects", done: (summaryData || []).length > 0 },
    { id: "jurors",   label: "Jurors",   done: (allJurors || []).length > 0 },
  ], [sortedPeriods, criteriaConfig, summaryData, allJurors]);

  // Groups derived from project summaries
  const groups = useMemo(
    () =>
      (summaryData || [])
        .map((p) => ({ id: p.id, group_no: p.group_no, title: p.title ?? "", members: p.members ?? "" }))
        .sort((a, b) => (a.group_no ?? 0) - (b.group_no ?? 0)),
    [summaryData]
  );

  // Jurors with key field matching lookup
  const matrixJurors = useMemo(() => {
    const seen = new Map();
    (allJurors || []).forEach((j) => {
      if (j.jurorId && !seen.has(j.jurorId)) {
        seen.set(j.jurorId, {
          key: j.jurorId,
          jurorId: j.jurorId,
          name: (j.juryName || "").trim(),
          dept: (j.affiliation || "").trim(),
          finalSubmitted: !!(j.finalSubmittedAt || j.final_submitted_at),
          finalSubmittedAt: j.finalSubmittedAt || j.final_submitted_at || "",
          editEnabled: j.editEnabled || false,
        });
      }
    });
    (rawScores || []).forEach((r) => {
      if (r.jurorId && !seen.has(r.jurorId)) {
        seen.set(r.jurorId, {
          key: r.jurorId,
          jurorId: r.jurorId,
          name: (r.juryName || "").trim(),
          dept: (r.affiliation || "").trim(),
          finalSubmitted: false,
        });
      }
    });
    const scoreKeys = new Set((rawScores || []).map((r) => r.jurorId).filter(Boolean));
    return [...seen.values()]
      .filter((j) => scoreKeys.has(j.jurorId))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allJurors, rawScores]);

  // Build context to pass to child routes via Outlet.
  // Must be declared before any conditional returns (Rules of Hooks).
  // Memoized so sidebar/header interactions don't re-render all child pages.
  const adminContext = useMemo(() => ({
    rawScores,
    summaryData,
    allJurors,
    sortedPeriods,
    loading,
    loadError,
    lastRefresh,
    fetchData,
    bgRefresh,
    selectedPeriod,
    selectedPeriodId,
    setSelectedPeriodId,
    criteriaConfig,
    criteriaLoading,
    outcomeConfig,
    frameworks,
    reloadFrameworks,
    reloadCriteriaAndOutcomes,
    frameworkThreshold,
    groups,
    matrixJurors,
    activeOrganization,
    settingsDirtyRef,
    onDirtyChange,
    onCurrentSemesterChange,
    navigateTo,
    basePath,
    isDemo,
    isDemoMode,
    scoresView,
    onStartTour: handleStartTour,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    rawScores, summaryData, allJurors, sortedPeriods,
    loading, loadError, lastRefresh, fetchData, bgRefresh,
    selectedPeriod, selectedPeriodId, setSelectedPeriodId,
    criteriaConfig, criteriaLoading, outcomeConfig, frameworks, reloadFrameworks, reloadCriteriaAndOutcomes,
    frameworkThreshold, groups, matrixJurors, activeOrganization,
    onDirtyChange, onCurrentSemesterChange, navigateTo,
    basePath, isDemo, isDemoMode, scoresView, handleStartTour,
  ]);

  // ── Auth gate ─────────────────────────────────────────────
  if (authLoading) return null;

  const loginHandler = async (email, password, rememberMe, captchaToken) => {
    setAuthError("");
    await signIn(email, password, rememberMe, captchaToken);
  };

  if (!user) {
    // Demo admin session can be cleared when a juror flow starts in the same
    // browser (useJuryLoading.clearPersistedSession). Instead of showing a
    // login form, bounce through /demo so DemoAdminLoader auto-logs back in.
    if (isDemoMode && location.pathname.startsWith("/demo/admin")) {
      return <Navigate to="/demo" replace />;
    }
    return (
      <>
        <AuthFormErrorBoundary
          fallback={
            <FallbackLoginForm
              onLogin={loginHandler}
              initialEmail={isDemoMode ? DEMO_EMAIL : ""}
              initialPassword={isDemoMode ? DEMO_PASSWORD : ""}
            />
          }
        >
          <Suspense fallback={null}>
            {authPage === "login" && (
              <LazyLoginForm
                onLogin={loginHandler}
                onGoogleLogin={signInWithGoogle}
                onSwitchToRegister={() => navigate(isDemoMode ? "/demo/register" : "/register")}
                onForgotPassword={() => navigate(isDemoMode ? "/demo/forgot-password" : "/forgot-password")}
                error={authError}
                initialEmail={isDemoMode ? DEMO_EMAIL : ""}
                initialPassword={isDemoMode ? DEMO_PASSWORD : ""}
                onReturnHome={() => navigate(isDemoMode ? "/demo" : "/")}
              />
            )}
            {authPage === "register" && (
              <LazyRegisterForm
                onRegister={signUp}
                onSwitchToLogin={() => navigate(isDemoMode ? "/demo/login" : "/login")}
              />
            )}
            {authPage === "forgot" && (
              <LazyForgotPasswordForm
                onResetPassword={resetPassword}
                onBackToLogin={() => navigate(isDemoMode ? "/demo/login" : "/login")}
              />
            )}
            {authPage === "reset" && (
              <LazyResetPasswordForm
                onUpdatePassword={updatePassword}
                onBackToLogin={() => navigate(isDemoMode ? "/demo/login" : "/login")}
              />
            )}
          </Suspense>
        </AuthFormErrorBoundary>
        <DraggableThemeToggle />
      </>
    );
  }

  if (profileIncomplete) {
    return (
      <>
        <AuthFormErrorBoundary>
          <Suspense fallback={null}>
            <LazyCompleteProfileForm
              user={user}
              onComplete={completeProfile}
              onSignOut={signOut}
            />
          </Suspense>
        </AuthFormErrorBoundary>
        <DraggableThemeToggle />
      </>
    );
  }

  // Gate: user has pending join request but no active membership
  if (isPending && hasJoinRequest) {
    return (
      <>
        <AuthFormErrorBoundary>
          <Suspense fallback={null}>
            <LazyPendingReviewGate
              user={user}
              onSignOut={signOut}
              onBack={() => navigate("/")}
            />
          </Suspense>
        </AuthFormErrorBoundary>
        <DraggableThemeToggle />
      </>
    );
  }

  // Gate: grace period has expired and email is still unverified
  if (graceEndsAt && new Date(graceEndsAt) < new Date() && !isEmailVerified) {
    return (
      <>
        <AuthFormErrorBoundary>
          <Suspense fallback={null}>
            <LazyGraceLockScreen user={user} onSignOut={signOut} />
          </Suspense>
        </AuthFormErrorBoundary>
        <DraggableThemeToggle />
      </>
    );
  }

  return (
    <div className="admin-shell">
      {/* Mobile overlay */}
      <div
        className={`mobile-overlay${mobileOpen ? " show" : ""}`}
        onClick={() => setMobileOpen(false)}
      />
      <AdminSidebar
        currentPage={currentPage}
        basePath={basePath}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        setupIncomplete={setupIncomplete && !skipped}
        onStartTour={tourDone ? undefined : handleStartTour}
      />
      <div className={`admin-main${isDemoMode ? " has-demo-banner" : ""}${maintenanceActive && isSuper ? " has-maintenance-banner" : ""}${setupIncomplete && currentPage !== "setup" ? " has-setup-banner" : ""}${user && !isEmailVerified && !isSuper ? " has-evb-banner" : ""}`}>
        {maintenanceActive && isSuper && (
          <div className="maintenance-super-banner">
            <AlertTriangle size={13} strokeWidth={2.5} aria-hidden />
            <span><strong>Maintenance is active.</strong> Regular users are locked out — only super admins retain access.</span>
          </div>
        )}
        {isDemoMode && (
          <div className="demo-banner">
            <div className="demo-banner-inner">
              <Icon
                iconNode={[]}
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                style={{ flexShrink: 0, opacity: 0.7 }}>
                <polygon points="5 3 19 12 5 21 5 3" />
              </Icon>
              <span>You&apos;re viewing a <strong>live demo</strong> with sample data.</span>
            </div>
          </div>
        )}
        {setupIncomplete && currentPage !== "setup" && (
          <SetupProgressBanner basePath={basePath} steps={setupSteps} />
        )}
        <EmailVerifyBanner />
        <AdminHeader
          currentPage={currentPage}
          onMobileMenuOpen={() => setMobileOpen(true)}
          sortedPeriods={sortedPeriods}
          selectedPeriodId={selectedPeriodId}
          onPeriodChange={(periodId) => { setSelectedPeriodId(periodId); fetchData(periodId); }}
          onRefresh={fetchData}
          refreshing={loading}
          navigateTo={navigateTo}
        />
        <div className="admin-content">
          <Outlet context={adminContext} />
        </div>
      </div>
      {!(setupIncomplete && !skipped) && (
        <SpotlightTour
          key={tourKey}
          steps={ADMIN_TOUR_STEPS}
          sessionKey={KEYS.ADMIN_TOUR_DONE}
          storageType="local"
          delay={800}
          onDone={() => { setTourDone(true); setMobileOpen(false); }}
          onStart={() => { if (window.innerWidth <= 768) setMobileOpen(true); }}
        />
      )}
    </div>
  );
}
