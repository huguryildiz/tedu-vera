// src/admin/hooks/useAdminContext.js
// Wraps useOutletContext() for admin child pages.
// Provides the shared data from AdminRouteLayout + derived helpers.

import { useOutletContext } from "react-router-dom";

export function useAdminContext() {
  const ctx = useOutletContext() ?? {};
  return {
    ...ctx,
    // bgRefresh: mutable ref from useAdminData. Pages/hooks with their own
    // Realtime subscriptions call `.current?.([tables])` to trigger a
    // selective refresh of the central score/juror/period store.
    bgRefresh: ctx.bgRefresh,
    // Derived convenience fields
    organizationId: ctx.activeOrganization?.id,
    periodName:
      ctx.selectedPeriod?.name ||
      ctx.selectedPeriod?.period_name ||
      ctx.selectedPeriod?.semester_name ||
      "",
    // Alias mappings for pages that use different prop names
    dashboardStats: ctx.summaryData,
    submittedData: ctx.rawScores,
    error: ctx.loadError,
    data: ctx.rawScores,
    jurors: ctx.matrixJurors,
    assignedJurors: ctx.matrixJurors,
    periodOptions: ctx.sortedPeriods,
    trendPeriodIds: ctx.trendPeriodIds,
    onTrendSelectionChange: ctx.setTrendPeriodIds,
    threshold: ctx.frameworkThreshold,
    onNavigate: ctx.navigateTo,
    onViewReviews: () => ctx.navigateTo("reviews"),
    onFrameworksChange: ctx.reloadFrameworks,
  };
}
