import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import "./styles/main.css";

// Auto-grow textareas: JS fallback for browsers without field-sizing:content
// and for initial render (React sets value before browser can auto-size).
if (!CSS.supports("field-sizing", "content")) {
  function _resizeTextarea(el) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }
  document.addEventListener("input", (e) => {
    if (e.target.tagName === "TEXTAREA") _resizeTextarea(e.target);
  });
  new MutationObserver(() => {
    document.querySelectorAll("textarea:not([data-ar])").forEach((el) => {
      el.dataset.ar = "1";
      _resizeTextarea(el);
    });
  }).observe(document.body, { childList: true, subtree: true });
}

// iOS Safari: after the keyboard dismisses, visualViewport height snaps back
// but the page can stay scrolled into the "keyboard gap". A same-position
// scroll forces the browser to recalculate layout without moving the view.
if (window.visualViewport) {
  let prevHeight = window.visualViewport.height;
  window.visualViewport.addEventListener("resize", () => {
    const h = window.visualViewport.height;
    if (h > prevHeight + 120) {
      requestAnimationFrame(() => {
        window.scrollTo(window.scrollX, window.scrollY);
      });
    }
    prevHeight = h;
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} future={{ v7_startTransition: true }} />
  </React.StrictMode>
);
