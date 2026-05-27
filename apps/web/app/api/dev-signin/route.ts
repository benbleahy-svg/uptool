import { authVerificationTokens, db } from "@uptool/db";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

async function sha256hex(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const email = "owner@acme.test";
  const secret = process.env.AUTH_SECRET ?? "";
  const rawToken = randomBytes(32).toString("hex");
  const storedToken = await sha256hex(`${rawToken}${secret}`);
  const expires = new Date(Date.now() + 5 * 60 * 1000);

  await db
    .delete(authVerificationTokens)
    .where(eq(authVerificationTokens.identifier, email));

  await db
    .insert(authVerificationTokens)
    .values({ identifier: email, token: storedToken, expires });

  const callbackUrl = encodeURIComponent("/acme/rfqs");
  const destination = new URL(
    `/api/auth/callback/resend?callbackUrl=${callbackUrl}&token=${rawToken}&email=${encodeURIComponent(email)}`,
    req.url,
  );

  return NextResponse.redirect(destination);
}
