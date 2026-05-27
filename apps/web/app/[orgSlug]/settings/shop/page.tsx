import { getTranslations } from "next-intl/server";
import { db } from "@uptool/db";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { saveShopProfile } from "./actions";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

interface AddressJsonb {
  street?: string;
  city?: string;
  postal?: string;
  country?: string;
}

function ShopField({
  id,
  name,
  label,
  defaultValue,
  type = "text",
  placeholder,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="w-full rounded border border-[hsl(var(--border))] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
      />
    </div>
  );
}

export default async function ShopSettingsPage({ params }: Props) {
  const { orgSlug } = await params;
  await requireAuth();

  const org = await db.query.orgs.findFirst({ where: (o, { eq }) => eq(o.slug, orgSlug) });
  if (!org) notFound();

  const addr = (org.addressJsonb ?? {}) as AddressJsonb;
  const t = await getTranslations("settings.shop");

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("subtitle")}</p>
      </div>

      <form action={saveShopProfile} className="space-y-5">
        <input type="hidden" name="orgSlug" value={orgSlug} />

        <div className="grid grid-cols-2 gap-4">
          <ShopField id="shop-name" name="name" label={t("name")} defaultValue={org.name} />
          <ShopField id="shop-vat" name="vatId" label={t("vat_id")} defaultValue={org.vatId ?? ""} />
          <ShopField id="shop-phone" name="phone" label={t("phone")} defaultValue={org.phone ?? ""} placeholder="+49 30 12345678" />
          <ShopField id="shop-website" name="website" label={t("website")} defaultValue={org.website ?? ""} placeholder="https://example.com" />
        </div>

        <fieldset className="rounded-md border border-[hsl(var(--border))] p-4 space-y-3">
          <legend className="text-xs font-semibold px-1 text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            Adresse
          </legend>
          <div className="grid grid-cols-1 gap-3">
            <ShopField id="shop-street" name="street" label={t("street")} defaultValue={addr.street} placeholder="Musterstraße 1" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <ShopField id="shop-postal" name="postal" label={t("postal")} defaultValue={addr.postal} placeholder="10115" />
            <div className="col-span-2">
              <ShopField id="shop-city" name="city" label={t("city")} defaultValue={addr.city} placeholder="Berlin" />
            </div>
          </div>
          <ShopField id="shop-country" name="country" label={t("country")} defaultValue={addr.country ?? org.country} />
        </fieldset>

        <div className="max-w-xs">
          <label htmlFor="shop-rate" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
            {t("default_rate")}
          </label>
          <input
            id="shop-rate"
            name="defaultRateEuros"
            type="number"
            min="0"
            step="0.01"
            defaultValue={((org.defaultHourlyRateCents ?? 0) / 100).toFixed(2)}
            className="w-full rounded border border-[hsl(var(--border))] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
        </div>

        <button
          type="submit"
          className="rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-5 py-2 text-sm font-medium hover:opacity-90"
        >
          {t("save")}
        </button>
      </form>
    </div>
  );
}
