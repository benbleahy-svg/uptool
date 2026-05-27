import { blockList, db } from "@uptool/db";
import { and, eq } from "drizzle-orm";

export const blockListService = {
  async add(orgId: string, value: string): Promise<void> {
    const normalized = value.toLowerCase().trim();
    await db.insert(blockList).values({ orgId, value: normalized }).onConflictDoNothing();
  },

  async remove(orgId: string, id: string): Promise<void> {
    await db.delete(blockList).where(and(eq(blockList.id, id), eq(blockList.orgId, orgId)));
  },

  async findByOrg(orgId: string) {
    return db.query.blockList.findMany({
      where: (b, { eq }) => eq(b.orgId, orgId),
      orderBy: (b, { asc }) => [asc(b.createdAt)],
    });
  },

  async isBlocked(orgId: string, email: string): Promise<boolean> {
    const normalized = email.toLowerCase();
    const domain = `@${normalized.split("@")[1] ?? ""}`;

    const entries = await db.query.blockList.findMany({
      where: (b, { eq }) => eq(b.orgId, orgId),
    });

    return entries.some((e) => e.value === normalized || e.value === domain);
  },
};
