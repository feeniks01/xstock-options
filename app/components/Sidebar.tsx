"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { 
  TrendingUp, 
  LayoutGrid, 
  Briefcase, 
  // Bell, 
  Settings,
  ChevronsLeft
} from "lucide-react";

interface NavItem {
  name: string;
  icon: React.ReactNode;
  href: string;
  badge?: string;
  disabled?: boolean;
}

const navItems: NavItem[] = [
  {
    name: "Markets",
    href: "/",
    icon: <TrendingUp className="w-5 h-5" />,
  },
  {
    name: "Options Chains",
    href: "/stock",
    icon: <LayoutGrid className="w-5 h-5" />,
  },
  {
    name: "Portfolio",
    href: "/portfolio",
    icon: <Briefcase className="w-5 h-5" />,
  },
  // {
  //   name: "Alerts",
  //   href: "/alerts",
  //   icon: <Bell className="w-5 h-5" />,
  //   badge: "Soon",
  //   disabled: true,
  // },
  {
    name: "Settings",
    href: "/settings",
    icon: <Settings className="w-5 h-5" />,
    disabled: true,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`
        ${collapsed ? "w-16" : "w-56"}
        flex-shrink-0 border-r border-border bg-background/50 backdrop-blur-sm
        transition-all duration-300 ease-in-out
        hidden lg:flex flex-col
      `}
    >
      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="p-3 hover:bg-secondary/50 transition-colors border-b border-border flex items-center justify-center"
        title={collapsed ? "Expand" : "Collapse"}
      >
        <ChevronsLeft 
          className={`w-5 h-5 text-muted-foreground transition-transform ${collapsed ? "rotate-180" : ""}`}
        />
      </button>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Component = item.disabled ? "div" : Link;

          return (
            <Component
              key={item.name}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg
                transition-all duration-200
                ${isActive
                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  : item.disabled
                    ? "text-muted-foreground/50 cursor-not-allowed"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }
              `}
              title={collapsed ? item.name : undefined}
            >
              <span className={isActive ? "text-blue-400" : ""}>{item.icon}</span>
              {!collapsed && (
                <>
                  <span className="font-medium text-sm flex-1">{item.name}</span>
                  {item.badge && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </Component>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-border">
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground/70 mb-1">xOptions v0.1</p>
            <p>On-Chain Options</p>
          </div>
        </div>
      )}
    </aside>
  );
}
