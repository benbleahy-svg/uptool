import type { NextAuthConfig } from "next-auth";

// Edge-safe config — only validates JWT sessions in middleware.
// Providers require the full Node.js auth.ts (DrizzleAdapter, DB connection).
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  providers: [],
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
};
