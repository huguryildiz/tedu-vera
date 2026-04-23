// src/types/admin.d.ts
// Type definitions for admin panel domain shapes.

/** A project record from Supabase. */
export interface ProjectShape {
  id: string;
  group_no: string;
  project_title: string;
  group_students: string;
  semester_id: string;
  created_at: string;
  updated_at: string;
}

/** A period record from Supabase. */
export interface PeriodShape {
  id: string;
  semester_name: string;
  is_locked: boolean;
  closed_at: string | null;
  criteria_template: import("./criteria").CriteriaTemplate | null;
  outcome_template: import("./criteria").OutcomeDefinition[] | null;
  created_at: string;
  updated_at: string;
}

/** Dashboard statistics computed for analytics. */
export interface DashboardStats {
  [groupNo: string]: {
    [criterionKey: string]: {
      scores: number[];
      avg: number;
      count: number;
    };
  };
}

/** Overview metrics for the admin dashboard. */
export interface OverviewMetrics {
  totalGroups: number;
  totalJurors: number;
  totalSubmissions: number;
  completionRate: number;
  averageTotal: number;
}
