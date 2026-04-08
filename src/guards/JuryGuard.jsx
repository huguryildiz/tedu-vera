// src/guards/JuryGuard.jsx
// Protects jury flow routes — redirects to /eval if no jury session.

import { Navigate, Outlet } from "react-router-dom";
import { getJuryAccess } from "@/shared/storage";

export default function JuryGuard() {
  const hasAccess = getJuryAccess();

  if (!hasAccess) {
    return <Navigate to="/eval" replace />;
  }

  return <Outlet />;
}
