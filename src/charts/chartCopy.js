// src/charts/chartCopy.js
// Shared chart titles and export notes — single source of truth for both
// chart headers and Excel export sheet metadata.

export const CHART_COPY = {
  outcomeByGroup: {
    title: "Outcome Achievement by Group",
    note: "Average score per criterion per project group. Normalized to percentage of maximum possible score.",
  },
  programmeAverages: {
    title: "Programme-Level Outcome Averages",
    note: "Grand mean (%) ± 1σ per criterion. 70% attainment threshold shown as reference.",
  },
  semesterTrend: {
    title: "Outcome Attainment Trend",
    note: "Percentage of evaluations meeting the 70% threshold across evaluation periods.",
  },
  competencyProfile: {
    title: "Competency Profile",
    note: "Radar/polar view of average attainment per criterion per group. Cohort average included.",
  },
  jurorConsistency: {
    title: "Inter-Rater Consistency Heatmap",
    note: "Coefficient of Variation (CV = σ/μ × 100) per group × criterion. CV >25% indicates poor inter-rater agreement.",
  },
  scoreDistribution: {
    title: "Score Distribution (Boxplot)",
    note: "Q1, median, Q3, whiskers, and outlier count per criterion. Normalized to percentage.",
  },
  achievementDistribution: {
    title: "Rubric Achievement Distribution",
    note: "Performance band (Excellent / Good / Developing / Insufficient) breakdown per criterion.",
  },
};
