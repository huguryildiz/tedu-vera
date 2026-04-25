import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

// jsdom doesn't implement Blob.prototype.text() — polyfill for file upload tests
if (!Blob.prototype.text) {
  Blob.prototype.text = function () {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

// jsdom doesn't implement Element.prototype.scrollIntoView. Without this,
// async requestAnimationFrame callbacks in components like ProjectDrawer
// fire after the test completes and throw an "Uncaught Exception" that
// vitest counts as an unhandled error → exit code 1 in CI even though
// every test assertion passed. Local vmForks pool tolerates this; the
// CI `forks` pool does not. No-op stub is sufficient for unit tests.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}
