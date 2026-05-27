"use client";

import { Building2, FileText, LifeBuoy, Settings, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { cn } from "@uptool/ui";
import { Wordmark } from "./wordmark";
import { LanguageSwitcher } from "./language-switcher";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface SidebarProps {
  orgSlug: string;
  newRfqCount?: number;
  navLabels: {
    rfqs: string;
    customers: string;
    settings: string;
    support: string;
    signout: string;
  };
  userEmail: string;
  userName: string;
  locale: "de" | "en-GB";
}

function NavLink({
  href,
  label,
  icon: Icon,
  badge,
  active,
}: NavItem & { active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex items-center h-10 xl:px-3 xl:justify-start justify-center rounded-[var(--radius)] transition-colors",
        active
          ? "text-[hsl(var(--primary))] bg-[hsl(var(--accent))]"
          : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]",
      )}
    >
      {active && (
        <span className="absolute left-0 top-1 bottom-1 w-[3px] bg-[hsl(var(--primary))] rounded-r" />
      )}
      <span className="relative flex-shrink-0 xl:ml-0">
        <Icon className="w-5 h-5" />
        {badge != null && badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white leading-none">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span className="hidden xl:block ml-3 text-sm font-medium">{label}</span>
    </Link>
  );
}

export function Sidebar({ orgSlug, newRfqCount = 0, navLabels, userEmail, userName, locale }: SidebarProps) {
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);

  const initials = (userName || userEmail)
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "U";

  const navItems: NavItem[] = [
    { href: `/${orgSlug}/rfqs`, label: navLabels.rfqs, icon: FileText, badge: newRfqCount },
    { href: `/${orgSlug}/customers`, label: navLabels.customers, icon: Building2 },
  ];

  const bottomItems: NavItem[] = [
    { href: `/${orgSlug}/settings`, label: navLabels.settings, icon: Settings },
    { href: "https://help.toolup.de", label: navLabels.support, icon: LifeBuoy },
  ];

  return (
    <aside className="flex flex-col h-screen border-r border-[hsl(var(--border))] bg-[hsl(var(--sidebar))] w-16 xl:w-60 flex-shrink-0">
      {/* Wordmark */}
      <div className="flex h-16 items-center xl:px-6 justify-center xl:justify-start border-b border-[hsl(var(--border))]">
        <Link href={`/${orgSlug}/rfqs`}>
          <Wordmark size="md" />
        </Link>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            active={pathname.startsWith(item.href)}
          />
        ))}
      </nav>

      {/* Bottom nav */}
      <div className="py-4 px-2 space-y-1 border-t border-[hsl(var(--border))]">
        {bottomItems.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            active={pathname.startsWith(item.href)}
          />
        ))}

        {/* Profile */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen((v) => !v)}
            className="relative flex items-center h-10 w-full xl:px-3 xl:justify-start justify-center rounded-[var(--radius)] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <span className="h-7 w-7 rounded-full bg-[hsl(var(--primary))] text-white flex items-center justify-center text-xs font-medium flex-shrink-0">
              {initials}
            </span>
            <span className="hidden xl:block ml-3 text-sm font-medium truncate">
              {userName || userEmail}
            </span>
          </button>

          {profileOpen && (
            <>
              {/* backdrop */}
              <button
                type="button"
                aria-label="Close menu"
                className="fixed inset-0 z-10"
                onClick={() => setProfileOpen(false)}
              />
              <div className="absolute bottom-full left-0 xl:left-auto xl:right-0 mb-2 w-56 z-20 rounded-[var(--radius)] border border-[hsl(var(--border))] bg-white shadow-lg">
                <div className="px-3 py-2.5 border-b border-[hsl(var(--border))]">
                  <p className="text-xs font-medium truncate">{userName || userEmail}</p>
                  {userName && (
                    <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{userEmail}</p>
                  )}
                </div>
                <div className="px-3 py-2 border-b border-[hsl(var(--border))]">
                  <LanguageSwitcher currentLocale={locale} />
                </div>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  {navLabels.signout}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
