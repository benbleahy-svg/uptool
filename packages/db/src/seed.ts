import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { seedOrgMaterials } from "./seed-org-materials";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://uptool:uptool@localhost:5432/uptool";

const client = postgres(connectionString);
const db = drizzle(client, { schema });

async function seed() {
  console.log("Seeding database...");

  const existing = await db.query.orgs.findFirst({
    where: (orgs, { eq }) => eq(orgs.slug, "acme"),
  });

  if (existing) {
    console.log("Already seeded — skipping.");
    await client.end();
    return;
  }

  await db.transaction(async (tx) => {
    const [org] = await tx
      .insert(schema.orgs)
      .values({
        name: "Acme GmbH",
        slug: "acme",
        country: "DE",
        localeDefault: "de",
        timezone: "Europe/Berlin",
        forwardingAddress: "rfq+acme@in.toolup.de",
      })
      .returning();

    if (!org) throw new Error("Failed to insert org");

    const [user] = await tx
      .insert(schema.users)
      .values({
        email: "owner@acme.test",
        name: "Acme Owner",
        locale: "de",
      })
      .returning();

    if (!user) throw new Error("Failed to insert user");

    // set_config with is_local=true is equivalent to SET LOCAL but accepts params
    await tx.execute(sql`select set_config('app.org_id', ${org.id}, true)`);

    await tx.insert(schema.memberships).values({
      orgId: org.id,
      userId: user.id,
      role: "owner",
    });

    await seedOrgMaterials(tx, org.id);

    console.log(`Created org: ${org.name} (slug: ${org.slug})`);
    console.log(`Created user: ${user.email}`);
    console.log("Created membership: owner");
  });

  console.log("Seed complete.");
  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
