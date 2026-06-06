import { eq, sql } from "drizzle-orm";
import { db, memberships, orgs, seedOrgMaterials, users } from "@uptool/db";
import type { CreateOrgInput, UpdateGeneralSettingsInput } from "@uptool/shared";
import { generateSlug, RESERVED_SLUGS, BRAND, UpdateGeneralSettingsSchema } from "@uptool/shared";

async function findUniqueSlug(base: string): Promise<string> {
  const candidate = generateSlug(base);
  if (!candidate) throw new Error("Could not generate a slug from the org name");

  if (RESERVED_SLUGS.has(candidate)) {
    throw new Error(`"${candidate}" is a reserved slug — choose a different org name`);
  }

  const existing = await db.query.orgs.findFirst({
    where: (o, { eq }) => eq(o.slug, candidate),
  });

  if (!existing) return candidate;

  // Collision: append incrementing suffix
  for (let i = 2; i <= 99; i++) {
    const suffixed = `${candidate.slice(0, 45)}-${i}`;
    const collision = await db.query.orgs.findFirst({
      where: (o, { eq }) => eq(o.slug, suffixed),
    });
    if (!collision) return suffixed;
  }

  throw new Error("Could not find a unique slug after 99 attempts");
}

export const orgService = {
  async create({ userId, name, country, locale }: CreateOrgInput & { userId: string }) {
    const slug = await findUniqueSlug(name);

    return db.transaction(async (tx) => {
      const [org] = await tx
        .insert(orgs)
        .values({
          name,
          slug,
          country,
          localeDefault: locale,
          forwardingAddress: `rfq+${slug}@${BRAND.forwardingDomain}`,
        })
        .returning();

      if (!org) throw new Error("Failed to create org");

      // Set RLS context before inserting membership
      await tx.execute(sql`select set_config('app.org_id', ${org.id}, true)`);

      await tx.insert(memberships).values({
        orgId: org.id,
        userId,
        role: "owner",
      });

      // Update the user's own locale to match what they selected
      await tx.update(users).set({ locale }).where(sql`id = ${userId}::uuid`);

      // Seed the org's materials library with DACH-standard defaults.
      await seedOrgMaterials(tx, org.id);

      return org;
    });
  },

  async updateGeneralSettings(orgId: string, raw: UpdateGeneralSettingsInput) {
    const data = UpdateGeneralSettingsSchema.parse(raw);
    await db
      .update(orgs)
      .set({
        name: data.name,
        vatId: data.vatId ?? null,
        phone: data.phone ?? null,
        website: data.website ?? null,
        country: data.country,
        defaultHourlyRateCents: data.defaultHourlyRateCents,
        addressJsonb: {
          street: data.street ?? undefined,
          postal: data.postal ?? undefined,
          city: data.city ?? undefined,
          country: data.country,
        },
        updatedAt: new Date(),
      })
      .where(eq(orgs.id, orgId));
  },

  async updateLogoUrl(orgId: string, key: string | null) {
    await db
      .update(orgs)
      .set({ logoUrl: key, updatedAt: new Date() })
      .where(eq(orgs.id, orgId));
  },

  async updateProfile(
    orgId: string,
    data: {
      name?: string;
      phone?: string | null;
      website?: string | null;
      vatId?: string | null;
      defaultHourlyRateCents?: number;
      addressJsonb?: { street?: string; city?: string; postal?: string; country?: string } | null;
    },
  ) {
    await db
      .update(orgs)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.website !== undefined && { website: data.website }),
        ...(data.vatId !== undefined && { vatId: data.vatId }),
        ...(data.defaultHourlyRateCents !== undefined && {
          defaultHourlyRateCents: data.defaultHourlyRateCents,
        }),
        ...(data.addressJsonb !== undefined && { addressJsonb: data.addressJsonb }),
        updatedAt: new Date(),
      })
      .where(eq(orgs.id, orgId));
  },
};
