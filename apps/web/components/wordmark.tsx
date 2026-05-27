import { BRAND } from "@uptool/shared";

const sizes = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-2xl",
} as const;

export function Wordmark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <span
      className={`font-jetbrains-mono font-bold text-[hsl(var(--primary))] ${sizes[size]}`}
      style={{ fontFamily: "var(--font-jetbrains-mono)" }}
    >
      {BRAND.name}
    </span>
  );
}
