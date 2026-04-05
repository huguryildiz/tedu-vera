// src/admin/analytics/captureChartImage.js
// ============================================================
// Captures a chart DOM element as a JPEG data URL for PDF embedding.
// Uses scale 2 + JPEG 0.75 for sharp images with small file size.
// ============================================================

/**
 * Captures a chart element as a JPEG data URL for PDF embedding.
 * Temporarily applies the pdf-capture-mode class to ensure a light background
 * during capture, then removes it regardless of success or failure.
 *
 * @param {string} elementId - DOM element ID to capture
 * @returns {Promise<{dataURL: string, width: number, height: number}|null>}
 */
export async function captureChartImage(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return null;

  el.classList.add("pdf-capture-mode");
  try {
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(el, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
    });
    return { dataURL: canvas.toDataURL("image/jpeg", 0.75), width: canvas.width, height: canvas.height };
  } finally {
    el.classList.remove("pdf-capture-mode");
  }
}
