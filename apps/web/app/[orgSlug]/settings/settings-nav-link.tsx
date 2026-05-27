"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@uptool/ui";

interface Props {
  href: string;
  label: string;
}

export function SettingsNavLink({ href, label }: Props) {
  const pathname = usePathname();
  const active = pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        "block rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-[hsl(var(--accent))] text-[hsl(var(--primary))] font-medium"
          : "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]",
      )}
    >
      {label}
    </Link>
  );
}
