import { renderHook } from "@testing-library/react";
import { describe, expect } from "vitest";
import { useScoreGridData } from "../useScoreGridData";
import { qaTest } from "../../test/qaTest.js";

describe("useScoreGridData — Phase A safety", () => {
  // ── phaseA.grid.01 ─────────────────────────────────────────────────────────
  qaTest("phaseA.grid.01", () => {
    const customCriteria = [
      { id: "research", label: "Research", max: 40 },
      { id: "presentation", label: "Presentation", max: 60 },
    ];
    const data = [
      {
        jurorId: "j1",
        projectId: "g1",
        total: 80,
        research: 30,
        presentation: 50,
        status: "completed",
        editingFlag: "",
        finalSubmittedAt: "2026-03-13T10:00:00.000Z",
      },
    ];
    const jurors = [
      { key: "j1", name: "Alice", dept: "EE", finalSubmitted: true, editEnabled: false },
    ];
    const groups = [{ id: "g1", groupNo: 1, label: "Group 1" }];

    const { result } = renderHook(() =>
      useScoreGridData({ data, jurors, groups, criteriaConfig: customCriteria })
    );

    expect(result.current.lookup.j1.g1.research).toBe(30);
    expect(result.current.lookup.j1.g1.presentation).toBe(50);
    // Default criteria fields must NOT be present when a custom template is used
    expect(result.current.lookup.j1.g1.technical).toBeUndefined();
    expect(result.current.lookup.j1.g1.design).toBeUndefined();
    expect(result.current.lookup.j1.g1.delivery).toBeUndefined();
    expect(result.current.lookup.j1.g1.teamwork).toBeUndefined();
  });

  // ── phaseA.grid.02 ─────────────────────────────────────────────────────────
  qaTest("phaseA.grid.02", () => {
    // Two groups so we can exercise ready_to_submit vs partial states
    const groups = [
      { id: "g1", groupNo: 1, label: "Group 1" },
      { id: "g2", groupNo: 2, label: "Group 2" },
    ];

    const jurors = [
      // editing: editEnabled=true (checked first by getJurorWorkflowState)
      { key: "j_editing",  name: "Ed",      dept: "EE", finalSubmitted: false, editEnabled: true },
      // completed: finalSubmitted=true and editEnabled=false
      { key: "j_complete", name: "Alice",   dept: "EE", finalSubmitted: true,  editEnabled: false },
      // ready_to_submit: all groups scored, not final
      { key: "j_ready",    name: "Bob",     dept: "CS", finalSubmitted: false, editEnabled: false },
      // in_progress: some groups scored but not all, not final
      { key: "j_partial",  name: "Cem",     dept: "EE", finalSubmitted: false, editEnabled: false },
      // not_started: no scores at all
      { key: "j_none",     name: "Deniz",   dept: "EE", finalSubmitted: false, editEnabled: false },
    ];

    const data = [
      // j_editing scored g1 (state doesn't matter — editEnabled overrides)
      {
        jurorId: "j_editing", projectId: "g1",
        total: 90, technical: 30, design: 28, delivery: 25, teamwork: 7,
        status: "editing", editingFlag: "editing", finalSubmittedAt: "",
      },
      // j_complete scored both groups and is finalised
      {
        jurorId: "j_complete", projectId: "g1",
        total: 80, technical: 25, design: 25, delivery: 22, teamwork: 8,
        status: "completed", editingFlag: "", finalSubmittedAt: "2026-03-13T10:00:00.000Z",
      },
      {
        jurorId: "j_complete", projectId: "g2",
        total: 70, technical: 22, design: 22, delivery: 20, teamwork: 6,
        status: "completed", editingFlag: "", finalSubmittedAt: "2026-03-13T10:00:00.000Z",
      },
      // j_ready scored both groups but has NOT finalised
      {
        jurorId: "j_ready", projectId: "g1",
        total: 75, technical: 24, design: 22, delivery: 22, teamwork: 7,
        status: "completed", editingFlag: "", finalSubmittedAt: "",
      },
      {
        jurorId: "j_ready", projectId: "g2",
        total: 65, technical: 20, design: 20, delivery: 18, teamwork: 7,
        status: "completed", editingFlag: "", finalSubmittedAt: "",
      },
      // j_partial only scored g1 (g2 missing → not_started cell, so in_progress overall)
      {
        jurorId: "j_partial", projectId: "g1",
        total: 60, technical: 20, design: 18, delivery: 16, teamwork: 6,
        status: "completed", editingFlag: "", finalSubmittedAt: "",
      },
      // j_none has no data rows at all
    ];

    const { result } = renderHook(() => useScoreGridData({ data, jurors, groups }));
    const { jurorWorkflowMap } = result.current;

    expect(jurorWorkflowMap.get("j_editing")).toBe("editing");
    expect(jurorWorkflowMap.get("j_complete")).toBe("completed");
    expect(jurorWorkflowMap.get("j_ready")).toBe("ready_to_submit");
    expect(jurorWorkflowMap.get("j_partial")).toBe("in_progress");
    expect(jurorWorkflowMap.get("j_none")).toBe("not_started");
  });

  // ── phaseA.grid.03 ─────────────────────────────────────────────────────────
  qaTest("phaseA.grid.03", () => {
    const groups = [
      { id: "g1", groupNo: 1, label: "Group 1" },
      { id: "g2", groupNo: 2, label: "Group 2" },
      { id: "g3", groupNo: 3, label: "Group 3" },
    ];

    const jurors = [
      { key: "j1", name: "Alice", dept: "EE", finalSubmitted: false, editEnabled: false },
    ];

    const data = [
      // g1 → scored (total is set)
      {
        jurorId: "j1", projectId: "g1",
        total: 85, technical: 28, design: 27, delivery: 23, teamwork: 7,
        status: "completed", editingFlag: "", finalSubmittedAt: "",
      },
      // g2 → partial (total=null, some criteria filled)
      {
        jurorId: "j1", projectId: "g2",
        total: null, technical: 20, design: null, delivery: null, teamwork: null,
        status: "in_progress", editingFlag: "", finalSubmittedAt: "",
      },
      // g3 → empty (total=null, all criteria null)
      {
        jurorId: "j1", projectId: "g3",
        total: null, technical: null, design: null, delivery: null, teamwork: null,
        status: "in_progress", editingFlag: "", finalSubmittedAt: "",
      },
    ];

    const { result } = renderHook(() => useScoreGridData({ data, jurors, groups }));
    const exportRows = result.current.buildExportRows(jurors);

    expect(exportRows).toHaveLength(1);
    const { scores } = exportRows[0];

    // scored entry → numeric total
    expect(scores.g1).toBe(85);
    // partial entry → partial sum of the filled criteria (only technical=20 is non-null)
    expect(scores.g2).toBe(20);
    // empty entry → null
    expect(scores.g3).toBeNull();
  });
});
