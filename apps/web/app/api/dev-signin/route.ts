import { db } from "@uptool/db";
import { encode } from "next-auth/jwt";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, "owner@acme.test"),
  });
  if (!user) {
    return NextResponse.json(
      { error: "Seed user not found. Run pnpm db:seed first." },
      { status: 500 },
    );
  }

  const membership = await db.query.memberships.findFirst({
    where: (m, { eq }) => eq(m.userId, user.id),
    with: { org: true },
  });

  const org = (membership as unknown as { org: { id: string; slug: string } } | undefined)
    ?.org;

  // Salt must match the cookie name Auth.js uses when decoding sessions
  const cookieName = "authjs.session-token";
  const token = await encode({
    token: {
      sub: user.id,
      email: user.email,
      name: user.name,
      userId: user.id,
      locale: user.locale ?? "de",
      defaultOrgId: org?.id ?? "",
      defaultOrgSlug: org?.slug ?? "",
    },
    secret: process.env.AUTH_SECRET ?? "",
    salt: cookieName,
  });

  const destination = new URL(
    org ? `/${org.slug}/rfqs` : "/onboarding/new-org",
    req.url,
  );

  const res = NextResponse.redirect(destination);
  res.cookies.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // No secure flag — dev runs on HTTP localhost
  });

  return res;
}
