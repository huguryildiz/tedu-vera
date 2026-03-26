// src/shared/api/admin/index.js
// ============================================================
// Barrel re-export for all admin domain modules.
// ============================================================

export { adminLogin, adminSecurityState } from "./auth";

// v2 Auth (Phase C — JWT-based)
export {
  adminGetSession,
  listTenantsPublic,
  submitAdminApplication,
  getMyApplications,
  cancelAdminApplication,
  approveAdminApplication,
  rejectAdminApplication,
  listPendingApplications,
} from "./auth";

export {
  adminListSemesters,
  adminSetCurrentSemester,
  adminCreateSemester,
  adminUpdateSemester,
  adminUpdateSemesterCriteriaTemplate,
  adminUpdateSemesterMudekTemplate,
  adminDeleteSemester,
} from "./semesters";

export {
  adminListProjects,
  adminCreateProject,
  adminUpsertProject,
  adminDeleteProject,
} from "./projects";

export {
  adminCreateJuror,
  adminUpdateJuror,
  adminResetJurorPin,
  adminSetJurorEditMode,
  adminForceCloseJurorEditMode,
  adminDeleteJuror,
} from "./jurors";

export {
  adminGetScores,
  adminListJurors,
  adminProjectSummary,
  adminGetOutcomeTrends,
  adminDeleteCounts,
  adminDeleteEntity,
  adminGetSettings,
  adminSetSetting,
  adminSetSemesterEvalLock,
} from "./scores";

export { adminFullExport, adminFullImport } from "./export";

export {
  adminGenerateEntryToken,
  adminRevokeEntryToken,
  adminGetEntryTokenStatus,
} from "./tokens";

export { adminListAuditLogs } from "./audit";

export { adminProfileUpsert, adminProfileGet } from "./profiles";

// Tenant/Organization management (super-admin only)
export {
  adminListTenants,
  adminCreateTenant,
  adminUpdateTenant,
  adminUpdateTenantAdmin,
  adminDeleteTenantAdminHard,
} from "./tenants";
