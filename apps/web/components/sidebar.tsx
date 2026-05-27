"use client";

import { Building2, FileText, LifeBuoy, Settings, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { cn } from "@uptool/ui";
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
    profile: string;
  };
  userEmail: string;
  userName: string;
  locale: "de" | "en-GB";
}

function NavTile({
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
        "flex flex-col items-center justify-center h-14 w-full gap-1 rounded-md transition-colors",
        active ? "hover:bg-[hsl(215_81%_93%)]" : "hover:bg-[hsl(0_0%_96%)]",
      )}
    >
      <div className="relative">
        <div
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-[8px]",
            active && "bg-[hsl(215_81%_96%)]",
          )}
        >
          <Icon
            className={cn(
              "w-6 h-6",
              active
                ? "text-[hsl(var(--primary))]"
                : "text-[hsl(var(--muted-foreground))]",
            )}
          />
        </div>
        {badge != null && badge > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[hsl(var(--primary))] px-0.5 text-[10px] font-bold text-white leading-none shadow-sm">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </div>
      <span
        className={cn(
          "text-[11px]",
          active
            ? "font-semibold text-[hsl(var(--primary))]"
            : "font-medium text-[hsl(var(--muted-foreground))]",
        )}
      >
        {label}
      </span>
    </Link>
  );
}

export function Sidebar({
  orgSlug,
  newRfqCount = 0,
  navLabels,
  userEmail,
  userName,
  locale,
}: SidebarProps) {
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);

  const initial = (userName || userEmail)
    .split(/[\s@]/)
    .filter(Boolean)[0]?.[0]
    ?.toUpperCase() ?? "U";

  const navItems: NavItem[] = [
    { href: `/${orgSlug}/rfqs`, label: navLabels.rfqs, icon: FileText, badge: newRfqCount },
    { href: `/${orgSlug}/customers`, label: navLabels.customers, icon: Building2 },
  ];

  const bottomItems: NavItem[] = [
    { href: `/${orgSlug}/settings`, label: navLabels.settings, icon: Settings },
    { href: "https://help.toolup.de", label: navLabels.support, icon: LifeBuoy },
  ];

  return (
    <aside className="flex flex-col h-screen w-[72px] shrink-0 border-r border-[hsl(var(--border))] bg-[hsl(var(--sidebar))]">
      {/* Brand glyph */}
      <div className="flex flex-col items-center py-4">
        <Link
          href={`/${orgSlug}/rfqs`}
          className="flex flex-col items-center gap-1"
        >
          <div
            className="w-8 h-8 rounded-[6px] bg-[hsl(var(--primary))] flex items-center justify-center"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            <span className="text-white font-bold text-[14px] leading-none select-none">
              TU
            </span>
          </div>
          <span className="text-[10px] tracking-wide text-[hsl(var(--muted-foreground))] select-none">
            toolup
          </span>
        </Link>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 px-1 space-y-2 pt-2">
        {navItems.map((item) => (
          <NavTile
            key={item.href}
            {...item}
            active={pathname.startsWith(item.href)}
          />
        ))}
      </nav>

      {/* Bottom section */}
      <div className="px-1 pb-4">
        <div className="border-t border-[hsl(214_32%_91%)] my-3" />
        <div className="space-y-2">
          {bottomItems.map((item) => (
            <NavTile
              key={item.href}
              {...item}
              active={pathname.startsWith(item.href)}
            />
          ))}

          {/* Profile tile */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className="flex flex-col items-center justify-center h-14 w-full gap-1 rounded-md hover:bg-[hsl(0_0%_96%)] transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[hsl(var(--primary))] text-white flex items-center justify-center text-sm font-medium">
                {initial}
              </div>
              <span className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
                {navLabels.profile}
              </span>
            </button>

            {profileOpen && (
              <>
                <button
                  type="button"
                  aria-label="Close menu"
                  className="fixed inset-0 z-10"
                  onClick={() => setProfileOpen(false)}
                />
                <div className="absolute bottom-0 left-full ml-2 w-56 z-20 rounded-[var(--radius)] border border-[hsl(var(--border))] bg-white shadow-lg">
                  <div className="px-3 py-2.5 border-b border-[hsl(var(--border))]">
                    <p className="text-xs font-medium truncate">
                      {userName || userEmail}
                    </p>
                    {userName && (
                      <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                        {userEmail}
                      </p>
                    )}
                  </div>
                  <div className="px-3 py-2 border-b border-[hsl(var(--border))]">
                    <LanguageSwitcher currentLocale={locale} />
                  </div>
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors rounded-b-[var(--radius)]"
                  >
                    <LogOut className="w-4 h-4" />
                    {navLabels.signout}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
