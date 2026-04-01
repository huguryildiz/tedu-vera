// src/admin/ScoresTab.jsx
// Merges Rankings, Analytics, Grid, and Details views into one tab.
// View switching is handled by AdminPanel (sub-nav bar above content).

import { lazy, Suspense } from "react";
import RankingsTable from "./scores/RankingsTable";
const AnalyticsTab = lazy(() => import("./AnalyticsTab"));
import ScoreDetails from "./ScoreDetails";
import ScoreGrid from "./ScoreGrid";
import ErrorBoundary from "../shared/ErrorBoundary";

function AnalyticsFallback() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200, color: "var(--color-muted, #888)" }}>
      Loading analytics…
    </div>
  );
}

export default function ScoresTab({
  view = "rankings",
  ranked,
  submittedData,
  rawScores,
  detailsScores,
  jurors,
  matrixJurors,
  groups,
  periodName,
  summaryData,
  detailsSummary,
  dashboardStats,
  overviewMetrics,
  lastRefresh,
  loading,
  error,
  detailsLoading,
  semesterOptions,
  trendSemesterIds,
  onTrendSelectionChange,
  trendData,
  trendLoading,
  trendError,
  criteriaConfig,
  outcomeConfig,
}) {
  return (
    <div className="scores-tab">
      {view === "rankings" && (
        <RankingsTable ranked={ranked} periodName={periodName} criteriaConfig={criteriaConfig} />
      )}
      {view === "analytics" && (
        <ErrorBoundary fallback={<AnalyticsFallback />}>
          <Suspense fallback={<AnalyticsFallback />}>
            <AnalyticsTab
              dashboardStats={dashboardStats}
              submittedData={submittedData}
              overviewMetrics={overviewMetrics}
              lastRefresh={lastRefresh}
              loading={loading}
              error={error}
              periodName={periodName}
              semesterOptions={semesterOptions}
              trendSemesterIds={trendSemesterIds}
              onTrendSelectionChange={onTrendSelectionChange}
              trendData={trendData}
              trendLoading={trendLoading}
              trendError={trendError}
              criteriaConfig={criteriaConfig}
              outcomeConfig={outcomeConfig}
            />
          </Suspense>
        </ErrorBoundary>
      )}
      {view === "details" && (
        <ScoreDetails
          data={detailsScores && detailsScores.length ? detailsScores : rawScores}
          jurors={jurors}
          assignedJurors={matrixJurors || jurors}
          groups={groups}
          periodName={periodName}
          semesterOptions={semesterOptions}
          summaryData={detailsSummary && detailsSummary.length ? detailsSummary : summaryData}
          loading={detailsLoading}
          criteriaConfig={criteriaConfig}
        />
      )}
      {view === "grid" && (
        <ScoreGrid
          data={rawScores}
          jurors={matrixJurors || jurors}
          groups={groups}
          periodName={periodName}
          criteriaConfig={criteriaConfig}
        />
      )}
    </div>
  );
}
