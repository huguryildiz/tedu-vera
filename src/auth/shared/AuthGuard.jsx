// src/auth/shared/AuthGuard.jsx
// Protects admin routes — redirects to /login if no user session.
// On /demo/admin/*, redirect to /demo so DemoAdminLoader can auto-login again.

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/auth";

export default function AuthGuard() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;

  if (!user) {
    const isDemoAdmin = location.pathname.startsWith("/demo/admin");
    const target = isDemoAdmin ? "/demo" : "/login";
    return <Navigate to={target} state={{ from: location }} replace />;
  }

  return <Outlet />;
}
