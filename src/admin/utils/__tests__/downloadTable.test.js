import { describe, expect, vi } from "vitest";
import { qaTest } from "@/test/qaTest";

vi.mock("@/assets/fonts/Inter-Subset.ttf?url", () => ({ default: "inter.ttf" }));
vi.mock("@/assets/vera_logo_pdf.png?url", () => ({ default: "vera_logo.png" }));
vi.mock("../exportXLSX", () => ({
  buildExportFilename: (type, period, ext) => `${type}-${period}.${ext}`,
}));

import { arrayBufferToBase64 } from "../downloadTable";

describe("downloadTable", () => {
  qaTest("coverage.download-table.array-buffer-to-base64", () => {
    const buffer = new Uint8Array([72, 101, 108, 108, 111]).buffer;
    const result = arrayBufferToBase64(buffer);
    expect(result).toBe(btoa("Hello"));
  });
});
