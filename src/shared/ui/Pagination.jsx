// src/shared/ui/Pagination.jsx
// Global pagination bar — Reviews-style sliding window.
// Always renders when there are items; page nav is hidden on single-page results.
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";

const DEFAULT_SIZE_OPTIONS = [15, 25, 50, 100];

/**
 * Props:
 *   currentPage        — 1-based current page
 *   totalPages         — total number of pages (from loaded data)
 *   pageSize           — current rows per page
 *   totalItems         — total item count for "X–Y of Z" info text
 *   onPageChange       — (page: number) => void
 *   onPageSizeChange   — (size: number) => void
 *   itemLabel          — noun for items, e.g. "jurors" (default "items")
 *   pageSizeOptions    — array of numbers (default [15, 25, 50, 100])
 *   hasMore            — true when server has more data beyond current totalPages
 *   onLoadMore         — called when Next is clicked on last page with hasMore=true
 *   trailing           — optional JSX rendered after the size buttons (e.g. Refresh)
 */
export default function Pagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  itemLabel = "items",
  pageSizeOptions = DEFAULT_SIZE_OPTIONS,
  hasMore = false,
  onLoadMore,
  trailing,
  density = "standard",
}) {
  if (totalItems === 0) return null;

  const multiPage = totalPages > 1 || hasMore;
  const safePage = Math.min(currentPage, Math.max(1, totalPages));
  const pageStart = (safePage - 1) * pageSize + 1;
  const pageEnd = Math.min(safePage * pageSize, totalItems);

  // Sliding window ±2 around current page
  const delta = 2;
  const pageNums = [];
  for (let i = Math.max(1, safePage - delta); i <= Math.min(totalPages, safePage + delta); i++) {
    pageNums.push(i);
  }
  const showLeadingEllipsis = pageNums.length > 0 && pageNums[0] > 1;
  const showTrailingEllipsis = pageNums.length > 0 && pageNums[pageNums.length - 1] < totalPages;
  const safeDensity = density === "dense" ? "dense" : "standard";
  const iconSize = safeDensity === "dense" ? 10 : 11;

  const isFirst = safePage <= 1;
  const isLast = safePage >= totalPages && !hasMore;

  function handleNext() {
    if (safePage < totalPages) {
      onPageChange(safePage + 1);
    } else if (hasMore) {
      onLoadMore?.();
      onPageChange(safePage + 1);
    }
  }

  return (
    <div className={`pagination-bar pagination-bar--${safeDensity}`}>
      <div className="pagination-info">
        {totalItems === 0
          ? "No results"
          : `${pageStart}–${pageEnd} of ${totalItems}${hasMore ? "+" : ""} ${itemLabel}`}
      </div>

      {multiPage && (
        <div className="pagination-controls">
          <button
            type="button"
            className="pagination-btn"
            disabled={isFirst}
            onClick={() => onPageChange(1)}
            aria-label="First page"
          >
            <ChevronsLeft size={iconSize} />
          </button>
          <button
            type="button"
            className="pagination-btn"
            disabled={isFirst}
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft size={iconSize} />
          </button>

          {showLeadingEllipsis && <span className="pagination-ellipsis">…</span>}

          {pageNums.map((n) => (
            <button
              key={n}
              type="button"
              className={`pagination-btn${n === safePage ? " active" : ""}`}
              aria-current={n === safePage ? "page" : undefined}
              onClick={() => onPageChange(n)}
            >
              {n}
            </button>
          ))}

          {showTrailingEllipsis && <span className="pagination-ellipsis">…</span>}

          <button
            type="button"
            className="pagination-btn"
            disabled={isLast}
            onClick={handleNext}
            aria-label="Next page"
          >
            <ChevronRight size={iconSize} />
          </button>
          <button
            type="button"
            className="pagination-btn"
            disabled={isLast || hasMore}
            onClick={() => onPageChange(totalPages)}
            aria-label="Last page"
          >
            <ChevronsRight size={iconSize} />
          </button>
        </div>
      )}

      <div className="pagination-sizes">
        <span className="pagination-sizes-label">Rows</span>
        {pageSizeOptions.map((n) => (
          <button
            key={n}
            type="button"
            className={`pagination-btn${pageSize === n ? " active" : ""}`}
            onClick={() => onPageSizeChange(n)}
          >
            {n}
          </button>
        ))}
        {trailing}
      </div>
    </div>
  );
}
