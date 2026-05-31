"use client";

import type { DocTemplate } from "@/lib/quoting/quote-doc";
import type { LegalForm, QuoteTemplateInput } from "@uptool/services";
import { ChevronDown, Plus, Trash2, Upload } from "lucide-react";
import dynamic from "next/dynamic";
import * as React from "react";
import type { TemplateStrings } from "./strings";

const TemplatePreview = dynamic(
  () => import("./template-preview").then((m) => m.TemplatePreview),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[680px] items-center justify-center rounded-md border border-[hsl(var(--border))] bg-gray-100 text-sm text-[hsl(var(--muted-foreground))]">
        Loading preview…
      </div>
    ),
  },
);

/** Read a File as a data URI (for inline preview without a round-trip). */
function readDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const INPUT =
  "w-full rounded-[6px] border border-[hsl(214_32%_91%)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] placeholder:text-[hsl(var(--muted-foreground))] placeholder:opacity-60";
const SELECT =
  "w-full rounded-[6px] border border-[hsl(214_32%_91%)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]";

const LEGAL_FORM_ORDER: LegalForm[] = [
  "sole_trader",
  "eK",
  "GbR",
  "GmbH",
  "UG",
  "AG",
  "GmbH_Co_KG",
  "OHG",
  "KG",
  "other",
];

// Legal forms entered in a commercial register (Handelsregister) → show
// Register Court / Number. Sole traders, GbR, and "other" are not registered.
const REGISTERED_FORMS = new Set<LegalForm>(["eK", "GmbH", "UG", "AG", "GmbH_Co_KG", "OHG", "KG"]);

/** Loose IBAN check: 2 country letters + 2 check digits + 11–30 alphanumerics. */
function isLooseIban(value: string): boolean {
  const v = value.replace(/\s+/g, "").toUpperCase();
  return /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(v);
}

interface Props {
  orgSlug: string;
  initial: QuoteTemplateInput;
  initialLogoDataUri: string | null;
  initialFooterLogos: { key: string; dataUri: string }[];
  s: TemplateStrings;
  onSave: (orgSlug: string, data: QuoteTemplateInput) => Promise<void>;
  onUploadLogo: (fd: FormData) => Promise<string>;
  onRemoveLogo: (fd: FormData) => Promise<void>;
  onUploadFooterLogo: (fd: FormData) => Promise<{ key: string; url: string }>;
  onRemoveFooterLogo: (fd: FormData) => Promise<void>;
}

