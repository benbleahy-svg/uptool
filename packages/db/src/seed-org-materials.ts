// DACH-standard default materials library, seeded for every org.
//
// Two seed paths share this list:
//   - existing orgs: the INSERT block in migrations/0028_thin_quentin_quire.sql
//   - new orgs:       seedOrgMaterials() below, called from orgService.create
// Keep the two in sync if the list changes.
//
// Prices default to 0 — configure real €/kg in Settings → Materialien.

import type { Database } from "./client";
import { orgMaterials } from "./schema";

/** A transaction handle (or the db itself) — anything with `.insert`. */
type Executor = Parameters<Parameters<Database["transaction"]>[0]>[0] | Database;

/** name | category | density (g/cm³, as a numeric string). price_eur_per_kg and
 *  is_default are applied uniformly by seedOrgMaterials (0 €/kg, default = true). */
export const DEFAULT_ORG_MATERIALS: ReadonlyArray<{
  name: string;
  category: string;
  densityGCm3: string;
}> = [
  { name: "S235JR", category: "steel", densityGCm3: "7.8500" },
  { name: "S355J2", category: "steel", densityGCm3: "7.8500" },
  { name: "1.4301 (304 SS)", category: "stainless", densityGCm3: "7.9300" },
  { name: "1.4404 (316L SS)", category: "stainless", densityGCm3: "7.9800" },
  { name: "EN AW-6082 T6", category: "aluminium", densityGCm3: "2.7000" },
  { name: "EN AW-5754 H22", category: "aluminium", densityGCm3: "2.6700" },
  { name: "EN AW-7075 T6", category: "aluminium", densityGCm3: "2.8100" },
  { name: "CuZn37 (MS63)", category: "copper", densityGCm3: "8.4400" },
  { name: "PA6 (Nylon)", category: "plastic", densityGCm3: "1.1500" },
  { name: "POM-C", category: "plastic", densityGCm3: "1.4100" },
];

/**
 * Seed the DACH-standard default materials for an org. Idempotent — re-running is a
 * no-op (ON CONFLICT (org_id, name) DO NOTHING), so it never clobbers user edits.
 * Pass the surrounding transaction so it commits atomically with org creation.
 */
export async function seedOrgMaterials(tx: Executor, orgId: string): Promise<void> {
  await tx
    .insert(orgMaterials)
    .values(DEFAULT_ORG_MATERIALS.map((m) => ({ orgId, isDefault: true, ...m })))
    .onConflictDoNothing({ target: [orgMaterials.orgId, orgMaterials.name] });
}
