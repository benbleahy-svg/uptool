import { db, memberships } from "@uptool/db";
import { and, eq } from "drizzle-orm";

export type OrgMember = {
  userId: string;
  name: string | null;
  email: string;
  avatarInitial: string;
};

export const memberService = {
  async listForOrg(orgId: string): Promise<OrgMember[]> {
    const rows = await db.query.memberships.findMany({
      where: (m, { eq }) => eq(m.orgId, orgId),
      with: { user: true },
    });
    return rows
      .map((m) => ({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        avatarInitial: ((m.user.name ?? m.user.email).split(/[\s@]/)[0]?.[0] ?? "U").toUpperCase(),
      }))
      .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email));
  },

  async findByOrg(orgId: string) {
    return db.query.memberships.findMany({
      where: (m, { eq }) => eq(m.orgId, orgId),
      with: { user: true },
      orderBy: (m, { asc }) => [asc(m.createdAt)],
    });
  },

  async add(orgId: string, email: string, role: "owner" | "estimator" | "office") {
    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, email.toLowerCase()),
    });
    if (!user) throw new Error("USER_NOT_FOUND");

    const existing = await db.query.memberships.findFirst({
      where: (m, { and, eq }) => and(eq(m.orgId, orgId), eq(m.userId, user.id)),
    });
    if (existing) throw new Error("ALREADY_MEMBER");

    await db.insert(memberships).values({ orgId, userId: user.id, role });
    return user;
  },

  async remove(orgId: string, userId: string) {
    await db.delete(memberships).where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
  },

  async updateRole(orgId: string, userId: string, role: "owner" | "estimator" | "office") {
    await db
      .update(memberships)
      .set({ role })
      .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
  },
};
