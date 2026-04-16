import { formatAuditTimestamp, formatSentence, SEVERITY_META, getActorInfo } from './auditUtils';

const CHIP_MAP = {
  entry_tokens:        { label: 'QR Access' },
  score_sheets:        { label: 'Evaluation' },
  jurors:              { label: 'Juror' },
  periods:             { label: 'Period' },
  projects:            { label: 'Project' },
  organizations:       { label: 'Security' },
  memberships:         { label: 'Security' },
  juror_period_auth:   { label: 'Juror' },
  profiles:            { label: 'Auth' },
  audit_logs:          { label: 'Audit' },
  period_criteria:     { label: 'Criteria' },
  framework_outcomes:  { label: 'Outcome' },
  org_applications:    { label: 'Application' },
  admin_user_sessions: { label: 'Session' },
  platform_backups:    { label: 'Backup' },
  frameworks:          { label: 'Framework' },
};

const getChipLabel = (type) => CHIP_MAP[type]?.label ?? type ?? '—';

export const AUDIT_TABLE_COLUMNS = [
  {
    key: 'ts',
    label: 'Timestamp',
    sortKey: 'created_at',
    style: { width: 170 },
    getValue: (r) => formatAuditTimestamp(r.created_at),
  },
  {
    key: 'type',
    label: 'Type',
    sortKey: 'resource_type',
    style: { width: 95 },
    getValue: (r) => getChipLabel(r.resource_type),
  },
  {
    key: 'actor',
    label: 'Actor',
    sortKey: 'actor',
    style: { width: 200 },
    getValue: (r) => getActorInfo(r).name,
  },
  {
    key: 'action',
    label: 'Action',
    sortKey: 'action',
    getValue: (r) => {
      const s = formatSentence(r);
      if (!s) return r.action ?? '—';
      return s.verb + (s.resource ? ` ${s.resource}` : '');
    },
  },
  {
    key: 'severity',
    label: 'Severity',
    sortKey: 'severity',
    style: { width: 90 },
    getValue: (r) => SEVERITY_META[r.severity]?.label ?? r.severity ?? '—',
  },
];
