"use client";

import { LayoutDashboard, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@uptool/ui";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface SidebarProps {
  orgSlug: string;
  newRfqCount?: number;
  navLabels: {
    rfqs: string;
    customers: string;
    settings: string;
  };
}

export function Sidebar({ orgSlug, newRfqCount = 0, navLabels }: SidebarProps) {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();

  const navItems: Array<NavItem & { badge?: number }> = [
    { href: `/${orgSlug}/rfqs`, label: navLabels.rfqs, icon: LayoutDashboard, badge: newRfqCount },
    { href: `/${orgSlug}/customers`, label: navLabels.customers, icon: Users },
  ];

  return (
    <aside
      className={cn(
        "flex flex-col h-screen border-r border-[hsl(var(--border))] bg-white transition-all duration-200",
        expanded ? "w-60" : "w-16",
      )}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Logo */}
      <div className="flex h-14 items-center px-4 border-b border-[hsl(var(--border))]">
        <Link href={`/${orgSlug}/rfqs`} className="flex items-center gap-2 font-semibold">
          <div className="w-6 h-6 rounded bg-[hsl(var(--primary))] flex-shrink-0" />
          {expanded && <span className="text-sm">Uptool</span>}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-1 px-2">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-2 py-2 rounded-[var(--radius)] text-sm transition-colors",
                active
                  ? "bg-[hsl(var(--accent))] text-[hsl(var(--primary))] font-medium"
                  : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]",
              )}
            >
              <span className="relative flex-shrink-0">
                <item.icon className="w-5 h-5" />
                {item.badge != null && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white leading-none">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </span>
              {expanded && <span>{item.label}</span>}
              {expanded && item.badge != null && item.badge > 0 && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1.5 text-[10px] font-bold text-white">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Settings */}
      <div className="py-3 px-2 border-t border-[hsl(var(--border))]">
        <Link
          href={`/${orgSlug}/settings`}
          className={cn(
            "flex items-center gap-3 px-2 py-2 rounded-[var(--radius)] text-sm transition-colors",
            pathname.startsWith(`/${orgSlug}/settings`)
              ? "bg-[hsl(var(--accent))] text-[hsl(var(--primary))] font-medium"
              : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]",
          )}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          {expanded && <span>{navLabels.settings}</span>}
        </Link>
      </div>
    </aside>
  );
}