export function QuoteTemplateForm({
  orgSlug,
  initial,
  initialLogoDataUri,
  initialFooterLogos,
  s,
  onSave,
  onUploadLogo,
  onRemoveLogo,
  onUploadFooterLogo,
  onRemoveFooterLogo,
}: Props) {
  const [data, setData] = React.useState<QuoteTemplateInput>(initial);
  const [logoDataUri, setLogoDataUri] = React.useState<string | null>(initialLogoDataUri);
  const [footerLogos, setFooterLogos] =
    React.useState<{ key: string; dataUri: string }[]>(initialFooterLogos);
  const [isDirty, setIsDirty] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [busy, setBusy] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoRef = React.useRef<HTMLInputElement>(null);
  const footerRef = React.useRef<HTMLInputElement>(null);

  function set<K extends keyof QuoteTemplateInput>(key: K, value: QuoteTemplateInput[K]) {
    setData((d) => ({ ...d, [key]: value }));
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
    setLogoDataUri(initialLogoDataUri);
    setFooterLogos(initialFooterLogos);
    setIsDirty(false);
    if (logoRef.current) logoRef.current.value = "";
  }

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || file.size > 1024 * 1024) return;
    // Inline immediately for the preview; persist in parallel.
    setLogoDataUri(await readDataUri(file));
    const fd = new FormData();
    fd.set("orgSlug", orgSlug);
    fd.set("logo", file);
    setBusy(true);
    onUploadLogo(fd).finally(() => setBusy(false));
  }

  function handleRemoveLogo() {
    const fd = new FormData();
    fd.set("orgSlug", orgSlug);
    setBusy(true);
    onRemoveLogo(fd)
      .then(() => {
        setLogoDataUri(null);
        if (logoRef.current) logoRef.current.value = "";
      })
      .finally(() => setBusy(false));
  }

  async function handleFooterLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || file.size > 1024 * 1024) return;
    const dataUri = await readDataUri(file);
    const fd = new FormData();
    fd.set("orgSlug", orgSlug);
    fd.set("logo", file);
    setBusy(true);
    onUploadFooterLogo(fd)
      .then(({ key }) => setFooterLogos((prev) => [...prev, { key, dataUri }]))
      .finally(() => {
        setBusy(false);
        if (footerRef.current) footerRef.current.value = "";
      });
  }

  function handleRemoveFooterLogo(key: string) {
    const fd = new FormData();
    fd.set("orgSlug", orgSlug);
    fd.set("key", key);
    setBusy(true);
    onRemoveFooterLogo(fd)
      .then(() => setFooterLogos((prev) => prev.filter((f) => f.key !== key)))
      .finally(() => setBusy(false));
  }

  const showRegister = REGISTERED_FORMS.has(data.legalForm);

  // The exact DocTemplate the Send page would render, from the live form state.
  const previewTemplate: DocTemplate = {
    ...data,
    logoDataUri,
    footerLogoUris: footerLogos.map((f) => f.dataUri),
  };

  return (
    <div className="pb-24">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">{s.pageTitle}</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{s.pageSubtitle}</p>
      </div>

      <div className="flex gap-6">
        <div className="min-w-0 max-w-2xl flex-1 space-y-4">
        {/* 1 — Logo & Letterhead */}
        <Section title={s.sLogo}>
          <div className="flex items-center gap-4">
            {logoDataUri ? (
              <img
                src={logoDataUri}
                alt="logo"
                className="h-16 w-16 rounded-md border border-[hsl(var(--border))] object-contain"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]">
                <Upload className="h-5 w-5" />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => logoRef.current?.click()}
                  className="rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm hover:bg-[hsl(0_0%_96%)] disabled:opacity-50"
                >
                  {s.logoUpload}
                </button>
                {logoDataUri && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleRemoveLogo}
                    className="text-sm text-red-500 hover:underline disabled:opacity-50"
                  >
                    {s.logoRemove}
                  </button>
                )}
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{s.logoHint}</p>
            </div>
            <input
              ref={logoRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              className="hidden"
              onChange={handleLogo}
            />
          </div>
          <Field label={s.slogan}>
            <input
              className={INPUT}
              value={data.slogan}
              placeholder={s.sloganPlaceholder}
              onChange={(e) => set("slogan", e.target.value)}
            />
          </Field>
        </Section>

        {/* 2 — Sender & Company */}
        <Section title={s.sSender}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Field label={s.companyName}>
              <input
                className={INPUT}
                value={data.companyName}
                onChange={(e) => set("companyName", e.target.value)}
              />
            </Field>
            <Field label={s.legalForm}>
              <select
                className={SELECT}
                value={data.legalForm}
                onChange={(e) => set("legalForm", e.target.value as LegalForm)}
              >
                {LEGAL_FORM_ORDER.map((lf) => (
                  <option key={lf} value={lf}>
                    {s.legalForms[lf]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={s.street}>
            <input
              className={INPUT}
              value={data.street}
              onChange={(e) => set("street", e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label={s.postalCode}>
              <input
                className={INPUT}
                value={data.postalCode}
                onChange={(e) => set("postalCode", e.target.value)}
              />
            </Field>
            <div className="col-span-2">
              <Field label={s.city}>
                <input
                  className={INPUT}
                  value={data.city}
                  onChange={(e) => set("city", e.target.value)}
                />
              </Field>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label={s.country}>
              <input
                className={INPUT}
                value={data.country}
                onChange={(e) => set("country", e.target.value)}
              />
            </Field>
            <Field label={s.senderPlace} hint={s.senderPlaceHint}>
              <input
                className={INPUT}
                value={data.senderPlace}
                onChange={(e) => set("senderPlace", e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label={s.phone}>
              <input
                className={INPUT}
                value={data.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </Field>
            <Field label={s.fax}>
              <input className={INPUT} value={data.fax} onChange={(e) => set("fax", e.target.value)} />
            </Field>
            <Field label={s.email}>
              <input
                className={INPUT}
                type="email"
                value={data.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
            <Field label={s.website}>
              <input
                className={INPUT}
                value={data.website}
                onChange={(e) => set("website", e.target.value)}
              />
            </Field>
          </div>
        </Section>

        {/* 3 — Tax & Currency */}
        <Section title={s.sTax}>
          <div className="grid grid-cols-2 gap-4">
            <Field label={s.localeLabel}>
              <select
                className={SELECT}
                value={data.locale}
                onChange={(e) => set("locale", e.target.value)}
              >
                {s.localeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={s.currency}>
              <select
                className={SELECT}
                value={data.currency}
                onChange={(e) => set("currency", e.target.value)}
              >
                {s.currencyOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={s.vatRate}>
              <input
                className={INPUT}
                type="number"
                min="0"
                step="0.1"
                value={String(data.vatRate)}
                onChange={(e) => set("vatRate", Number.parseFloat(e.target.value) || 0)}
              />
            </Field>
            <Field label={s.reducedVatRate}>
              <input
                className={INPUT}
                type="number"
                min="0"
                step="0.1"
                value={String(data.reducedVatRate)}
                onChange={(e) => set("reducedVatRate", Number.parseFloat(e.target.value) || 0)}
              />
            </Field>
          </div>
          <label className="mt-1 flex items-start gap-2">
            <input
              type="checkbox"
              checked={data.smallBusiness}
              onChange={(e) => set("smallBusiness", e.target.checked)}
              className="mt-0.5 accent-[hsl(var(--primary))]"
            />
            <span className="text-sm">
              {s.smallBusiness}
              <span className="block text-xs text-[hsl(var(--muted-foreground))]">
                {s.smallBusinessHint}
              </span>
            </span>
          </label>
        </Section>

        {/* 4 — Quote Text */}
        <Section title={s.sQuoteText}>
          <Field label={s.subjectTemplate} hint={s.subjectHint}>
            <input
              className={INPUT}
              value={data.subjectTemplate}
              onChange={(e) => set("subjectTemplate", e.target.value)}
            />
          </Field>
          <Field label={s.introText}>
            <textarea
              className={`${INPUT} min-h-[88px] resize-y`}
              value={data.introText}
              onChange={(e) => set("introText", e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={s.closingText}>
              <input
                className={INPUT}
                value={data.closingText}
                onChange={(e) => set("closingText", e.target.value)}
              />
            </Field>
            <Field label={s.validityDays}>
              <input
                className={INPUT}
                type="number"
                min="0"
                value={String(data.validityDays)}
                onChange={(e) => set("validityDays", Number.parseInt(e.target.value, 10) || 0)}
              />
            </Field>
          </div>
        </Section>

        {/* 5 — Terms */}
        <Section title={s.sTerms}>
          <div className="grid grid-cols-2 gap-4">
            <Field label={s.deliveryTerms}>
              <input
                className={INPUT}
                value={data.deliveryTerms}
                onChange={(e) => set("deliveryTerms", e.target.value)}
              />
            </Field>
            <Field label={s.paymentTerms}>
              <input
                className={INPUT}
                value={data.paymentTerms}
                onChange={(e) => set("paymentTerms", e.target.value)}
              />
            </Field>
          </div>
        </Section>

        {/* 6 — Contacts */}
        <Section title={s.sContacts}>
          <Repeatable
            rows={data.contacts}
            empty={s.noContacts}
            addLabel={s.addContact}
            onAdd={() =>
              set("contacts", [...data.contacts, { roleLabel: "", name: "", phone: "", email: "" }])
            }
            onRemove={(i) =>
              set(
                "contacts",
                data.contacts.filter((_, idx) => idx !== i),
              )
            }
            render={(c, i) => (
              <div className="grid flex-1 grid-cols-2 gap-2">
                <input
                  className={INPUT}
                  placeholder={s.contactRole}
                  value={c.roleLabel}
                  onChange={(e) => updateRow(data.contacts, i, "roleLabel", e.target.value, (v) => set("contacts", v))}
                />
                <input
                  className={INPUT}
                  placeholder={s.contactName}
                  value={c.name}
                  onChange={(e) => updateRow(data.contacts, i, "name", e.target.value, (v) => set("contacts", v))}
                />
                <input
                  className={INPUT}
                  placeholder={s.contactPhone}
                  value={c.phone}
                  onChange={(e) => updateRow(data.contacts, i, "phone", e.target.value, (v) => set("contacts", v))}
                />
                <input
                  className={INPUT}
                  placeholder={s.contactEmail}
                  value={c.email}
                  onChange={(e) => updateRow(data.contacts, i, "email", e.target.value, (v) => set("contacts", v))}
                />
              </div>
            )}
          />
        </Section>

        {/* 7 — Terms & Conditions */}
        <Section title={s.sTermsConditions}>
          <textarea
            className={`${INPUT} min-h-[160px] resize-y font-[inherit]`}
            value={data.termsText}
            onChange={(e) => set("termsText", e.target.value)}
          />
        </Section>

        {/* 8 — Legal Footer */}
        <Section title={s.sLegal}>
          <p className="mb-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">{s.legalHint}</p>
          <Field label={s.managingDirectors}>
            <Repeatable
              rows={data.managingDirectors}
              addLabel={s.addDirector}
              onAdd={() => set("managingDirectors", [...data.managingDirectors, ""])}
              onRemove={(i) =>
                set(
                  "managingDirectors",
                  data.managingDirectors.filter((_, idx) => idx !== i),
                )
              }
              render={(name, i) => (
                <input
                  className={`${INPUT} flex-1`}
                  placeholder={s.directorName}
                  value={name}
                  onChange={(e) => {
                    const next = [...data.managingDirectors];
                    next[i] = e.target.value;
                    set("managingDirectors", next);
                  }}
                />
              )}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            {showRegister && (
              <>
                <Field label={s.registerCourt}>
                  <input
                    className={INPUT}
                    value={data.registerCourt}
                    onChange={(e) => set("registerCourt", e.target.value)}
                  />
                </Field>
                <Field label={s.registerNumber}>
                  <input
                    className={INPUT}
                    value={data.registerNumber}
                    onChange={(e) => set("registerNumber", e.target.value)}
                  />
                </Field>
              </>
            )}
            <Field label={s.jurisdiction}>
              <input
                className={INPUT}
                value={data.jurisdiction}
                onChange={(e) => set("jurisdiction", e.target.value)}
              />
            </Field>
            <Field label={s.taxNumber}>
              <input
                className={INPUT}
                value={data.taxNumber}
                onChange={(e) => set("taxNumber", e.target.value)}
              />
            </Field>
            <Field label={s.vatId}>
              <input
                className={INPUT}
                value={data.vatId}
                onChange={(e) => set("vatId", e.target.value)}
              />
            </Field>
          </div>
        </Section>

        {/* 9 — Bank Accounts */}
        <Section title={s.sBank}>
          <Repeatable
            rows={data.bankAccounts}
            empty={s.noBanks}
            addLabel={s.addBank}
            onAdd={() =>
              set("bankAccounts", [...data.bankAccounts, { bankName: "", iban: "", bic: "" }])
            }
            onRemove={(i) =>
              set(
                "bankAccounts",
                data.bankAccounts.filter((_, idx) => idx !== i),
              )
            }
            render={(b, i) => {
              const ibanBad = b.iban.trim() !== "" && !isLooseIban(b.iban);
              return (
                <div className="grid flex-1 grid-cols-3 gap-2">
                  <input
                    className={INPUT}
                    placeholder={s.bankName}
                    value={b.bankName}
                    onChange={(e) => updateRow(data.bankAccounts, i, "bankName", e.target.value, (v) => set("bankAccounts", v))}
                  />
                  <div>
                    <input
                      className={`${INPUT} ${ibanBad ? "border-red-400" : ""}`}
                      placeholder={s.iban}
                      value={b.iban}
                      onChange={(e) => updateRow(data.bankAccounts, i, "iban", e.target.value, (v) => set("bankAccounts", v))}
                    />
                    {ibanBad && <p className="mt-1 text-xs text-red-500">{s.ibanInvalid}</p>}
                  </div>
                  <input
                    className={INPUT}
                    placeholder={s.bic}
                    value={b.bic}
                    onChange={(e) => updateRow(data.bankAccounts, i, "bic", e.target.value, (v) => set("bankAccounts", v))}
                  />
                </div>
              );
            }}
          />
          {/* Optional footer logos */}
          <div className="mt-4 border-t border-[hsl(var(--border))] pt-4">
            <div className="flex flex-wrap items-center gap-3">
              {footerLogos.map((f) => (
                <div key={f.key} className="relative">
                  <img
                    src={f.dataUri}
                    alt="footer logo"
                    className="h-12 w-12 rounded border border-[hsl(var(--border))] object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveFooterLogo(f.key)}
                    aria-label="Remove footer logo"
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-white text-red-500 shadow"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={() => footerRef.current?.click()}
                className="flex h-12 w-12 items-center justify-center rounded border border-dashed border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(0_0%_96%)] disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
              </button>
              <input
                ref={footerRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                className="hidden"
                onChange={handleFooterLogo}
              />
            </div>
          </div>
        </Section>
        </div>

        {/* Live preview — same document the Send page renders, with sample data */}
        <div className="hidden w-[460px] shrink-0 xl:block">
          <div className="sticky top-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              Preview
            </p>
            <TemplatePreview template={previewTemplate} />
          </div>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 right-0 left-0 z-10 flex items-center justify-end gap-3 border-t border-[hsl(var(--border))] bg-white/90 px-8 py-3 backdrop-blur">
        <button
          type="button"
          onClick={handleReset}
          disabled={!isDirty || pending}
          className="rounded-md border border-[hsl(var(--border))] px-4 py-2 text-sm font-medium hover:bg-[hsl(0_0%_96%)] disabled:opacity-40"
        >
          {s.reset}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="rounded-md bg-[hsl(var(--primary))] px-5 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-40"
        >
          {pending ? s.saving : s.save}
        </button>
      </div>

      {toast && (
        <div className="fixed bottom-16 right-8 z-20 rounded-md bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

// Immutably update field `key` of row `i` in `rows`, then push via `commit`.
function updateRow<T>(
  rows: T[],
  i: number,
  key: keyof T,
  value: T[keyof T],
  commit: (next: T[]) => void,
) {
  commit(rows.map((row, idx) => (idx === i ? { ...row, [key]: value } : row)));
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 first:mt-0">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{hint}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(true);
  return (
    <section className="rounded-lg border border-[hsl(var(--border))] bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left"
      >
        <span className="text-sm font-semibold">{title}</span>
        <ChevronDown
          className={`h-4 w-4 text-[hsl(var(--muted-foreground))] transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && <div className="border-t border-[hsl(var(--border))] px-5 py-4">{children}</div>}
    </section>
  );
}

function Repeatable<T>({
  rows,
  empty,
  addLabel,
  onAdd,
  onRemove,
  render,
}: {
  rows: T[];
  empty?: string;
  addLabel: string;
  onAdd: () => void;
  onRemove: (i: number) => void;
  render: (row: T, i: number) => React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      {rows.length === 0 && empty && (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{empty}</p>
      )}
      {rows.map((row, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: row identity is positional
        <div key={i} className="flex items-start gap-2">
          {render(row, i)}
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label="Remove row"
            className="mt-1.5 shrink-0 text-gray-300 hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="mt-1 flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--primary))] hover:underline"
      >
        <Plus className="h-4 w-4" /> {addLabel}
      </button>
    </div>
  );
}
