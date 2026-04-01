import { toast as sonnerToast } from "sonner";

const ensureTrailingPeriod = (message) => {
  const text = String(message ?? "").trim();
  if (!text) return text;
  return text.replace(/[.!?]+$/u, "") + ".";
};

const toast = {
  success: (m) => sonnerToast.success(ensureTrailingPeriod(m)),
  error:   (m) => sonnerToast.error(ensureTrailingPeriod(m)),
  warning: (m) => sonnerToast.warning(ensureTrailingPeriod(m)),
  info:    (m) => sonnerToast.info(ensureTrailingPeriod(m)),
};

export function useToast() {
  return toast;
}

// Legacy exports — no-ops, kept for import compatibility
export function ToastProvider({ children }) {
  return children;
}

export function useToasts() {
  return { toasts: [], removeToast: () => {} };
}
