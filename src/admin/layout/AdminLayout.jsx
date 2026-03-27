// src/admin/layout/AdminLayout.jsx
// ============================================================
// Top-level layout wrapper for the admin panel.
// Combines the sidebar navigation with the main content area
// using shadcn's SidebarProvider for responsive behavior
// (auto-collapses to sheet on mobile via useIsMobile).
// ============================================================

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import AdminSidebar from "./AdminSidebar";

/**
 * @param {object} props
 * @param {React.ReactNode} props.children — page content rendered inside SidebarInset
 * @param {object}          [props.sidebarProps] — forwarded to AdminSidebar (active tab, handlers, etc.)
 * @param {boolean}         [props.defaultOpen=true] — initial sidebar open state on desktop
 */
export function AdminLayout({ children, sidebarProps, defaultOpen = true }) {
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AdminSidebar {...sidebarProps} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
