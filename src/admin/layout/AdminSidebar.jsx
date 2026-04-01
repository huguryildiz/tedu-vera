// src/admin/layout/AdminSidebar.jsx
// ============================================================
// Premium dark sidebar for admin panel.
// Navigation organized into five sections:
//   Overview      — standalone
//   Evaluation    — Rankings, Analytics, Heatmap, Reviews
//   Manage        — Jurors, Projects, Periods
//   Configuration — Evaluation Criteria, Outcomes & Mapping
//   System        — Entry Control, PIN Blocking, Audit Log, Settings
// ============================================================

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Users,
  FolderKanban,
  Calendar,
  Shield,
  ScrollText,
  Settings,
  ChevronDown,
  LayoutDashboard,
  Sun,
  Moon,
  Lock,
  CheckCircle,
} from "lucide-react";
import veraLogo from "../../assets/vera_logo.png";
import { useTheme } from "../../shared/theme/ThemeProvider";
import SidebarProfileMenu from "../components/SidebarProfileMenu";

// ---------------------------------------------------------------------------
// Navigation configuration
// ---------------------------------------------------------------------------

const NAV_SECTIONS = [
  {
    label: "Overview",
    items: [
      { id: "overview", label: "Overview", icon: LayoutDashboard },
    ],
  },
  {
    label: "Evaluation",
    items: [
      { id: "rankings", label: "Rankings", icon: BarChart3 },
      { id: "analytics", label: "Analytics", icon: BarChart3 },
      { id: "heatmap", label: "Heatmap", icon: BarChart3 },
      { id: "reviews", label: "Reviews", icon: ScrollText },
    ],
  },
  {
    label: "Manage",
    items: [
      { id: "jurors", label: "Jurors", icon: Users },
      { id: "projects", label: "Projects", icon: FolderKanban },
      { id: "periods", label: "Periods", icon: Calendar },
    ],
  },
  {
    label: "Configuration",
    items: [
      { id: "criteria", label: "Evaluation Criteria", icon: Settings },
      { id: "outcomes", label: "Outcomes & Mapping", icon: CheckCircle },
    ],
  },
  {
    label: "System",
    items: [
      { id: "entry-control", label: "Entry Control", icon: Shield },
      { id: "pin-lock", label: "PIN Blocking", icon: Lock },
      { id: "audit-log", label: "Audit Log", icon: ScrollText },
      { id: "settings", label: "Settings", icon: Settings },
    ],
  },
];

// Map tab IDs to section navigation IDs
const TAB_TO_NAV_ID = {
  overview: "overview",
  scores: "rankings", // scores tab displays under Evaluation > Rankings
  jurors: "jurors",
  projects: "projects",
  periods: "periods",
  criteria: "criteria",
  outcomes: "outcomes",
  "entry-control": "entry-control",
  "pin-lock": "pin-lock",
  "audit-log": "audit-log",
  settings: "settings",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SidebarBrand() {
  return (
    <div className="flex items-center gap-3 px-4 py-4 border-b border-white/5">
      <img src={veraLogo} alt="" className="w-8 h-8 shrink-0 rounded-lg" aria-hidden="true" />
      <div className="flex flex-col min-w-0">
        <span className="text-lg font-bold tracking-tight text-blue-300">VERA</span>
      </div>
    </div>
  );
}

function NavSection({ section, adminTab, scoresView, onNavigate, onScoresViewChange }) {
  const sectionItemIds = section.items.map((i) => i.id);
  const isSectionActive = sectionItemIds.some((id) => {
    if (adminTab === "scores") return id === "rankings";
    return id === TAB_TO_NAV_ID[adminTab];
  });
  const [isOpen, setIsOpen] = useState(isSectionActive);
  const open = isOpen || isSectionActive;

  // Overview section is not collapsible
  if (section.label === "Overview") {
    return (
      <div className="px-2">
        {section.items.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors mb-1",
              adminTab === item.id
                ? "bg-blue-500/15 text-blue-300"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            )}
          >
            <item.icon className="w-4 h-4 flex-shrink-0 opacity-70" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setIsOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors"
      >
        <span>{section.label}</span>
        <ChevronDown
          className={cn("w-3 h-3 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="px-2 pb-2">
          {section.items.map((item) => {
            const isActive = adminTab === "scores"
              ? item.id === "rankings"
              : item.id === TAB_TO_NAV_ID[adminTab];

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === "rankings" && adminTab !== "scores") {
                    onNavigate("scores");
                    onScoresViewChange("rankings");
                  } else if (item.id !== "rankings") {
                    onNavigate(item.id);
                  }
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors mb-1",
                  isActive
                    ? "bg-blue-500/15 text-blue-300"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0 opacity-70" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SidebarFooter({ user, displayName, activeOrganization, isSuper, onLogout }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="px-3 py-3 space-y-2 border-t border-white/5">
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
      >
        {theme === "dark" ? (
          <Sun className="w-4 h-4 flex-shrink-0" />
        ) : (
          <Moon className="w-4 h-4 flex-shrink-0" />
        )}
        <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
      </button>

      <SidebarProfileMenu
        user={user}
        displayName={displayName}
        activeOrganization={activeOrganization}
        isSuper={isSuper}
        onLogout={onLogout}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AdminSidebar({
  adminTab,
  scoresView,
  onNavigate,
  onScoresViewChange,
  activeOrganization,
  organizations,
  onTenantSwitch,
  isSuper,
  user,
  displayName,
  onLogout,
}) {
  return (
    <aside className="w-60 bg-slate-950 border-r border-white/5 flex flex-col fixed left-0 top-0 bottom-0 z-50">
      {/* Header */}
      <SidebarBrand />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-6">
        {NAV_SECTIONS.map((section) => (
          <NavSection
            key={section.label}
            section={section}
            adminTab={adminTab}
            scoresView={scoresView}
            onNavigate={onNavigate}
            onScoresViewChange={onScoresViewChange}
          />
        ))}
      </nav>

      {/* Footer */}
      <SidebarFooter
        user={user}
        displayName={displayName}
        activeOrganization={activeOrganization}
        isSuper={isSuper}
        onLogout={onLogout}
      />
    </aside>
  );
}
