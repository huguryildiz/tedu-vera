// src/router.jsx
// ============================================================
// Central route definitions for VERA — React Router v6.
// All navigation is path-based. No more query-param routing.
// ============================================================

import { createBrowserRouter, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import RootLayout from "./layouts/RootLayout";
import AdminRouteLayout from "./layouts/AdminRouteLayout";
import DemoLayout from "./layouts/DemoLayout";
import JuryGuard from "./guards/JuryGuard";
import LegacyRedirects from "./LegacyRedirects";
import ErrorBoundary from "@/shared/ui/ErrorBoundary";

// ── Lazy-loaded page components ───────────────────────────────

const LandingPage = lazy(() =>
  import("./landing/LandingPage").then((m) => ({ default: m.LandingPage }))
);
const JuryGatePage = lazy(() => import("./jury/JuryGatePage"));
const JuryFlow = lazy(() => import("./jury/JuryFlow"));
const DemoAdminLoader = lazy(() => import("@/shared/ui/DemoAdminLoader"));

// Auth screens (standalone routes)
const LoginScreen = lazy(() => import("@/auth/screens/LoginScreen"));
const RegisterScreen = lazy(() => import("@/auth/screens/RegisterScreen"));
const ForgotPasswordScreen = lazy(() => import("@/auth/screens/ForgotPasswordScreen"));
const ResetPasswordScreen = lazy(() => import("@/auth/screens/ResetPasswordScreen"));

// Admin pages
const OverviewPage = lazy(() => import("@/admin/pages/OverviewPage"));
const RankingsPage = lazy(() => import("@/admin/pages/RankingsPage"));
const AnalyticsPage = lazy(() => import("@/admin/pages/AnalyticsPage"));
const HeatmapPage = lazy(() => import("@/admin/pages/HeatmapPage"));
const ReviewsPage = lazy(() => import("@/admin/pages/ReviewsPage"));
const JurorsPage = lazy(() => import("@/admin/pages/JurorsPage"));
const ProjectsPage = lazy(() => import("@/admin/pages/ProjectsPage"));
const PeriodsPage = lazy(() => import("@/admin/pages/PeriodsPage"));
const CriteriaPage = lazy(() => import("@/admin/pages/CriteriaPage"));
const OutcomesPage = lazy(() => import("@/admin/pages/OutcomesPage"));
const EntryControlPage = lazy(() => import("@/admin/pages/EntryControlPage"));
const PinBlockingPage = lazy(() => import("@/admin/pages/PinBlockingPage"));
const AuditLogPage = lazy(() => import("@/admin/pages/AuditLogPage"));
const SettingsPage = lazy(() => import("@/admin/pages/SettingsPage"));

// Maintenance
const MaintenancePage = lazy(() => import("@/components/MaintenancePage"));

// ── Suspense wrapper ──────────────────────────────────────────
function SuspenseWrap({ children }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

// ── Admin child routes (shared between /admin and /demo/admin) ─
const adminChildRoutes = [
  { index: true, element: <Navigate to="overview" replace /> },
  { path: "overview", element: <SuspenseWrap><OverviewPage /></SuspenseWrap> },
  { path: "rankings", element: <SuspenseWrap><RankingsPage /></SuspenseWrap> },
  { path: "analytics", element: <SuspenseWrap><AnalyticsPage /></SuspenseWrap> },
  { path: "heatmap", element: <SuspenseWrap><HeatmapPage /></SuspenseWrap> },
  { path: "reviews", element: <SuspenseWrap><ReviewsPage /></SuspenseWrap> },
  { path: "jurors", element: <SuspenseWrap><JurorsPage /></SuspenseWrap> },
  { path: "projects", element: <SuspenseWrap><ProjectsPage /></SuspenseWrap> },
  { path: "periods", element: <SuspenseWrap><PeriodsPage /></SuspenseWrap> },
  { path: "criteria", element: <SuspenseWrap><CriteriaPage /></SuspenseWrap> },
  { path: "outcomes", element: <SuspenseWrap><OutcomesPage /></SuspenseWrap> },
  { path: "entry-control", element: <SuspenseWrap><EntryControlPage /></SuspenseWrap> },
  { path: "pin-blocking", element: <SuspenseWrap><PinBlockingPage /></SuspenseWrap> },
  { path: "audit-log", element: <SuspenseWrap><AuditLogPage /></SuspenseWrap> },
  { path: "settings", element: <SuspenseWrap><SettingsPage /></SuspenseWrap> },
];

// ── Router ────────────────────────────────────────────────────

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      // Landing
      {
        path: "/",
        element: (
          <LegacyRedirects>
            <SuspenseWrap><LandingPage /></SuspenseWrap>
          </LegacyRedirects>
        ),
      },

      // Auth routes (standalone, no admin shell)
      { path: "/login", element: <SuspenseWrap><LoginScreen /></SuspenseWrap> },
      { path: "/register", element: <SuspenseWrap><RegisterScreen /></SuspenseWrap> },
      { path: "/forgot-password", element: <SuspenseWrap><ForgotPasswordScreen /></SuspenseWrap> },
      { path: "/reset-password", element: <SuspenseWrap><ResetPasswordScreen /></SuspenseWrap> },

      // Jury Gate
      {
        path: "/eval",
        element: (
          <ErrorBoundary>
            <SuspenseWrap><JuryGatePage /></SuspenseWrap>
          </ErrorBoundary>
        ),
      },

      // Jury Flow (guarded by jury session)
      {
        path: "/jury",
        element: <JuryGuard />,
        children: [
          {
            element: (
              <ErrorBoundary>
                <SuspenseWrap><JuryFlow /></SuspenseWrap>
              </ErrorBoundary>
            ),
            children: [
              { index: true, element: <Navigate to="identity" replace /> },
              { path: "identity" },
              { path: "period" },
              { path: "pin" },
              { path: "pin-reveal" },
              { path: "locked" },
              { path: "progress" },
              { path: "evaluate" },
              { path: "complete" },
            ],
          },
        ],
      },

      // Admin Panel (prod)
      {
        path: "/admin",
        element: <AdminRouteLayout />,
        children: adminChildRoutes,
      },

      // Demo routes
      {
        path: "/demo",
        element: <DemoLayout />,
        children: [
          // /demo → DemoAdminLoader (auto-login → /demo/admin)
          {
            index: true,
            element: <SuspenseWrap><DemoAdminLoader /></SuspenseWrap>,
          },
          // /demo/admin/* → admin panel in demo mode
          {
            path: "admin",
            element: <AdminRouteLayout />,
            children: adminChildRoutes,
          },
        ],
      },

      // Legacy path: /jury-entry → /jury
      { path: "/jury-entry", element: <Navigate to="/jury" replace /> },

      // Catch-all → landing
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
