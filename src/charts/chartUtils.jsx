// src/charts/chartUtils.jsx
// Shared chart utility components.
//
// ChartDataTable — accessible data table backing for each chart.
// Renders as a <details> element (collapsed by default) containing a
// plain HTML table with the same data the chart visualises.
// When prefers-reduced-motion: reduce is active the <details> is opened
// automatically so the data is always visible without animation.

import { useEffect, useRef } from "react";

/**
 * ChartDataTable
 *
 * @param {object} props
 * @param {string}   props.caption  — table caption / accessible label
 * @param {string[]} props.headers  — column header labels
 * @param {Array[]}  props.rows     — array of row arrays (cells)
 */
export function ChartDataTable({ caption, headers = [], rows = [] }) {
  const detailsRef = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches && detailsRef.current) {
      detailsRef.current.open = true;
    }
    const handler = (e) => {
      if (e.matches && detailsRef.current) detailsRef.current.open = true;
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <details ref={detailsRef} className="chart-data-table">
      <summary className="chart-data-table-summary">View data table</summary>
      <div className="chart-data-table-scroll">
        <table className="table-dense table-pill-balance">
          {caption && <caption>{caption}</caption>}
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci}>{cell ?? "—"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
