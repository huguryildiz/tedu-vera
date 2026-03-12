import { createContext, useCallback, useContext, useRef, useState } from "react";
import React from "react";

const ToastContext = createContext(null);

const ensureTrailingPeriod = (message) => {
  const text = String(message ?? "").trim();
  if (!text) return text;
  return text.replace(/[.!?]+$/u, "") + ".";
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type, message, duration = 4000) => {
      const id = ++counter.current;
      const normalizedMessage =
        typeof message === "string" || typeof message === "number"
          ? ensureTrailingPeriod(message)
          : message;
      setToasts((prev) => [{ id, type, message: normalizedMessage }, ...prev]);
      setTimeout(() => removeToast(id), duration);
    },
    [removeToast]
  );

  const toast = {
    success: (m, d) => addToast("success", m, d),
    error:   (m, d) => addToast("error",   m, d),
    warning: (m, d) => addToast("warning", m, d),
    info:    (m, d) => addToast("info",    m, d),
  };

  return React.createElement(
    ToastContext.Provider,
    { value: { toasts, toast, removeToast } },
    children
  );
}

export function useToast() {
  return useContext(ToastContext).toast;
}

export function useToasts() {
  const ctx = useContext(ToastContext);
  return { toasts: ctx.toasts, removeToast: ctx.removeToast };
}
