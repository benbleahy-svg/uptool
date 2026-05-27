import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import MicrosoftEntraId from "next-auth/providers/microsoft-entra-id";
import Resend from "next-auth/providers/resend";
import {
  authAccounts,
  authSessions,
  authUsers,
  authVerificationTokens,
  db,
  users,
} from "@uptool/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: authUsers,
    accountsTable: authAccounts,
    sessionsTable: authSessions,
    verificationTokensTable: authVerificationTokens,
  }),
  session: { strategy: "jwt" },
  providers: [
    Resend({
      from: process.env.RESEND_FROM_EMAIL ?? "noreply@localhost",
      sendVerificationRequest: async ({ identifier, url }) => {
        // Always log the magic link in dev so local testing never requires a real email
        if (process.env.NODE_ENV === "development") {
          console.log("\n=== MAGIC LINK (dev mode) ===");
          console.log(`To: ${identifier}`);
          console.log(`URL: ${url}`);
          console.log("============================\n");
          if (!process.env.RESEND_API_KEY) return;
        }

        const { Resend: ResendClient } = await import("resend");
        const client = new ResendClient(process.env.RESEND_API_KEY);
        await client.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? "noreply@localhost",
          to: identifier,
          subject: "Sign in to Uptool",
          html: `<a href="${url}">Click here to sign in to Uptool</a>`,
        });
      },
    }),
    Google,
    MicrosoftEntraId({
      issuer: `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID ?? "common"}/v2.0`,
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // On sign-in, user is populated from the auth adapter
      if (user?.email && (trigger === "signIn" || trigger === "signUp")) {
        // Upsert into our app users table
        const email = user.email ?? "";
        const existing = await db.query.users.findFirst({
          where: (u, { eq }) => eq(u.email, email),
        });

        let appUser = existing;
        if (!appUser) {
          const [created] = await db
            .insert(users)
            .values({ email, name: user.name ?? null })
            .returning();
          appUser = created;
        }

        if (!appUser) throw new Error("Failed to create app user");

        token.userId = appUser.id;
        token.locale = appUser.locale;

        // Look up first membership for default org
        const membership = await db.query.memberships.findFirst({
          where: (m, { eq }) => eq(m.userId, appUser?.id),
          with: { org: true },
        });

        if (membership) {
          token.defaultOrgId = membership.orgId;
          const org = (membership as unknown as { org: { slug: string } }).org;
          token.defaultOrgSlug = org?.slug ?? "";
        }
      }

      return token;
    },

    async session({ session, token }) {
      session.user.id = (token.userId as string | undefined) ?? session.user.id;
      // biome-ignore lint/suspicious/noExplicitAny: Auth.js session type is not extensible without module augmentation
      const s = session as any;
      s.defaultOrgId = token.defaultOrgId;
      s.defaultOrgSlug = token.defaultOrgSlug;
      s.locale = token.locale ?? "de";
      return session;
    },
  },
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
});
