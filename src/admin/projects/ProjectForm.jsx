// src/admin/projects/ProjectForm.jsx

import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "../../lib/utils";
import { PencilIcon, CirclePlusIcon } from "../../shared/Icons";
import Tooltip from "../../shared/Tooltip";
import { splitStudents, digitsOnly } from "./projectHelpers";

function CircleMinusIcon({ className = "" } = {}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8" />
    </svg>
  );
}

function SortableStudentRow({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };
  return children({ attributes, listeners, setNodeRef, style });
}

const dragHandle = (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="12" r="1" />
    <circle cx="9" cy="5" r="1" />
    <circle cx="9" cy="19" r="1" />
    <circle cx="15" cy="12" r="1" />
    <circle cx="15" cy="5" r="1" />
    <circle cx="15" cy="19" r="1" />
  </svg>
);

function updateStudentInput(setter, index, nextValue) {
  setter((prev) => ({
    ...prev,
    members: prev.members.map((entry, idx) => (idx === index ? nextValue : entry)),
  }));
}

function blurStudentInput(setter, index) {
  setter((prev) => {
    const current = [...prev.members];
    const expanded = splitStudents(current[index]);
    if (expanded.length > 1) {
      current.splice(index, 1, ...expanded);
    } else {
      current[index] = expanded[0] || "";
    }
    return {
      ...prev,
      members: current,
    };
  });
}

function addStudentInputRow(setter) {
  setter((prev) => ({
    ...prev,
    members: [...prev.members, ""],
  }));
}

function moveStudentInput(setter, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
  setter((prev) => {
    const list = [...prev.members];
    if (fromIndex >= list.length || toIndex >= list.length) return prev;
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    return {
      ...prev,
      members: list,
    };
  });
}

function removeStudentInput(setter, index) {
  setter((prev) => {
    const next = prev.members.filter((_, idx) => idx !== index);
    return {
      ...prev,
      members: next.length ? next : [""],
    };
  });
}

