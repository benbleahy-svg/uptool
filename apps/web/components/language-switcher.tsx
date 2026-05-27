"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@uptool/ui";

type Locale = "de" | "en-GB";

const LOCALE_LABELS: Record<Locale, string> = {
  de: "DE",
  "en-GB": "EN",
};

interface LanguageSwitcherProps {
  currentLocale: Locale;
  className?: string;
}

export function LanguageSwitcher({ currentLocale, className }: LanguageSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function switchLocale(locale: Locale) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("locale", locale);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className={cn("flex items-center gap-1 text-sm", className)}>
      {(["de", "en-GB"] as Locale[]).map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => switchLocale(locale)}
          className={cn(
            "px-2 py-1 rounded text-xs font-medium transition-colors",
            currentLocale === locale
              ? "bg-[hsl(var(--accent))] text-[hsl(var(--primary))]"
              : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]",
          )}
        >
          {LOCALE_LABELS[locale]}
        </button>
      ))}
    </div>
  );
}
