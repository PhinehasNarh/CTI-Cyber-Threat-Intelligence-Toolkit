import { useState, useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { getWorkspaces, activeWorkspace } from "../api/client";
import {
  LayoutDashboard,
  Newspaper,
  Shield,
  Activity,
  Bell,
  Target,
  Clock,
  Users,
  Crosshair,
  Siren,
  ScrollText,
  ClipboardList,
  FileText,
  Share2,
  Trophy,
  Clapperboard,
  Archive,
  NotebookPen,
  LayoutGrid,
  Boxes,
  MessageSquare,
  BadgeCheck,
  Globe,
  Flame,
  Building2,
  ServerCog,
  KeyRound,
  CalendarClock,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/my-dashboard", icon: LayoutGrid, label: "My Dashboard" },
  { to: "/assistant", icon: MessageSquare, label: "Assistant" },
  { to: "/feed", icon: Newspaper, label: "News Feed" },
  { to: "/clusters", icon: Boxes, label: "Clusters" },
  { to: "/iocs", icon: Shield, label: "IOC Explorer" },
  { to: "/graph", icon: Share2, label: "Correlation Graph" },
  { to: "/actors", icon: Users, label: "Threat Actors" },
  { to: "/campaigns", icon: Crosshair, label: "Campaigns" },
  { to: "/triage", icon: ClipboardList, label: "Triage Queue" },
  { to: "/workbench", icon: NotebookPen, label: "Workbench" },
  { to: "/watchlist", icon: Bell, label: "Watchlist" },
  { to: "/honeypot", icon: Flame, label: "Honeypot" },
  { to: "/alerts", icon: Siren, label: "Alert Rules" },
  { to: "/ctlogs", icon: BadgeCheck, label: "CT Logs" },
  { to: "/attack", icon: Target, label: "ATT&CK Map" },
  { to: "/timeline", icon: Clock, label: "Timeline" },
  { to: "/timelapse", icon: Clapperboard, label: "Time-Lapse" },
  { to: "/map", icon: Globe, label: "World Map" },
  { to: "/digest", icon: FileText, label: "Digest" },
  { to: "/audit", icon: ScrollText, label: "Audit Log" },
  { to: "/leaderboard", icon: Trophy, label: "Leaderboard" },
  { to: "/retention", icon: Archive, label: "Data Retention" },
  { to: "/integrations", icon: ServerCog, label: "Integrations" },
  { to: "/api-keys", icon: KeyRound, label: "API Keys" },
  { to: "/scheduler", icon: CalendarClock, label: "Feed Scheduler" },
  { to: "/workspaces", icon: Building2, label: "Workspaces" },
];

export default function Layout() {
  const [workspaces, setWorkspaces] = useState([]);
  const [current, setCurrent] = useState(activeWorkspace());

  useEffect(() => {
    getWorkspaces().then((r) => setWorkspaces(r.workspaces ?? [])).catch(() => {});
  }, []);

  function switchWorkspace(id) {
    localStorage.setItem("cti-workspace", String(id));
    setCurrent(String(id));
    // Reload so every page refetches scoped to the new workspace
    window.location.reload();
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-cti-surface border-r border-cti-border flex flex-col">
        {/* Logo */}
        <div className="p-5 border-b border-cti-border">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-cti-green shadow-[0_0_12px_#00ff8766] animate-pulse-dot" />
            <span className="text-[10px] text-gray-500 tracking-[3px] uppercase">
              Active
            </span>
          </div>
          <h1 className="font-display text-lg font-bold bg-gradient-to-r from-cti-green to-cti-blue bg-clip-text text-transparent">
            CTI Platform
          </h1>
        </div>

        {/* Workspace switcher (#34) */}
        {workspaces.length > 0 && (
          <div className="px-3 pt-3">
            <label className="block text-[9px] text-gray-600 uppercase tracking-[2px] mb-1 px-1">Workspace</label>
            <select
              value={current}
              onChange={(e) => switchWorkspace(e.target.value)}
              className="w-full bg-cti-bg border border-cti-border rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-cti-green/50"
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-cti-green/10 text-cti-green border border-cti-green/20"
                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-transparent"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-cti-border">
          <div className="flex items-center gap-2 text-gray-500 text-xs">
            <Activity size={14} />
            <span>v0.1.0</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-cti-bg p-6">
        <Outlet />
      </main>
    </div>
  );
}
