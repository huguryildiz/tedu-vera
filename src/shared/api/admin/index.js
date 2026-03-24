// src/shared/api/admin/index.js
// ============================================================
// Barrel re-export for all admin domain modules.
// ============================================================

export { adminLogin, adminSecurityState } from "./auth";

export {
  adminSetActiveSemester,
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

export {
  adminChangePassword,
  adminBootstrapPassword,
  adminBootstrapBackupPassword,
  adminBootstrapDeletePassword,
  adminChangeBackupPassword,
  adminChangeDeletePassword,
} from "./passwords";

export { adminFullExport, adminFullImport } from "./export";

export {
  adminGenerateEntryToken,
  adminRevokeEntryToken,
  adminGetEntryTokenStatus,
} from "./tokens";

export { adminListAuditLogs } from "./audit";
