// src/layouts/RootLayout.jsx
// Root layout wrapper for the entire app.
// Provides ThemeProvider, AuthProvider, ToastContainer
// and renders child routes via <Outlet />.

import { Outlet } from "react-router-dom";
import { ThemeProvider } from "@/shared/theme/ThemeProvider";
import { AuthProvider } from "@/auth";
import ToastContainer from "@/shared/ui/ToastContainer";
import ErrorBoundary from "@/shared/ui/ErrorBoundary";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
        <ToastContainer />
      </AuthProvider>
    </ThemeProvider>
  );
}
