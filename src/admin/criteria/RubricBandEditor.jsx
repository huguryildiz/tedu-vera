// src/admin/criteria/RubricBandEditor.jsx

import AutoGrow from "@/shared/ui/AutoGrow";
import BlockingValidationAlert from "@/shared/ui/BlockingValidationAlert";
import DangerIconButton from "../../components/admin/DangerIconButton";
import { XIcon, CirclePlusIcon } from "@/shared/ui/Icons";
import { RUBRIC_EDITOR_TEXT } from "../../config";
import { clampToCriterionMax, getDescPlaceholder } from "./criteriaFormHelpers";
import { cn } from "@/shared/lib/utils";

export default function RubricBandEditor({ bands, onChange, disabled, criterionMax, rubricErrors }) {
  const bandRangeErrors = rubricErrors?.bandRangeErrors ?? {};
  const bandLevelErrors = rubricErrors?.bandLevelErrors ?? {};
  const bandDescErrors  = rubricErrors?.bandDescErrors  ?? {};
  const coverageError   = rubricErrors?.coverageError   ?? null;

  const addBand = () => {
    onChange([...bands, { level: "", min: 0, max: 0, desc: "" }]);
  };
  const removeBand = (bi) => {
    onChange(bands.filter((_, idx) => idx !== bi));
  };
  const setBand = (bi, field, value) => {
    const finalValue = field === "min" || field === "max"
      ? clampToCriterionMax(value, criterionMax)
      : value;
    const next = bands.map((b, idx) => idx === bi ? { ...b, [field]: finalValue } : b);
    onChange(next);
  };

  const hasBandErrors = Object.keys(bandRangeErrors).length > 0;

  return (
    <div className="rubric-band-editor">
      {hasBandErrors && (
        <BlockingValidationAlert message="Fix highlighted score ranges." />
      )}
      {coverageError && (
        <BlockingValidationAlert message={coverageError} />
      )}
      {bands.map((band, bi) => {
        const rangeError = bandRangeErrors[bi];
        const levelError = bandLevelErrors[bi];
        const descError  = bandDescErrors[bi];
        return (
          <div key={bi} className="rubric-band-card">
            <div className="rubric-band-header">
              <div className="rubric-band-level-group">
                <label className="criteria-manager-cell-label small-label">Band Name</label>
                <input
                  className={cn(
                    "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring rubric-band-level",
                    levelError && "border-destructive"
                  )}
                  value={band.level}
                  onChange={(e) => setBand(bi, "level", e.target.value)}
                  placeholder={RUBRIC_EDITOR_TEXT.rubricBandNamePlaceholder}
                  disabled={disabled}
                  aria-label={`Band ${bi + 1} level`}
                />
                {levelError && (
                  <div className="text-xs text-destructive rubric-band-error">{levelError}</div>
                )}
              </div>

              <div className="rubric-band-score-group">
                <label className="criteria-manager-cell-label small-label">Score Range</label>
                <div className="rubric-band-range-inputs">
                  <input
                    className={cn(
                      "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring rubric-band-score-input",
                      rangeError && "border-destructive"
                    )}
                    type="number"
                    min="0"
                    max={criterionMax}
                    value={band.min}
                    onChange={(e) => setBand(bi, "min", e.target.value)}
                    placeholder={RUBRIC_EDITOR_TEXT.rubricBandMinPlaceholder}
                    disabled={disabled}
                    aria-label={`Band ${bi + 1} min`}
                  />
                  <span className="rubric-band-separator">--</span>
                  <input
                    className={cn(
                      "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring rubric-band-score-input",
                      rangeError && "border-destructive"
                    )}
                    type="number"
                    min="0"
                    max={criterionMax}
                    value={band.max}
                    onChange={(e) => setBand(bi, "max", e.target.value)}
                    placeholder={RUBRIC_EDITOR_TEXT.rubricBandMaxPlaceholder}
                    disabled={disabled}
                    aria-label={`Band ${bi + 1} max`}
                  />
                </div>
                {rangeError && (
                  <div className="text-xs text-destructive rubric-band-error">{rangeError}</div>
                )}
              </div>

              {!disabled && (
                <div className="rubric-band-actions">
                  <DangerIconButton
                    Icon={XIcon}
                    onClick={() => removeBand(bi)}
                    disabled={disabled}
                    ariaLabel={`Remove band ${bi + 1}`}
                    title="Remove band"
                    className="rubric-band-remove-btn"
                  />
                </div>
              )}
            </div>

            <div className="rubric-band-description-row">
              <label className="criteria-manager-cell-label small-label">Description</label>
              <AutoGrow
                value={band.desc}
                onChange={(e) => setBand(bi, "desc", e.target.value)}
                disabled={disabled}
                placeholder={getDescPlaceholder(band.level)}
                ariaLabel={`Band ${bi + 1} description`}
                hasError={!!descError}
                className="rubric-band-desc-textarea"
                rows={2}
              />
              {descError && (
                <div className="text-xs text-destructive rubric-band-error">{descError}</div>
              )}
            </div>
          </div>
        );
      })}
      {!disabled && (
        <button type="button" className="inline-flex items-center gap-1.5 rounded-full border border-input bg-muted px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:-translate-y-px hover:border-border hover:shadow-md disabled:pointer-events-none disabled:opacity-60 rubric-add-band-btn" onClick={addBand}>
          <span aria-hidden="true"><CirclePlusIcon className="size-3.5" /></span>
          Add Band
        </button>
      )}
    </div>
  );
}