export default function ProjectForm({
  form,
  setForm,
  error,
  saving,
  canSubmit,
  onSubmit,
  onCancel,
  onClearError,
  mode,
  isDemoMode = false,
  semesterOptions,
}) {
  const studentIds = form.members.map((_, idx) => `${mode}-${idx}`);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } })
  );

  const isAdd = mode === "add";

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const fromIndex = studentIds.indexOf(String(active.id));
    const toIndex = studentIds.indexOf(String(over.id));
    if (fromIndex < 0 || toIndex < 0) return;
    moveStudentInput(setForm, fromIndex, toIndex);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm">
      <div className="w-[min(520px,92vw)] max-w-[100vw] max-h-[90vh] rounded-2xl border bg-card shadow-lg flex flex-col gap-3 p-5 relative overflow-hidden">
        <div className="flex items-center gap-2.5 mb-0.5">
          <span className="inline-flex items-center justify-center size-9 rounded-xl bg-muted text-muted-foreground" aria-hidden="true">
            {isAdd ? <CirclePlusIcon /> : <PencilIcon />}
          </span>
          <div className="text-lg font-bold tracking-tight">{isAdd ? "Create Group" : "Edit Group"}</div>
        </div>
        <div className="flex flex-col gap-2.5">
          {isAdd && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Period</label>
                <select
                  className={cn(
                    "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm",
                    error && !form.period_id && "border-destructive ring-destructive/20 ring-2"
                  )}
                  value={form.period_id || ""}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, period_id: e.target.value }));
                    if (error) onClearError();
                  }}
                >
                  <option value="" disabled>Select period</option>
                  {(semesterOptions || []).map((s) => (
                    <option key={s.id} value={s.id}>{s.period_name}</option>
                  ))}
                </select>
                {semesterOptions.length === 0 && (
                  <div className="text-xs text-amber-600" role="status">
                    No periods exist. Create a period in Period Settings before adding groups.
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Group number</label>
                <input
                  className={cn(
                    "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none transition-colors focus:ring-2 focus:ring-ring",
                    error && "border-destructive ring-destructive/20 ring-2"
                  )}
                  value={form.group_no}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, group_no: digitsOnly(e.target.value) }));
                    if (error) onClearError();
                  }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  placeholder="1"
                />
              </div>
              {error && <div className="rounded-xl border border-destructive/30 border-l-4 border-l-destructive bg-destructive/5 px-2.5 py-2 text-xs text-destructive">{error}</div>}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Title</label>
                <input
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none transition-colors focus:ring-2 focus:ring-ring"
                  value={form.title}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, title: e.target.value }));
                    if (error) onClearError();
                  }}
                  placeholder="Smart Traffic AI"
                />
              </div>
            </>
          )}
          {!isAdd && (
            <>
              <label className="text-sm font-medium">
                Group number
                <span className="ml-1.5 font-normal text-muted-foreground">(locked)</span>
              </label>
              <input
                className="h-9 w-full rounded-lg border border-destructive/40 bg-destructive/5 px-3 text-sm cursor-not-allowed shadow-sm"
                value={form.group_no}
                disabled
              />
              <label className="text-sm font-medium">Title</label>
              <input
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none transition-colors focus:ring-2 focus:ring-ring"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </>
          )}
          <label className="text-sm font-medium">
            Team Members
            <span className="ml-1.5 font-normal text-muted-foreground">
              (one team member per line item)
            </span>
          </label>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={studentIds} strategy={verticalListSortingStrategy}>
              {form.members.map((student, idx) => (
                <SortableStudentRow key={studentIds[idx]} id={studentIds[idx]}>
                  {({ attributes, listeners, setNodeRef, style }) => (
                    <div
                      ref={setNodeRef}
                      style={style}
                      className="flex gap-2 mb-2"
                    >
                      <Tooltip text="Drag to reorder">
                        <button
                          className="inline-flex items-center justify-center rounded-lg border border-input bg-background p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                          type="button"
                          aria-label={`Drag student ${idx + 1} to reorder`}
                          style={{ cursor: "grab", alignSelf: "center", touchAction: "none" }}
                          {...attributes}
                          {...listeners}
                        >
                          {dragHandle}
                        </button>
                      </Tooltip>
                      <input
                        className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none transition-colors focus:ring-2 focus:ring-ring"
                        value={student}
                        onChange={(e) => {
                          updateStudentInput(setForm, idx, e.target.value);
                          if (isAdd && error) onClearError();
                        }}
                        onBlur={() => blurStudentInput(setForm, idx)}
                        placeholder={idx === 0 ? "Ali Yilmaz" : "Ayse Demir"}
                      />
                      <button
                        className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50"
                        type="button"
                        onClick={() => removeStudentInput(setForm, idx)}
                        disabled={form.members.length === 1}
                        title="Remove student"
                        aria-label={`Remove student ${idx + 1}`}
                      >
                        <span className="inline-flex items-center gap-1">
                          <CircleMinusIcon />
                          Student
                        </span>
                      </button>
                    </div>
                  )}
                </SortableStudentRow>
              ))}
            </SortableContext>
          </DndContext>
          <button
            className="inline-flex items-center gap-1.5 self-start rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
            type="button"
            onClick={() => addStudentInputRow(setForm)}
            title="Add student"
            aria-label="Add student"
          >
            <span className="inline-flex items-center gap-1">
              <CirclePlusIcon />
              Student
            </span>
          </button>
        </div>
        {!isAdd && error && (
          <div role="alert" className="rounded-xl border border-destructive/30 border-l-4 border-l-destructive bg-destructive/5 px-2.5 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2.5 border-t pt-4">
          <button
            className="inline-flex items-center gap-1.5 rounded-full border border-input bg-background px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-accent hover:text-accent-foreground"
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            type="button"
            disabled={!canSubmit || saving || isDemoMode}
            onClick={onSubmit}
          >
            {saving ? (isAdd ? "Creating\u2026" : "Saving\u2026") : (isAdd ? "Create" : "Save")}
          </button>
        </div>
      </div>
    </div>
  );
}
