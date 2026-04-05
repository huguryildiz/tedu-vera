// src/admin/__tests__/csvParser.test.js
import { describe, expect, vi } from "vitest";
import { qaTest } from "../../test/qaTest.js";
import { parseJurorsCsv, parseProjectsCsv } from "../utils/csvParser.js";

vi.mock("../../shared/lib/supabaseClient", () => ({ supabase: {} }));

// Helper: build a minimal File from a CSV string
function csvFile(content, name = "test.csv") {
  return new File([content], name, { type: "text/csv" });
}

describe("parseJurorsCsv", () => {
  qaTest("import.csv.juror.duplicate", async () => {
    const csv = "Name,Affiliation\nDr. Ali Yılmaz,TEDU\nProf. Zeynep Kaya,METU";
    // existingJurors uses juryName field (not juror_name)
    const existing = [{ juryName: "Dr. Ali Yılmaz" }];
    const result = await parseJurorsCsv(csvFile(csv), existing);
    const statuses = result.rows.map((r) => r.status);
    expect(statuses).toEqual(["skip", "ok"]);
    expect(result.stats.duplicate).toBe(1);
    expect(result.stats.valid).toBe(1);
  });

  qaTest("import.csv.juror.error", async () => {
    const csv = "Name,Affiliation\n,TEDU\nProf. Zeynep Kaya,METU";
    const result = await parseJurorsCsv(csvFile(csv), []);
    expect(result.rows[0].status).toBe("err");
    expect(result.rows[1].status).toBe("ok");
    expect(result.stats.error).toBe(1);
  });
});

describe("parseProjectsCsv", () => {
  qaTest("import.csv.project.duplicate", async () => {
    const csv = "Group,Title,Members\n5,Drone Nav,Can E.\n9,IoT Hub,Elif S.";
    const existing = [{ group_no: 5 }];
    const result = await parseProjectsCsv(csvFile(csv), existing);
    expect(result.rows[0].status).toBe("skip");
    expect(result.rows[1].status).toBe("ok");
    expect(result.stats.duplicate).toBe(1);
    expect(result.stats.valid).toBe(1);
  });

  qaTest("import.csv.project.no-existing", async () => {
    const csv = "Group,Title,Members\n5,Drone Nav,Can E.";
    const result = await parseProjectsCsv(csvFile(csv));
    expect(result.rows[0].status).toBe("ok");
    expect(result.stats.duplicate).toBe(0);
  });
});
