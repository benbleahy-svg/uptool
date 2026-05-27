import type { NextAuthConfig } from "next-auth";

// Edge-safe config — only validates JWT sessions in middleware.
// Providers require the full Node.js auth.ts (DrizzleAdapter, DB connection).
export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    session({ session, token }) {
      // Mirror the mapping from auth.ts so the middleware can read session.user.id
      session.user.id = (token.userId as string | undefined) ?? session.user.id;
      return session;
    },
  },
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
};
