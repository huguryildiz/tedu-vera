// src/components/EntityMeta.jsx
// ============================================================
// Canonical rendering for Group, Project Title, and Students.
// Use these components EVERYWHERE these three entities appear.
//
// Hierarchy (visual dominance):
//   1. GroupLabel   — FolderKanban icon + bold text
//   2. ProjectTitle — FileText icon   + normal weight text
//   3. StudentNames — Users icon      + italic text
//
// Usage:
//   <GroupLabel text={`Group ${groupNo}`} />
//   <ProjectTitle text={projectTitle} />
//   <StudentNames names={studentNamesArray} />
// ============================================================

import { FolderKanban, FileText, Users } from "lucide-react";

export function GroupLabel({ text, size = 16 }) {
  return (
    <span className="entity-group-label">
      <FolderKanban size={size} aria-hidden="true" />
      <span>{text}</span>
    </span>
  );
}

export function ProjectTitle({ text, size = 16 }) {
  if (!text) return null;
  return (
    <span className="entity-project-title">
      <FileText size={size} aria-hidden="true" />
      <span>{text}</span>
    </span>
  );
}

export function StudentNames({ names, size = 16 }) {
  if (!names || names.length === 0) return null;
  return (
    <span className="entity-student-names">
      <Users size={size} aria-hidden="true" />
      <span>{names.join(" · ")}</span>
    </span>
  );
}
