"use client";

import type { EmailTemplateEntry, EmailTemplateKey, EmailTemplates } from "@uptool/services";
import * as React from "react";
import type { EmailTemplateStrings } from "./strings";

const INPUT =
  "w-full rounded-[6px] border border-[hsl(214_32%_91%)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] placeholder:text-[hsl(var(--muted-foreground))] placeholder:opacity-60";

type ResolvedTemplates = Record<EmailTemplateKey, EmailTemplateEntry>;

interface Props {
  orgSlug: string;
  initial: ResolvedTemplates;
  s: EmailTemplateStrings;
  onSave: (orgSlug: string, data: EmailTemplates) => Promise<void>;
}

// The set of template sections rendered. Only "decline" is wired up now; add a
// row here (plus a default in the service) to surface another template type.
const SECTIONS: Array<{
  key: EmailTemplateKey;
  title: (s: EmailTemplateStrings) => string;
  description: (s: EmailTemplateStrings) => string;
}> = [
  {
    key: "decline",
    title: (s) => s.declineTitle,
    description: (s) => s.declineDescription,
  },
];

export function EmailTemplatesForm({ orgSlug, initial, s, onSave }: Props) {
  const [data, setData] = React.useState<ResolvedTemplates>(initial);
  const [isDirty, setIsDirty] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [toast, setToast] = React.useState<string | null>(null);
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function setField(key: EmailTemplateKey, field: keyof EmailTemplateEntry, value: string) {
    setData((d) => ({ ...d, [key]: { ...d[key], [field]: value } }));
    setIsDirty(true);
  }

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }

  function handleSave() {
    startTransition(() =>
      onSave(orgSlug, data).then(() => {
        setIsDirty(false);
        showToast(s.saved);
      }),
    );
  }

  function handleReset() {
    setData(initial);
    setIsDirty(false);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[hsl(var(--foreground))]">{s.pageTitle}</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{s.pageSubtitle}</p>
      </div>

      {SECTIONS.map(({ key, title, description }) => (
        <section
          key={key}
          className="mb-6 rounded-lg border border-[hsl(var(--border))] bg-white p-5"
        >
          <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">{title(s)}</h2>
          <p className="mt-0.5 mb-4 text-xs text-[hsl(var(--muted-foreground))]">
            {description(s)}
          </p>

          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-medium text-[hsl(var(--foreground))]">
              {s.subjectLabel}
            </span>
            <input
              className={INPUT}
              value={data[key].subject}
              onChange={(e) => setField(key, "subject", e.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[hsl(var(--foreground))]">
              {s.bodyLabel}
            </span>
            <textarea
              className={`${INPUT} h-56 resize-y font-[inherit] leading-relaxed`}
              value={data[key].body}
              onChange={(e) => setField(key, "body", e.target.value)}
            />
          </label>

          <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{s.tokensHint}</p>
        </section>
      ))}

      <div className="flex items-center justify-end gap-3">
        {toast && <span className="text-sm text-green-600">{toast}</span>}
        <button
          type="button"
          onClick={handleReset}
          disabled={!isDirty || pending}
          className="rounded-md border border-[hsl(var(--border))] px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(0_0%_96%)] disabled:opacity-50"
        >
          {s.reset}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || pending}
          className="rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary)/0.9)] disabled:opacity-50"
        >
          {pending ? s.saving : s.save}
        </button>
      </div>
    </div>
  );
}
