import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

// Slugs that are not org slugs and handled by their own routes
export const RESERVED_SLUGS = new Set([
  "api",
  "signin",
  "signup",
  "dev-signin",
  "onboarding",
  "legal",
  "health",
  "_next",
  "static",
  "images",
  "public",
  "admin",
  "docs",
  "help",
  "support",
  "pricing",
  "about",
  "terms",
  "privacy",
]);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  const segments = pathname.split("/").filter(Boolean);
  const potentialSlug = segments[0];

  // Not a tenant route
  if (!potentialSlug || RESERVED_SLUGS.has(potentialSlug)) {
    return NextResponse.next();
  }

  // Tenant routes require authentication
  if (!session?.user?.id) {
    const signInUrl = new URL("/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Pass slug + user id to server components via request headers.
  // The [orgSlug] layout does the DB-side org existence + membership check.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-potential-slug", potentialSlug);
  requestHeaders.set("x-user-id", session.user.id);

  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
