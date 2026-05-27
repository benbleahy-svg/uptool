"use client";

import { useTranslations } from "next-intl";
import { useFormStatus } from "react-dom";
import { Button, Input, Label } from "@uptool/ui";
import { createOrgAction } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("onboarding.new_org");
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "…" : t("submit")}
    </Button>
  );
}

export function NewOrgForm() {
  const t = useTranslations("onboarding.new_org");

  return (
    <form action={createOrgAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">{t("name_label")}</Label>
        <Input id="name" name="name" required minLength={1} maxLength={100} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="country">{t("country_label")}</Label>
        <select
          id="country"
          name="country"
          required
          defaultValue="DE"
          className="flex h-9 w-full rounded-[var(--radius)] border border-[hsl(var(--input))] bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
        >
          <option value="DE">Deutschland</option>
          <option value="AT">Österreich</option>
          <option value="CH">Schweiz</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="locale">{t("locale_label")}</Label>
        <select
          id="locale"
          name="locale"
          required
          defaultValue="de"
          className="flex h-9 w-full rounded-[var(--radius)] border border-[hsl(var(--input))] bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
        >
          <option value="de">Deutsch</option>
          <option value="en-GB">English (UK)</option>
        </select>
      </div>

      <SubmitButton />
    </form>
  );
}
