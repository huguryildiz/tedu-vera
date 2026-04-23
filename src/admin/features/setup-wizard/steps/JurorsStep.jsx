import { useState } from "react";
import { useAdminContext } from "@/admin/shared/useAdminContext";
import { useToast } from "@/shared/hooks/useToast";
import ImportJurorsModal from "@/admin/shared/ImportJurorsModal";
import { parseJurorsCsv } from "@/admin/utils/csvParser";
import { avatarGradient, initials } from "@/shared/ui/avatarColor";
import { createJuror } from "@/shared/api";
import {
  Users,
  Zap,
  Plus,
  X,
  Check,
  CheckCircle2,
  ArrowRight,
  Upload,
  Loader2,
} from "lucide-react";

export default function JurorsStep({ periodId, onContinue, onBack, onLaunch, loading }) {
  const toast = useToast();
  const { activeOrganization, fetchData, allJurors, navigateTo, setSelectedPeriodId } = useAdminContext();
  // allJurors is already scoped to selectedPeriodId by listJurorsSummary —
  // items have no period_id field, so we can't filter by it. Trust the list.
  const periodJurors = allJurors || [];
  const [rows, setRows] = useState([{ name: "", affiliation: "", email: "" }]);
  const [rowErrors, setRowErrors] = useState([{ name: false, affiliation: false }]);
  const [importOpen, setImportOpen] = useState(false);

  const addRow = () => {
    setRows([...rows, { name: "", affiliation: "", email: "" }]);
    setRowErrors((prev) => [...prev, { name: false, affiliation: false }]);
  };

  const removeRow = (idx) => {
    setRows(rows.filter((_, i) => i !== idx));
    setRowErrors((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateRow = (idx, field, value) => {
    const updated = [...rows];
    updated[idx][field] = value;
    setRows(updated);
    if (field === "name" || field === "affiliation") {
      setRowErrors((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], [field]: false };
        return next;
      });
    }
  };

  const handleSave = async () => {
    const errors = rows.map((r) => ({ name: !r.name.trim(), affiliation: !r.affiliation.trim() }));
    const hasError = errors.some((e) => e.name || e.affiliation);
    const validRows = rows.filter((r) => r.name.trim() && r.affiliation.trim());
    if (validRows.length === 0) {
      setRowErrors(errors);
      toast.error("Please add at least one juror");
      return;
    }
    if (hasError) {
      setRowErrors(errors);
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      for (const row of validRows) {
        await createJuror({
          period_id: periodId,
          organization_id: activeOrganization?.id,
          juror_name: row.name,
          affiliation: row.affiliation,
          email: row.email || null,
        });
      }
      toast.success(`${validRows.length} jurors added`);
      onContinue();
      await fetchData();
    } catch (err) {
      toast.error("Failed to add jurors: " + err.message);
    }
  };

  if (periodJurors.length > 0) {
    return (
      <div className="sw-card sw-fade-in">
        <div className="sw-status-chip">
          <CheckCircle2 size={12} /> {periodJurors.length} added
        </div>
        <div className="sw-card-icon">
          <Users size={24} />
        </div>
        <h2 className="sw-card-title">Add your evaluation team</h2>
        <p className="sw-card-desc">
          Register the jurors who will evaluate projects during this period.
        </p>
        <div className="sw-done-summary">
          <div className="sw-done-summary-icon">
            <Check size={16} strokeWidth={2.5} />
          </div>
          <div className="sw-done-summary-body">
            <div className="sw-done-summary-meta">Jurors added</div>
            <div className="sw-done-summary-title">
              {periodJurors.length} {periodJurors.length === 1 ? "juror" : "jurors"} registered
            </div>
            <div className="sw-done-summary-sub">
              To add more or edit details, go to the Jurors page.
            </div>
          </div>
        </div>
        <div className="sw-existing-list">
          <div className="sw-existing-head">
            <span />
            <span>Juror</span>
            <span>Affiliation</span>
            <span>Email</span>
          </div>
          {periodJurors.map((j) => {
            const jName = j.juryName || j.juror_name || "";
            return (
              <div key={j.jurorId ?? j.id} className="sw-existing-item">
                <div className="sw-existing-item-icon sw-existing-item-icon--avatar">
                  <span className="sw-member-chip" style={{ background: avatarGradient(jName) }}>
                    {initials(jName)}
                  </span>
                </div>
                <span className="sw-existing-item-name">{jName || "—"}</span>
                <span className="sw-existing-item-meta">{j.affiliation || "—"}</span>
                <span className="sw-existing-item-meta">{j.email || "—"}</span>
              </div>
            );
          })}
        </div>
        <div className="sw-actions">
          <button className="sw-btn sw-btn-success" onClick={onLaunch}>
            <Zap size={16} /> Generate Entry Token
          </button>
        </div>
        <div className="sw-footer sw-footer-stack">
          <button
            className="sw-btn-link"
            onClick={() => { if (periodId) setSelectedPeriodId(periodId); navigateTo("jurors"); }}
          >
            Add more jurors →
          </button>
          <button className="sw-btn-link sw-btn-link-sub" onClick={onBack}>← Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="sw-card sw-fade-in">
      <div className="sw-card-icon">
        <Users size={24} />
      </div>
      <h2 className="sw-card-title">Add your evaluation team</h2>
      <p className="sw-card-desc">
        Register the jurors who will evaluate projects.
      </p>

      {rows.map((row, idx) => (
        <div key={idx} className="sw-item-row">
          <div className="sw-form-group">
            <label className="sw-form-label">
              Name <span className="sw-required">*</span>
            </label>
            <input
              type="text"
              className={`sw-form-input${rowErrors[idx]?.name ? " error" : ""}`}
              placeholder="Dr. Ayşe Demir"
              value={row.name}
              onChange={(e) => updateRow(idx, "name", e.target.value)}
            />
          </div>
          <div className="sw-form-group">
            <label className="sw-form-label">
              Affiliation <span className="sw-required">*</span>
            </label>
            <input
              type="text"
              className={`sw-form-input${rowErrors[idx]?.affiliation ? " error" : ""}`}
              placeholder="TED University"
              value={row.affiliation}
              onChange={(e) => updateRow(idx, "affiliation", e.target.value)}
            />
          </div>
          <div className="sw-form-group">
            <label className="sw-form-label">Email</label>
            <input
              type="email"
              className="sw-form-input"
              placeholder="juror@example.com"
              value={row.email}
              onChange={(e) => updateRow(idx, "email", e.target.value)}
            />
          </div>
          <button
            className="sw-item-remove"
            onClick={() => removeRow(idx)}
            type="button"
            aria-label="Remove juror"
          >
            <X size={14} />
          </button>
        </div>
      ))}

      <button className="sw-add-another-btn" onClick={addRow} type="button">
        <Plus size={14} /> Add Another Juror
      </button>

      <div className="sw-or-divider">or</div>

      <button className="sw-btn sw-btn-ghost" style={{ width: "100%" }} type="button" onClick={() => setImportOpen(true)}>
        <Upload size={14} /> Import from CSV
      </button>

      <div className="sw-actions">
        <button
          className="sw-btn sw-btn-primary"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? <><Loader2 size={16} className="sw-btn-spinner" /> Saving…</> : <>Save Jurors & Continue <ArrowRight size={16} /></>}
        </button>
      </div>

      <div className="sw-footer sw-footer-stack">
        <button className="sw-btn-link" onClick={onLaunch}>
          Skip jurors &amp; launch →
        </button>
        <button className="sw-btn-link sw-btn-link-sub" onClick={onBack}>
          ← Back
        </button>
      </div>

      <ImportJurorsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        parseFile={(f) => parseJurorsCsv(f, allJurors || [])}
        onImport={async (validRows) => {
          let imported = 0, skipped = 0, failed = 0;
          for (const row of validRows) {
            try {
              await createJuror({
                period_id: periodId,
                organization_id: activeOrganization?.id,
                juror_name: row.juror_name,
                affiliation: row.affiliation,
                email: row.email || null,
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
