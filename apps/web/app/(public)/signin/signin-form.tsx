"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, Input, Label } from "@uptool/ui";
import { signIn } from "next-auth/react";

export function SignInForm() {
  const t = useTranslations("auth.signin");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await signIn("resend", { email, redirect: false });
    if (result?.error) {
      setError(result.error);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  if (sent) {
    return <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("magic_link_sent")}</p>;
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleEmailSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("email_label")}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "…" : t("submit")}
        </Button>
        {error && (
          <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>
        )}
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[hsl(var(--border))]" />
        </div>
        <div className="relative flex justify-center text-xs text-[hsl(var(--muted-foreground))]">
          <span className="bg-white px-2">or</span>
        </div>
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => signIn("google", { callbackUrl: "/" })}
      >
        {t("google")}
      </Button>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => signIn("microsoft-entra-id", { callbackUrl: "/" })}
      >
        {t("microsoft")}
      </Button>
    </div>
  );
}
