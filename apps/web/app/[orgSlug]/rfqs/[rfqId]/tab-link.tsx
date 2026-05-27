"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@uptool/ui";

interface Props {
  href: string;
  label: string;
}

export function TabLink({ href, label }: Props) {
  const pathname = usePathname();
  const active = pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
        active
          ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]"
          : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:border-[hsl(var(--foreground))]",
      )}
    >
      {label}
    </Link>
  );
}
