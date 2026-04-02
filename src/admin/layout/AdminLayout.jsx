// src/admin/layout/AdminLayout.jsx
// ============================================================
// Top-level layout wrapper for the admin panel.
// Combines the premium dark sidebar with the main content area.
// On mobile (< lg): sidebar is hidden by default, toggled via
// the hamburger button exposed through children via context.
// ============================================================

import { createContext, useState } from "react";
import { Menu } from "lucide-react";
import AdminSidebar from "./AdminSidebar";

/** Exposes `onMenuToggle` to child components (e.g. AdminHeader) */
export const AdminMobileMenuContext = createContext({ onMenuToggle: () => {} });

/**
 * @param {object} props
 * @param {React.ReactNode} props.children — page content rendered in main area
 * @param {object}          [props.sidebarProps] — forwarded to AdminSidebar
 */
export function AdminLayout({ children, sidebarProps }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AdminMobileMenuContext.Provider value={{ onMenuToggle: () => setSidebarOpen(true) }}>
      <div className="flex h-screen bg-background">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        <AdminSidebar
          {...sidebarProps}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main content */}
        <div className="flex flex-col flex-1 min-w-0 lg:ml-60">
          {/* Mobile header bar with hamburger */}
          <div className="flex items-center h-12 px-4 border-b border-border bg-background lg:hidden shrink-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </AdminMobileMenuContext.Provider>
  );
}
