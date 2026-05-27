"use client";

import { useState, useTransition } from "react";

const INPUT =
  "w-full rounded-[6px] border border-[hsl(214_32%_91%)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] placeholder:text-[hsl(var(--muted-foreground))] placeholder:opacity-60";

const SELECT =
  "w-full rounded-[6px] border border-[hsl(214_32%_91%)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]";

function Label({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium mb-1.5">
      {children}
    </label>
  );
}

function SectionHeading({ children }: { children: string }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-4">
      {children}
    </p>
  );
}

interface Initial {
  name: string;
  vatId: string;
  phone: string;
  website: string;
  street: string;
  postal: string;
  city: string;
  country: "DE" | "AT" | "CH";
  defaultRateEuros: string;
}

interface Labels {
  title: string;
  subtitle: string;
  sectionBusiness: string;
  sectionContact: string;
  sectionAddress: string;
  sectionDefaults: string;
  name: string;
  vatId: string;
  phone: string;
  website: string;
  street: string;
  postal: string;
  city: string;
  country: string;
  countryDe: string;
  countryAt: string;
  countryCh: string;
  defaultRate: string;
  save: string;
}

interface Props {
  orgSlug: string;
  initial: Initial;
  labels: Labels;
  onSave: (fd: FormData) => Promise<void>;
}

export function GeneralForm({ orgSlug, initial, labels, onSave }: Props) {
  const [isDirty, setIsDirty] = useState(false);
  const [isPending, startTransition] = useTransition();

  const markDirty = () => setIsDirty(true);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("orgSlug", orgSlug);
    startTransition(() =>
      onSave(fd).then(() => setIsDirty(false)),
    );
  }

  return (
    <div className="max-w-2xl">
      {/* Page heading */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">{labels.title}</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{labels.subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section A — Business */}
        <section>
          <SectionHeading>{labels.sectionBusiness}</SectionHeading>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="shop-name">{labels.name}</Label>
              <input
                id="shop-name"
                name="name"
                defaultValue={initial.name}
                onChange={markDirty}
                className={INPUT}
              />
            </div>
            <div>
              <Label htmlFor="shop-vat">{labels.vatId}</Label>
              <input
                id="shop-vat"
                name="vatId"
                defaultValue={initial.vatId}
                onChange={markDirty}
                className={INPUT}
              />
            </div>
          </div>
        </section>

        {/* Section B — Contact */}
        <section>
          <SectionHeading>{labels.sectionContact}</SectionHeading>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="shop-phone">{labels.phone}</Label>
              <input
                id="shop-phone"
                name="phone"
                defaultValue={initial.phone}
                onChange={markDirty}
                placeholder="+49 30 12345678"
                className={INPUT}
              />
            </div>
            <div>
              <Label htmlFor="shop-website">{labels.website}</Label>
              <input
                id="shop-website"
                name="website"
                defaultValue={initial.website}
                onChange={markDirty}
                placeholder="https://example.com"
                className={INPUT}
              />
            </div>
          </div>
        </section>

        {/* Section C — Address */}
        <section>
          <SectionHeading>{labels.sectionAddress}</SectionHeading>
          <div className="space-y-4">
            <div>
              <Label htmlFor="shop-street">{labels.street}</Label>
              <input
                id="shop-street"
                name="street"
                defaultValue={initial.street}
                onChange={markDirty}
                placeholder="Musterstraße 1"
                className={INPUT}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="shop-postal">{labels.postal}</Label>
                <input
                  id="shop-postal"
                  name="postal"
                  defaultValue={initial.postal}
                  onChange={markDirty}
                  placeholder="10115"
                  className={INPUT}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="shop-city">{labels.city}</Label>
                <input
                  id="shop-city"
                  name="city"
                  defaultValue={initial.city}
                  onChange={markDirty}
                  placeholder="Berlin"
                  className={INPUT}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="shop-country">{labels.country}</Label>
              <select
                id="shop-country"
                name="country"
                defaultValue={initial.country}
                onChange={markDirty}
                className={SELECT}
              >
                <option value="DE">{labels.countryDe}</option>
                <option value="AT">{labels.countryAt}</option>
                <option value="CH">{labels.countryCh}</option>
              </select>
            </div>
          </div>
        </section>

        {/* Section D — Defaults */}
        <section>
          <SectionHeading>{labels.sectionDefaults}</SectionHeading>
          <div className="max-w-[240px]">
            <Label htmlFor="shop-rate">{labels.defaultRate}</Label>
            <input
              id="shop-rate"
              name="defaultRateEuros"
              type="number"
              min="0"
              step="0.01"
              defaultValue={initial.defaultRateEuros}
              onChange={markDirty}
              className={INPUT}
            />
          </div>
        </section>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={!isDirty || isPending}
            className="rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {labels.save}
          </button>
        </div>
      </form>
    </div>
  );
}
