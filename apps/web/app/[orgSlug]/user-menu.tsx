"use client";

import { signOut } from "next-auth/react";

interface UserMenuProps {
  userEmail: string;
  userName: string;
  signOutLabel: string;
}

export function UserMenu({ userEmail, userName, signOutLabel }: UserMenuProps) {
  const initials = (userName ?? userEmail)
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="relative group">
      <button
        type="button"
        className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
      >
        <div className="h-8 w-8 rounded-full bg-[hsl(var(--primary))] text-white flex items-center justify-center text-xs font-medium">
          {initials || "U"}
        </div>
      </button>
      <div className="absolute right-0 top-full mt-1 w-48 rounded-[var(--radius)] border border-[hsl(var(--border))] bg-white shadow-md opacity-0 invisible group-focus-within:opacity-100 group-focus-within:visible transition-all">
        <div className="px-3 py-2 border-b border-[hsl(var(--border))]">
          <p className="text-xs font-medium truncate">{userName ?? userEmail}</p>
          {userName && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{userEmail}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="w-full text-left px-3 py-2 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          {signOutLabel}
        </button>
      </div>
    </div>
  );
}
