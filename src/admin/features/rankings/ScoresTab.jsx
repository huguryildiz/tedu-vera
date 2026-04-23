// src/admin/ScoresTab.jsx — Phase 14
// Scores tab view switch: Rankings / Analytics / Grid / Details.
// AdminLayout routes scores sub-views directly; this component is available
// for standalone embedding if needed.

import RankingsPage from "./RankingsPage";
import AnalyticsPage from "@/admin/features/analytics/AnalyticsPage";
import ReviewsPage from "@/admin/features/reviews/ReviewsPage";
import HeatmapPage from "@/admin/features/heatmap/HeatmapPage";

export default function ScoresTab({
  view = "rankings",
  summaryData,
  rawScores,
  allJurors,
  matrixJurors,
  groups,
  selectedPeriod,
  selectedPeriodId,
  periodName,
  dashboardStats,
  submittedData,
  lastRefresh,
  loading,
  error,
  periodOptions,
  trendPeriodIds,
  onTrendSelectionChange,
  trendData,

  outcomeTrendData,
  outcomeTrendLoading,
  outcomeTrendError,
  criteriaConfig,
  outcomeConfig,
}) {
  return (
    <div className="scores-tab">
      {view === "rankings" && (
        <RankingsPage
          summaryData={summaryData}
          rawScores={rawScores}
          allJurors={allJurors}
          selectedPeriod={selectedPeriod}
          periodName={periodName}
          criteriaConfig={criteriaConfig}
          loading={loading}
        />
      )}
      {view === "analytics" && (
        <AnalyticsPage
          dashboardStats={dashboardStats}
          submittedData={submittedData}
          lastRefresh={lastRefresh}
          loading={loading}
          error={error}
          periodName={periodName}
          selectedPeriodId={selectedPeriodId}
          periodOptions={periodOptions}
          trendPeriodIds={trendPeriodIds}
          onTrendSelectionChange={onTrendSelectionChange}
          trendData={trendData}
          outcomeTrendData={outcomeTrendData}
          outcomeTrendLoading={outcomeTrendLoading}
          outcomeTrendError={outcomeTrendError}
          criteriaConfig={criteriaConfig}
          outcomeConfig={outcomeConfig}
        />
      )}
      {view === "grid" && (
        <HeatmapPage
          data={rawScores}
          jurors={matrixJurors}
          groups={groups}
          periodName={periodName}
        />
      )}
      {view === "details" && (
        <ReviewsPage
          data={rawScores}
          jurors={allJurors}
          assignedJurors={matrixJurors}
          groups={groups}
          periodName={periodName}
          summaryData={summaryData}
          loading={loading}
        />
      )}
    </div>
  );
}
