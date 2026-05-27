import { eq } from "drizzle-orm";
import { db, users } from "@uptool/db";

export const userService = {
  async getByEmail(email: string) {
    return db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, email),
    });
  },

  async updateLocale(userId: string, locale: string) {
    const [updated] = await db
      .update(users)
      .set({ locale })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  },
};
