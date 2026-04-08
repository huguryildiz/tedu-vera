// src/guards/AuthGuard.jsx
// Protects admin routes — redirects to /login if no user session.

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/auth";

export default function AuthGuard() {
  const { user, loading } = useAuth();
  const location = useLocation();

  // While auth is loading, render nothing (prevents flash)
  if (loading) return null;

  if (!user) {
    // Redirect to login, preserving the intended destination
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
