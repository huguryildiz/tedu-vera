// src/layouts/DemoLayout.jsx
// Wraps all /demo/* routes. Sets demo environment on mount
// so that Supabase client picks the demo instance.

import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { setEnvironment } from "@/shared/lib/environment";

export default function DemoLayout() {
  useEffect(() => {
    setEnvironment("demo");
  }, []);

  return <Outlet />;
}
