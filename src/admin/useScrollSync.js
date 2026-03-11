// src/admin/useScrollSync.js
// ── Shared horizontal scroll sync hook ────────────────────────

import { useEffect } from "react";

export function useScrollSync(topScrollRef, tableScrollRef) {
  useEffect(() => {
    const top  = topScrollRef?.current;
    const wrap = tableScrollRef?.current;
    if (!top || !wrap) return;

    const inner = top.firstElementChild;
    if (!inner) return;

    let syncing = false;
    const syncFromWrap = () => { if (syncing) return; syncing = true; top.scrollLeft  = wrap.scrollLeft; syncing = false; };
    const syncFromTop  = () => { if (syncing) return; syncing = true; wrap.scrollLeft = top.scrollLeft;  syncing = false; };
    const updateWidth  = () => { inner.style.width = `${wrap.scrollWidth}px`; syncFromWrap(); };

    updateWidth();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateWidth) : null;
    ro?.observe(wrap);
    window.addEventListener("resize", updateWidth);
    wrap.addEventListener("scroll", syncFromWrap, { passive: true });
    top.addEventListener("scroll",  syncFromTop,  { passive: true });

    return () => {
      wrap.removeEventListener("scroll", syncFromWrap);
      top.removeEventListener("scroll",  syncFromTop);
      window.removeEventListener("resize", updateWidth);
      ro?.disconnect();
    };
  }, [topScrollRef, tableScrollRef]);
}
