import { db } from "@uptool/db";
import { encode } from "next-auth/jwt";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, "owner@acme.test"),
  });
  if (!user) {
    return NextResponse.json({ error: "Seed user not found. Run pnpm db:seed first." }, { status: 500 });
  }

  const membership = await db.query.memberships.findFirst({
    where: (m, { eq }) => eq(m.userId, user.id),
    with: { org: true },
  });

  const org = (membership as unknown as { org: { id: string; slug: string } } | undefined)?.org;

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
    salt: "authjs.session-token",
  });

  const cookieStore = await cookies();
  cookieStore.set("authjs.session-token", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // No secure flag — dev runs on HTTP
  });

  redirect(org ? `/${org.slug}/rfqs` : "/onboarding/new-org");
}
