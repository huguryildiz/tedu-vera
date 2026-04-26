/**
 * Phase 1 export-content-parity helpers.
 *
 * CSV / XLSX parsers already live in `parseExport.ts` (pre-existing). This
 * module adds PDF signature verification and a small util used by Phase 1
 * tests. Kept separate so the parser module stays focused and the new helpers
 * have a clear ownership boundary.
 */
import * as fs from "node:fs";

/**
 * Asserts a file's first 5 bytes match the `%PDF-` magic. Throws otherwise.
 *
 * Why: Playwright's `page.pdf()` and server-side renderers both produce real
 * PDFs that start with `%PDF-`. A "save as PDF" implementation that returned
 * an HTML snapshot or an empty file would fail this check.
 */
export function assertPDFSignature(filePath: string): void {
  const fd = fs.openSync(filePath, "r");
  try {
    const buf = Buffer.alloc(5);
    const read = fs.readSync(fd, buf, 0, 5, 0);
    if (read < 5) {
      throw new Error(
        `assertPDFSignature: file ${filePath} is shorter than 5 bytes (read=${read})`,
      );
    }
    const sig = buf.toString("ascii");
    if (sig !== "%PDF-") {
      throw new Error(
        `assertPDFSignature: ${filePath} does not start with %PDF- (got: ${JSON.stringify(sig)})`,
      );
    }
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Asserts numeric drift between two values is below `tolerance`. Returns the
 * absolute drift so callers can include it in failure messages. Centralises
 * the convention used across export-content-parity tests.
 */
export function assertNumericClose(
  actual: number,
  expected: number,
  tolerance = 0.01,
  context = "",
): number {
  const drift = Math.abs(actual - expected);
  if (drift > tolerance) {
    throw new Error(
      `Numeric drift ${drift} exceeds tolerance ${tolerance}` +
        (context ? ` (${context})` : "") +
        ` actual=${actual} expected=${expected}`,
    );
  }
  return drift;
}
