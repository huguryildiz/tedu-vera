import { useState, useRef } from "react";
import { useAdminContext } from "@/admin/shared/useAdminContext";
import { useToast } from "@/shared/hooks/useToast";
import ImportCsvModal from "@/admin/shared/ImportCsvModal";
import { parseProjectsCsv } from "@/admin/utils/csvParser";
import { normalizeTeamMemberNames } from "@/admin/utils/auditUtils";
import { avatarGradient, initials } from "@/shared/ui/avatarColor";
import { createProject } from "@/shared/api";
import {
  Layers,
  Plus,
  X,
  Check,
  CheckCircle2,
  ArrowRight,
  Upload,
  Loader2,
} from "lucide-react";

// Convert a comma/semicolon/newline-delimited member string to the JSONB
// shape the projects table expects: `[{ name, order }]`. Mirrors
// `membersToJsonb` in `useManageProjects.js`.
function membersStringToJsonb(value) {
  const normalized = normalizeTeamMemberNames(value);
  const names = normalized
    ? normalized.split(";").map((s) => s.trim()).filter(Boolean)
    : [];
  return names.map((name, i) => ({ name, order: i + 1 }));
}

export default function ProjectsStep({ periodId, onContinue, onBack, loading }) {
  const toast = useToast();
  const { fetchData, summaryData, navigateTo, setSelectedPeriodId } = useAdminContext();
  // summaryData is already scoped to selectedPeriodId by getProjectSummary —
  // items have no period_id field. Trust the list.
  const periodProjects = summaryData || [];
  const [rows, setRows] = useState([
    { title: "", advisor: "", teamMembers: [] },
  ]);
  const [rowErrors, setRowErrors] = useState([{ title: false, teamMembers: false }]);
  const [importOpen, setImportOpen] = useState(false);
  const cancelImportRef = useRef(false);

  const addRow = () => {
    setRows([...rows, { title: "", advisor: "", teamMembers: [] }]);
    setRowErrors((prev) => [...prev, { title: false, teamMembers: false }]);
  };

  const removeRow = (idx) => {
    setRows(rows.filter((_, i) => i !== idx));
    setRowErrors((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateRow = (idx, field, value) => {
    const updated = [...rows];
    updated[idx][field] = value;
    setRows(updated);
    if (field === "title" || field === "teamMembers") {
      setRowErrors((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], [field]: false };
        return next;
      });
    }
  };

  const handleSave = async () => {
    const errors = rows.map((r) => ({
      title: !r.title.trim(),
      teamMembers: !r.teamMembers.some((m) => m.trim()),
    }));
    const hasError = errors.some((e) => e.title || e.teamMembers);
    const validRows = rows.filter((r) => r.title.trim());
    if (validRows.length === 0) {
      setRowErrors(errors);
      toast.error("Please add at least one project");
      return;
    }

    const missingMembers = validRows.some(
      (r) => !r.teamMembers.some((m) => m.trim())
    );
    if (missingMembers || hasError) {
      setRowErrors(errors);
      toast.error("Team members are required for each project");
      return;
    }

    try {
      for (const row of validRows) {
        await createProject({
          period_id: periodId,
          title: row.title,
          advisor: row.advisor || null,
          members: row.teamMembers
            .filter((m) => m.trim())
            .map((name, i) => ({ name: name.trim(), order: i + 1 })),
        });
      }
      toast.success(`${validRows.length} projects added`);
      onContinue();
      await fetchData();
    } catch (err) {
      toast.error("Failed to add projects");
    }
  };

  if (periodProjects.length > 0) {
    return (
      <div className="sw-card sw-fade-in">
        <div className="sw-status-chip">
          <CheckCircle2 size={12} /> {periodProjects.length} registered
        </div>
        <div className="sw-card-icon">
          <Layers size={24} />
        </div>
        <h2 className="sw-card-title">Add projects</h2>
        <p className="sw-card-desc">
          Register the projects that jurors will evaluate during this period.
        </p>
        <div className="sw-done-summary">
          <div className="sw-done-summary-icon">
            <Check size={16} strokeWidth={2.5} />
          </div>
          <div className="sw-done-summary-body">
            <div className="sw-done-summary-meta">Projects registered</div>
            <div className="sw-done-summary-title">
              {periodProjects.length} {periodProjects.length === 1 ? "project" : "projects"}
            </div>
            <div className="sw-done-summary-sub">
              To add more or edit details, go to the Projects page.
            </div>
          </div>
        </div>
        <div className="sw-existing-list">
          <div className="sw-existing-head">
            <span />
            <span>Project Title</span>
            <span>Team Members</span>
            <span>Advisor</span>
          </div>
          {periodProjects.map((p) => (
            <div key={p.id} className="sw-existing-item">
              <div className="sw-existing-item-icon">
                <Layers size={13} />
              </div>
              <span className="sw-existing-item-name">{p.title || "—"}</span>
              <span className="sw-existing-item-meta">
                {(() => {
                  const arr = p.members
                    ? String(p.members).split(/[,;\n]/).map((s) => s.trim()).filter(Boolean)
                    : [];
                  if (!arr.length) return <span style={{ color: "var(--text-tertiary)" }}>—</span>;
                  const visible = arr.slice(0, 5);
                  const extra = arr.length - visible.length;
                  return (
                    <span className="sw-member-chips">
                      {visible.map((name) => (
                        <span key={name} className="sw-member-chip-row">
                          <span className="sw-member-chip" style={{ background: avatarGradient(name) }}>
                            {initials(name)}
                          </span>
                          <span className="sw-member-chip-name">{name}</span>
                        </span>
                      ))}
                      {extra > 0 && (
                        <span className="sw-member-chip-row">
                          <span className="sw-member-chip sw-member-chip-more">+{extra} more</span>
                        </span>
                      )}
                    </span>
                  );
                })()}
              </span>
              <span className="sw-existing-item-meta">
                {p.advisor ? (
                  <span className="sw-member-chip-row">
                    <span className="sw-member-chip" style={{ background: avatarGradient(p.advisor) }}>
                      {initials(p.advisor)}
                    </span>
                    <span className="sw-member-chip-name">{p.advisor}</span>
                  </span>
                ) : "—"}
              </span>
            </div>
          ))}
        </div>
        <div className="sw-actions">
          <button className="sw-btn sw-btn-primary" onClick={onContinue}>
            Continue <ArrowRight size={16} />
          </button>
        </div>
        <div className="sw-footer sw-footer-stack">
          <button
            className="sw-btn-link"
            onClick={() => { if (periodId) setSelectedPeriodId(periodId); navigateTo("projects"); }}
          >
            Add more projects →
          </button>
          <button className="sw-btn-link sw-btn-link-sub" onClick={onBack}>← Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="sw-card sw-fade-in">
      <div className="sw-card-icon">
        <Layers size={24} />
      </div>
      <h2 className="sw-card-title">Add projects</h2>
      <p className="sw-card-desc">
        Register the projects that jurors will evaluate during this period.
      </p>

      {rows.map((row, idx) => (
        <div key={idx} className="sw-item-row">
          <div className="sw-form-group">
            <label className="sw-form-label">
              Project Title <span className="sw-required">*</span>
            </label>
            <input
              type="text"
              className={`sw-form-input${rowErrors[idx]?.title ? " error" : ""}`}
              placeholder="Autonomous Warehouse Router"
              value={row.title}
              onChange={(e) => updateRow(idx, "title", e.target.value)}
            />
          </div>
          <div className="sw-form-group">
            <label className="sw-form-label">
              Team Members <span className="sw-required">*</span>
            </label>
            <input
              type="text"
              className={`sw-form-input${rowErrors[idx]?.teamMembers ? " error" : ""}`}
              placeholder="Ali Vural, Zeynep Şahin, Ege Tan"
              defaultValue={row.teamMembers.join(", ")}
              onChange={(e) =>
                updateRow(idx, "teamMembers", e.target.value.split(",").map((s) => s.trim()))
              }
            />
          </div>
          <div className="sw-form-group">
            <label className="sw-form-label">Advisor</label>
            <input
              type="text"
              className="sw-form-input"
              placeholder="Dr. Mehmet Kara"
              value={row.advisor}
              onChange={(e) => updateRow(idx, "advisor", e.target.value)}
            />
          </div>
          <button
            className="sw-item-remove"
            onClick={() => removeRow(idx)}
            type="button"
            aria-label="Remove project"
          >
            <X size={14} />
          </button>
        </div>
      ))}

      <button className="sw-add-another-btn" data-testid="wizard-step-projects-add" onClick={addRow} type="button">
        <Plus size={14} /> Add Another Project
      </button>

      <div className="sw-or-divider">or</div>

      <button
        className="sw-btn sw-btn-ghost"
        style={{ width: "100%" }}
        type="button"
        onClick={() => setImportOpen(true)}
      >
        <Upload size={14} /> Import from CSV
      </button>

      <div className="sw-actions">
        <button
          className="sw-btn sw-btn-primary"
          data-testid="wizard-step-projects-next"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? <><Loader2 size={16} className="sw-btn-spinner" /> Saving…</> : <>Save Projects & Continue <ArrowRight size={16} /></>}
        </button>
      </div>

      <div className="sw-footer">
        <button className="sw-btn-link" onClick={onBack}>
          ← Back
        </button>
      </div>

      <ImportCsvModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        parseFile={(f) => parseProjectsCsv(f, summaryData || [])}
        onImport={async (validRows) => {
          cancelImportRef.current = false;
          let imported = 0, skipped = 0, failed = 0;
          for (const row of validRows) {
            if (cancelImportRef.current) break;
            try {
              await createProject({
                period_id: periodId,
                title: row.title,
                members: membersStringToJsonb(row.members),
              });
              imported += 1;
            } catch (e) {
              const msg = String(e?.message || "").toLowerCase();
              if (msg.includes("duplicate") || msg.includes("uniq")) {
                skipped += 1;
              } else {
                failed += 1;
              }
            }
          }
          await fetchData();
          return { imported, skipped, failed };
        }}
      />
    </div>
  );
}
