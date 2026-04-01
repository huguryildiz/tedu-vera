// src/admin/layout/AdminLayout.jsx
// ============================================================
// Top-level layout wrapper for the admin panel.
// Combines the premium dark sidebar with the main content area.
// ============================================================

import AdminSidebar from "./AdminSidebar";

/**
 * @param {object} props
 * @param {React.ReactNode} props.children — page content rendered in main area
 * @param {object}          [props.sidebarProps] — forwarded to AdminSidebar (active tab, handlers, etc.)
 */
export function AdminLayout({ children, sidebarProps }) {
  return (
    <div className="flex h-screen">
      <AdminSidebar {...sidebarProps} />
      <main className="flex-1 overflow-auto ml-60">
        {children}
      </main>
    </div>
  );
}
