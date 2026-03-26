// src/shared/api/index.js
// ============================================================
// Re-exports all public API functions from the split modules.
//
// Consumers should import from "../../shared/api" (resolves to
// api.js, which delegates here). This file exists as a secondary
// entry point if any code imports directly from "../../shared/api/".
// ============================================================

export { withRetry }                       from "./core/retry";
export { listSemesters, getCurrentSemester } from "./semesterApi";
export {
  createOrGetJurorAndIssuePin,
  verifyJurorPin,
  getJurorById,
  listProjects,
  upsertScore,
  getJurorEditState,
  finalizeJurorSubmission,
  verifyEntryToken,
}                                           from "./juryApi";
export {
  adminLogin,
  adminSecurityState,
  adminGetScores,
  adminListJurors,
  adminProjectSummary,
  adminGetOutcomeTrends,
  adminListSemesters,
  adminSetCurrentSemester,
  adminCreateSemester,
  adminUpdateSemester,
  adminUpdateSemesterCriteriaTemplate,
  adminUpdateSemesterMudekTemplate,
  adminDeleteSemester,
  adminListProjects,
  adminCreateProject,
  adminUpsertProject,
  adminDeleteProject,
  adminCreateJuror,
  adminUpdateJuror,
  adminResetJurorPin,
  adminSetJurorEditMode,
  adminForceCloseJurorEditMode,
  adminDeleteJuror,
  adminGetSettings,
  adminSetSetting,
  adminSetSemesterEvalLock,
  adminListAuditLogs,
  adminFullExport,
  adminFullImport,
  adminDeleteCounts,
  adminDeleteEntity,
  adminGenerateEntryToken,
  adminRevokeEntryToken,
  adminGetEntryTokenStatus,
  // v2 Auth (Phase C)
  adminGetSession,
  listTenantsPublic,
  submitAdminApplication,
  getMyApplications,
  cancelAdminApplication,
  approveAdminApplication,
  rejectAdminApplication,
  listPendingApplications,
  // Tenant/Organization management (super-admin only)
  adminListTenants,
  adminCreateTenant,
  adminUpdateTenant,
  adminUpdateTenantAdmin,
  adminDeleteTenantAdminHard,
}                                           from "./admin/index";
